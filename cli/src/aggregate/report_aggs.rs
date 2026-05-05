use std::collections::{BTreeMap, HashMap, HashSet};

use serde::Serialize;

use crate::aggregate::author::AuthorSummary;
use crate::aggregate::timeseries::unix_ts_to_ymd;
use crate::model::commit_stat::CommitStat;
use crate::model::file_stat::FileStat;

/// Monthly churn by file extension for stacked area chart.
#[derive(Debug, Serialize)]
pub struct ExtMonthlyChurn {
    pub months: Vec<String>,
    pub extensions: Vec<String>,
    pub data: Vec<Vec<u64>>,
}

/// Lines changed by extension over time (monthly breakdown for top N extensions).
pub fn lines_by_extension_over_time(
    commit_stats: &[CommitStat],
    file_stats: &[FileStat],
    paths: &BTreeMap<u32, String>,
    top_n: usize,
) -> ExtMonthlyChurn {
    // Build commit_oid → (author_ts) lookup
    let ts_map: HashMap<[u8; 20], i64> = commit_stats
        .iter()
        .map(|cs| {
            let oid: [u8; 20] = cs.commit_oid.as_bytes().try_into().unwrap();
            (oid, cs.author_ts)
        })
        .collect();

    // Accumulate churn per (extension, month)
    let mut ext_month: HashMap<String, BTreeMap<String, u64>> = HashMap::new();
    let mut ext_total: HashMap<String, u64> = HashMap::new();

    for fs in file_stats {
        if let Some(path) = paths.get(&fs.path_id) {
            let ext = path
                .rsplit('.')
                .next()
                .map(|e| e.to_lowercase())
                .unwrap_or_default();
            if ext.is_empty() || ext == path.to_lowercase() {
                continue;
            }
            let oid: [u8; 20] = fs.commit_oid.as_bytes().try_into().unwrap();
            if let Some(&ts) = ts_map.get(&oid) {
                let (y, m, _) = unix_ts_to_ymd(ts);
                let month_key = format!("{y:04}-{m:02}");
                let churn = (fs.insertions + fs.deletions) as u64;
                *ext_month
                    .entry(ext.clone())
                    .or_default()
                    .entry(month_key)
                    .or_insert(0) += churn;
                *ext_total.entry(ext).or_insert(0) += churn;
            }
        }
    }

    // Find top N extensions by total churn
    let mut sorted_exts: Vec<(String, u64)> = ext_total.into_iter().collect();
    sorted_exts.sort_by(|a, b| b.1.cmp(&a.1));
    sorted_exts.truncate(top_n);
    let top_exts: Vec<String> = sorted_exts.into_iter().map(|(e, _)| e).collect();

    // Collect all months
    let mut all_months: BTreeMap<String, bool> = BTreeMap::new();
    for ext in &top_exts {
        if let Some(months) = ext_month.get(ext) {
            for k in months.keys() {
                all_months.insert(k.clone(), true);
            }
        }
    }
    let months: Vec<String> = all_months.into_keys().collect();

    // Build data matrix: data[ext_idx][month_idx]
    let data: Vec<Vec<u64>> = top_exts
        .iter()
        .map(|ext| {
            let month_map = ext_month.get(ext);
            months
                .iter()
                .map(|m| month_map.and_then(|mm| mm.get(m)).copied().unwrap_or(0))
                .collect()
        })
        .collect();

    ExtMonthlyChurn {
        months,
        extensions: top_exts,
        data,
    }
}

/// Commits grouped by weekday (Mon=0 .. Sun=6).
pub fn commits_by_weekday(stats: &[CommitStat]) -> [u64; 7] {
    let mut counts = [0u64; 7];
    for cs in stats {
        let (y, m, d) = unix_ts_to_ymd(cs.author_ts);
        let dow = day_of_week(y, m, d);
        counts[dow as usize] += 1;
    }
    counts
}

/// Commits grouped by month (Jan=0 .. Dec=11).
pub fn commits_by_month(stats: &[CommitStat]) -> [u64; 12] {
    let mut counts = [0u64; 12];
    for cs in stats {
        let (_y, m, _d) = unix_ts_to_ymd(cs.author_ts);
        if (1..=12).contains(&m) {
            counts[(m - 1) as usize] += 1;
        }
    }
    counts
}

/// Commits grouped by year.
pub fn commits_by_year(stats: &[CommitStat]) -> BTreeMap<i32, u64> {
    let mut map = BTreeMap::new();
    for cs in stats {
        let (y, _m, _d) = unix_ts_to_ymd(cs.author_ts);
        *map.entry(y).or_insert(0) += 1;
    }
    map
}

/// Punch card: (day 0-6, hour 0-23, count).
pub fn punch_card(stats: &[CommitStat]) -> Vec<(u8, u8, u64)> {
    let mut grid = [[0u64; 24]; 7];
    for cs in stats {
        let (y, m, d) = unix_ts_to_ymd(cs.author_ts);
        let dow = day_of_week(y, m, d) as usize;
        // Extract hour from timestamp
        let hour = ((cs.author_ts % 86400 + 86400) % 86400 / 3600) as usize;
        if dow < 7 && hour < 24 {
            grid[dow][hour] += 1;
        }
    }
    let mut result = Vec::new();
    for day in 0..7u8 {
        for hour in 0..24u8 {
            let count = grid[day as usize][hour as usize];
            if count > 0 {
                result.push((day, hour, count));
            }
        }
    }
    result
}

