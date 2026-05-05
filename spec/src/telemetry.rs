use std::io::Write;
use std::path::Path;
use std::sync::Mutex;
use std::time::Instant;

use indicatif::MultiProgress;
use serde::Serialize;

#[derive(Debug, Default, Serialize)]
pub struct PerfTelemetry {
    pub walk_time_ms: u64,
    pub diff_time_ms: u64,
    pub write_time_ms: u64,
    pub total_time_ms: u64,
    pub commits_processed: u64,
    pub file_changes_processed: u64,
}

impl PerfTelemetry {
    pub fn new() -> Self {
        Self {
            walk_time_ms: 0,
            diff_time_ms: 0,
            write_time_ms: 0,
            total_time_ms: 0,
            commits_processed: 0,
            file_changes_processed: 0,
        }
    }

    pub fn write_to(&self, path: &Path) -> anyhow::Result<()> {
        let json = serde_json::to_string_pretty(self)?;
        std::fs::write(path, json)?;
        Ok(())
    }
}

/// Log to both stderr and a file so users can `tail -f <out>/scan.log`.
pub struct ScanLog {
    file: Mutex<std::io::BufWriter<std::fs::File>>,
    start: Instant,
    multi: Mutex<Option<MultiProgress>>,
    status_bar: Mutex<Option<indicatif::ProgressBar>>,
    verbose: bool,
}

impl ScanLog {
    /// Create a new ScanLog writing to `<out_dir>/scan.log`.
    pub fn new(out_dir: &Path, verbose: bool) -> std::io::Result<Self> {
        let f = std::fs::File::create(out_dir.join("scan.log"))?;
        Ok(Self {
            file: Mutex::new(std::io::BufWriter::new(f)),
            start: Instant::now(),
            multi: Mutex::new(None),
            status_bar: Mutex::new(None),
            verbose,
        })
    }

    /// Attach a MultiProgress and status bar so log output is routed correctly.
    pub fn set_multi_progress(&self, multi: MultiProgress, status: indicatif::ProgressBar) {
        if let Ok(mut m) = self.multi.lock() {
            *m = Some(multi);
        }
        if let Ok(mut s) = self.status_bar.lock() {
            *s = Some(status);
        }
    }

    fn timestamp(&self) -> String {
        let elapsed = self.start.elapsed();
        let secs = elapsed.as_secs();
        let millis = elapsed.subsec_millis();
        format!("[{:4}.{:03}s]", secs, millis)
    }

    /// Write a log line. In verbose mode, prints above progress bars.
    /// In normal mode, updates the status line below the bars.
    /// Always writes to scan.log.
    pub fn log(&self, msg: &str) {
        let ts = self.timestamp();
        let line = format!("{ts} {msg}");

        if self.verbose {
            if let Ok(m) = self.multi.lock() {
                if let Some(ref multi) = *m {
                    multi.println(&line).ok();
                } else {
                    eprintln!("{line}");
                }
            } else {
                eprintln!("{line}");
            }
        } else {
            // Update status bar with the message (no timestamp clutter)
            if let Ok(s) = self.status_bar.lock() {
                if let Some(ref bar) = *s {
                    bar.set_message(msg.to_string());
                }
            }
        }

        if let Ok(mut f) = self.file.lock() {
            let _ = writeln!(f, "{line}");
            let _ = f.flush();
        }
    }

    /// Write a progress update — always file-only (progress bars handle display).
    pub fn progress(&self, msg: &str) {
        let ts = self.timestamp();
        let line = format!("{ts} {msg}");
        if let Ok(mut f) = self.file.lock() {
            let _ = writeln!(f, "{line}");
            let _ = f.flush();
        }
    }

    /// Clear the status bar on completion.
    pub fn finish(&self) {
        if let Ok(s) = self.status_bar.lock() {
            if let Some(ref bar) = *s {
                bar.finish_and_clear();
            }
        }
    }
}

/// Simple timer helper.
pub struct Timer {
    start: Instant,
}

impl Timer {
    pub fn start() -> Self {
        Self {
            start: Instant::now(),
        }
    }

    pub fn elapsed_ms(&self) -> u64 {
        self.start.elapsed().as_millis() as u64
    }
}
