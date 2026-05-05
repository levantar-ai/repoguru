use imara_diff::intern::InternedInput;
use imara_diff::Algorithm;

use crate::diff::binary::is_binary;

/// Sentinel value for binary files (§6.4.2).
pub const BINARY_SENTINEL: u32 = 0xFFFF_FFFF;

/// Line diff statistics.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct LineStats {
    pub insertions: u32,
    pub deletions: u32,
    /// True if diff bailed out (currently unused with imara-diff histogram,
    /// kept for API compatibility).
    pub bailed_out: bool,
}

/// Compute line-level insertion/deletion counts using imara-diff histogram algorithm (§8.3).
///
/// Returns sentinel values for binary content.
/// Does not generate patch text or hunks.
pub fn compute_line_stats(old: &[u8], new: &[u8]) -> LineStats {
    if is_binary(old) || is_binary(new) {
        return LineStats {
            insertions: BINARY_SENTINEL,
            deletions: BINARY_SENTINEL,
            bailed_out: false,
        };
    }

    if old == new {
        return LineStats {
            insertions: 0,
            deletions: 0,
            bailed_out: false,
        };
    }

    // imara-diff works on &str — convert from bytes.
    // Non-UTF8 content gets lossy conversion; line boundaries are preserved.
    let old_str = String::from_utf8_lossy(old);
    let new_str = String::from_utf8_lossy(new);

    let input = InternedInput::new(old_str.as_ref(), new_str.as_ref());
    let diff = imara_diff::diff(Algorithm::Histogram, &input, counter());

    LineStats {
        insertions: diff.insertions,
        deletions: diff.deletions,
        bailed_out: false,
    }
}

struct Counter {
    insertions: u32,
    deletions: u32,
}

fn counter() -> Counter {
    Counter {
        insertions: 0,
        deletions: 0,
    }
}

impl imara_diff::Sink for Counter {
    type Out = Counter;

    fn process_change(&mut self, before: std::ops::Range<u32>, after: std::ops::Range<u32>) {
        self.deletions += before.end - before.start;
        self.insertions += after.end - after.start;
    }

    fn finish(self) -> Self::Out {
        self
    }
}
