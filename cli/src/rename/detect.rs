use std::collections::BTreeSet;

use gix::Repository;

use crate::error::ScanError;
use crate::model::change::RawChange;
use crate::rename::similarity::{line_hashes, similarity_score};
use crate::walk::workitem::ZERO_OID;

/// A matched rename pair.
#[derive(Debug)]
pub struct RenamePair {
    pub old_idx: usize,
    pub new_idx: usize,
    pub score: u16,
}

/// A matched copy pair.
#[derive(Debug)]
pub struct CopyPair {
    pub old_idx: usize,
    pub new_idx: usize,
    pub score: u16,
}

/// Detect renames among deleted and added files within a single commit.
/// Returns pairs sorted by (score desc, old_path asc, new_path asc).
/// Each file can only participate in one rename.
pub fn detect_renames(
    deletes: &[&RawChange],
    adds: &[&RawChange],
    repo: &Repository,
    threshold: u16,
) -> Result<Vec<RenamePair>, ScanError> {
    if deletes.is_empty() || adds.is_empty() {
        return Ok(Vec::new());
    }

    // Precompute line hashes for all candidates
    let del_hashes: Vec<Vec<u64>> = deletes
        .iter()
        .map(|c| blob_line_hashes(repo, c.old_oid))
        .collect::<Result<_, _>>()?;

    let add_hashes: Vec<Vec<u64>> = adds
        .iter()
        .map(|c| blob_line_hashes(repo, c.new_oid))
        .collect::<Result<_, _>>()?;

    // Build all candidate edges
    let mut edges: Vec<(u16, usize, usize)> = Vec::new();
    for (di, dh) in del_hashes.iter().enumerate() {
        for (ai, ah) in add_hashes.iter().enumerate() {
            let score = similarity_score(dh, ah);
            if score >= threshold {
                edges.push((score, di, ai));
            }
        }
    }

    // Sort: score desc, old_path asc, new_path asc
    edges.sort_by(|a, b| {
        b.0.cmp(&a.0)
            .then_with(|| deletes[a.1].path.cmp(&deletes[b.1].path))
            .then_with(|| adds[a.2].path.cmp(&adds[b.2].path))
    });

    // Greedy match
    let mut used_del = BTreeSet::new();
    let mut used_add = BTreeSet::new();
    let mut pairs = Vec::new();

    for (score, di, ai) in edges {
        if !used_del.contains(&di) && !used_add.contains(&ai) {
            used_del.insert(di);
            used_add.insert(ai);
            pairs.push(RenamePair {
                old_idx: di,
                new_idx: ai,
                score,
            });
        }
    }

    Ok(pairs)
}

/// Detect copies: for remaining (unmatched) adds, find best match among all old files
/// within size ratio window [0.5, 2.0].
pub fn detect_copies(
    remaining_adds: &[&RawChange],
    all_old: &[&RawChange],
    repo: &Repository,
    threshold: u16,
) -> Result<Vec<CopyPair>, ScanError> {
    if remaining_adds.is_empty() || all_old.is_empty() {
        return Ok(Vec::new());
    }

    // Precompute line hashes for old files
    let old_hashes: Vec<Vec<u64>> = all_old
        .iter()
        .map(|c| blob_line_hashes(repo, c.old_oid))
        .collect::<Result<_, _>>()?;

    let add_hashes: Vec<Vec<u64>> = remaining_adds
        .iter()
        .map(|c| blob_line_hashes(repo, c.new_oid))
        .collect::<Result<_, _>>()?;

    let mut copies = Vec::new();

    for (ai, ah) in add_hashes.iter().enumerate() {
        let mut best: Option<(u16, usize)> = None;

        for (oi, oh) in old_hashes.iter().enumerate() {
            // Size ratio window [0.5, 2.0]
            let old_len = oh.len();
            let new_len = ah.len();
            if old_len == 0 && new_len == 0 {
                continue;
            }
            if old_len > 0 && new_len > 0 {
                let ratio = new_len as f64 / old_len as f64;
                if !(0.5..=2.0).contains(&ratio) {
                    continue;
                }
            }

            let score = similarity_score(oh, ah);
            if score >= threshold {
                if let Some((best_score, best_oi)) = best {
                    if score > best_score
                        || (score == best_score && all_old[oi].path < all_old[best_oi].path)
                    {
                        best = Some((score, oi));
                    }
                } else {
                    best = Some((score, oi));
                }
            }
        }

        if let Some((score, oi)) = best {
            copies.push(CopyPair {
                old_idx: oi,
                new_idx: ai,
                score,
            });
        }
    }

    Ok(copies)
}

fn blob_line_hashes(repo: &Repository, oid: gix::ObjectId) -> Result<Vec<u64>, ScanError> {
    if oid == ZERO_OID {
        return Ok(Vec::new());
    }
    let data = repo
        .find_object(oid)
        .map(|o| o.data.to_vec())
        .unwrap_or_default();
    Ok(line_hashes(&data))
}
