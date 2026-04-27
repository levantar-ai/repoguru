use std::collections::BTreeSet;

use gix::ObjectId;

use crate::error::ScanError;

/// Collect all commit tip OIDs from repository refs (§4.4).
///
/// Always includes HEAD and local branches.
/// Includes remote refs if `include_remotes` is true.
/// Peels annotated tags to their target commits.
/// Returns a sorted, deduplicated Vec of commit OIDs.
pub fn collect_tips(
    repo: &gix::Repository,
    include_remotes: bool,
) -> Result<Vec<ObjectId>, ScanError> {
    let mut tips = BTreeSet::new();

    // Collect HEAD
    if let Ok(head) = repo.head_id() {
        if let Ok(oid) = peel_to_commit(repo, head.detach()) {
            tips.insert(oid);
        }
    }

    // Iterate all references
    let refs = repo
        .references()
        .map_err(|e| ScanError::ScanFailed(format!("failed to enumerate refs: {e}")))?;

    let all_refs = refs
        .all()
        .map_err(|e| ScanError::ScanFailed(format!("failed to iterate refs: {e}")))?;

    for reference in all_refs.flatten() {
        let name = reference.name().as_bstr().to_string();

        // Filter by ref type
        let dominated = name.starts_with("refs/heads/")
            || name.starts_with("refs/tags/")
            || (include_remotes && name.starts_with("refs/remotes/"));

        if !dominated {
            continue;
        }

        // Skip symbolic refs (e.g. HEAD -> refs/heads/main); use try_id() to avoid panic
        let oid = match reference.try_id() {
            Some(id) => id.detach(),
            None => continue,
        };
        if let Ok(commit_oid) = peel_to_commit(repo, oid) {
            tips.insert(commit_oid);
        }
    }

    Ok(tips.into_iter().collect())
}

/// Count references by type: (total, branches, tags).
pub fn count_refs(repo: &gix::Repository) -> (u64, u64, u64) {
    let refs = match repo.references() {
        Ok(r) => r,
        Err(_) => return (0, 0, 0),
    };
    let all = match refs.all() {
        Ok(a) => a,
        Err(_) => return (0, 0, 0),
    };

    let mut total: u64 = 0;
    let mut branches: u64 = 0;
    let mut tags: u64 = 0;

    for reference in all.flatten() {
        total += 1;
        let name = reference.name().as_bstr().to_string();
        if name.starts_with("refs/heads/") {
            branches += 1;
        } else if name.starts_with("refs/tags/") {
            tags += 1;
        }
    }

    (total, branches, tags)
}

/// Tag metadata for report visualization.
#[derive(Debug, Clone)]
pub struct TagInfo {
    pub name: String,
    pub commit_oid: ObjectId,
    pub timestamp: i64, // committer timestamp of the tagged commit
}

/// Collect tag names, their target commit OIDs, and commit timestamps.
pub fn collect_tag_info(repo: &gix::Repository) -> Vec<TagInfo> {
    let mut tags = Vec::new();
    let refs = match repo.references() {
        Ok(r) => r,
        Err(_) => return tags,
    };
    let all = match refs.all() {
        Ok(a) => a,
        Err(_) => return tags,
    };

    for reference in all.flatten() {
        let name = reference.name().as_bstr().to_string();
        if !name.starts_with("refs/tags/") {
            continue;
        }
        let short_name = name.strip_prefix("refs/tags/").unwrap_or(&name).to_string();
        let oid = match reference.try_id() {
            Some(id) => id.detach(),
            None => continue,
        };
        if let Ok(commit_oid) = peel_to_commit(repo, oid) {
            // Get commit timestamp
            let ts = (|| -> Option<i64> {
                let obj = repo.find_object(commit_oid).ok()?;
                let commit = obj.try_into_commit().ok()?;
                let sig = commit.committer().ok()?;
                let time = sig.time().ok()?;
                Some(time.seconds)
            })()
            .unwrap_or(0);
            tags.push(TagInfo {
                name: short_name,
                commit_oid,
                timestamp: ts,
            });
        }
    }
    tags.sort_by_key(|t| t.timestamp);
    tags
}

/// Peel an OID to a commit, following tag chains.
fn peel_to_commit(repo: &gix::Repository, oid: ObjectId) -> Result<ObjectId, ScanError> {
    let object = repo
        .find_object(oid)
        .map_err(|e| ScanError::ScanFailed(format!("failed to find object {oid}: {e}")))?;

    match object.kind {
        gix::object::Kind::Commit => Ok(oid),
        gix::object::Kind::Tag => {
            // Peel tag to its target
            let tag = object
                .try_into_tag()
                .map_err(|e| ScanError::ScanFailed(format!("failed to parse tag {oid}: {e}")))?;
            let target = tag.target_id().map_err(|e| {
                ScanError::ScanFailed(format!("failed to get tag target for {oid}: {e}"))
            })?;
            // Recurse to handle chained tags (with implicit depth limit from gix objects)
            peel_to_commit(repo, target.detach())
        }
        _ => Err(ScanError::ScanFailed(format!(
            "ref points to unexpected object type {:?} for {oid}",
            object.kind
        ))),
    }
}
