use std::collections::{BTreeMap, HashMap, HashSet};
use std::sync::Arc;

use gix::ObjectId;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};

use crate::error::ScanError;
use crate::telemetry::ScanLog;

/// Object type keys for counts/bytes maps.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ObjectType {
    Blob,
    Tree,
    Commit,
    Tag,
}

/// Repository-level metrics (§7).
#[derive(Debug, Serialize, Deserialize)]
pub struct RepoMetrics {
    pub object_counts: BTreeMap<ObjectType, u64>,
    pub total_bytes: BTreeMap<ObjectType, u64>,
    pub total_tree_entries: u64,
    pub largest_blobs: Vec<(String, u64)>, // (oid hex, size)
    pub largest_trees: Vec<(String, u64)>, // (oid hex, entry count)
    pub largest_commit: (String, u64),     // (oid hex, size bytes)
    pub deepest_path: (String, u32),
    pub longest_name: (String, u32),
    pub longest_path: (String, u32),      // full path length in bytes
    pub largest_directory: (String, u32), // (path, entry count)
    pub max_parents: u32,
    pub max_tag_depth: u32,
    pub merge_count: u64,
    pub max_history_depth: u64,
    pub oldest_commit: i64,
    pub newest_commit: i64,
    // Biggest checkout stats (from tip tree walk)
    pub checkout_num_files: u64,
    pub checkout_num_dirs: u64,
    pub checkout_total_size: u64,
    pub checkout_num_symlinks: u64,
    pub checkout_num_submodules: u64,
    // Reference counts
    pub ref_count: u64,
    pub branch_count: u64,
    pub tag_ref_count: u64,
}

/// Partial results from processing a chunk of objects (for parallel merge).
struct ChunkResult {
    counts: BTreeMap<ObjectType, u64>,
    bytes: BTreeMap<ObjectType, u64>,
    total_tree_entries: u64,
    top_blobs: Vec<(u64, String)>,
    top_trees: Vec<(u64, String)>,
    largest_commit: (String, u64),
    max_parents: u32,
    max_tag_depth: u32,
    merge_count: u64,
    oldest_commit: i64,
    newest_commit: i64,
    commit_parents: HashMap<ObjectId, Vec<ObjectId>>,
    blob_sizes: HashMap<ObjectId, u64>,
}

impl ChunkResult {
    fn new() -> Self {
        Self {
            counts: BTreeMap::new(),
            bytes: BTreeMap::new(),
            total_tree_entries: 0,
            top_blobs: Vec::new(),
            top_trees: Vec::new(),
            largest_commit: (String::new(), 0),
            max_parents: 0,
            max_tag_depth: 0,
            merge_count: 0,
            oldest_commit: i64::MAX,
            newest_commit: i64::MIN,
            commit_parents: HashMap::new(),
            blob_sizes: HashMap::new(),
        }
    }

    fn merge(mut self, other: Self) -> Self {
        for (k, v) in other.counts {
            *self.counts.entry(k).or_insert(0) += v;
        }
        for (k, v) in other.bytes {
            *self.bytes.entry(k).or_insert(0) += v;
        }
        self.total_tree_entries += other.total_tree_entries;
        self.top_blobs.extend(other.top_blobs);
        self.top_trees.extend(other.top_trees);
        if other.largest_commit.1 > self.largest_commit.1 {
            self.largest_commit = other.largest_commit;
        }
        if other.max_parents > self.max_parents {
            self.max_parents = other.max_parents;
        }
        if other.max_tag_depth > self.max_tag_depth {
            self.max_tag_depth = other.max_tag_depth;
        }
        self.merge_count += other.merge_count;
        if other.oldest_commit < self.oldest_commit {
            self.oldest_commit = other.oldest_commit;
        }
        if other.newest_commit > self.newest_commit {
            self.newest_commit = other.newest_commit;
        }
        self.commit_parents.extend(other.commit_parents);
        self.blob_sizes.extend(other.blob_sizes);
        self
    }
}