/// Histogram of commit sizes (by lines changed).
pub fn commit_size_histogram(stats: &[CommitStat]) -> Vec<(String, u64)> {
    let buckets: &[(u64, &str)] = &[
        (0, "0"),
        (1, "1-10"),
        (11, "11-50"),
        (51, "51-100"),
        (101, "101-500"),
        (501, "501-1K"),
        (1001, "1K-5K"),
        (5001, "5K-10K"),
        (10001, "10K+"),
    ];

    let mut counts = vec![0u64; buckets.len()];

    for cs in stats {
        let lines = cs.insertions + cs.deletions;
        let idx = if lines == 0 {
            0
        } else if lines <= 10 {
            1
        } else if lines <= 50 {
            2
        } else if lines <= 100 {
            3
        } else if lines <= 500 {
            4
        } else if lines <= 1000 {
            5
        } else if lines <= 5000 {
            6
        } else if lines <= 10000 {
            7
        } else {
            8
        };
        counts[idx] += 1;
    }

    buckets
        .iter()
        .zip(counts.iter())
        .map(|((_, label), &count)| (label.to_string(), count))
        .collect()
}

/// Bus factor result.
#[derive(Debug, Serialize)]
pub struct BusFactor {
    pub factor: u32,
    pub lorenz: Vec<f64>,
}

/// Compute bus factor and Lorenz curve from author summaries.
pub fn bus_factor(authors: &[AuthorSummary]) -> BusFactor {
    if authors.is_empty() {
        return BusFactor {
            factor: 0,
            lorenz: Vec::new(),
        };
    }

    let total_commits: u64 = authors.iter().map(|a| a.commits).sum();
    if total_commits == 0 {
        return BusFactor {
            factor: 0,
            lorenz: Vec::new(),
        };
    }

    // Authors are already sorted by commits descending; we need ascending for Lorenz
    let mut sorted: Vec<u64> = authors.iter().map(|a| a.commits).collect();
    sorted.sort_unstable(); // ascending

    // Lorenz curve: cumulative fraction
    let mut cum = 0u64;
    let lorenz: Vec<f64> = sorted
        .iter()
        .map(|&c| {
            cum += c;
            cum as f64 / total_commits as f64
        })
        .collect();

    // Bus factor: minimum number of top contributors whose commits exceed 50%
    let threshold = total_commits / 2;
    let mut factor = 0u32;
    let mut acc = 0u64;
    // Walk from most commits to least
    for a in authors {
        acc += a.commits;
        factor += 1;
        if acc > threshold {
            break;
        }
    }

    BusFactor { factor, lorenz }
}

/// Count commits touching each file extension.
pub fn commits_by_extension(
    file_stats: &[FileStat],
    paths: &BTreeMap<u32, String>,
) -> Vec<(String, u64)> {
    let mut ext_counts: HashMap<String, u64> = HashMap::new();

    // Track (extension, commit_oid) to avoid double-counting within same commit
    let mut seen: HashSet<(u32, [u8; 20])> = HashSet::new();

    for fs in file_stats {
        if let Some(path) = paths.get(&fs.path_id) {
            let ext = path
                .rsplit('.')
                .next()
                .map(|e| e.to_lowercase())
                .unwrap_or_default();
            if ext.is_empty() || ext == path.to_lowercase() {
                continue; // no extension
            }
            // Use a simple hash key to deduplicate per commit
            let oid_bytes: [u8; 20] = fs.commit_oid.as_bytes().try_into().unwrap();
            if seen.insert((fs.path_id, oid_bytes)) {
                *ext_counts.entry(ext).or_insert(0) += 1;
            }
        }
    }

    let mut result: Vec<(String, u64)> = ext_counts.into_iter().collect();
    result.sort_by(|a, b| b.1.cmp(&a.1));
    result
}

/// File coupling pair.
#[derive(Debug, Serialize)]
pub struct FileCouplingPair {
    pub file_a: String,
    pub file_b: String,
    pub count: u64,
    pub coupling_pct: f64,
}

/// Compute file coupling: files that frequently change together.
pub fn file_coupling(
    file_stats: &[FileStat],
    paths: &BTreeMap<u32, String>,
    top_n: usize,
) -> Vec<FileCouplingPair> {
    // Group path_ids by commit_oid
    let mut commit_files: HashMap<[u8; 20], Vec<u32>> = HashMap::new();
    for fs in file_stats {
        let oid_bytes: [u8; 20] = fs.commit_oid.as_bytes().try_into().unwrap();
        commit_files.entry(oid_bytes).or_default().push(fs.path_id);
    }

    // Count co-occurrences (only for commits with 2..=50 files)
    let mut pair_counts: HashMap<(u32, u32), u64> = HashMap::new();
    let mut file_commit_counts: HashMap<u32, u64> = HashMap::new();

    for files in commit_files.values() {
        if files.len() < 2 || files.len() > 50 {
            continue;
        }
        let mut unique: Vec<u32> = files.clone();
        unique.sort_unstable();
        unique.dedup();

        for &fid in &unique {
            *file_commit_counts.entry(fid).or_insert(0) += 1;
        }

        for i in 0..unique.len() {
            for j in (i + 1)..unique.len() {
                let key = (unique[i], unique[j]);
                *pair_counts.entry(key).or_insert(0) += 1;
            }
        }
    }

    // Sort by count descending, take top_n
    let mut pairs: Vec<((u32, u32), u64)> = pair_counts.into_iter().collect();
    pairs.sort_by(|a, b| b.1.cmp(&a.1));
    pairs.truncate(top_n);

    pairs
        .into_iter()
        .map(|((a, b), count)| {
            let file_a = paths.get(&a).cloned().unwrap_or_default();
            let file_b = paths.get(&b).cloned().unwrap_or_default();
            let max_commits = (*file_commit_counts.get(&a).unwrap_or(&1))
                .min(*file_commit_counts.get(&b).unwrap_or(&1));
            let coupling_pct = if max_commits > 0 {
                (count as f64 / max_commits as f64 * 100.0).min(100.0)
            } else {
                0.0
            };
            FileCouplingPair {
                file_a,
                file_b,
                count,
                coupling_pct: (coupling_pct * 10.0).round() / 10.0,
            }
        })
        .collect()
}

