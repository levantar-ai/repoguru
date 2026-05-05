use std::collections::{BTreeMap, BTreeSet};

use serde::Serialize;

use crate::model::commit_stat::CommitStat;

/// Granularity for time bucketing.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Granularity {
    Daily,
    Weekly,
    Monthly,
}

/// A single time bucket in a timeseries.
#[derive(Debug, Serialize)]
pub struct TimeBucket {
    pub period_start: String, // ISO date string
    pub commits: u64,
    pub insertions: u64,
    pub deletions: u64,
    pub authors: u64, // distinct count
}

/// Compute timeseries from commit stats (§10).
pub fn compute_timeseries(stats: &[CommitStat], granularity: Granularity) -> Vec<TimeBucket> {
    // Group by bucket key
    struct BucketAccum {
        commits: u64,
        insertions: u64,
        deletions: u64,
        authors: BTreeSet<u32>,
    }

    let mut buckets: BTreeMap<String, BucketAccum> = BTreeMap::new();

    for cs in stats {
        let key = bucket_key(cs.author_ts, granularity);
        let entry = buckets.entry(key).or_insert_with(|| BucketAccum {
            commits: 0,
            insertions: 0,
            deletions: 0,
            authors: BTreeSet::new(),
        });
        entry.commits += 1;
        entry.insertions += cs.insertions;
        entry.deletions += cs.deletions;
        entry.authors.insert(cs.author_id);
    }

    buckets
        .into_iter()
        .map(|(key, acc)| TimeBucket {
            period_start: key,
            commits: acc.commits,
            insertions: acc.insertions,
            deletions: acc.deletions,
            authors: acc.authors.len() as u64,
        })
        .collect()
}

fn bucket_key(unix_ts: i64, granularity: Granularity) -> String {
    // Convert unix timestamp to date components
    let (year, month, day) = unix_ts_to_ymd(unix_ts);

    match granularity {
        Granularity::Daily => format!("{year:04}-{month:02}-{day:02}"),
        Granularity::Weekly => {
            // Truncate to Monday of the week
            let dow = day_of_week(year, month, day); // 0=Mon, 6=Sun
            let (wy, wm, wd) = subtract_days(year, month, day, dow);
            format!("{wy:04}-{wm:02}-{wd:02}")
        }
        Granularity::Monthly => format!("{year:04}-{month:02}-01"),
    }
}

/// Convert unix timestamp to (year, month, day).
pub fn unix_ts_to_ymd(ts: i64) -> (i32, u32, u32) {
    // Days since epoch (1970-01-01)
    let days = (ts / 86400) as i32;
    civil_from_days(days)
}

/// Civil date from days since 1970-01-01 (Howard Hinnant's algorithm).
fn civil_from_days(z: i32) -> (i32, u32, u32) {
    let z = z + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = (z - era * 146097) as u32;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe as i32 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y, m, d)
}

/// Day of week: 0=Monday, 6=Sunday.
fn day_of_week(y: i32, m: u32, d: u32) -> u32 {
    // Tomohiko Sakamoto's algorithm
    let t = [0i32, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
    let y = if m < 3 { y - 1 } else { y };
    let dow = (y + y / 4 - y / 100 + y / 400 + t[(m - 1) as usize] + d as i32) % 7;
    // Sakamoto gives 0=Sunday; convert to 0=Monday
    ((dow + 6) % 7) as u32
}

/// Subtract `n` days from a date. Simple implementation.
fn subtract_days(mut y: i32, mut m: u32, mut d: u32, n: u32) -> (i32, u32, u32) {
    for _ in 0..n {
        if d > 1 {
            d -= 1;
        } else {
            // Go to previous month
            if m > 1 {
                m -= 1;
            } else {
                m = 12;
                y -= 1;
            }
            d = days_in_month(y, m);
        }
    }
    (y, m, d)
}

fn days_in_month(y: i32, m: u32) -> u32 {
    match m {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if y % 4 == 0 && (y % 100 != 0 || y % 400 == 0) {
                29
            } else {
                28
            }
        }
        _ => 30,
    }
}
