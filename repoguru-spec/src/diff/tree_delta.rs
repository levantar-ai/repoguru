use std::collections::VecDeque;

use gix::bstr::{BStr, BString, ByteSlice, ByteVec};
use gix::ObjectId;

use crate::error::ScanError;
use crate::model::change::{ChangeKind, RawChange};

/// Zero OID for missing blobs.
const ZERO_OID: ObjectId = ObjectId::null(gix::hash::Kind::Sha1);

/// Compute the delta between two trees using gix's low-level tree diff (§8.1).
///
/// Uses `gix_diff::tree()` which walks both trees breadth-first,
/// only recursing into subtrees that differ.
///
/// `max_changes`: if > 0, bail out early once this many changes are seen.
/// Returns (changes, truncated). If truncated, the change list is incomplete.
pub fn compute_tree_delta(
    repo: &gix::Repository,
    old_tree: Option<ObjectId>,
    new_tree: ObjectId,
) -> Result<Vec<RawChange>, ScanError> {
    compute_tree_delta_with_limit(repo, old_tree, new_tree, 0).map(|r| r.changes)
}

/// Like `compute_tree_delta` but with an early bail-out limit.
/// If `max_changes > 0` and the diff produces more changes, stops early
/// and returns what was collected (with a flag that more exist).
/// Result of tree delta computation.
pub struct TreeDeltaResult {
    pub changes: Vec<RawChange>,
    /// True if the visitor cancelled early due to the limit.
    pub truncated: bool,
}

pub fn compute_tree_delta_with_limit(
    repo: &gix::Repository,
    old_tree: Option<ObjectId>,
    new_tree: ObjectId,
    max_changes: usize,
) -> Result<TreeDeltaResult, ScanError> {
    let old_data = match old_tree {
        Some(oid) => repo
            .find_object(oid)
            .map_err(|e| ScanError::ScanFailed(format!("find old tree {oid}: {e}")))?
            .data
            .to_vec(),
        None => Vec::new(),
    };
    let new_data = repo
        .find_object(new_tree)
        .map_err(|e| ScanError::ScanFailed(format!("find new tree {new_tree}: {e}")))?
        .data
        .to_vec();

    let mut visitor = ChangeCollector::new(max_changes);
    let mut state = gix::diff::tree::State::default();

    let old_iter = gix::objs::TreeRefIter::from_bytes(&old_data);
    let new_iter = gix::objs::TreeRefIter::from_bytes(&new_data);
    let result = gix::diff::tree(old_iter, new_iter, &mut state, &repo.objects, &mut visitor);

    // When the visitor cancels (bail-out), gix returns an error.
    // That's expected — return partial results, not an error.
    let truncated = if let Err(e) = result {
        if !visitor.at_limit() {
            return Err(ScanError::ScanFailed(format!("tree diff: {e}")));
        }
        true
    } else {
        false
    };

    let mut changes = visitor.changes;
    changes.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(TreeDeltaResult { changes, truncated })
}

/// Custom Visit implementation that collects changes and can bail out early.
struct ChangeCollector {
    changes: Vec<RawChange>,
    max_changes: usize,
    visit_count: usize,
    path_deque: VecDeque<BString>,
    path: BString,
}

impl ChangeCollector {
    fn new(max_changes: usize) -> Self {
        Self {
            changes: Vec::new(),
            max_changes,
            visit_count: 0,
            path_deque: VecDeque::new(),
            path: BString::default(),
        }
    }

    fn current_path(&self) -> String {
        self.path.to_str_lossy().to_string()
    }

    fn at_limit(&self) -> bool {
        self.max_changes > 0 && self.visit_count >= self.max_changes
    }
}

impl gix::diff::tree::Visit for ChangeCollector {
    fn pop_front_tracked_path_and_set_current(&mut self) {
        self.path = self.path_deque.pop_front().unwrap_or_default();
    }

    fn push_back_tracked_path_component(&mut self, component: &BStr) {
        let mut p = self.path.clone();
        if !p.is_empty() {
            p.push(b'/');
        }
        p.push_str(component);
        self.path_deque.push_back(p);
    }

    fn push_path_component(&mut self, component: &BStr) {
        if !self.path.is_empty() {
            self.path.push(b'/');
        }
        self.path.push_str(component);
    }

    fn pop_path_component(&mut self) {
        if let Some(pos) = self.path.rfind_byte(b'/') {
            self.path.truncate(pos);
        } else {
            self.path.clear();
        }
    }

    fn visit(&mut self, change: gix::diff::tree::visit::Change) -> std::ops::ControlFlow<()> {
        // Count ALL changes (including tree-level) toward the limit.
        // This ensures we bail out fast even when the tree structure itself
        // is massively different (e.g., repo merges with 100K+ entries).
        self.visit_count += 1;
        if self.at_limit() {
            return std::ops::ControlFlow::Break(());
        }

        use gix::diff::tree::visit::Change;
        match change {
            Change::Addition {
                entry_mode, oid, ..
            } => {
                if !entry_mode.is_tree() {
                    self.changes.push(RawChange {
                        path: self.current_path(),
                        old_oid: ZERO_OID,
                        new_oid: oid,
                        old_mode: 0,
                        new_mode: entry_mode.value() as u32,
                        kind: ChangeKind::Add,
                    });
                }
            }
            Change::Deletion {
                entry_mode, oid, ..
            } => {
                if !entry_mode.is_tree() {
                    self.changes.push(RawChange {
                        path: self.current_path(),
                        old_oid: oid,
                        new_oid: ZERO_OID,
                        old_mode: entry_mode.value() as u32,
                        new_mode: 0,
                        kind: ChangeKind::Delete,
                    });
                }
            }
            Change::Modification {
                previous_entry_mode,
                previous_oid,
                entry_mode,
                oid,
            } => {
                if !entry_mode.is_tree() {
                    let kind = if previous_entry_mode.value() != entry_mode.value()
                        && is_type_change(
                            previous_entry_mode.value() as u32,
                            entry_mode.value() as u32,
                        ) {
                        ChangeKind::TypeChange
                    } else {
                        ChangeKind::Modify
                    };
                    self.changes.push(RawChange {
                        path: self.current_path(),
                        old_oid: previous_oid,
                        new_oid: oid,
                        old_mode: previous_entry_mode.value() as u32,
                        new_mode: entry_mode.value() as u32,
                        kind,
                    });
                }
            }
        }

        if self.at_limit() {
            std::ops::ControlFlow::Break(())
        } else {
            std::ops::ControlFlow::Continue(())
        }
    }
}

fn is_type_change(old_mode: u32, new_mode: u32) -> bool {
    (old_mode & 0o170000) != (new_mode & 0o170000)
}