/// Parse conventional commit prefixes from message subjects.
pub fn parse_conventional_commits(subjects: &[String]) -> BTreeMap<String, u64> {
    let mut counts: BTreeMap<String, u64> = BTreeMap::new();
    for subject in subjects {
        let trimmed = subject.trim();
        // Match patterns like "feat:", "fix(scope):", "docs:", etc.
        if let Some(colon_pos) = trimmed.find(':') {
            let prefix = &trimmed[..colon_pos];
            // Strip optional scope in parens
            let kind = if let Some(paren_pos) = prefix.find('(') {
                &prefix[..paren_pos]
            } else {
                prefix
            };
            let kind_lower = kind.trim().to_lowercase();
            let valid = [
                "feat", "fix", "docs", "style", "refactor", "perf", "test", "tests", "build", "ci",
                "chore", "revert", "release", "deps", "wip",
            ];
            if valid.contains(&kind_lower.as_str()) {
                *counts.entry(kind_lower).or_insert(0) += 1;
            }
        }
    }
    counts
}

/// Stop words to filter from word frequencies.
const STOP_WORDS: &[&str] = &[
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by",
    "from", "is", "it", "its", "this", "that", "be", "as", "are", "was", "were", "been", "not",
    "no", "do", "did", "has", "had", "have", "will", "would", "should", "could", "can", "may",
    "if", "so", "up", "out", "all", "we", "us", "our", "into", "when", "than", "them", "then",
    "each", "also", "some", "use", "new", "one", "two", "set",
];

/// Compute word frequencies from commit message subjects.
pub fn word_frequencies(subjects: &[String], top_n: usize) -> Vec<(String, u64)> {
    let stop: HashSet<&str> = STOP_WORDS.iter().copied().collect();
    let mut freq: HashMap<String, u64> = HashMap::new();

    for subject in subjects {
        for word in subject.split(|c: char| !c.is_alphanumeric()) {
            let w = word.to_lowercase();
            if w.len() >= 3 && !stop.contains(w.as_str()) && !w.chars().all(|c| c.is_numeric()) {
                *freq.entry(w).or_insert(0) += 1;
            }
        }
    }

    let mut result: Vec<(String, u64)> = freq.into_iter().collect();
    result.sort_by(|a, b| b.1.cmp(&a.1));
    result.truncate(top_n);
    result
}

/// Radar metric for repo health.
#[derive(Debug, Serialize)]
pub struct RadarMetric {
    pub label: String,
    pub value: f64, // 0.0 to 1.0
}

/// Compute radar metrics for repository health assessment.
pub fn compute_radar_metrics(
    stats: &[CommitStat],
    authors: &[AuthorSummary],
    bus: &BusFactor,
) -> Vec<RadarMetric> {
    let total_commits = stats.len() as f64;
    if total_commits == 0.0 {
        return Vec::new();
    }

    // Activity: normalize based on commit count (1000+ is "high")
    let activity = (total_commits / 1000.0).min(1.0);

    // Team size: normalize (20+ is "high")
    let team_size = (authors.len() as f64 / 20.0).min(1.0);

    // Bus factor: normalize (5+ is "good")
    let bus_score = (bus.factor as f64 / 5.0).min(1.0);

    // Code growth rate: ratio of net lines to total changes
    let total_ins: u64 = stats.iter().map(|s| s.insertions).sum();
    let total_del: u64 = stats.iter().map(|s| s.deletions).sum();
    let total_churn = (total_ins + total_del) as f64;
    let growth_balance = if total_churn > 0.0 {
        1.0 - ((total_ins as f64 - total_del as f64).abs() / total_churn)
    } else {
        0.5
    };

    // Merge ratio: fraction of merge commits (lower is typically better)
    let merge_count = stats.iter().filter(|s| s.is_merge != 0).count() as f64;
    let merge_ratio = 1.0 - (merge_count / total_commits).min(0.5) * 2.0;

    // Recency: how recently was the last commit (within 90 days is "good")
    let max_ts = stats.iter().map(|s| s.author_ts).max().unwrap_or(0);
    let now_approx = 1741564800i64; // ~2025-03-10
    let days_since = ((now_approx - max_ts) as f64 / 86400.0).max(0.0);
    let recency = (1.0 - days_since / 365.0).clamp(0.0, 1.0);

    vec![
        RadarMetric {
            label: "Activity".to_string(),
            value: (activity * 100.0).round() / 100.0,
        },
        RadarMetric {
            label: "Team Size".to_string(),
            value: (team_size * 100.0).round() / 100.0,
        },
        RadarMetric {
            label: "Bus Factor".to_string(),
            value: (bus_score * 100.0).round() / 100.0,
        },
        RadarMetric {
            label: "Code Balance".to_string(),
            value: (growth_balance * 100.0).round() / 100.0,
        },
        RadarMetric {
            label: "PR Hygiene".to_string(),
            value: (merge_ratio * 100.0).round() / 100.0,
        },
        RadarMetric {
            label: "Recency".to_string(),
            value: (recency * 100.0).round() / 100.0,
        },
    ]
}

/// Commits grouped by hour of day (0-23).
pub fn commits_by_hour(stats: &[CommitStat]) -> [u64; 24] {
    let mut counts = [0u64; 24];
    for cs in stats {
        let hour = ((cs.author_ts % 86400 + 86400) % 86400 / 3600) as usize;
        if hour < 24 {
            counts[hour] += 1;
        }
    }
    counts
}

