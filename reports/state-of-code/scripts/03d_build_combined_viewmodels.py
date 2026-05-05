#!/usr/bin/env python3
"""Stage 3d — derive viewmodels from the unified combined/ data.

Reads $TARGET_ROOT/data/combined/<owner>/<repo>.json (each containing
{slug, tech, gitstats, reportcard}) and emits:

  22_report_card.json — grade distribution, per-org rollup, exemplars
  23_ai_filescan.json — AI tooling presence (replaces 19a_ai_filescan)

This is the right architecture: the combined/ data is the canonical
per-repo record, derived viewmodels just project from it.
"""
from __future__ import annotations

import json
import os
import sys
from collections import Counter, defaultdict
from pathlib import Path


def main() -> int:
    root = os.environ.get("TARGET_ROOT")
    if not root:
        sys.exit("ERROR: TARGET_ROOT env var is required")
    target_root = Path(root).resolve()
    src = target_root / "data" / "combined"
    out_dir = target_root / "viewmodels"
    out_dir.mkdir(parents=True, exist_ok=True)

    if not src.is_dir():
        sys.exit(f"ERROR: combined data not found at {src}")

    # Per-repo aggregations.
    grade_counts = Counter()  # overall grade
    cat_grade_counts: dict[str, Counter] = defaultdict(Counter)  # category → grade
    cat_score_sum: dict[str, int] = defaultdict(int)
    cat_score_n: dict[str, int] = defaultdict(int)
    org_scores: dict[str, list[int]] = defaultdict(list)
    org_grade_counts: dict[str, Counter] = defaultdict(Counter)
    repos_with_card: int = 0

    # AI tooling presence.
    ai_repo_count: Counter = Counter()
    ai_orgs: dict[str, set] = defaultdict(set)
    ai_orgs_top: dict[str, Counter] = defaultdict(Counter)
    repos_with_any_ai: list = []

    # Exemplars per category.
    exemplars: dict[str, list] = defaultdict(list)

    repos_scanned = 0
    org_set = set()

    for p in src.rglob("*.json"):
        try:
            d = json.loads(p.read_text())
        except json.JSONDecodeError:
            continue
        slug = d.get("slug") or f"{p.parent.name}/{p.stem}"
        org = slug.split("/", 1)[0]
        org_set.add(org)
        repos_scanned += 1

        rc = d.get("reportcard") or {}
        if rc and rc.get("overall_grade"):
            repos_with_card += 1
            overall = rc.get("overall_score", 0)
            overall_grade = rc.get("overall_grade", "F")
            grade_counts[overall_grade] += 1
            org_scores[org].append(overall)
            org_grade_counts[org][overall_grade] += 1
            for cat, info in (rc.get("categories") or {}).items():
                if not isinstance(info, dict):
                    continue
                g = info.get("grade", "F")
                s = info.get("score", 0)
                cat_grade_counts[cat][g] += 1
                cat_score_sum[cat] += s
                cat_score_n[cat] += 1
                # Per-category exemplars: top 25 with highest score.
                exemplars[cat].append({"slug": slug, "score": s})

            # AI tooling presence (lifted from reportcard signals).
            ai_signals = ((rc.get("signals") or {}).get("ai_tooling") or {})
            had_any_ai = False
            ai_hits = []
            for k, v in ai_signals.items():
                if v:
                    ai_repo_count[k] += 1
                    ai_orgs[k].add(org)
                    ai_orgs_top[k][org] += 1
                    ai_hits.append(k)
                    had_any_ai = True
            if had_any_ai:
                repos_with_any_ai.append({"slug": slug, "hits": ai_hits})

    # Top exemplars per category.
    for cat in exemplars:
        exemplars[cat] = sorted(exemplars[cat], key=lambda r: r["score"], reverse=True)[:25]

    # Per-org rollup — average overall score, distribution.
    org_rows = []
    for org, scores in org_scores.items():
        if not scores:
            continue
        org_rows.append({
            "org": org,
            "repos_scored": len(scores),
            "mean_overall": round(sum(scores) / len(scores), 1),
            "grade_counts": dict(org_grade_counts[org]),
        })
    org_rows.sort(key=lambda r: r["mean_overall"], reverse=True)

    cat_means = {
        cat: round(cat_score_sum[cat] / cat_score_n[cat], 1)
        for cat in cat_score_sum
        if cat_score_n[cat] > 0
    }

    # Order grades A→F for display.
    GRADE_ORDER = ["A", "B", "C", "D", "F"]
    overall_dist = [{"grade": g, "count": grade_counts.get(g, 0)} for g in GRADE_ORDER]
    cat_dist = {
        cat: [{"grade": g, "count": cat_grade_counts[cat].get(g, 0)} for g in GRADE_ORDER]
        for cat in cat_grade_counts
    }

    report_card = {
        "totals": {
            "repos_scored": repos_with_card,
            "orgs_scored": len(org_scores),
        },
        "overall_grade_distribution": overall_dist,
        "category_grade_distribution": cat_dist,
        "category_means": cat_means,
        "per_org_top25_by_score": org_rows[:25],
        "per_org_bottom25_by_score": list(reversed(org_rows[-25:])),
        "exemplars_by_category": {
            cat: rows[:5] for cat, rows in exemplars.items()
        },
    }
    (out_dir / "22_report_card.json").write_text(json.dumps(report_card, indent=2))
    print(f"wrote {out_dir / '22_report_card.json'}")

    # AI filescan rebuild.
    ai_label = {
        "claude_md": "CLAUDE.md",
        "agents_md": "AGENTS.md",
        "cursor": ".cursor/ or .cursorrules",
        "copilot_instructions": ".github/copilot-instructions.md",
        "claude_dir": ".claude/",
        "aider_conf": ".aider.conf.yml",
    }
    by_pattern = []
    for k, label in ai_label.items():
        n = ai_repo_count.get(k, 0)
        if n == 0:
            continue
        by_pattern.append({
            "pattern": label,
            "key": k,
            "total_repos": n,
            "total_orgs": len(ai_orgs[k]),
            "orgs_top10": [o for o, _ in ai_orgs_top[k].most_common(10)],
        })
    by_pattern.sort(key=lambda r: -r["total_repos"])
    ai_payload = {
        "orgs_scanned": len(org_set),
        "repos_scanned": repos_scanned,
        "totals": {
            "repos_with_any_ai": len(repos_with_any_ai),
            "any_ai_pct": round(100 * len(repos_with_any_ai) / max(repos_scanned, 1), 2),
            "orgs_with_any_ai": len({s["slug"].split("/", 1)[0] for s in repos_with_any_ai}),
        },
        "by_pattern": by_pattern,
        "repos_with_any_ai_top50": sorted(repos_with_any_ai, key=lambda r: -len(r["hits"]))[:50],
    }
    # Replace old 19a_ai_filescan with the unified version.
    (out_dir / "19a_ai_filescan.json").write_text(json.dumps(ai_payload, indent=2))
    print(f"wrote {out_dir / '19a_ai_filescan.json'} (from combined data)")

    print(f"  repos scanned:     {repos_scanned}")
    print(f"  repos scored:      {repos_with_card}")
    print(f"  orgs:              {len(org_set)}")
    print(f"  repos with AI:     {len(repos_with_any_ai)}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
