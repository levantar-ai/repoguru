use std::fs;
use std::path::Path;

/// Recursively collect all .rs files under a directory.
fn collect_rs_files(dir: &Path, files: &mut Vec<std::path::PathBuf>) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                collect_rs_files(&path, files);
            } else if path.extension().and_then(|e| e.to_str()) == Some("rs") {
                files.push(path);
            }
        }
    }
}

#[test]
fn test_no_process_command() {
    let src_dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("src");
    let mut rs_files = Vec::new();
    collect_rs_files(&src_dir, &mut rs_files);

    assert!(!rs_files.is_empty(), "should find .rs files in src/");

    let mut violations = Vec::new();
    for file in &rs_files {
        let content = fs::read_to_string(file).expect("read source file");
        if content.contains("std::process::Command") || content.contains("process::Command") {
            // Exclude the check in main.rs for ExitCode (std::process::ExitCode is fine)
            // We only flag std::process::Command usage
            for (i, line) in content.lines().enumerate() {
                if line.contains("process::Command") && !line.contains("ExitCode") {
                    violations.push(format!("{}:{}: {}", file.display(), i + 1, line.trim()));
                }
            }
        }
    }

    assert!(
        violations.is_empty(),
        "Found std::process::Command usage in source files (§0.2 item 6):\n{}",
        violations.join("\n")
    );
}