/// Commits by timezone offset (estimated from commit timestamps).
/// Returns vec of (offset_hours: i32, count: u64) sorted by offset.
pub fn commits_by_timezone(stats: &[CommitStat]) -> Vec<(i32, u64)> {
    let mut tz_counts: BTreeMap<i32, u64> = BTreeMap::new();
    for cs in stats {
        // Estimate timezone offset from difference between author_ts and commit_ts
        // This is an approximation — both timestamps come from git
        let diff_secs = cs.commit_ts - cs.author_ts;
        // Round to nearest hour
        let offset_hours = if diff_secs.abs() < 86400 {
            (diff_secs as f64 / 3600.0).round() as i32
        } else {
            0 // too large, ignore
        };
        *tz_counts.entry(offset_hours).or_insert(0) += 1;
    }
    tz_counts.into_iter().collect()
}

/// Commits by author email domain.
pub fn commits_by_domain(
    authors: &BTreeMap<u32, String>,
    stats: &[CommitStat],
) -> Vec<(String, u64)> {
    let mut domain_counts: HashMap<String, u64> = HashMap::new();
    for cs in stats {
        if let Some(email) = authors.get(&cs.author_id) {
            let domain = email.rsplit('@').next().unwrap_or("unknown").to_lowercase();
            if !domain.is_empty() {
                *domain_counts.entry(domain).or_insert(0) += 1;
            }
        }
    }
    let mut result: Vec<(String, u64)> = domain_counts.into_iter().collect();
    result.sort_by(|a, b| b.1.cmp(&a.1));
    result.truncate(20);
    result
}

/// Author of month: for each (year, month), who had the most commits?
#[derive(Debug, Serialize)]
pub struct AuthorOfPeriod {
    pub period: String,
    pub author_id: u32,
    pub commits: u64,
    pub total_authors: u64,
}

pub fn author_of_month(stats: &[CommitStat]) -> Vec<AuthorOfPeriod> {
    let mut period_authors: BTreeMap<String, HashMap<u32, u64>> = BTreeMap::new();
    for cs in stats {
        let (y, m, _d) = unix_ts_to_ymd(cs.author_ts);
        let period = format!("{y:04}-{m:02}");
        *period_authors
            .entry(period)
            .or_default()
            .entry(cs.author_id)
            .or_insert(0) += 1;
    }
    period_authors
        .into_iter()
        .map(|(period, authors)| {
            let total_authors = authors.len() as u64;
            let (&author_id, &commits) = authors.iter().max_by_key(|(_, &c)| c).unwrap();
            AuthorOfPeriod {
                period,
                author_id,
                commits,
                total_authors,
            }
        })
        .collect()
}

pub fn author_of_year(stats: &[CommitStat]) -> Vec<AuthorOfPeriod> {
    let mut period_authors: BTreeMap<String, HashMap<u32, u64>> = BTreeMap::new();
    for cs in stats {
        let (y, _m, _d) = unix_ts_to_ymd(cs.author_ts);
        let period = format!("{y:04}");
        *period_authors
            .entry(period)
            .or_default()
            .entry(cs.author_id)
            .or_insert(0) += 1;
    }
    period_authors
        .into_iter()
        .map(|(period, authors)| {
            let total_authors = authors.len() as u64;
            let (&author_id, &commits) = authors.iter().max_by_key(|(_, &c)| c).unwrap();
            AuthorOfPeriod {
                period,
                author_id,
                commits,
                total_authors,
            }
        })
        .collect()
}

/// Weekly activity: commits per week for the last 52 weeks.
pub fn weekly_activity(stats: &[CommitStat]) -> Vec<(String, u64)> {
    // Find the most recent timestamp
    let max_ts = stats.iter().map(|s| s.author_ts).max().unwrap_or(0);
    let weeks_back = 52;
    let cutoff = max_ts - (weeks_back * 7 * 86400);

    let mut week_counts: BTreeMap<String, u64> = BTreeMap::new();
    for cs in stats {
        if cs.author_ts < cutoff {
            continue;
        }
        let (y, m, d) = unix_ts_to_ymd(cs.author_ts);
        // Find Monday of this week
        let dow = day_of_week(y, m, d);
        let monday_ts = cs.author_ts - (dow as i64 * 86400);
        let (wy, wm, wd) = unix_ts_to_ymd(monday_ts);
        let week_key = format!("{wy:04}-{wm:02}-{wd:02}");
        *week_counts.entry(week_key).or_insert(0) += 1;
    }
    week_counts.into_iter().collect()
}

/// Tag info for serialization.
#[derive(Debug, Serialize)]
pub struct TagSummary {
    pub name: String,
    pub date: String,
    pub timestamp: i64,
    pub commits_since_prev: u64,
}

/// Build tag summaries from tag info and commit stats.
pub fn build_tag_summaries(
    tag_infos: &[crate::repo::refs::TagInfo],
    commit_stats: &[CommitStat],
) -> Vec<TagSummary> {
    let mut summaries = Vec::new();
    let mut prev_ts: Option<i64> = None;
    for ti in tag_infos {
        let commits_since = if let Some(pt) = prev_ts {
            commit_stats
                .iter()
                .filter(|cs| cs.author_ts > pt && cs.author_ts <= ti.timestamp)
                .count() as u64
        } else {
            commit_stats
                .iter()
                .filter(|cs| cs.author_ts <= ti.timestamp)
                .count() as u64
        };
        let (y, m, d) = unix_ts_to_ymd(ti.timestamp);
        summaries.push(TagSummary {
            name: ti.name.clone(),
            date: format!("{y:04}-{m:02}-{d:02}"),
            timestamp: ti.timestamp,
            commits_since_prev: commits_since,
        });
        prev_ts = Some(ti.timestamp);
    }
    summaries
}

