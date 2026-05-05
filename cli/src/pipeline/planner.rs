use crossbeam_channel::Sender;

use crate::walk::workitem::WorkItem;

/// Emit WorkItems in order into the channel (§5.3).
pub fn run_planner(items: Vec<WorkItem>, tx: Sender<WorkItem>) {
    for item in items {
        if tx.send(item).is_err() {
            break; // receiver dropped
        }
    }
    // tx drops here, closing the channel
}
