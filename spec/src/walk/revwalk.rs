use std::collections::BTreeSet;

use gix::ObjectId;

use crate::error::ScanError;

/// Metadata for a commit used in deterministic sorting.
struct CommitMeta {
    oid: ObjectId,
    committer_time: i64,
    parent_oids: Vec<ObjectId>,
}

/// Perform a deterministic topological walk over all reachable commits (§5.1).
///
/// Ordering: topological (parents before children), with tie-breaking by
/// committer timestamp (ascending) then OID bytes (lexicographic).
///
/// Returns commits in deterministic order (oldest/root first).
pub fn deterministic_walk(
    repo: &gix::Repository,
    tips: &[ObjectId],
) -> Result<Vec<ObjectId>, ScanError> {
    if tips.is_empty() {
        return Ok(Vec::new());
    }

    // Collect all reachable commits using BFS/DFS — read each commit ONCE
    let mut visited = BTreeSet::new();
    let mut stack: Vec<ObjectId> = tips.to_vec();
    let mut metas: Vec<CommitMeta> = Vec::new();

    while let Some(oid) = stack.pop() {
        if !visited.insert(oid) {
            continue;
        }

        let object = repo
            .find_object(oid)
            .map_err(|e| ScanError::ScanFailed(format!("failed to find object {oid}: {e}")))?;

        if object.kind != gix::object::Kind::Commit {
            continue;
        }

        let commit = object
            .try_into_commit()
            .map_err(|e| ScanError::ScanFailed(format!("failed to parse commit {oid}: {e}")))?;

        let committer_sig = commit.committer().map_err(|e| {
            ScanError::ScanFailed(format!("failed to get committer for {oid}: {e}"))
        })?;
        let committer_time = committer_sig.time().map(|t| t.seconds).unwrap_or(0);

        // Store parent OIDs now to avoid re-reading commits later
        let parent_oids: Vec<ObjectId> = commit.parent_ids().map(|p| p.detach()).collect();

        for &pid in &parent_oids {
            if !visited.contains(&pid) {
                stack.push(pid);
            }
        }

        metas.push(CommitMeta {
            oid,
            committer_time,
            parent_oids,
        });
    }

    // Topological sort: Kahn's algorithm (using stored parent_oids, no re-reads)
    let oid_to_idx: std::collections::HashMap<ObjectId, usize> =
        metas.iter().enumerate().map(|(i, m)| (m.oid, i)).collect();

    let n = metas.len();
    let mut in_degree = vec![0u32; n];
    let mut children: Vec<Vec<usize>> = vec![Vec::new(); n];

    for i in 0..n {
        for pid in &metas[i].parent_oids {
            if let Some(&parent_idx) = oid_to_idx.get(pid) {
                children[parent_idx].push(i);
                in_degree[i] += 1;
            }
        }
    }

    // Initialize with root commits (in_degree == 0)
    let mut frontier: BTreeSet<(i64, ObjectId, usize)> = BTreeSet::new();
    for i in 0..n {
        if in_degree[i] == 0 {
            frontier.insert((metas[i].committer_time, metas[i].oid, i));
        }
    }

    let mut result = Vec::with_capacity(n);

    while let Some(&(_, _, idx)) = frontier.iter().next() {
        frontier.remove(&(metas[idx].committer_time, metas[idx].oid, idx));
        result.push(metas[idx].oid);

        for &child_idx in &children[idx] {
            in_degree[child_idx] -= 1;
            if in_degree[child_idx] == 0 {
                frontier.insert((
                    metas[child_idx].committer_time,
                    metas[child_idx].oid,
                    child_idx,
                ));
            }
        }
    }

    assert_eq!(
        result.len(),
        n,
        "topological sort should include all commits"
    );

    Ok(result)
}
