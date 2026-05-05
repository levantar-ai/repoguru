use repoanalyze::diff::line_diff::{compute_line_stats, LineStats, BINARY_SENTINEL};

#[test]
fn test_empty_to_content() {
    let stats = compute_line_stats(b"", b"line1\nline2\nline3\n");
    assert_eq!(stats.insertions, 3);
    assert_eq!(stats.deletions, 0);
    assert!(!stats.bailed_out);
}

#[test]
fn test_content_to_empty() {
    let stats = compute_line_stats(b"line1\nline2\n", b"");
    assert_eq!(stats.insertions, 0);
    assert_eq!(stats.deletions, 2);
}

#[test]
fn test_modify_lines() {
    let old = b"aaa\nbbb\nccc\n";
    let new = b"aaa\nBBB\nccc\nddd\n";
    let stats = compute_line_stats(old, new);
    // bbb deleted, BBB and ddd inserted
    assert_eq!(stats.deletions, 1);
    assert_eq!(stats.insertions, 2);
}

#[test]
fn test_identical_content() {
    let data = b"same\nlines\nhere\n";
    let stats = compute_line_stats(data, data);
    assert_eq!(stats.insertions, 0);
    assert_eq!(stats.deletions, 0);
}

#[test]
fn test_no_final_newline() {
    let old = b"line1\nline2";
    let new = b"line1\nline2\nline3";
    let stats = compute_line_stats(old, new);
    assert_eq!(stats.insertions, 1);
    assert_eq!(stats.deletions, 0);

    let stats2 = compute_line_stats(b"line1\n", b"line1");
    assert_eq!(stats2.insertions, 0);
    assert_eq!(stats2.deletions, 0);
}

#[test]
fn test_large_diff() {
    let old: Vec<u8> = (0..10_000)
        .map(|i| format!("line {i}\n"))
        .collect::<String>()
        .into_bytes();
    let new: Vec<u8> = (0..10_000)
        .map(|i| {
            if i % 100 == 0 {
                format!("CHANGED {i}\n")
            } else {
                format!("line {i}\n")
            }
        })
        .collect::<String>()
        .into_bytes();

    let stats = compute_line_stats(&old, &new);
    // 100 lines changed (every 100th): 100 deletions + 100 insertions
    assert_eq!(stats.deletions, 100);
    assert_eq!(stats.insertions, 100);
    assert!(!stats.bailed_out);
}

#[test]
fn test_binary_skipped() {
    let binary = b"some\x00binary\x00content";
    let text = b"hello\nworld\n";

    let stats = compute_line_stats(binary, text);
    assert_eq!(stats.insertions, BINARY_SENTINEL);
    assert_eq!(stats.deletions, BINARY_SENTINEL);

    let stats2 = compute_line_stats(text, binary);
    assert_eq!(stats2.insertions, BINARY_SENTINEL);
    assert_eq!(stats2.deletions, BINARY_SENTINEL);
}
