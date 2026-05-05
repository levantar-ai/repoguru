use std::io::Write;

use crate::model::commit_stat::CommitStat;
use crate::model::file_stat::FileStat;
use crate::model::rename_event::RenameEvent;

/// Writer for fixed-width binary table files.
pub struct BinWriter<W: Write> {
    inner: W,
    rows_written: u64,
}

impl<W: Write> BinWriter<W> {
    pub fn new(inner: W) -> Self {
        Self {
            inner,
            rows_written: 0,
        }
    }

    pub fn write_commit_stat(&mut self, stat: &CommitStat) -> std::io::Result<()> {
        self.inner.write_all(&stat.to_bytes())?;
        self.rows_written += 1;
        Ok(())
    }

    pub fn write_file_stat(&mut self, stat: &FileStat) -> std::io::Result<()> {
        self.inner.write_all(&stat.to_bytes())?;
        self.rows_written += 1;
        Ok(())
    }

    pub fn write_rename_event(&mut self, event: &RenameEvent) -> std::io::Result<()> {
        self.inner.write_all(&event.to_bytes())?;
        self.rows_written += 1;
        Ok(())
    }

    pub fn rows_written(&self) -> u64 {
        self.rows_written
    }

    pub fn flush(&mut self) -> std::io::Result<()> {
        self.inner.flush()
    }
}
