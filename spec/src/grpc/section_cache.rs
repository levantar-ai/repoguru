use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, OnceLock};

use crate::error::ScanError;
use crate::model::commit_stat::CommitStat;
use crate::model::file_stat::FileStat;
use crate::model::loader;
use crate::writer::json_writer::Metrics;

/// Cached data for one scan output directory.
/// Metrics are always loaded (small). Binary tables are loaded lazily on first access.
pub struct ScanCache {
    pub out_path: PathBuf,
    pub metrics: Metrics,
    commit_stats: Mutex<Option<Arc<Vec<CommitStat>>>>,
    file_stats: Mutex<Option<Arc<Vec<FileStat>>>>,
    messages: OnceLock<Vec<String>>,
}

impl ScanCache {
    fn new(out_path: PathBuf, metrics: Metrics) -> Self {
        Self {
            out_path,
            metrics,
            commit_stats: Mutex::new(None),
            file_stats: Mutex::new(None),
            messages: OnceLock::new(),
        }
    }

    pub fn commit_stats(&self) -> Result<Arc<Vec<CommitStat>>, ScanError> {
        let mut guard = self.commit_stats.lock().unwrap();
        if let Some(ref data) = *guard {
            return Ok(Arc::clone(data));
        }
        let data = Arc::new(loader::load_commit_stats(&self.out_path)?);
        *guard = Some(Arc::clone(&data));
        Ok(data)
    }

    pub fn file_stats(&self) -> Result<Arc<Vec<FileStat>>, ScanError> {
        let mut guard = self.file_stats.lock().unwrap();
        if let Some(ref data) = *guard {
            return Ok(Arc::clone(data));
        }
        let data = Arc::new(loader::load_file_stats(&self.out_path)?);
        *guard = Some(Arc::clone(&data));
        Ok(data)
    }

    pub fn messages(&self) -> &Vec<String> {
        self.messages
            .get_or_init(|| loader::load_messages(&self.out_path))
    }
}

/// Manages scan caches keyed by canonicalized output path.
pub struct SectionCacheManager {
    caches: Mutex<HashMap<PathBuf, Arc<ScanCache>>>,
}

impl Default for SectionCacheManager {
    fn default() -> Self {
        Self::new()
    }
}

impl SectionCacheManager {
    pub fn new() -> Self {
        Self {
            caches: Mutex::new(HashMap::new()),
        }
    }

    /// Get or create a cache for the given output path.
    pub fn get_or_load(&self, out_path: &str) -> Result<Arc<ScanCache>, ScanError> {
        let path = PathBuf::from(out_path);
        let canonical = std::fs::canonicalize(&path).unwrap_or_else(|_| path.clone());

        let mut caches = self.caches.lock().unwrap();
        if let Some(cache) = caches.get(&canonical) {
            return Ok(Arc::clone(cache));
        }

        let metrics = loader::load_metrics(&path)?;
        let cache = Arc::new(ScanCache::new(path, metrics));
        caches.insert(canonical, Arc::clone(&cache));
        Ok(cache)
    }
}
