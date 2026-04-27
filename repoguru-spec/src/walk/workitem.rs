use gix::ObjectId;

use crate::cli::MergePolicy;
use crate::error::ScanError;

/// Zero OID used for root commits (no parent).
pub const ZERO_OID: ObjectId = ObjectId::null(gix::hash::Kind::Sha1);

/// A unit of work for the diff pipeline (§5.2).
#[derive(Debug, Clone)]
pub struct WorkItem {
    /// Monotonically increasing sequence number for ordering.
    pub seq: u64,
    /// The commit being analyzed.
    pub commit_oid: ObjectId,
    /// The parent to diff against (ZERO_OID for root commits).
    pub parent_oid: ObjectId,
    /// Total number of parents this commit has.
    pub parents_count: u8,
    /// Whether this commit is a merge (2+ parents).
    pub is_merge: bool,
}

/// Expand a deterministic commit list into WorkItems based on merge policy (§5.2).
///
/// - `first-parent`: one WorkItem per commit, diffing against parent[0] (or ZERO_OID for root).
/// - `all-parents`: one WorkItem per parent edge; root still gets one WorkItem with ZERO_OID.
pub fn expand_to_workitems(
    commits: &[ObjectId],
    repo: &gix::Repository,
    policy: MergePolicy,
) -> Result<Vec<WorkItem>, ScanError> {
    let mut items = Vec::new();
    let mut seq: u64 = 0;

    for &commit_oid in commits {
        let object = repo.find_object(commit_oid).map_err(|e| {
            ScanError::ScanFailed(format!("failed to find commit {commit_oid}: {e}"))
        })?;
        let commit = object.try_into_commit().map_err(|e| {
            ScanError::ScanFailed(format!("failed to parse commit {commit_oid}: {e}"))
        })?;

        let parent_ids: Vec<ObjectId> = commit.parent_ids().map(|p| p.detach()).collect();
        let parents_count = parent_ids.len() as u8;
        let is_merge = parents_count >= 2;

        match policy {
            MergePolicy::FirstParent => {
                let parent_oid = parent_ids.first().copied().unwrap_or(ZERO_OID);
                items.push(WorkItem {
                    seq,
                    commit_oid,
                    parent_oid,
                    parents_count,
                    is_merge,
                });
                seq += 1;
            }
            MergePolicy::AllParents => {
                if parent_ids.is_empty() {
                    // Root commit
                    items.push(WorkItem {
                        seq,
                        commit_oid,
                        parent_oid: ZERO_OID,
                        parents_count: 0,
                        is_merge: false,
                    });
                    seq += 1;
                } else {
                    for parent_oid in &parent_ids {
                        items.push(WorkItem {
                            seq,
                            commit_oid,
                            parent_oid: *parent_oid,
                            parents_count,
                            is_merge,
                        });
                        seq += 1;
                    }
                }
            }
        }
    }

    Ok(items)
}
