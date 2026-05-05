#!/usr/bin/env python3
"""Stage 3c — aggregate per-repo AI filescan JSONs into one viewmodel.

Reads $TARGET_ROOT/data/ai_filescan/repos/<owner>/<repo>.json and emits
viewmodels/19a_ai_filescan.json with per-pattern repo + org counts.
"""
from __future__ import annotations

import json
import os
import sys
from collections import Counter, defaultdict
from pathlib import Path


# Map JSON field name → display label.
PATTERN_LABELS = {
    "claude_md": "CLAUDE.md",
    "agents_md": "AGENTS.md",
    "copilot_instructions": ".github/copilot-instructions.md",
    "cursorrules": ".cursorrules",
    "cursor_dir": ".cursor/",
    "claude_dir": ".claude/",
    "claude_agents_files": ".claude/agents/* (file count)",
    "claude_skills_files": ".claude/skills/* (file count)",
    "aider_conf": ".aider.conf.yml",
    "windsurfrules": ".windsurfrules",
    "clinerules": ".clinerules",
    "continue_dir": ".continue/",
}


def main() -> int:
    root = os.environ.get("TARGET_ROOT")
    if not root:
        sys.exit("ERROR: TARGET_ROOT env var is required")
    target_root = Path(root).resolve()
    src = target_root / "data" / "ai_filescan" / "repos"
    out = target_root / "viewmodels" / "19a_ai_filescan.json"

    if not src.is_dir():
        out.write_text(json.dumps({"orgs_scanned": 0, "repos_scanned": 0, "by_pattern": [], "repos_with_any_ai": [], "totals": {"repos_with_any_ai": 0, "any_ai_pct": 0}}, indent=2))
        print(f"[no scan data — wrote stub] {out}")
        return 0

    pattern_repo_count: Counter = Counter()
    pattern_orgs: dict[str, set] = defaultdict(set)
    pattern_orgs_top: dict[str, Counter] = defaultdict(Counter)
    repos_with_any: list = []
    repos_scanned: int = 0
    org_set: set = set()
    org_with_any_count: Counter = Counter()

    for p in src.rglob("*.json"):
        try:
            d = json.loads(p.read_text())
        except json.JSONDecodeError:
            continue
        slug = d.get("slug") or f"{p.parent.name}/{p.stem}"
        org = slug.split("/", 1)[0]
        org_set.add(org)
        repos_scanned += 1
        had_any = False
        repo_hits = []
        for key, label in PATTERN_LABELS.items():
            v = d.get(key)
            if isinstance(v, bool):
                if v:
                    pattern_repo_count[key] += 1
                    pattern_orgs[key].add(org)
                    pattern_orgs_top[key][org] += 1
                    repo_hits.append(label)
                    had_any = True
            elif isinstance(v, int):
                if v > 0:
                    pattern_repo_count[key] += 1
                    pattern_orgs[key].add(org)
                    pattern_orgs_top[key][org] += v
                    repo_hits.append(f"{label}: {v}")
                    had_any = True
        if had_any:
            repos_with_any.append({"slug": slug, "hits": repo_hits})
            org_with_any_count[org] += 1

    by_pattern = []
    for key, label in PATTERN_LABELS.items():
        n = pattern_repo_count.get(key, 0)
        if n == 0:
            continue
        by_pattern.append({
            "pattern": label,
            "key": key,
            "total_repos": n,
            "total_orgs": len(pattern_orgs[key]),
            "orgs_top10": [o for o, _ in pattern_orgs_top[key].most_common(10)],
        })
    by_pattern.sort(key=lambda r: -r["total_repos"])

    payload = {
        "orgs_scanned": len(org_set),
        "repos_scanned": repos_scanned,
        "totals": {
            "repos_with_any_ai": len(repos_with_any),
            "any_ai_pct": round(100 * len(repos_with_any) / max(repos_scanned, 1), 2),
            "orgs_with_any_ai": len(org_with_any_count),
        },
        "by_pattern": by_pattern,
        "repos_with_any_ai_top50": sorted(repos_with_any, key=lambda r: -len(r["hits"]))[:50],
        "top_orgs_by_ai_repo_count": [
            {"org": o, "repos": c} for o, c in org_with_any_count.most_common(25)
        ],
    }
    out.write_text(json.dumps(payload, indent=2))
    print(f"wrote {out}")
    print(f"  repos scanned:     {repos_scanned}")
    print(f"  orgs scanned:      {len(org_set)}")
    print(f"  repos with AI cfg: {len(repos_with_any)} ({payload['totals']['any_ai_pct']}%)")
    print(f"  patterns matched:  {len(by_pattern)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
