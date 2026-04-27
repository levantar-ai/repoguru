//! License category analyzer (weight: 0.10).

use super::tree_reader::TreeContext;
use super::Signal;

const LICENSE_FILES: &[&str] = &[
    "LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING", "LICENCE", "LICENCE.md", "LICENCE.txt",
];

const PERMISSIVE: &[&str] = &[
    "MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "Unlicense", "CC0-1.0",
];

const COPYLEFT: &[&str] = &[
    "GPL-2.0", "GPL-3.0", "AGPL-3.0", "LGPL-2.1", "LGPL-3.0", "MPL-2.0",
];

pub fn analyze(ctx: &TreeContext) -> Vec<Signal> {
    let mut signals = Vec::new();

    // License file exists (40 pts)
    let license_path = LICENSE_FILES.iter().find(|f| ctx.has_path(f));
    signals.push(Signal {
        name: "License file exists".into(),
        found: license_path.is_some(),
        details: license_path.map(|p| p.to_string()).unwrap_or_default(),
        points: 40,
    });

    // Detect SPDX license from content
    let license_content = license_path.and_then(|p| ctx.file_content(p));
    let detected_spdx = license_content.and_then(detect_spdx_id);

    // SPDX license detected (30 pts)
    signals.push(Signal {
        name: "SPDX license detected".into(),
        found: detected_spdx.is_some(),
        details: detected_spdx.clone().unwrap_or_default(),
        points: 30,
    });

    // Permissive license (30 pts) — only if SPDX detected
    let is_permissive = detected_spdx
        .as_deref()
        .map(|id| PERMISSIVE.iter().any(|p| id.contains(p)))
        .unwrap_or(false);
    // Copyleft license (20 pts) — only if SPDX detected and not permissive
    let is_copyleft = detected_spdx
        .as_deref()
        .map(|id| COPYLEFT.iter().any(|c| id.contains(c)))
        .unwrap_or(false);

    if is_permissive {
        signals.push(Signal {
            name: "Permissive license".into(),
            found: true,
            details: detected_spdx.clone().unwrap_or_default(),
            points: 30,
        });
    } else {
        signals.push(Signal {
            name: "Copyleft license".into(),
            found: is_copyleft,
            details: detected_spdx.unwrap_or_default(),
            points: 20,
        });
    }

    signals
}

/// Attempt to detect an SPDX license identifier from the LICENSE file content.
fn detect_spdx_id(content: &str) -> Option<String> {
    let lower = content.to_lowercase();

    // Check for SPDX identifier header
    if let Some(line) = content.lines().find(|l| l.contains("SPDX-License-Identifier:")) {
        if let Some(id) = line.split("SPDX-License-Identifier:").nth(1) {
            return Some(id.trim().to_string());
        }
    }

    // Heuristic detection from content
    if lower.contains("mit license") || lower.contains("permission is hereby granted, free of charge") {
        return Some("MIT".to_string());
    }
    if lower.contains("apache license") && lower.contains("version 2.0") {
        return Some("Apache-2.0".to_string());
    }
    if lower.contains("gnu general public license") {
        if lower.contains("version 3") {
            return Some("GPL-3.0".to_string());
        }
        if lower.contains("version 2") {
            return Some("GPL-2.0".to_string());
        }
    }
    if lower.contains("gnu lesser general public license") {
        return Some("LGPL-2.1".to_string());
    }
    if lower.contains("gnu affero general public license") {
        return Some("AGPL-3.0".to_string());
    }
    if lower.contains("bsd 3-clause") || lower.contains("redistribution and use in source and binary") && lower.contains("3. neither") {
        return Some("BSD-3-Clause".to_string());
    }
    if lower.contains("bsd 2-clause") || lower.contains("redistribution and use in source and binary") && !lower.contains("3. neither") {
        return Some("BSD-2-Clause".to_string());
    }
    if lower.contains("isc license") || lower.contains("permission to use, copy, modify, and/or distribute") {
        return Some("ISC".to_string());
    }
    if lower.contains("the unlicense") || lower.contains("this is free and unencumbered software") {
        return Some("Unlicense".to_string());
    }
    if lower.contains("mozilla public license") && lower.contains("2.0") {
        return Some("MPL-2.0".to_string());
    }
    if lower.contains("cc0") || lower.contains("creative commons") && lower.contains("public domain") {
        return Some("CC0-1.0".to_string());
    }

    None
}
