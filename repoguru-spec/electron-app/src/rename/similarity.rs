use std::collections::BTreeMap;
use std::hash::{Hash, Hasher};

/// Hash each line of the given data, returning a vector of hashes.
pub fn line_hashes(data: &[u8]) -> Vec<u64> {
    if data.is_empty() {
        return Vec::new();
    }
    split_lines(data)
        .iter()
        .map(|line| hash_line(line))
        .collect()
}

/// Compute similarity score per §8.4:
/// `100 * (2*common) / (old_lines + new_lines)`
/// where `common` is the multiset intersection count.
/// Returns 0..=100.
pub fn similarity_score(old: &[u64], new: &[u64]) -> u16 {
    let total = old.len() + new.len();
    if total == 0 {
        return 0;
    }

    // Build multiset from old
    let mut old_counts: BTreeMap<u64, usize> = BTreeMap::new();
    for &h in old {
        *old_counts.entry(h).or_insert(0) += 1;
    }

    // Count common (multiset intersection)
    let mut common: usize = 0;
    let mut remaining = old_counts;
    for &h in new {
        if let Some(count) = remaining.get_mut(&h) {
            if *count > 0 {
                common += 1;
                *count -= 1;
            }
        }
    }

    let score = (100 * 2 * common) / total;
    score.min(100) as u16
}

fn split_lines(data: &[u8]) -> Vec<&[u8]> {
    let mut lines = Vec::new();
    let mut start = 0;
    for (i, &b) in data.iter().enumerate() {
        if b == b'\n' {
            lines.push(&data[start..=i]);
            start = i + 1;
        }
    }
    if start < data.len() {
        lines.push(&data[start..]);
    }
    lines
}

fn hash_line(line: &[u8]) -> u64 {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    line.hash(&mut hasher);
    hasher.finish()
}
