use std::collections::BTreeMap;

use crate::model::rename_event::RenameEvent;

/// Compute file entity IDs by propagating through renames (§10).
/// Returns path_id → entity_id mapping.
/// Uses union-find to merge renamed paths into the same entity.
pub fn compute_file_entities(all_path_ids: &[u32], renames: &[RenameEvent]) -> BTreeMap<u32, u32> {
    // Union-Find
    let mut parent: BTreeMap<u32, u32> = BTreeMap::new();

    // Initialize: each path is its own entity
    for &pid in all_path_ids {
        parent.entry(pid).or_insert(pid);
    }

    // Union rename pairs
    for re in renames {
        if re.is_copy != 0 {
            continue; // Copies don't merge entities
        }
        parent.entry(re.old_path_id).or_insert(re.old_path_id);
        parent.entry(re.new_path_id).or_insert(re.new_path_id);

        let root_old = find(&parent, re.old_path_id);
        let root_new = find(&parent, re.new_path_id);
        if root_old != root_new {
            // Union: smaller root becomes parent (deterministic)
            let (smaller, larger) = if root_old < root_new {
                (root_old, root_new)
            } else {
                (root_new, root_old)
            };
            // We need mutable access - rebuild after
            parent.insert(larger, smaller);
        }
    }

    // Path compress and build result
    let keys: Vec<u32> = parent.keys().copied().collect();
    let mut result: BTreeMap<u32, u32> = BTreeMap::new();
    for pid in keys {
        result.insert(pid, find(&parent, pid));
    }
    result
}

fn find(parent: &BTreeMap<u32, u32>, mut x: u32) -> u32 {
    while let Some(&p) = parent.get(&x) {
        if p == x {
            break;
        }
        x = p;
    }
    x
}
