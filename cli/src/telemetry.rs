use std::io::Write;
use std::path::Path;
use std::sync::Mutex;
use std::time::Instant;

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
}

impl ScanLog {
    /// Create a new ScanLog writing to `<out_dir>/scan.log`.
    pub fn new(out_dir: &Path) -> std::io::Result<Self> {
        let f = std::fs::File::create(out_dir.join("scan.log"))?;
        Ok(Self {
            file: Mutex::new(std::io::BufWriter::new(f)),
            start: Instant::now(),
        })
    }

    fn timestamp(&self) -> String {
        let elapsed = self.start.elapsed();
        let secs = elapsed.as_secs();
        let millis = elapsed.subsec_millis();
        format!("[{:4}.{:03}s]", secs, millis)
    }

    /// Write a log line to both stderr and the log file.
    pub fn log(&self, msg: &str) {
        let ts = self.timestamp();
        eprintln!("{ts} {msg}");
        if let Ok(mut f) = self.file.lock() {
            let _ = writeln!(f, "{ts} {msg}");
            let _ = f.flush();
        }
    }

    /// Write an in-place progress update (\\r on stderr, newline in file).
    pub fn progress(&self, msg: &str) {
        let ts = self.timestamp();
        eprint!("\r{ts} {msg}");
        if let Ok(mut f) = self.file.lock() {
            let _ = writeln!(f, "{ts} {msg}");
            let _ = f.flush();
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