/// Compute repo-level size metrics using parallel ODB scanning.
///
/// Phase 1: Collect all OIDs from pack index (sequential, fast).
/// Phase 2: Process objects in parallel chunks using rayon.
/// Phase 3: Walk tip trees for shape + checkout metrics.
/// Phase 4: Compute max history depth from collected parent graph.
#[allow(clippy::too_many_arguments)]
pub fn compute_repo_metrics(
    repo: &gix::Repository,
    tips: &[ObjectId],
    max_top: usize,
    log: &Arc<ScanLog>,
    ref_count: u64,
    branch_count: u64,
    tag_ref_count: u64,
    sizer_chunk_size: usize,
    sizer_cache_bytes: usize,
) -> Result<RepoMetrics, ScanError> {
    // Phase 1: Collect all OIDs (fast — just reads pack index)
    let iter = repo
        .objects
        .iter()
        .map_err(|e| ScanError::ScanFailed(format!("failed to iterate objects: {e}")))?;

    let oids: Vec<ObjectId> = iter.filter_map(|r| r.ok()).collect();
    let obj_count = oids.len() as u64;
    log.progress(&format!(
        "[sizer] {} objects found, processing in parallel...",
        obj_count
    ));

    // Phase 2: Process objects in parallel using rayon
    let repo_path = repo.path().to_path_buf();
    let result = oids
        .par_chunks(sizer_chunk_size)
        .map(|chunk| {
            // Each rayon task opens its own repo handle
            let mut r = match gix::open(&repo_path) {
                Ok(r) => r,
                Err(_) => return ChunkResult::new(),
            };
            r.object_cache_size_if_unset(sizer_cache_bytes);

            let mut cr = ChunkResult::new();
            for &oid in chunk {
                let header = match r.find_header(oid) {
                    Ok(h) => h,
                    Err(_) => continue,
                };
                let size = header.size();

                match header.kind() {
                    gix::object::Kind::Blob => {
                        *cr.counts.entry(ObjectType::Blob).or_insert(0) += 1;
                        *cr.bytes.entry(ObjectType::Blob).or_insert(0) += size;
                        cr.blob_sizes.insert(oid, size);
                        insert_top_n(&mut cr.top_blobs, max_top, size, oid);
                    }
                    gix::object::Kind::Tree => {
                        *cr.counts.entry(ObjectType::Tree).or_insert(0) += 1;
                        *cr.bytes.entry(ObjectType::Tree).or_insert(0) += size;

                        if let Ok(obj) = r.find_object(oid) {
                            let data = obj.data.to_vec();
                            if let Ok(tree) = gix::objs::TreeRef::from_bytes(&data) {
                                let entry_count = tree.entries.len() as u64;
                                cr.total_tree_entries += entry_count;
                                insert_top_n(&mut cr.top_trees, max_top, entry_count, oid);
                            }
                        }
                    }
                    gix::object::Kind::Commit => {
                        *cr.counts.entry(ObjectType::Commit).or_insert(0) += 1;
                        *cr.bytes.entry(ObjectType::Commit).or_insert(0) += size;

                        if size > cr.largest_commit.1 {
                            cr.largest_commit = (oid.to_hex().to_string(), size);
                        }

                        if let Ok(obj) = r.find_object(oid) {
                            if let Ok(commit) = obj.try_into_commit() {
                                let pids: Vec<ObjectId> =
                                    commit.parent_ids().map(|p| p.detach()).collect();
                                let parent_count = pids.len() as u32;
                                if parent_count > cr.max_parents {
                                    cr.max_parents = parent_count;
                                }
                                if parent_count > 1 {
                                    cr.merge_count += 1;
                                }
                                cr.commit_parents.insert(oid, pids);

                                if let Ok(author) = commit.author() {
                                    if let Ok(time) = author.time() {
                                        let ts = time.seconds;
                                        if ts < cr.oldest_commit {
                                            cr.oldest_commit = ts;
                                        }
                                        if ts > cr.newest_commit {
                                            cr.newest_commit = ts;
                                        }
                                    }
                                }
                            }
                        }
                    }
                    gix::object::Kind::Tag => {
                        *cr.counts.entry(ObjectType::Tag).or_insert(0) += 1;
                        *cr.bytes.entry(ObjectType::Tag).or_insert(0) += size;

                        let mut depth: u32 = 1;
                        let mut target = oid;
                        while let Ok(obj) = r.find_object(target) {
                            if let Ok(tag) = gix::objs::TagRef::from_bytes(&obj.data) {
                                if tag.target_kind == gix::object::Kind::Tag {
                                    depth += 1;
                                    target = tag.target();
                                    continue;
                                }
                            }
                            break;
                        }
                        if depth > cr.max_tag_depth {
                            cr.max_tag_depth = depth;
                        }
                    }
                }
            }
            cr
        })
        .reduce(ChunkResult::new, ChunkResult::merge);

    log.log(&format!("[sizer] {} objects scanned. Done.", obj_count));

    // Trim top-N after merging parallel results
    let mut top_blobs = result.top_blobs;
    top_blobs.sort_by(|a, b| b.0.cmp(&a.0));
    top_blobs.truncate(max_top);

    let mut top_trees = result.top_trees;
    top_trees.sort_by(|a, b| b.0.cmp(&a.0));
    top_trees.truncate(max_top);

    let mut oldest_commit = result.oldest_commit;
    let mut newest_commit = result.newest_commit;
    if oldest_commit == i64::MAX {
        oldest_commit = 0;
    }
    if newest_commit == i64::MIN {
        newest_commit = 0;
    }

    // Phase 3: Walk tip trees for shape + checkout metrics
    let mut deepest_path: (String, u32) = (String::new(), 0);
    let mut longest_name: (String, u32) = (String::new(), 0);
    let mut longest_path: (String, u32) = (String::new(), 0);
    let mut largest_dir: (String, u32) = (String::new(), 0);
    let mut best_checkout_files: u64 = 0;
    let mut best_checkout_dirs: u64 = 0;
    let mut best_checkout_size: u64 = 0;
    let mut best_checkout_symlinks: u64 = 0;
    let mut best_checkout_submodules: u64 = 0;

    // Collect unique root trees from tips
    let mut root_trees: Vec<ObjectId> = Vec::new();
    let mut seen_trees: HashSet<ObjectId> = HashSet::new();
    for tip in tips {
        if let Ok(obj) = repo.find_object(*tip) {
            if let Ok(commit) = obj.try_into_commit() {
                if let Ok(tree_id) = commit.tree_id() {
                    let tid = tree_id.detach();
                    if seen_trees.insert(tid) {
                        root_trees.push(tid);
                    }
                }
            }
        }
    }

    // Walk trees — shared visited set for shape, per-root for checkout
    let mut visited_trees: HashSet<ObjectId> = HashSet::new();

    for root_tree in &root_trees {
        let mut co_files: u64 = 0;
        let mut co_dirs: u64 = 0;
        let mut co_size: u64 = 0;
        let mut co_symlinks: u64 = 0;
        let mut co_submodules: u64 = 0;

        let mut co_visited: HashSet<ObjectId> = HashSet::new();
        let mut stack: Vec<(ObjectId, String, u32)> = vec![(*root_tree, String::new(), 0)];

        while let Some((tree_oid, prefix, depth)) = stack.pop() {
            if !co_visited.insert(tree_oid) {
                continue;
            }
            let first_global_visit = visited_trees.insert(tree_oid);

            let obj = match repo.find_object(tree_oid) {
                Ok(o) => o,
                Err(_) => continue,
            };
            let data = obj.data.to_vec();
            let tree = match gix::objs::TreeRef::from_bytes(&data) {
                Ok(t) => t,
                Err(_) => continue,
            };

            co_dirs += 1;
            let dir_entry_count = tree.entries.len() as u32;
            let dir_path = if prefix.is_empty() {
                "/".to_string()
            } else {
                prefix.clone()
            };
            if dir_entry_count > largest_dir.1 {
                largest_dir = (dir_path, dir_entry_count);
            }

            for entry in &tree.entries {
                let name = String::from_utf8_lossy(entry.filename).to_string();
                let full_path = if prefix.is_empty() {
                    name.clone()
                } else {
                    format!("{prefix}/{name}")
                };

                if first_global_visit {
                    let name_len = name.len() as u32;
                    if name_len > longest_name.1 {
                        longest_name = (name.clone(), name_len);
                    }
                    let path_len = full_path.len() as u32;
                    if path_len > longest_path.1 {
                        longest_path = (full_path.clone(), path_len);
                    }
                    let entry_depth = depth + 1;
                    if entry_depth > deepest_path.1 {
                        deepest_path = (full_path.clone(), entry_depth);
                    }
                }

                let mode_val = entry.mode.value() as u32;
                if entry.mode.is_tree() {
                    stack.push((entry.oid.into(), full_path, depth + 1));
                } else if mode_val == 0o120000 {
                    co_symlinks += 1;
                    co_files += 1;
                } else if mode_val == 0o160000 {
                    co_submodules += 1;
                } else {
                    co_files += 1;
                    let blob_oid: ObjectId = entry.oid.into();
                    if let Some(&sz) = result.blob_sizes.get(&blob_oid) {
                        co_size += sz;
                    }
                }
            }
        }

        if co_files > best_checkout_files {
            best_checkout_files = co_files;
        }
        if co_dirs > best_checkout_dirs {
            best_checkout_dirs = co_dirs;
        }
        if co_size > best_checkout_size {
            best_checkout_size = co_size;
        }
        if co_symlinks > best_checkout_symlinks {
            best_checkout_symlinks = co_symlinks;
        }
        if co_submodules > best_checkout_submodules {
            best_checkout_submodules = co_submodules;
        }
    }

    // Phase 4: Compute max history depth
    let max_history_depth = compute_max_depth_from_parents(&result.commit_parents);

    Ok(RepoMetrics {
        object_counts: result.counts,
        total_bytes: result.bytes,
        total_tree_entries: result.total_tree_entries,
        largest_blobs: top_blobs.into_iter().map(|(s, h)| (h, s)).collect(),
        largest_trees: top_trees.into_iter().map(|(s, h)| (h, s)).collect(),
        largest_commit: result.largest_commit,
        deepest_path,
        longest_name,
        longest_path,
        largest_directory: largest_dir,
        max_parents: result.max_parents,
        max_tag_depth: result.max_tag_depth,
        merge_count: result.merge_count,
        max_history_depth,
        oldest_commit,
        newest_commit,
        checkout_num_files: best_checkout_files,
        checkout_num_dirs: best_checkout_dirs,
        checkout_total_size: best_checkout_size,
        checkout_num_symlinks: best_checkout_symlinks,
        checkout_num_submodules: best_checkout_submodules,
        ref_count,
        branch_count,
        tag_ref_count,
    })
}

