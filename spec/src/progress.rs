use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use indicatif::{MultiProgress, ProgressBar, ProgressStyle};

/// Multi-level progress display for the scan pipeline.
///
/// Layout:
///   ▸ Scan        [=====>          ] 3/6 phases   (top-level)
///   ▸ Diffing     [========>       ] 32000/62000  commits
///   ▸ Sizer       [==>             ] 100k/500k    objects
pub struct ScanProgress {
    multi: MultiProgress,
    phase_bar: ProgressBar,
    diff_bar: ProgressBar,
    sizer_bar: ProgressBar,
    status_bar: ProgressBar,
    /// Shared counter incremented by the aggregator, polled by the diff bar tick.
    diff_counter: Arc<AtomicU64>,
}

fn phase_style() -> ProgressStyle {
    ProgressStyle::with_template(
        "  {prefix:>12.bold.cyan} [{wide_bar:.cyan/dim}] {pos}/{len}  {msg}",
    )
    .unwrap()
    .progress_chars("━╸─")
}

fn count_style() -> ProgressStyle {
    ProgressStyle::with_template(
        "  {prefix:>12.bold.green} [{wide_bar:.green/dim}] {human_pos}/{human_len}  {per_sec}  {eta}  {msg}",
    )
    .unwrap()
    .progress_chars("━╸─")
}

fn status_style() -> ProgressStyle {
    ProgressStyle::with_template("  {msg:.dim}").unwrap()
}

impl ScanProgress {
    /// Create progress bars. They become visible immediately.
    pub fn new() -> Self {
        let multi = MultiProgress::new();

        let phase_bar = multi.add(ProgressBar::new(6));
        phase_bar.set_style(phase_style());
        phase_bar.set_prefix("Scan");

        // Hidden until we know totals
        let diff_bar = multi.add(ProgressBar::hidden());
        diff_bar.set_style(count_style());
        diff_bar.set_prefix("Diffing");

        let sizer_bar = multi.add(ProgressBar::hidden());
        sizer_bar.set_style(count_style());
        sizer_bar.set_prefix("Sizer");

        // Status line below all bars for non-verbose log messages
        let status_bar = multi.add(ProgressBar::new_spinner());
        status_bar.set_style(status_style());
        status_bar.enable_steady_tick(std::time::Duration::from_millis(200));

        Self {
            multi,
            phase_bar,
            diff_bar,
            sizer_bar,
            status_bar,
            diff_counter: Arc::new(AtomicU64::new(0)),
        }
    }

    /// Get a clone of the MultiProgress and the status bar for log routing.
    pub fn multi_and_status(&self) -> (MultiProgress, ProgressBar) {
        (self.multi.clone(), self.status_bar.clone())
    }

    /// Mark a phase as started — advances the top bar and sets a label.
    pub fn enter_phase(&self, name: &str) {
        self.phase_bar.set_message(name.to_string());
    }

    /// Advance the phase bar by one step.
    pub fn finish_phase(&self) {
        self.phase_bar.inc(1);
    }

    // -- Diff progress --

    /// Initialize the diff bar with total work items.
    pub fn init_diff(&self, total: u64) {
        self.diff_bar.set_length(total);
        self.diff_bar.set_position(0);
        self.diff_bar.reset_eta();
        // Make visible
        self.diff_bar.set_style(count_style());
    }

    /// Get the shared counter for the aggregator to increment.
    pub fn diff_counter(&self) -> Arc<AtomicU64> {
        Arc::clone(&self.diff_counter)
    }

    /// Tick the diff bar from the shared counter. Call periodically from aggregator.
    pub fn tick_diff(&self) {
        let pos = self.diff_counter.load(Ordering::Relaxed);
        self.diff_bar.set_position(pos);
    }

    pub fn finish_diff(&self) {
        let pos = self.diff_counter.load(Ordering::Relaxed);
        self.diff_bar.set_position(pos);
        self.diff_bar.finish_and_clear();
    }

    // -- Sizer progress --

    /// Initialize the sizer bar with total object count.
    pub fn init_sizer(&self, total: u64) {
        self.sizer_bar.set_length(total);
        self.sizer_bar.set_position(0);
        self.sizer_bar.reset_eta();
        self.sizer_bar.set_style(count_style());
    }

    /// Get the underlying sizer ProgressBar so rayon tasks can inc() it.
    pub fn sizer_bar(&self) -> &ProgressBar {
        &self.sizer_bar
    }

    pub fn finish_sizer(&self) {
        self.sizer_bar.finish_and_clear();
    }

    // -- Overall --

    /// Clear all bars and print a final summary line.
    pub fn finish_all(&self, summary: &str) {
        self.phase_bar.finish_and_clear();
        self.diff_bar.finish_and_clear();
        self.sizer_bar.finish_and_clear();
        self.status_bar.finish_and_clear();
        self.multi.clear().ok();
        eprintln!("{summary}");
    }

}