/// Day of week: 0=Monday, 6=Sunday (Tomohiko Sakamoto's algorithm).
fn day_of_week(y: i32, m: u32, d: u32) -> u32 {
    let t = [0i32, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
    let y = if m < 3 { y - 1 } else { y };
    let dow = (y + y / 4 - y / 100 + y / 400 + t[(m - 1) as usize] + d as i32) % 7;
    ((dow + 6) % 7) as u32
}

// ---------------------------------------------------------------------------
// New aggregations for Phase 6 visualizations
// ---------------------------------------------------------------------------

/// Cumulative unique files over time.
pub fn cumulative_files_over_time(
    commit_stats: &[CommitStat],
    file_stats: &[FileStat],
) -> Vec<(String, u64)> {
    // Build commit_oid → author_ts lookup
    let ts_map: HashMap<[u8; 20], i64> = commit_stats
        .iter()
        .map(|cs| {
            let oid: [u8; 20] = cs.commit_oid.as_bytes().try_into().unwrap();
            (oid, cs.author_ts)
        })
        .collect();

    // For each path_id, find earliest timestamp
    let mut first_seen: HashMap<u32, i64> = HashMap::new();
    for fs in file_stats {
        let oid: [u8; 20] = fs.commit_oid.as_bytes().try_into().unwrap();
        if let Some(&ts) = ts_map.get(&oid) {
            first_seen
                .entry(fs.path_id)
                .and_modify(|existing| *existing = (*existing).min(ts))
                .or_insert(ts);
        }
    }

    // Sort by timestamp, accumulate
    let mut events: Vec<(i64, u32)> = first_seen.into_iter().map(|(pid, ts)| (ts, pid)).collect();
    events.sort_unstable();

    let mut result = Vec::new();
    let mut cum = 0u64;
    let mut prev_date = String::new();
    for (ts, _) in events {
        cum += 1;
        let (y, m, d) = unix_ts_to_ymd(ts);
        let date = format!("{y:04}-{m:02}-{d:02}");
        if date != prev_date {
            result.push((date.clone(), cum));
            prev_date = date;
        } else if let Some(last) = result.last_mut() {
            last.1 = cum;
        }
    }
    result
}

/// Count file operations by change_kind.
/// ChangeKind: 1=Add, 2=Modify, 3=Delete, 4=Rename, 5=Copy, 6=TypeChange
pub fn file_operations_breakdown(file_stats: &[FileStat]) -> Vec<(String, u64)> {
    let mut counts = [0u64; 7]; // index 0 unused, 1-6 for ChangeKind values
    for fs in file_stats {
        let k = fs.change_kind as usize;
        if (1..=6).contains(&k) {
            counts[k] += 1;
        }
    }
    let labels = [
        "",
        "Added",
        "Modified",
        "Deleted",
        "Renamed",
        "Copied",
        "Type Changed",
    ];
    (1..=6)
        .filter(|&i| counts[i] > 0)
        .map(|i| (labels[i].to_string(), counts[i]))
        .collect()
}

/// Lines added/deleted grouped by file extension.
pub fn lines_by_extension(
    file_stats: &[FileStat],
    paths: &BTreeMap<u32, String>,
) -> Vec<(String, u64, u64)> {
    let mut ext_stats: HashMap<String, (u64, u64)> = HashMap::new();
    for fs in file_stats {
        if let Some(path) = paths.get(&fs.path_id) {
            let ext = path
                .rsplit('.')
                .next()
                .map(|e| e.to_lowercase())
                .unwrap_or_default();
            if ext.is_empty() || ext == path.to_lowercase() {
                continue;
            }
            let entry = ext_stats.entry(ext).or_insert((0, 0));
            entry.0 += fs.insertions as u64;
            entry.1 += fs.deletions as u64;
        }
    }
    let mut result: Vec<_> = ext_stats
        .into_iter()
        .map(|(ext, (ins, del))| (ext, ins, del))
        .collect();
    result.sort_by(|a, b| (b.1 + b.2).cmp(&(a.1 + a.2)));
    result.truncate(20);
    result
}

/// Lines statistics summary row.
#[derive(Debug, Serialize)]
pub struct LinesStatsSummary {
    pub label: String,
    pub min: u64,
    pub max: u64,
    pub avg: f64,
    pub median: u64,
    pub total: u64,
}

fn compute_stats_row(label: &str, values: &mut [u64]) -> LinesStatsSummary {
    values.sort_unstable();
    let len = values.len();
    if len == 0 {
        return LinesStatsSummary {
            label: label.to_string(),
            min: 0,
            max: 0,
            avg: 0.0,
            median: 0,
            total: 0,
        };
    }
    let total: u64 = values.iter().sum();
    LinesStatsSummary {
        label: label.to_string(),
        min: values[0],
        max: values[len - 1],
        avg: (total as f64 / len as f64 * 10.0).round() / 10.0,
        median: values[len / 2],
        total,
    }
}

/// Compute lines-changed statistics per commit, per day, per week, per month.
pub fn lines_stats_summary(commit_stats: &[CommitStat]) -> Vec<LinesStatsSummary> {
    if commit_stats.is_empty() {
        return Vec::new();
    }

    // Per commit
    let mut per_commit: Vec<u64> = commit_stats
        .iter()
        .map(|cs| cs.insertions + cs.deletions)
        .collect();

    // Per day
    let mut day_totals: BTreeMap<String, u64> = BTreeMap::new();
    for cs in commit_stats {
        let (y, m, d) = unix_ts_to_ymd(cs.author_ts);
        let key = format!("{y:04}-{m:02}-{d:02}");
        *day_totals.entry(key).or_insert(0) += cs.insertions + cs.deletions;
    }
    let mut per_day: Vec<u64> = day_totals.values().copied().collect();

    // Per week
    let mut week_totals: BTreeMap<String, u64> = BTreeMap::new();
    for cs in commit_stats {
        let (y, m, d) = unix_ts_to_ymd(cs.author_ts);
        let dow = day_of_week(y, m, d);
        let monday_ts = cs.author_ts - (dow as i64 * 86400);
        let (wy, wm, wd) = unix_ts_to_ymd(monday_ts);
        let key = format!("{wy:04}-{wm:02}-{wd:02}");
        *week_totals.entry(key).or_insert(0) += cs.insertions + cs.deletions;
    }
    let mut per_week: Vec<u64> = week_totals.values().copied().collect();

    // Per month
    let mut month_totals: BTreeMap<String, u64> = BTreeMap::new();
    for cs in commit_stats {
        let (y, m, _) = unix_ts_to_ymd(cs.author_ts);
        let key = format!("{y:04}-{m:02}");
        *month_totals.entry(key).or_insert(0) += cs.insertions + cs.deletions;
    }
    let mut per_month: Vec<u64> = month_totals.values().copied().collect();

    vec![
        compute_stats_row("Per Commit", &mut per_commit),
        compute_stats_row("Per Day", &mut per_day),
        compute_stats_row("Per Week", &mut per_week),
        compute_stats_row("Per Month", &mut per_month),
    ]
}

/// Per-author monthly commit timeline.
#[derive(Debug, Serialize)]
pub struct AuthorTimeline {
    pub author_id: u32,
    pub points: Vec<(String, u64)>,
}

/// Per-author monthly commit counts for top N authors.
pub fn author_timelines(commit_stats: &[CommitStat], top_n: usize) -> Vec<AuthorTimeline> {
    let mut author_total: HashMap<u32, u64> = HashMap::new();
    for cs in commit_stats {
        *author_total.entry(cs.author_id).or_insert(0) += 1;
    }
    let mut sorted_authors: Vec<_> = author_total.into_iter().collect();
    sorted_authors.sort_by(|a, b| b.1.cmp(&a.1));
    sorted_authors.truncate(top_n);
    let top_ids: HashSet<u32> = sorted_authors.iter().map(|(id, _)| *id).collect();

    let mut monthly: HashMap<u32, BTreeMap<String, u64>> = HashMap::new();
    for cs in commit_stats {
        if !top_ids.contains(&cs.author_id) {
            continue;
        }
        let (y, m, _) = unix_ts_to_ymd(cs.author_ts);
        let key = format!("{y:04}-{m:02}");
        *monthly
            .entry(cs.author_id)
            .or_default()
            .entry(key)
            .or_insert(0) += 1;
    }

    sorted_authors
        .iter()
        .map(|(id, _)| {
            let points = monthly
                .get(id)
                .map(|m| m.iter().map(|(k, &v)| (k.clone(), v)).collect())
                .unwrap_or_default();
            AuthorTimeline {
                author_id: *id,
                points,
            }
        })
        .collect()
}

/// Edge in contributor network graph.
#[derive(Debug, Serialize)]
pub struct ContribEdge {
    pub source: u32,
    pub target: u32,
    pub weight: u64,
}

/// Build contributor collaboration network.
pub fn contributor_network(
    file_stats: &[FileStat],
    min_shared: u64,
    top_authors: usize,
) -> (Vec<u32>, Vec<ContribEdge>) {
    let mut path_authors: HashMap<u32, HashSet<u32>> = HashMap::new();
    for fs in file_stats {
        path_authors
            .entry(fs.path_id)
            .or_default()
            .insert(fs.author_id);
    }

    let mut pair_counts: HashMap<(u32, u32), u64> = HashMap::new();
    let mut author_file_counts: HashMap<u32, u64> = HashMap::new();
    for authors in path_authors.values() {
        if authors.len() < 2 || authors.len() > 50 {
            continue;
        }
        let mut sorted: Vec<u32> = authors.iter().copied().collect();
        sorted.sort_unstable();
        for &a in &sorted {
            *author_file_counts.entry(a).or_insert(0) += 1;
        }
        for i in 0..sorted.len() {
            for j in (i + 1)..sorted.len() {
                *pair_counts.entry((sorted[i], sorted[j])).or_insert(0) += 1;
            }
        }
    }

    let mut top: Vec<_> = author_file_counts.into_iter().collect();
    top.sort_by(|a, b| b.1.cmp(&a.1));
    top.truncate(top_authors);
    let node_set: HashSet<u32> = top.iter().map(|(id, _)| *id).collect();
    let nodes: Vec<u32> = top.iter().map(|(id, _)| *id).collect();

    let edges: Vec<ContribEdge> = pair_counts
        .into_iter()
        .filter(|((s, t), w)| *w >= min_shared && node_set.contains(s) && node_set.contains(t))
        .map(|((s, t), w)| ContribEdge {
            source: s,
            target: t,
            weight: w,
        })
        .collect();

    (nodes, edges)
}

/// Node in code ownership treemap.
#[derive(Debug, Serialize)]
pub struct OwnershipNode {
    pub path: String,
    pub lines: u64,
    pub owner_id: u32,
}

/// Compute code ownership at directory level.
pub fn code_ownership(
    file_stats: &[FileStat],
    paths: &BTreeMap<u32, String>,
) -> Vec<OwnershipNode> {
    let mut dir_stats: HashMap<String, (u64, HashMap<u32, u64>)> = HashMap::new();
    for fs in file_stats {
        if let Some(path) = paths.get(&fs.path_id) {
            let parts: Vec<&str> = path.split('/').collect();
            let dir = if parts.len() <= 1 {
                "(root)".to_string()
            } else if parts.len() == 2 {
                parts[0].to_string()
            } else {
                format!("{}/{}", parts[0], parts[1])
            };
            let entry = dir_stats.entry(dir).or_insert((0, HashMap::new()));
            let lines = (fs.insertions + fs.deletions) as u64;
            entry.0 += lines;
            *entry.1.entry(fs.author_id).or_insert(0) += lines;
        }
    }

    let mut result: Vec<OwnershipNode> = dir_stats
        .into_iter()
        .filter(|(_, (lines, _))| *lines > 0)
        .map(|(path, (lines, authors))| {
            let owner_id = authors
                .into_iter()
                .max_by_key(|(_, l)| *l)
                .map(|(id, _)| id)
                .unwrap_or(0);
            OwnershipNode {
                path,
                lines,
                owner_id,
            }
        })
        .collect();
    result.sort_by(|a, b| b.lines.cmp(&a.lines));
    result.truncate(50);
    result
}

// ---------------------------------------------------------------------------
// Sequential change chain mining
// ---------------------------------------------------------------------------

/// A recurring sequence of file changes across consecutive commits.
#[derive(Debug, Serialize)]
pub struct ChangeChain {
    /// Ordered file paths in the chain (each from a different commit).
    pub files: Vec<String>,
    /// Number of times this exact chain was observed.
    pub occurrences: u64,
    /// Average wall-clock span (hours) from first to last file in the chain.
    pub avg_span_hours: f64,
    /// Confidence: occurrences / times the first file changed (0.0–1.0).
    pub confidence: f64,
}

/// Mine recurring sequential file-change chains from commit history.
///
/// Finds patterns like: "when file A changes, file B tends to change 1–W commits
/// later, then file C after that" — surfacing architectural cascades.
///
/// Algorithm:
/// 1. Build time-ordered commit→files mapping, filtering noise
/// 2. Mine frequent directed pairs (A→B within window)
/// 3. Iteratively extend pairs to longer chains, verifying each against actual data
/// 4. Deduplicate: remove chains that are strict prefixes of longer ones with similar support
pub fn sequential_coupling(
    commit_stats: &[CommitStat],
    file_stats: &[FileStat],
    paths: &BTreeMap<u32, String>,
    min_support: u64,
    max_chain_len: usize,
    window: usize,
) -> Vec<ChangeChain> {
    if commit_stats.is_empty() || file_stats.is_empty() {
        return Vec::new();
    }

    // Step 1: Build time-ordered commit sequence
    let mut commit_order: Vec<(i64, [u8; 20])> = commit_stats
        .iter()
        .map(|cs| {
            let oid: [u8; 20] = cs.commit_oid.as_bytes().try_into().unwrap();
            (cs.author_ts, oid)
        })
        .collect();
    commit_order.sort_by_key(|(ts, _)| *ts);

    let oid_to_idx: HashMap<[u8; 20], usize> = commit_order
        .iter()
        .enumerate()
        .map(|(i, (_, oid))| (*oid, i))
        .collect();

    let timestamps: Vec<i64> = commit_order.iter().map(|(ts, _)| *ts).collect();
    let n = commit_order.len();

    // Build commit_idx → set of path_ids
    let mut commit_files: Vec<HashSet<u32>> = vec![HashSet::new(); n];
    for fs in file_stats {
        let oid: [u8; 20] = fs.commit_oid.as_bytes().try_into().unwrap();
        if let Some(&idx) = oid_to_idx.get(&oid) {
            commit_files[idx].insert(fs.path_id);
        }
    }

    // Filter: skip commits with >50 files (bulk imports, merges)
    for files in &mut commit_files {
        if files.len() > 50 {
            files.clear();
        }
    }

    // Filter: remove noise files appearing in >5% of commits
    let noise_threshold = (n as f64 * 0.05).max(10.0) as u64;
    let mut file_freq: HashMap<u32, u64> = HashMap::new();
    for files in &commit_files {
        for &fid in files {
            *file_freq.entry(fid).or_insert(0) += 1;
        }
    }
    let noise_files: HashSet<u32> = file_freq
        .iter()
        .filter(|(_, &cnt)| cnt > noise_threshold)
        .map(|(&fid, _)| fid)
        .collect();
    for files in &mut commit_files {
        files.retain(|fid| !noise_files.contains(fid));
    }

    // Build per-file sorted position list (for chain verification)
    let mut file_positions: HashMap<u32, Vec<usize>> = HashMap::new();
    for (idx, files) in commit_files.iter().enumerate() {
        for &fid in files {
            file_positions.entry(fid).or_default().push(idx);
        }
    }
    // Positions are already sorted since we iterate idx in order

    // Count first-file occurrences (for confidence calculation)
    let file_total: HashMap<u32, u64> = file_positions
        .iter()
        .map(|(&fid, pos)| (fid, pos.len() as u64))
        .collect();

    // Step 2: Mine frequent directed pairs
    let mut pair_counts: HashMap<(u32, u32), u64> = HashMap::new();
    for i in 0..n {
        if commit_files[i].is_empty() {
            continue;
        }
        let end = (i + window).min(n - 1);
        for j in (i + 1)..=end {
            if commit_files[j].is_empty() {
                continue;
            }
            for &a in &commit_files[i] {
                for &b in &commit_files[j] {
                    if a != b {
                        *pair_counts.entry((a, b)).or_insert(0) += 1;
                    }
                }
            }
        }
    }
    pair_counts.retain(|_, cnt| *cnt >= min_support);

    if pair_counts.is_empty() {
        return Vec::new();
    }

    // Build adjacency list from frequent pairs (bounded fan-out)
    let mut adj: HashMap<u32, Vec<u32>> = HashMap::new();
    // Group by source, keep top-10 successors by count
    let mut by_source: HashMap<u32, Vec<(u32, u64)>> = HashMap::new();
    for (&(a, b), &cnt) in &pair_counts {
        by_source.entry(a).or_default().push((b, cnt));
    }
    for (src, mut succs) in by_source {
        succs.sort_by(|a, b| b.1.cmp(&a.1));
        succs.truncate(10);
        adj.insert(src, succs.into_iter().map(|(b, _)| b).collect());
    }

    // Step 3: Build verified chains level by level
    // Level 2: verified pairs
    let mut current_level: Vec<(Vec<u32>, u64, f64)> = Vec::new();
    for &(a, b) in pair_counts.keys() {
        let (count, avg_span) =
            count_chain_occurrences(&[a, b], &file_positions, &timestamps, window);
        if count >= min_support {
            current_level.push((vec![a, b], count, avg_span));
        }
    }

    let mut all_chains: Vec<(Vec<u32>, u64, f64)> = current_level.clone();

    // Extend to longer chains
    for _len in 3..=max_chain_len {
        let mut next_level: Vec<(Vec<u32>, u64, f64)> = Vec::new();
        for (chain, _, _) in &current_level {
            let last = *chain.last().unwrap();
            if let Some(successors) = adj.get(&last) {
                for &next in successors {
                    if chain.contains(&next) {
                        continue;
                    }
                    let mut new_chain = chain.clone();
                    new_chain.push(next);
                    let (count, avg_span) =
                        count_chain_occurrences(&new_chain, &file_positions, &timestamps, window);
                    if count >= min_support {
                        next_level.push((new_chain, count, avg_span));
                    }
                }
            }
        }
        if next_level.is_empty() {
            break;
        }
        // Safety: cap candidates per level
        if next_level.len() > 500 {
            next_level.sort_by(|a, b| b.1.cmp(&a.1));
            next_level.truncate(500);
        }
        all_chains.extend(next_level.clone());
        current_level = next_level;
    }

    // Step 4: Deduplicate — remove chains that are strict prefixes of longer ones
    // Sort by length desc, then count desc
    all_chains.sort_by(|a, b| b.0.len().cmp(&a.0.len()).then(b.1.cmp(&a.1)));

    let mut kept: Vec<(Vec<u32>, u64, f64)> = Vec::new();
    for (chain, count, avg_span) in all_chains {
        // Check if this chain is a prefix of any already-kept (longer) chain
        // with at least 50% of its support
        let dominated = kept.iter().any(|(longer, longer_count, _)| {
            longer.len() > chain.len()
                && longer.starts_with(&chain)
                && *longer_count as f64 >= count as f64 * 0.5
        });
        if !dominated {
            kept.push((chain, count, avg_span));
        }
    }

    // Convert to output, resolve path names
    let mut result: Vec<ChangeChain> = kept
        .into_iter()
        .map(|(chain, count, avg_span)| {
            let first_total = file_total.get(&chain[0]).copied().unwrap_or(1);
            let confidence = count as f64 / first_total as f64;
            let files = chain
                .iter()
                .map(|fid| {
                    paths
                        .get(fid)
                        .cloned()
                        .unwrap_or_else(|| format!("[{fid}]"))
                })
                .collect();
            ChangeChain {
                files,
                occurrences: count,
                avg_span_hours: (avg_span * 10.0).round() / 10.0,
                confidence: (confidence * 1000.0).round() / 1000.0,
            }
        })
        .collect();

    // Sort by score: longer chains with decent support are most interesting
    result.sort_by(|a, b| {
        let score_a = a.files.len() as u64 * a.occurrences;
        let score_b = b.files.len() as u64 * b.occurrences;
        score_b.cmp(&score_a)
    });
    result.truncate(50);
    result
}

/// Count how many times a chain of file IDs occurs in the commit sequence,
/// where each successive file appears within `window` commits of the previous.
/// Returns (occurrence count, average span in hours).
fn count_chain_occurrences(
    chain: &[u32],
    file_positions: &HashMap<u32, Vec<usize>>,
    timestamps: &[i64],
    window: usize,
) -> (u64, f64) {
    if chain.is_empty() {
        return (0, 0.0);
    }

    let first_positions = match file_positions.get(&chain[0]) {
        Some(p) => p,
        None => return (0, 0.0),
    };

    let mut count = 0u64;
    let mut total_span_hours = 0.0f64;

    for &start_pos in first_positions {
        let mut current_pos = start_pos;
        let mut found = true;

        for &file_id in &chain[1..] {
            let positions = match file_positions.get(&file_id) {
                Some(p) => p,
                None => {
                    found = false;
                    break;
                }
            };

            // Binary search for first position > current_pos and <= current_pos + window
            let search_min = current_pos + 1;
            let search_max = current_pos + window;

            let idx = match positions.binary_search(&search_min) {
                Ok(i) => i,
                Err(i) => i,
            };

            if idx < positions.len() && positions[idx] <= search_max {
                current_pos = positions[idx];
            } else {
                found = false;
                break;
            }
        }

        if found {
            count += 1;
            let span_secs = (timestamps[current_pos] - timestamps[start_pos]).abs();
            total_span_hours += span_secs as f64 / 3600.0;
        }
    }

    let avg_span = if count > 0 {
        total_span_hours / count as f64
    } else {
        0.0
    };
    (count, avg_span)
}