/// Compute max history depth from a pre-collected parent map.
fn compute_max_depth_from_parents(parents_map: &HashMap<ObjectId, Vec<ObjectId>>) -> u64 {
    let mut depths: HashMap<ObjectId, u64> = HashMap::with_capacity(parents_map.len());
    let mut max_depth: u64 = 0;

    for oid in parents_map.keys().copied().collect::<Vec<_>>() {
        let mut stack = vec![(oid, false)];
        while let Some((current, processed)) = stack.pop() {
            if depths.contains_key(&current) {
                continue;
            }
            if processed {
                let d = if let Some(parents) = parents_map.get(&current) {
                    parents
                        .iter()
                        .filter_map(|p| depths.get(p))
                        .max()
                        .copied()
                        .unwrap_or(0)
                        + 1
                } else {
                    1
                };
                depths.insert(current, d);
                if d > max_depth {
                    max_depth = d;
                }
            } else {
                stack.push((current, true));
                if let Some(parents) = parents_map.get(&current) {
                    for p in parents {
                        if !depths.contains_key(p) {
                            stack.push((*p, false));
                        }
                    }
                }
            }
        }
    }

    max_depth
}

fn insert_top_n(top: &mut Vec<(u64, String)>, max: usize, size: u64, oid: ObjectId) {
    let hex = oid.to_hex().to_string();
    if top.len() < max {
        top.push((size, hex));
    } else if let Some(min) = top.iter().min_by_key(|x| x.0) {
        if size > min.0 {
            let min_val = min.0;
            let min_hex = min.1.clone();
            if let Some(pos) = top.iter().position(|x| x.0 == min_val && x.1 == min_hex) {
                top[pos] = (size, hex);
            }
        }
    }
}
