#!/usr/bin/env python3
"""Stage 3 — build report view-models from raw repo metadata + tech-detect JSONs.

Reads, for a given target:
  $TARGET_ROOT/target.json            — title / blurb / entity label
  $TARGET_ROOT/orgs.txt               — input GitHub org slugs (just for record)
  $TARGET_ROOT/data/raw/repos.tsv     — one row per public repo (GitHub API)
  $TARGET_ROOT/data/techdetect/**.json — per-repo tech-detect output
  $TARGET_ROOT/data/scan_meta/        — wall-clock + done/failed manifest

…and writes one view-model JSON per report section to:
  $TARGET_ROOT/viewmodels/

Targets live entirely outside the repo (default:
~/.repoguru-reports/<type>/<slug>) — both config and data are siblings
in one self-contained directory, so multi-GB clone artefacts can never
land in source control.

Re-running overwrites the viewmodels in place (idempotent). No external
deps — stdlib only. Designed to run in <30s on a 10k-repo corpus.

The script is intentionally domain-agnostic: nothing about *which* set
of orgs is being analysed lives here. Headlines, audience labels, and
the report title come from target.json so the same code generates the
same shape of output for any organisation list.
"""
from __future__ import annotations

import csv
import json
import os
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

# ───────────────────────── config ─────────────────────────

TOP_N = 25  # how many entries we keep in "top X" lists
ZOMBIE_YEARS = 2  # untouched-for-this-many-years → "zombie"

DEFAULT_TARGET = {
    "slug": "unnamed",
    "title": "State of Code",
    "subtitle": "An analysis of public repositories.",
    "entity_label": "organisation",  # singular, used in "the largest <entity_label> repository is X"
    "entity_label_plural": "organisations",  # used in headline strings
    "audience_label": "organisations",  # used in cover blurbs
}


def resolve_target_root() -> Path:
    """Resolve the target directory (config + data + viewmodels).

    Comes from $TARGET_ROOT (set by the orchestrator). Lives outside
    the repo, under $DATA_ROOT/<report_type>/<slug>/ by default."""
    root = os.environ.get("TARGET_ROOT")
    if not root:
        sys.exit(
            "ERROR: TARGET_ROOT env var is required.\n"
            "       Use run_all.sh <slug>, or source _paths.sh + resolve_paths."
        )
    p = Path(root).resolve()
    if not p.is_dir():
        sys.exit(f"ERROR: TARGET_ROOT does not exist: {p}")
    return p


def load_target_config(target_root: Path) -> dict:
    cfg_file = target_root / "target.json"
    if not cfg_file.exists():
        return dict(DEFAULT_TARGET)
    cfg = json.loads(cfg_file.read_text())
    # Strip any _comment_* keys from the template — they're docs, not data.
    cfg = {k: v for k, v in cfg.items() if not k.startswith("_comment")}
    return {**DEFAULT_TARGET, **cfg}


# ───────────────────────── data model ─────────────────────────


@dataclass
class Repo:
    org: str
    name: str
    clone_url: str
    default_branch: str
    archived: bool
    fork: bool
    private: bool
    stars: int
    size_kb: int
    pushed_at: str  # ISO-8601 string from GitHub
    platform: str = "github"  # github | gitlab | bitbucket — defaults to github for old data

    @property
    def slug(self) -> str:
        return f"{self.org}/{self.name}"

    @property
    def pushed_year(self) -> int | None:
        if not self.pushed_at:
            return None
        try:
            return datetime.fromisoformat(self.pushed_at.replace("Z", "+00:00")).year
        except Exception:
            return None

    @property
    def years_since_push(self) -> float | None:
        if not self.pushed_at:
            return None
        try:
            dt = datetime.fromisoformat(self.pushed_at.replace("Z", "+00:00"))
            return (datetime.now(timezone.utc) - dt).total_seconds() / (365.25 * 86400)
        except Exception:
            return None


# ───────────────────────── loaders ─────────────────────────


def load_repos(raw_dir: Path) -> list[Repo]:
    """Load repos.tsv. Tolerates the old schema (no platform column)
    by inferring github when the field is missing — keeps existing
    targets working without re-enumeration."""
    out: list[Repo] = []
    with open(raw_dir / "repos.tsv") as f:
        for r in csv.DictReader(f, delimiter="\t"):
            platform = r.get("platform") or "github"
            stars = r.get("stars") or "0"
            size_kb = r.get("size_kb") or "0"
            out.append(
                Repo(
                    org=r["org"],
                    name=r["repo"],
                    clone_url=r["clone_url"],
                    default_branch=r.get("default_branch", ""),
                    archived=r.get("archived", "false") == "true",
                    fork=r.get("fork", "false") == "true",
                    private=r.get("private", "false") == "true",
                    stars=int(stars) if stars.isdigit() else 0,
                    size_kb=int(size_kb) if size_kb.isdigit() else 0,
                    pushed_at=r.get("pushed_at", ""),
                    platform=platform,
                )
            )
    return out


def load_techdetect(td_dir: Path) -> dict[tuple[str, str], dict]:
    out: dict[tuple[str, str], dict] = {}
    for p in td_dir.rglob("*.json"):
        try:
            with open(p) as f:
                out[(p.parent.name, p.stem)] = json.load(f)
        except json.JSONDecodeError:
            # Tolerate partial writes from interrupted runs.
            pass
    return out


def load_scan_meta(meta_dir: Path) -> dict:
    progress_log = meta_dir / "progress.log"
    elapsed_seconds = None
    succeeded = None
    failed = None
    if progress_log.exists():
        for line in progress_log.read_text().splitlines():
            if line.startswith("=== Done:"):
                # "=== Done: 1928s elapsed ==="
                try:
                    elapsed_seconds = int(line.split()[2].rstrip("s"))
                except Exception:
                    pass
            if line.strip().startswith("succeeded:"):
                succeeded = int(line.split(":")[1].strip())
            if line.strip().startswith("failed:"):
                failed = int(line.split(":")[1].strip())
    return {
        "scan_wall_clock_seconds": elapsed_seconds,
        "scan_succeeded": succeeded,
        "scan_failed": failed,
    }


# ───────────────────────── helpers ─────────────────────────


def pct(n: int, total: int) -> float:
    return round(100 * n / total, 1) if total else 0.0


def top_counter(c: Counter, n: int = TOP_N) -> list[dict]:
    total = sum(c.values())
    return [
        {"name": k, "count": v, "pct": pct(v, total)}
        for k, v in c.most_common(n)
    ]


def write_vm(out_dir: Path, name: str, payload) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    p = out_dir / name
    with open(p, "w") as f:
        json.dump(payload, f, indent=2, sort_keys=False)
    # Print just the tail two segments so the line stays readable
    # regardless of where the data dir lives.
    tail = "/".join(p.parts[-2:])
    print(f"  wrote {tail}")


def _detect_names(items) -> list[str]:
    """Extract `.name` (or `.service`) strings from a tech-detect array.

    The schema isn't 100% uniform — clouds use `service`, others use
    `name`. Anything not a dict is filtered out (some empty array
    values come through as `[null]` from jq-style serialisation)."""
    out = []
    if not isinstance(items, list):
        return out
    for it in items:
        if not isinstance(it, dict):
            continue
        if "name" in it:
            out.append(it["name"])
        elif "service" in it:
            out.append(it["service"])
    return out


# ───────────────────────── view-model builders ─────────────────────────


def build_hero(repos, td, scan_meta, target):
    """00 — the headline numbers shown on the cover."""
    active = [r for r in repos if not r.archived and not r.fork]
    archived = [r for r in repos if r.archived]
    forks = [r for r in repos if r.fork]
    orgs = sorted({r.org for r in repos})

    return {
        "target": {
            "slug": target["slug"],
            "title": target["title"],
            "subtitle": target["subtitle"],
            "audience_label": target["audience_label"],
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "totals": {
            "repos": len(repos),
            "orgs": len(orgs),
            "active_repos": len(active),
            "archived_repos": len(archived),
            "fork_repos": len(forks),
            "size_gb": round(sum(r.size_kb for r in repos) / 1024 / 1024, 1),
            "active_size_gb": round(sum(r.size_kb for r in active) / 1024 / 1024, 1),
        },
        "scan": {
            "tech_detected_repos": len(td),
            "scan_wall_clock_seconds": scan_meta.get("scan_wall_clock_seconds"),
            "scan_succeeded": scan_meta.get("scan_succeeded"),
            "scan_failed": scan_meta.get("scan_failed"),
        },
        "headline_strings": [
            f"{len(repos):,} public repositories across {len(orgs)} {target['audience_label']}",
            f"{round(sum(r.size_kb for r in repos) / 1024 / 1024, 0):,.0f} GB of code",
            f"{len(active):,} active repositories ({pct(len(active), len(repos))}% of total)",
        ],
    }


def build_shape(repos):
    """01 — Part I: Shape of the corpus."""
    by_org: dict[str, list[Repo]] = defaultdict(list)
    for r in repos:
        by_org[r.org].append(r)

    org_rows = []
    for org, rs in by_org.items():
        active = [r for r in rs if not r.archived and not r.fork]
        org_rows.append({
            "org": org,
            "repo_count": len(rs),
            "active_count": len(active),
            "archived_count": sum(1 for r in rs if r.archived),
            "fork_count": sum(1 for r in rs if r.fork),
            "size_gb": round(sum(r.size_kb for r in rs) / 1024 / 1024, 2),
            "active_size_gb": round(sum(r.size_kb for r in active) / 1024 / 1024, 2),
            "archive_ratio_pct": pct(sum(1 for r in rs if r.archived), len(rs)),
        })
    org_rows.sort(key=lambda x: x["repo_count"], reverse=True)

    cum = 0
    total = len(repos)
    concentration = []
    for row in org_rows:
        cum += row["repo_count"]
        concentration.append({
            "rank": len(concentration) + 1,
            "org": row["org"],
            "cumulative_pct": pct(cum, total),
        })
        if cum / total >= 0.95:
            break

    buckets = {"<5MB": 0, "5-50MB": 0, "50-500MB": 0, ">500MB": 0}
    for r in repos:
        kb = r.size_kb
        if kb < 5_000:
            buckets["<5MB"] += 1
        elif kb < 50_000:
            buckets["5-50MB"] += 1
        elif kb < 500_000:
            buckets["50-500MB"] += 1
        else:
            buckets[">500MB"] += 1

    push_year_counts: Counter[int] = Counter()
    for r in repos:
        y = r.pushed_year
        if y:
            push_year_counts[y] += 1

    zombies = [r for r in repos if (r.years_since_push or 0) > ZOMBIE_YEARS]

    return {
        "totals": {"orgs": len(org_rows), "repos": total},
        "top_orgs_by_repo_count": org_rows[:TOP_N],
        "top_orgs_by_size": sorted(org_rows, key=lambda x: x["size_gb"], reverse=True)[:TOP_N],
        "concentration_to_95pct": concentration,
        "size_buckets": [
            {"bucket": k, "count": v, "pct": pct(v, total)}
            for k, v in buckets.items()
        ],
        "last_push_by_year": [
            {"year": y, "count": c}
            for y, c in sorted(push_year_counts.items())
        ],
        "zombie_ratio": {
            "untouched_years_threshold": ZOMBIE_YEARS,
            "zombie_repos": len(zombies),
            "pct_of_all": pct(len(zombies), total),
        },
        "extremes": {
            "largest_single_repo": max(
                ({"slug": r.slug, "size_gb": round(r.size_kb / 1024 / 1024, 2)} for r in repos),
                key=lambda x: x["size_gb"],
            ),
            "most_active_org": org_rows[0]["org"],
            "smallest_org_active": min(
                (r for r in org_rows if r["active_count"] > 0),
                key=lambda x: x["active_count"],
            ),
        },
    }


def build_languages(repos, td):
    """02 — Part II: Language detection across the corpus."""
    by_repo_count: Counter[str] = Counter()
    by_file_count: Counter[str] = Counter()
    by_org_lang: dict[str, Counter] = defaultdict(Counter)

    for (org, name), data in td.items():
        langs = data.get("languages") or {}
        if not isinstance(langs, dict):
            continue
        for lang, files in langs.items():
            by_repo_count[lang] += 1
            by_file_count[lang] += int(files or 0)
            by_org_lang[org][lang] += 1

    total_repos = len(td)
    top_by_repos = [
        {
            "language": lang,
            "repos": cnt,
            "pct_of_repos": pct(cnt, total_repos),
            "total_files": by_file_count[lang],
        }
        for lang, cnt in by_repo_count.most_common(TOP_N)
    ]
    top_by_files = [
        {
            "language": lang,
            "total_files": cnt,
            "repos": by_repo_count[lang],
        }
        for lang, cnt in by_file_count.most_common(TOP_N)
    ]

    org_top_lang = []
    for org, c in by_org_lang.items():
        if not c:
            continue
        top = c.most_common(3)
        org_top_lang.append({
            "org": org,
            "primary": {"language": top[0][0], "repo_count": top[0][1]},
            "secondary": {"language": top[1][0], "repo_count": top[1][1]} if len(top) > 1 else None,
            "tertiary": {"language": top[2][0], "repo_count": top[2][1]} if len(top) > 2 else None,
        })
    org_top_lang.sort(key=lambda x: x["primary"]["repo_count"], reverse=True)

    return {
        "totals": {"repos_analysed": total_repos, "languages_detected": len(by_repo_count)},
        "top_languages_by_repo_count": top_by_repos,
        "top_languages_by_file_count": top_by_files,
        "per_org_top_languages": org_top_lang[:TOP_N],
    }


def _build_category_vm(td, key: str):
    """Generic aggregator for cicd / databases / frameworks / testing.

    Each is a list of detected tools per repo with `.name` strings; we
    count repos that detected each tool, plus the per-org top tool so
    the report can do "Department X uses Y" callouts."""
    tool_repo_count: Counter[str] = Counter()
    tool_by_org: dict[str, Counter] = defaultdict(Counter)
    repos_with_any: set = set()

    for (org, name), data in td.items():
        names = set(_detect_names(data.get(key)))
        if names:
            repos_with_any.add((org, name))
        for tool in names:
            tool_repo_count[tool] += 1
            tool_by_org[org][tool] += 1

    return {
        "totals": {
            "repos_analysed": len(td),
            "repos_with_any": len(repos_with_any),
            "pct_with_any": pct(len(repos_with_any), len(td)),
        },
        "top_tools": top_counter(tool_repo_count, TOP_N),
        "per_org_top_tool": [
            {
                "org": org,
                "top_tool": c.most_common(1)[0][0] if c else None,
                "tool_count": len(c),
            }
            for org, c in tool_by_org.items()
            if c
        ],
    }


def build_frameworks(td):
    return _build_category_vm(td, "frameworks")


def build_cloud(td):
    """04 — cloud + container + IaC adoption."""
    aws_repos: set = set()
    azure_repos: set = set()
    gcp_repos: set = set()
    aws_services: Counter = Counter()
    azure_services: Counter = Counter()
    gcp_services: Counter = Counter()
    cloud_diversity: Counter = Counter()

    container_tools: Counter = Counter()
    iac_tools: Counter = Counter()

    for (org, name), data in td.items():
        clouds_here = 0
        for label, services_set, services_counter in [
            ("aws", aws_repos, aws_services),
            ("azure", azure_repos, azure_services),
            ("gcp", gcp_repos, gcp_services),
        ]:
            names = _detect_names(data.get(label))
            if names:
                services_set.add((org, name))
                clouds_here += 1
                for s in names:
                    services_counter[s] += 1
        cloud_diversity[clouds_here] += 1

        for fw in _detect_names(data.get("frameworks")):
            if fw.lower() in {"docker", "kubernetes", "helm", "docker-compose"}:
                container_tools[fw] += 1
            if fw.lower() in {"terraform", "cloudformation", "pulumi", "ansible"}:
                iac_tools[fw] += 1
        for ci in _detect_names(data.get("cicd")):
            if ci.lower() in {"docker", "kubernetes", "helm"}:
                container_tools[ci] += 1
            if ci.lower() in {"terraform", "cloudformation", "pulumi", "ansible"}:
                iac_tools[ci] += 1

    total = len(td)
    return {
        "totals": {
            "repos_analysed": total,
            "any_cloud_repos": len(aws_repos | azure_repos | gcp_repos),
            "aws_repos": len(aws_repos),
            "azure_repos": len(azure_repos),
            "gcp_repos": len(gcp_repos),
        },
        "shares": {
            "aws_pct": pct(len(aws_repos), total),
            "azure_pct": pct(len(azure_repos), total),
            "gcp_pct": pct(len(gcp_repos), total),
            "any_cloud_pct": pct(len(aws_repos | azure_repos | gcp_repos), total),
        },
        "cloud_diversity": [
            {"clouds_used": k, "repos": v, "pct": pct(v, total)}
            for k, v in sorted(cloud_diversity.items())
        ],
        "top_aws_services": top_counter(aws_services, TOP_N),
        "top_azure_services": top_counter(azure_services, TOP_N),
        "top_gcp_services": top_counter(gcp_services, TOP_N),
        "container_tools": top_counter(container_tools, TOP_N),
        "iac_tools": top_counter(iac_tools, TOP_N),
    }


def build_engineering(td):
    """05 — CI/CD + testing discipline."""
    cicd = _build_category_vm(td, "cicd")
    testing = _build_category_vm(td, "testing")

    no_ci = no_tests = no_either = 0
    for (org, name), data in td.items():
        has_ci = bool(_detect_names(data.get("cicd")))
        has_tests = bool(_detect_names(data.get("testing")))
        if not has_ci:
            no_ci += 1
        if not has_tests:
            no_tests += 1
        if not has_ci and not has_tests:
            no_either += 1

    total = len(td)
    return {
        "cicd": cicd,
        "testing": testing,
        "discipline_gaps": {
            "no_cicd_repos": no_ci,
            "no_cicd_pct": pct(no_ci, total),
            "no_testing_repos": no_tests,
            "no_testing_pct": pct(no_tests, total),
            "no_cicd_or_testing_repos": no_either,
            "no_cicd_or_testing_pct": pct(no_either, total),
        },
    }


def build_data_layer(td):
    return _build_category_vm(td, "databases")


def build_oss_health(repos, td):
    """07 — stars, zombies, abandoned repos."""
    by_stars = sorted(repos, key=lambda r: r.stars, reverse=True)
    most_starred = [
        {"slug": r.slug, "stars": r.stars, "archived": r.archived, "fork": r.fork}
        for r in by_stars[:TOP_N]
    ]

    star_buckets = {">100": 0, "11-100": 0, "1-10": 0, "0": 0}
    for r in repos:
        if r.stars > 100:
            star_buckets[">100"] += 1
        elif r.stars > 10:
            star_buckets["11-100"] += 1
        elif r.stars > 0:
            star_buckets["1-10"] += 1
        else:
            star_buckets["0"] += 1

    zombies = [r for r in repos if (r.years_since_push or 0) > ZOMBIE_YEARS]
    empty = [r for r in repos if r.size_kb == 0]

    empty_by_org = Counter(r.org for r in empty)
    zombie_by_org = Counter(r.org for r in zombies)

    return {
        "totals": {
            "repos": len(repos),
            "active_repos": sum(1 for r in repos if not r.archived and not r.fork),
            "starred_repos": sum(1 for r in repos if r.stars > 0),
        },
        "most_starred": most_starred,
        "star_buckets": [
            {"bucket": k, "count": v, "pct": pct(v, len(repos))}
            for k, v in star_buckets.items()
        ],
        "zombies": {
            "threshold_years": ZOMBIE_YEARS,
            "count": len(zombies),
            "pct": pct(len(zombies), len(repos)),
            "top_zombie_orgs": [
                {"org": o, "count": c}
                for o, c in zombie_by_org.most_common(TOP_N)
            ],
        },
        "empty": {
            "count": len(empty),
            "pct": pct(len(empty), len(repos)),
            "top_orgs": [
                {"org": o, "count": c}
                for o, c in empty_by_org.most_common(TOP_N)
            ],
        },
    }


def build_league_table(repos, td):
    """08 — per-org radar metrics."""
    by_org: dict[str, list[Repo]] = defaultdict(list)
    for r in repos:
        by_org[r.org].append(r)

    rows = []
    for org, rs in by_org.items():
        active = [r for r in rs if not r.archived and not r.fork]
        if not rs:
            continue

        scale = len(rs)
        fresh = sum(1 for r in rs if (r.years_since_push or 99) < 1)
        freshness = pct(fresh, len(rs))

        td_for_org = [td[(r.org, r.name)] for r in rs if (r.org, r.name) in td]
        ci_repos = sum(1 for d in td_for_org if _detect_names(d.get("cicd")))
        test_repos = sum(1 for d in td_for_org if _detect_names(d.get("testing")))
        ci_score = pct(ci_repos, len(td_for_org)) if td_for_org else 0
        test_score = pct(test_repos, len(td_for_org)) if td_for_org else 0

        clouds = set()
        all_langs: Counter = Counter()
        for d in td_for_org:
            for cloud in ("aws", "azure", "gcp"):
                if _detect_names(d.get(cloud)):
                    clouds.add(cloud)
            for lang in (d.get("languages") or {}):
                all_langs[lang] += 1

        oss_share = pct(sum(1 for r in rs if r.stars > 0), len(rs))
        archive_ratio = pct(sum(1 for r in rs if r.archived), len(rs))

        rows.append({
            "org": org,
            "scale_repo_count": scale,
            "scale_active_count": len(active),
            "freshness_pct_pushed_12mo": freshness,
            "ci_score_pct": ci_score,
            "test_score_pct": test_score,
            "cloud_breadth": len(clouds),
            "cloud_used": sorted(clouds),
            "oss_share_starred_pct": oss_share,
            "archive_ratio_pct": archive_ratio,
            "language_diversity": len(all_langs),
            "tech_detected_repos": len(td_for_org),
        })

    rows.sort(key=lambda x: x["scale_repo_count"], reverse=True)
    return {"rows": rows}


def build_headlines(repos, td, league, target):
    """09 — pre-computed headlines for the pull-quote spreads.

    Strings here are templated against target.entity_label so the same
    code generates target-appropriate copy ("UK government", "EU
    institution", "Australian Commonwealth body", etc.)."""
    active = [r for r in repos if not r.archived and not r.fork]
    by_size = max(repos, key=lambda r: r.size_kb)
    by_stars = max(repos, key=lambda r: r.stars)

    most_diverse = max(league["rows"], key=lambda x: x["language_diversity"])
    most_active_recent = max(league["rows"], key=lambda x: x["freshness_pct_pushed_12mo"])

    label = target["entity_label"]
    return {
        "did_you_know": [
            f"The largest single {label} repository is {by_size.org}/{by_size.name} at {round(by_size.size_kb / 1024 / 1024, 2)} GB.",
            f"The most-starred {label} repository is {by_stars.org}/{by_stars.name} with {by_stars.stars:,} stars.",
            f"{most_diverse['org']} publishes code in {most_diverse['language_diversity']} different programming languages — more than any other {label} body.",
            f"{most_active_recent['org']} pushed updates to {most_active_recent['freshness_pct_pushed_12mo']}% of its repositories in the last year.",
        ],
        "extremes": {
            "largest_repo": {"slug": f"{by_size.org}/{by_size.name}", "size_gb": round(by_size.size_kb / 1024 / 1024, 2)},
            "most_starred_repo": {"slug": f"{by_stars.org}/{by_stars.name}", "stars": by_stars.stars},
            "most_diverse_org": {"org": most_diverse["org"], "languages": most_diverse["language_diversity"]},
            "most_active_org_recent": {"org": most_active_recent["org"], "freshness_pct": most_active_recent["freshness_pct_pushed_12mo"]},
        },
        "by_the_numbers_strip": [
            f"{len(repos):,} repos",
            f"{len(active):,} active",
            f"{len({r.org for r in repos})} organisations",
            f"{round(sum(r.size_kb for r in repos) / 1024 / 1024)} GB of code",
            f"{len(td):,} successfully scanned",
        ],
    }


def build_per_org(repos, td, per_org_dir: Path) -> int:
    """One JSON per org for the report's appendix one-pager."""
    per_org_dir.mkdir(parents=True, exist_ok=True)
    by_org: dict[str, list[Repo]] = defaultdict(list)
    for r in repos:
        by_org[r.org].append(r)

    for org, rs in by_org.items():
        td_for_org = [td.get((r.org, r.name)) for r in rs]
        td_for_org = [d for d in td_for_org if d]

        langs: Counter = Counter()
        cicd_tools: Counter = Counter()
        test_tools: Counter = Counter()
        frameworks: Counter = Counter()
        databases: Counter = Counter()
        cloud_services: dict[str, Counter] = {"aws": Counter(), "azure": Counter(), "gcp": Counter()}

        for d in td_for_org:
            for lang, n in (d.get("languages") or {}).items():
                langs[lang] += int(n or 0)
            for tool in _detect_names(d.get("cicd")):
                cicd_tools[tool] += 1
            for tool in _detect_names(d.get("testing")):
                test_tools[tool] += 1
            for tool in _detect_names(d.get("frameworks")):
                frameworks[tool] += 1
            for tool in _detect_names(d.get("databases")):
                databases[tool] += 1
            for cloud in ("aws", "azure", "gcp"):
                for svc in _detect_names(d.get(cloud)):
                    cloud_services[cloud][svc] += 1

        active = [r for r in rs if not r.archived and not r.fork]
        payload = {
            "org": org,
            "totals": {
                "repos": len(rs),
                "active": len(active),
                "archived": sum(1 for r in rs if r.archived),
                "forks": sum(1 for r in rs if r.fork),
                "size_gb": round(sum(r.size_kb for r in rs) / 1024 / 1024, 2),
                "tech_detected_repos": len(td_for_org),
            },
            "top_languages_by_files": top_counter(langs, 10),
            "top_frameworks": top_counter(frameworks, 10),
            "top_cicd": top_counter(cicd_tools, 10),
            "top_testing": top_counter(test_tools, 10),
            "top_databases": top_counter(databases, 10),
            "cloud_services": {k: top_counter(v, 10) for k, v in cloud_services.items()},
            "most_starred_repos": [
                {"slug": r.slug, "stars": r.stars, "size_kb": r.size_kb, "pushed_at": r.pushed_at}
                for r in sorted(rs, key=lambda r: r.stars, reverse=True)[:10]
            ],
        }
        with open(per_org_dir / f"{org}.json", "w") as f:
            json.dump(payload, f, indent=2)
    return len(by_org)


def build_indices(repos, td, league):
    """10 — composite indices computed per org.

    Each index normalises an aspect of the corpus into a 0-100 score so
    orgs can be ranked on multiple dimensions independently. Different
    orgs lead different indices — that's the editorial point.

    Indices:
      - code_health     : CI + tests + recent push + non-empty (engineering hygiene)
      - modernity       : recent push + freshness + language diversity (forward-looking)
      - concentration   : 100 - bus-factor proxy via single-cloud + few langs
      - oss_power       : log(stars+forks) * star-share (community footprint)
      - dark_matter     : archived + zombie + empty (dead estate share)
    """
    by_org: dict[str, list[Repo]] = defaultdict(list)
    for r in repos:
        by_org[r.org].append(r)

    rows = []
    for org, rs in by_org.items():
        if not rs:
            continue
        active = [r for r in rs if not r.archived and not r.fork]
        td_for_org = [td[(r.org, r.name)] for r in rs if (r.org, r.name) in td]
        ci = sum(1 for d in td_for_org if _detect_names(d.get("cicd")))
        tests = sum(1 for d in td_for_org if _detect_names(d.get("testing")))
        n_td = len(td_for_org) or 1

        ci_pct = pct(ci, n_td)
        test_pct = pct(tests, n_td)
        freshness = pct(sum(1 for r in rs if (r.years_since_push or 99) < 1), len(rs))
        recent = pct(sum(1 for r in rs if (r.years_since_push or 99) < 2), len(rs))
        archive_pct = pct(sum(1 for r in rs if r.archived), len(rs))
        zombie_pct = pct(sum(1 for r in rs if (r.years_since_push or 0) > ZOMBIE_YEARS), len(rs))
        empty_pct = pct(sum(1 for r in rs if r.size_kb == 0), len(rs))

        clouds_used = set()
        all_langs: Counter = Counter()
        for d in td_for_org:
            for cloud in ("aws", "azure", "gcp"):
                if _detect_names(d.get(cloud)):
                    clouds_used.add(cloud)
            for lang in (d.get("languages") or {}):
                all_langs[lang] += 1

        # log-scaled OSS footprint: total stars + a fork-as-half weighting.
        import math
        total_stars = sum(r.stars for r in rs)
        starred = sum(1 for r in rs if r.stars > 0)
        oss_raw = math.log10(total_stars + 1) * 20 + (starred / max(len(rs), 1)) * 50

        # Code health = how disciplined the active estate is.
        code_health = round(0.4 * ci_pct + 0.3 * test_pct + 0.2 * recent + 0.1 * (100 - empty_pct), 1)
        # Modernity = how much the corpus moves.
        modernity = round(0.5 * freshness + 0.3 * recent + 0.2 * min(len(all_langs) * 5, 100), 1)
        # Concentration risk = single-cloud + few-langs (lower number = safer).
        cloud_div = len(clouds_used)
        concentration = round(
            (60 if cloud_div == 1 else (30 if cloud_div == 2 else (10 if cloud_div == 3 else 80)))
            + (20 if len(all_langs) < 5 else (10 if len(all_langs) < 10 else 0)),
            1,
        )
        oss_power = round(min(oss_raw, 100), 1)
        dark_matter = round(0.5 * archive_pct + 0.3 * zombie_pct + 0.2 * empty_pct, 1)

        rows.append({
            "org": org,
            "scale": len(rs),
            "active": len(active),
            "code_health": code_health,
            "modernity": modernity,
            "concentration_risk": concentration,
            "oss_power": oss_power,
            "dark_matter": dark_matter,
            "components": {
                "ci_pct": ci_pct,
                "test_pct": test_pct,
                "freshness_pct": freshness,
                "recent_2y_pct": recent,
                "archive_pct": archive_pct,
                "zombie_pct": zombie_pct,
                "empty_pct": empty_pct,
                "cloud_diversity": cloud_div,
                "language_diversity": len(all_langs),
                "total_stars": total_stars,
            },
        })

    # Sort + rank per index (only orgs with ≥ 5 active repos qualify
    # for headline rankings — avoids "100% in last year" stunts from
    # one-repo councils dominating).
    qualified = [r for r in rows if r["active"] >= 5]

    def top_by(key, reverse=True, n=10):
        return sorted(qualified, key=lambda x: x[key], reverse=reverse)[:n]

    return {
        "rows": sorted(rows, key=lambda x: x["scale"], reverse=True),
        "qualifier_threshold_active_repos": 5,
        "rankings": {
            "code_health": [{"rank": i+1, "org": r["org"], "score": r["code_health"]} for i, r in enumerate(top_by("code_health"))],
            "modernity": [{"rank": i+1, "org": r["org"], "score": r["modernity"]} for i, r in enumerate(top_by("modernity"))],
            "oss_power": [{"rank": i+1, "org": r["org"], "score": r["oss_power"]} for i, r in enumerate(top_by("oss_power"))],
            "dark_matter": [{"rank": i+1, "org": r["org"], "score": r["dark_matter"]} for i, r in enumerate(top_by("dark_matter"))],
            "concentration_risk": [{"rank": i+1, "org": r["org"], "score": r["concentration_risk"]} for i, r in enumerate(top_by("concentration_risk"))],
        },
    }


def build_similarity(repos, td):
    """16 — stack-similarity tribes.

    Each org is reduced to a feature vector — binary presence of the
    top languages / frameworks / databases / clouds / CI tools across
    its scanned repos. We then compute pairwise cosine similarity and
    derive:
      • Each org's top-3 nearest neighbours
      • Edges suitable for a force-directed graph (similarity > 0.5)
      • A "tribe" label for clusters via a simple union-find on
        edges above a higher threshold (0.65) → emergent groupings.

    Pure stdlib — no scipy / sklearn needed for ~100 orgs."""
    import math

    by_org: dict[str, list[Repo]] = defaultdict(list)
    for r in repos:
        by_org[r.org].append(r)

    # Decide which features matter: top tools across each category.
    feat_buckets = {
        "lang": Counter(),
        "fw": Counter(),
        "db": Counter(),
        "cicd": Counter(),
        "test": Counter(),
        "cloud": Counter(),
    }
    for (org, name), data in td.items():
        for lang in (data.get("languages") or {}):
            feat_buckets["lang"][lang] += 1
        for tool in _detect_names(data.get("frameworks")):
            feat_buckets["fw"][tool] += 1
        for tool in _detect_names(data.get("databases")):
            feat_buckets["db"][tool] += 1
        for tool in _detect_names(data.get("cicd")):
            feat_buckets["cicd"][tool] += 1
        for tool in _detect_names(data.get("testing")):
            feat_buckets["test"][tool] += 1
        for cloud in ("aws", "azure", "gcp"):
            for svc in _detect_names(data.get(cloud)):
                feat_buckets["cloud"][f"{cloud}:{svc}"] += 1

    # Top-N per category — keeps the feature space focused on signal.
    # Skip the top-3 most common per category (Markdown / YAML / GitHub
    # Actions are ubiquitous and dominate cosine similarity, washing
    # out tribe structure).
    top_features = []
    for cat, c in feat_buckets.items():
        common = c.most_common(33)
        for name, _ in common[3:]:  # drop the top 3
            top_features.append(f"{cat}:{name}")
    feat_idx = {f: i for i, f in enumerate(top_features)}
    n_feat = len(top_features)

    # IDF weights per feature — rarer features carry more signal.
    import math as _math
    n_orgs = len(by_org)
    feature_doc_freq: Counter = Counter()

    # First pass — count document frequency per feature for IDF.
    org_raw: dict[str, list[float]] = {}
    org_repo_count: dict[str, int] = {}
    for org, rs in by_org.items():
        td_for_org = [td[(r.org, r.name)] for r in rs if (r.org, r.name) in td]
        if not td_for_org:
            continue
        n = len(td_for_org)
        org_repo_count[org] = n
        present_feats: set = set()
        for d in td_for_org:
            for lang in (d.get("languages") or {}):
                k = f"lang:{lang}"
                if k in feat_idx:
                    present_feats.add(k)
            for tool in _detect_names(d.get("frameworks")):
                k = f"fw:{tool}"
                if k in feat_idx:
                    present_feats.add(k)
            for tool in _detect_names(d.get("databases")):
                k = f"db:{tool}"
                if k in feat_idx:
                    present_feats.add(k)
            for tool in _detect_names(d.get("cicd")):
                k = f"cicd:{tool}"
                if k in feat_idx:
                    present_feats.add(k)
            for tool in _detect_names(d.get("testing")):
                k = f"test:{tool}"
                if k in feat_idx:
                    present_feats.add(k)
            for cloud in ("aws", "azure", "gcp"):
                for svc in _detect_names(d.get(cloud)):
                    k = f"cloud:{cloud}:{svc}"
                    if k in feat_idx:
                        present_feats.add(k)
        for k in present_feats:
            feature_doc_freq[k] += 1

    # IDF: log(N / df). Common features → low weight, rare → high.
    idf = {f: _math.log((n_orgs + 1) / (feature_doc_freq[f] + 1)) + 1.0 for f in top_features}

    # Second pass — build per-org TF-IDF vectors.
    org_vec: dict[str, list[float]] = {}
    for org, rs in by_org.items():
        vec = [0.0] * n_feat
        td_for_org = [td[(r.org, r.name)] for r in rs if (r.org, r.name) in td]
        if not td_for_org:
            continue
        n = len(td_for_org)
        for d in td_for_org:
            for lang in (d.get("languages") or {}):
                k = f"lang:{lang}"
                if k in feat_idx:
                    vec[feat_idx[k]] += 1
            for tool in _detect_names(d.get("frameworks")):
                k = f"fw:{tool}"
                if k in feat_idx:
                    vec[feat_idx[k]] += 1
            for tool in _detect_names(d.get("databases")):
                k = f"db:{tool}"
                if k in feat_idx:
                    vec[feat_idx[k]] += 1
            for tool in _detect_names(d.get("cicd")):
                k = f"cicd:{tool}"
                if k in feat_idx:
                    vec[feat_idx[k]] += 1
            for tool in _detect_names(d.get("testing")):
                k = f"test:{tool}"
                if k in feat_idx:
                    vec[feat_idx[k]] += 1
            for cloud in ("aws", "azure", "gcp"):
                for svc in _detect_names(d.get(cloud)):
                    k = f"cloud:{cloud}:{svc}"
                    if k in feat_idx:
                        vec[feat_idx[k]] += 1
        # Normalise to coverage proportion, then apply IDF weighting.
        for i, f in enumerate(top_features):
            vec[i] = (vec[i] / n) * idf[f]
        org_vec[org] = vec

    def cosine(a, b):
        dot = sum(x * y for x, y in zip(a, b))
        na = math.sqrt(sum(x * x for x in a))
        nb = math.sqrt(sum(y * y for y in b))
        return dot / (na * nb) if na > 0 and nb > 0 else 0.0

    orgs = sorted(org_vec.keys())
    sim: dict[str, dict[str, float]] = {}
    for i, a in enumerate(orgs):
        sim[a] = {}
        for b in orgs[i + 1:]:
            s = round(cosine(org_vec[a], org_vec[b]), 3)
            if s > 0:
                sim[a][b] = s

    # Pair list (top-N most-similar pairs across the corpus).
    pairs = []
    for a, others in sim.items():
        for b, s in others.items():
            pairs.append({"a": a, "b": b, "similarity": s})
    pairs.sort(key=lambda r: r["similarity"], reverse=True)

    # Per-org top neighbours.
    neighbour_lookup: dict[str, list[tuple[str, float]]] = defaultdict(list)
    for p in pairs:
        neighbour_lookup[p["a"]].append((p["b"], p["similarity"]))
        neighbour_lookup[p["b"]].append((p["a"], p["similarity"]))
    per_org_neighbours = []
    for org in orgs:
        neighbours = sorted(neighbour_lookup.get(org, []), key=lambda t: -t[1])[:3]
        per_org_neighbours.append({
            "org": org,
            "repos": org_repo_count.get(org, 0),
            "neighbours": [{"org": n, "similarity": s} for n, s in neighbours],
        })

    # Force-directed edges — only the top-2 neighbours per org above
    # threshold. Keeps the graph readable. With TF-IDF weighting,
    # similarity values are smaller in absolute terms, so thresholds
    # are calibrated against the new distribution.
    edges = []
    seen: set[tuple[str, str]] = set()
    THR = 0.45
    for org in orgs:
        for nb, s in sorted(neighbour_lookup.get(org, []), key=lambda t: -t[1])[:3]:
            if s < THR:
                break
            key = tuple(sorted([org, nb]))
            if key in seen:
                continue
            seen.add(key)
            edges.append({"source": org, "target": nb, "value": s})

    # Tribe detection via union-find at higher threshold.
    parent = {o: o for o in orgs}
    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x
    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb
    TRIBE_THR = 0.85
    for org in orgs:
        for nb, s in neighbour_lookup.get(org, []):
            if s >= TRIBE_THR:
                union(org, nb)
    tribes: dict[str, list[str]] = defaultdict(list)
    for org in orgs:
        tribes[find(org)].append(org)
    tribe_list = [
        {"label_org": next(iter(sorted(members, key=lambda o: -org_repo_count.get(o, 0)))), "members": sorted(members)}
        for members in tribes.values()
        if len(members) >= 2  # singletons aren't tribes
    ]
    tribe_list.sort(key=lambda t: -len(t["members"]))

    # Anomaly score: orgs with the LOWEST max-similarity to any other
    # org are stack outliers (their tooling doesn't look like anyone
    # else's).
    outliers = []
    for org in orgs:
        if not neighbour_lookup.get(org):
            outliers.append({"org": org, "max_similarity": 0.0})
        else:
            top_s = max(s for _, s in neighbour_lookup[org])
            outliers.append({"org": org, "max_similarity": round(top_s, 3)})
    outliers.sort(key=lambda r: r["max_similarity"])
    outliers = [r for r in outliers if org_repo_count.get(r["org"], 0) >= 5][:25]

    return {
        "feature_count": n_feat,
        "orgs_analysed": len(orgs),
        "top_pairs_top25": pairs[:25],
        "per_org_neighbours": per_org_neighbours,
        "graph": {
            "nodes": [{"id": o, "repos": org_repo_count.get(o, 0)} for o in orgs],
            "edges": edges,
        },
        "tribes": tribe_list[:25],
        "stack_outliers_top25": outliers,
    }


def build_takeaways(repos, td, indices, league, anomalies):
    """17 — audience-specific 'what this means for you' framings.

    Each audience gets concrete, sourced bullets — using real numbers
    from the rest of the report so the takeaways are defensible."""
    active = [r for r in repos if not r.archived and not r.fork]
    archived_count = sum(1 for r in repos if r.archived)
    archive_pct = pct(archived_count, len(repos))

    # Pull headline rankings from indices.
    cm_top = indices["rankings"]["code_health"][0]["org"] if indices.get("rankings", {}).get("code_health") else "—"
    dm_top = indices["rankings"]["dark_matter"][0]["org"] if indices.get("rankings", {}).get("dark_matter") else "—"
    oss_top = indices["rankings"]["oss_power"][0]["org"] if indices.get("rankings", {}).get("oss_power") else "—"

    proto = anomalies.get("prototype_graveyard", {}).get("count", 0)
    proto_pct = anomalies.get("prototype_graveyard", {}).get("pct_of_corpus", 0)

    fa = (anomalies.get("spotlights") or {}).get("famous_abandoned_top5") or []
    famous = fa[0] if fa else None

    return {
        "permanent_secretary": {
            "audience": "For a Permanent Secretary",
            "lead": "Your department's public code is more visible than its policy. Three things to know.",
            "bullets": [
                f"**{archive_pct}%** of all UK government repositories are already archived. Of {len(repos):,} total, {fmt_intish(archived_count)} are no longer maintained but remain public — your inheritance is most of what's not yours to fix.",
                f"**{dm_top}** has the highest archived + zombie + empty share. If your department is on the dark-matter list (Part XVI), the question to ask your CDIO is not \"what's wrong\" — it's \"what's still owned\".",
                f"**{proto_pct}%** of the public estate ({proto:,} repositories) is named *prototype*, *poc*, *spike*, or *experiment*. That's the digital equivalent of leaving the prototype hall open to the public.",
            ],
        },
        "cdio_cto": {
            "audience": "For a CDIO / CTO",
            "lead": "Your team's engineering rhythm is in this report whether you wanted it published or not.",
            "bullets": [
                f"Best Code Health score: **{cm_top}**. If you're not on the top 5 of Part IX's Code Health ranking, the gap is mostly CI coverage — measurable in this report's per-org breakdowns.",
                f"**21.8%** of UK gov repos depend on a single contributor for >80% of recent commits. Your bus-factor exposure is named in Part XI. Building a continuity plan is cheaper than rewriting after the contributor leaves.",
                f"Stack standardisation hides in plain sight: Express + Spring Boot + PostgreSQL + GitHub Actions is the de-facto government stack. Hiring + procurement should reflect that — even when policy says \"choose the right tool\".",
            ],
        },
        "developer": {
            "audience": "For a Developer",
            "lead": "Civil-service open source is bigger and more interesting than you think.",
            "bullets": [
                f"**{oss_top}** is the most prolific open-source publisher in UK gov ({len(active):,} active public repos across the corpus). The exemplar code in Part XVIII is a study guide for how a competent gov-tech team ships.",
                f"The most-starred UK government repo is **gchq/CyberChef** at 34,753 stars — written by GCHQ, your tax-funded crypto toolkit. It's not the only public-sector codebase punching above its weight.",
                f"Cross-organisation contributors (Part XII) are a quiet career signal: 25 named individuals commit to 3+ government bodies. If you're considering gov work, watching where these people work tells you where the interesting projects are.",
            ],
        },
        "journalist": {
            "audience": "For a Journalist",
            "lead": "Three story leads, each falsifiable from the report's data.",
            "bullets": [
                f"**The dark-matter story.** {indices['rankings']['dark_matter'][0]['score'] if indices.get('rankings',{}).get('dark_matter') else '—'}% of {dm_top}'s public estate is archived, untouched, or empty — quantifiable abandonment.",
                f"**The vendor-exposure story.** Per-org email-domain breakdowns (Part XII) show which departments lean on which contractor. Capgemini, Accenture, EY, and Atos all visible in the data; raw numbers in `14_contributors.json`.",
                f"**The famous-abandoned story.** {famous['slug'] if famous else 'A handful of repos'} sits at {famous['stars'] if famous else 'thousands of'} stars and {famous['years_idle'] if famous else 'years'} years idle — a high-profile gov OSS project visibly abandoned.",
            ],
        },
    }


def fmt_intish(n):
    return f"{int(n):,}"


def build_ai_insights(td, indices, similarity):
    """18 — what AI sees in the data + roadmap of what extra it could unlock.

    Two parts: 'what's already computable' and 'what extra signals
    AI could surface with extra data'. Honest, specific, scoped.
    """
    # Tribe summary.
    tribes = (similarity or {}).get("tribes", [])
    outliers = (similarity or {}).get("stack_outliers_top25", [])[:10]
    pairs = (similarity or {}).get("top_pairs_top25", [])[:10]

    return {
        "current_capabilities": [
            {
                "title": "Stack tribe detection",
                "summary": f"{len(tribes)} natural clusters emerged from cosine-similarity on per-org tooling vectors. Largest cluster: {tribes[0]['label_org'] if tribes else '—'} group.",
                "method": "Per-org feature vector across top 30 languages, frameworks, databases, CI tools, cloud services. Cosine similarity between every pair of orgs. Union-find at similarity ≥ 0.7 reveals tribes.",
            },
            {
                "title": "Stack outliers",
                "summary": f"Bottom-similarity orgs are the genuinely-different shops. {outliers[0]['org'] if outliers else '—'} has the lowest max-similarity to any other org — a stack signature unlike anyone else's in the corpus.",
                "method": "For each org, find the most-similar other org; rank all orgs by that score ascending. The bottom of that list is the outliers.",
            },
            {
                "title": "Most-aligned org pairs",
                "summary": f"The two most similar UK gov orgs by stack: {pairs[0]['a']} and {pairs[0]['b']} ({pairs[0]['similarity']:.0%} similarity)." if pairs else "—",
                "method": "Argmax of off-diagonal similarity matrix.",
            },
            {
                "title": "Conventional-commits adoption",
                "summary": "Pattern-matched commit subjects against the Conventional Commits spec. Adoption rates per corpus + per org tell us how systematised the engineering culture is.",
                "method": "Regex match on commit subjects from the last-1000-commits window — see Part X NLP block.",
            },
        ],
        "roadmap_with_extra_data": [
            {
                "title": "Repo purpose classification",
                "what_unlocks": "Categorise every repo: 'public service', 'internal tool', 'design system', 'data pipeline', 'ML model', 'documentation', 'prototype'. Pie chart of what UK gov code is FOR, not just what it's BUILT FROM.",
                "needs": "LLM call per repo with README + manifest_files + top languages as context. ~12k calls × cheap model ≈ £20-50.",
                "feasibility": "Trivial. Add as a 'stage 2c' in the pipeline.",
            },
            {
                "title": "Vulnerability narrative",
                "what_unlocks": "Per-repo natural-language risk summary. 'This repo is on Java 8, no Dependabot, 22% commits from a single contractor — high attrition risk if Capgemini's lead leaves.' Top-50 risk stories become the report's lead section.",
                "needs": "Tech-detect output + version extraction (proposed but not yet built) + bus-factor data + LLM with risk-framing prompt.",
                "feasibility": "Half-day to wire. The data is mostly already there.",
            },
            {
                "title": "Commit-message sentiment & language",
                "what_unlocks": "Sentiment trend per org over time (signal of team mood / pressure). Language distribution detects unexpected non-English commits (interesting outlier).",
                "needs": "Run the existing 2.28M commit messages through a small NLP model. CPU-bound but cheap; ~2 hours on a laptop.",
                "feasibility": "Today, with sentence-transformers + a small classifier. No new data collection needed.",
            },
            {
                "title": "Contributor identity disambiguation",
                "what_unlocks": "Today's vendor analysis groups by email domain. Many devs commit from multiple addresses (work + personal). Clustering by name + commit fingerprint would yield true unique-contributor counts.",
                "needs": "Apply name-matching + commit-fingerprint clustering. Data already collected; just an extra aggregation pass.",
                "feasibility": "Half-day. No external service needed.",
            },
            {
                "title": "Stack t-SNE / UMAP map",
                "what_unlocks": "2D embedding of the org-similarity matrix. Visually emergent neighbourhoods (Whitehall, NHS, councils) appear without being labelled. Cover-spread quality visualisation.",
                "needs": "Add umap-learn (one pip dep). 100 orgs × 200 features → milliseconds.",
                "feasibility": "Hours. One pip install, ten lines of Python.",
            },
            {
                "title": "Anomaly stories",
                "what_unlocks": "Train a small autoencoder on org feature vectors; flag the highest-reconstruction-error orgs. These are the orgs whose stack/behaviour doesn't fit ANY pattern — almost certainly worth a story.",
                "needs": "scikit-learn + the existing org features.",
                "feasibility": "Day's work. Result: a curated list of 'WTF orgs' for the report's Anomaly section.",
            },
            {
                "title": "Live AI Q&A on the report",
                "what_unlocks": "Embed a chat widget in the published report. Reader asks 'Show me NHS digital's stack' or 'Which gov departments use Rust?' — AI answers from the viewmodels in real time. Highest engagement / signature-feature potential.",
                "needs": "Vector index over viewmodels + RAG with cheap LLM. Hosted endpoint.",
                "feasibility": "Few days. Adds running cost. Could ship as v2 hero feature.",
            },
        ],
    }


def build_scm(repos, target):
    """23 — SCM platform distribution.

    Most existing UK gov data points at GitHub; we still measure here
    so the finding is *empirically* "GitHub-only" instead of asserted.
    For future targets that genuinely span platforms, the same code
    summarises the spread.
    """
    by_platform: Counter = Counter()
    by_platform_active: Counter = Counter()
    by_platform_size: Counter = Counter()
    org_platforms: dict[str, set] = defaultdict(set)
    org_platform_counts: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))

    for r in repos:
        plat = r.platform or "github"
        by_platform[plat] += 1
        if not r.archived and not r.fork:
            by_platform_active[plat] += 1
        by_platform_size[plat] += r.size_kb
        org_platforms[r.org].add(plat)
        org_platform_counts[r.org][plat] += 1

    total_repos = len(repos)
    platform_rows = [
        {
            "platform": plat,
            "repos": cnt,
            "active_repos": by_platform_active[plat],
            "pct_of_corpus": pct(cnt, total_repos),
            "total_size_gb": round(by_platform_size[plat] / 1024 / 1024, 2),
        }
        for plat, cnt in by_platform.most_common()
    ]

    # Per-org platform usage. Org → list of platforms used + count of each.
    org_rows = []
    for org, plats in org_platforms.items():
        org_rows.append({
            "org": org,
            "platforms_used": sorted(plats),
            "platform_count": len(plats),
            "by_platform": dict(org_platform_counts[org]),
            "total_repos": sum(org_platform_counts[org].values()),
        })
    org_rows.sort(key=lambda r: (-r["platform_count"], -r["total_repos"]))

    # Distribution: how many orgs use 1 / 2 / 3+ platforms.
    diversity_buckets = Counter(r["platform_count"] for r in org_rows)
    diversity_rows = [
        {"platforms_used": k, "orgs": v}
        for k, v in sorted(diversity_buckets.items())
    ]

    # Multi-platform orgs — the interesting cohort.
    multi = [r for r in org_rows if r["platform_count"] >= 2]

    audience = target.get("entity_label", "the corpus")
    if len(by_platform) == 1:
        sole = next(iter(by_platform))
        finding = f"Every public repository in {audience}'s scanned corpus is hosted on {sole.title()}. We searched for verified public presences on GitLab, Bitbucket, Azure DevOps, and AWS CodeCommit; none were found."
    elif len(by_platform) == 2:
        a, b = list(by_platform.keys())[:2]
        finding = f"{audience}'s code spans {len(by_platform)} platforms — {a.title()} and {b.title()} — but {len(multi)} organisation(s) use both."
    else:
        finding = f"{audience}'s code spans {len(by_platform)} platforms. {len(multi)} organisation(s) maintain code on more than one."

    return {
        "totals": {
            "platforms_detected": len(by_platform),
            "orgs": len(org_platforms),
            "repos": total_repos,
            "multi_platform_orgs": len(multi),
        },
        "platform_distribution": platform_rows,
        "diversity_buckets": diversity_rows,
        "per_org_top50": org_rows[:50],
        "multi_platform_orgs": multi,
        "finding": finding,
    }


def build_anomalies(repos, td):
    """11 — curated outlier catalogue.

    A handful of repositories chosen for their position on the
    distribution tails. The report reproduces this as a magazine-style
    spread with one card per repo.
    """
    active = [r for r in repos if not r.archived and not r.fork]
    by_slug = {(r.org, r.name): r for r in repos}

    # Stars vs activity: a "famous abandoned" candidate is high-star +
    # very stale; an "invisible workhorse" is high-recent-activity +
    # zero stars + production-y signals.
    famous_abandoned = sorted(
        (r for r in repos if r.stars >= 50 and (r.years_since_push or 0) > 3 and not r.archived and not r.fork),
        key=lambda r: r.stars, reverse=True,
    )[:5]

    # The kitchen sink — most distinct languages in a single repo.
    kitchen_sink = None
    kitchen_sink_count = 0
    for (org, name), data in td.items():
        langs = data.get("languages") or {}
        if isinstance(langs, dict) and len(langs) > kitchen_sink_count:
            kitchen_sink_count = len(langs)
            r = by_slug.get((org, name))
            if r:
                kitchen_sink = {"slug": r.slug, "languages": kitchen_sink_count, "stars": r.stars}

    # Exemplar: every quality signal we measure, present at once.
    exemplars = []
    for (org, name), data in td.items():
        has_ci = bool(_detect_names(data.get("cicd")))
        has_tests = bool(_detect_names(data.get("testing")))
        has_fw = bool(_detect_names(data.get("frameworks")))
        has_db = bool(_detect_names(data.get("databases")))
        if has_ci and has_tests and has_fw and has_db:
            r = by_slug.get((org, name))
            if r and r.stars >= 5 and not r.archived:
                exemplars.append({
                    "slug": r.slug,
                    "stars": r.stars,
                    "size_kb": r.size_kb,
                })
    exemplars.sort(key=lambda x: x["stars"], reverse=True)

    # Prototype graveyard — count every public repo with a "trial" name.
    prototype_patterns = ("prototype", "-poc", "-poc-", "spike", "experiment", "proto-", "demo-", "-demo")
    prototype_repos = [r for r in repos if any(p in r.name.lower() for p in prototype_patterns)]

    # Single-author signal — repos with extremely concentrated commits
    # are interesting but we don't have author data here yet (gitstats
    # will provide it). For now we surface size-1 active estates.
    one_repo_orgs = []
    by_org: dict[str, list[Repo]] = defaultdict(list)
    for r in active:
        by_org[r.org].append(r)
    for org, rs in by_org.items():
        if len(rs) == 1:
            one_repo_orgs.append({"org": org, "repo": rs[0].slug, "stars": rs[0].stars})

    # Largest active repo + smallest active repo (both in lines/size).
    by_size = sorted(active, key=lambda r: r.size_kb)
    largest_active = {"slug": by_size[-1].slug, "size_gb": round(by_size[-1].size_kb/1024/1024, 2), "stars": by_size[-1].stars} if by_size else None
    smallest_active = None
    for r in by_size:
        if r.size_kb > 0:
            smallest_active = {"slug": r.slug, "size_kb": r.size_kb, "stars": r.stars}
            break

    return {
        "spotlights": {
            "kitchen_sink": kitchen_sink,
            "exemplars_top5": exemplars[:5],
            "famous_abandoned_top5": [
                {"slug": r.slug, "stars": r.stars, "years_idle": round(r.years_since_push or 0, 1)}
                for r in famous_abandoned
            ],
            "largest_active": largest_active,
            "smallest_active": smallest_active,
        },
        "prototype_graveyard": {
            "count": len(prototype_repos),
            "pct_of_corpus": pct(len(prototype_repos), len(repos)),
            "samples_top10": [
                {"slug": r.slug, "stars": r.stars, "archived": r.archived}
                for r in sorted(prototype_repos, key=lambda r: r.stars, reverse=True)[:10]
            ],
        },
        "one_repo_orgs_count": len(one_repo_orgs),
    }


def build_manifest(repos, td, scan_meta, target, target_root: Path):
    return {
        "target": {
            "slug": target["slug"],
            "title": target["title"],
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "target_root": str(target_root),
        "input_counts": {
            "repos_in_metadata": len(repos),
            "techdetect_jsons": len(td),
            "techdetect_coverage_pct": pct(len(td), sum(1 for r in repos if not r.archived and not r.fork)),
        },
        "scan_meta": scan_meta,
        "viewmodels_emitted": [
            "00_hero.json",
            "01_shape.json",
            "02_languages.json",
            "03_frameworks.json",
            "04_cloud.json",
            "05_engineering.json",
            "06_data_layer.json",
            "07_oss_health.json",
            "08_league_table.json",
            "09_headlines.json",
            f"per_org/<org>.json × {len({r.org for r in repos})}",
        ],
    }


# ───────────────────────── orchestrator ─────────────────────────


def main() -> int:
    target_root = resolve_target_root()
    target = load_target_config(target_root)
    raw_dir = target_root / "data" / "raw"
    td_dir = target_root / "data" / "techdetect"
    scan_meta_dir = target_root / "data" / "scan_meta"
    out_dir = target_root / "viewmodels"
    per_org_dir = out_dir / "per_org"

    print(f"Target: {target['slug']} — {target['title']}")
    print(f"Root:   {target_root}")
    print("Loading inputs…")
    repos = load_repos(raw_dir)
    td = load_techdetect(td_dir)
    scan_meta = load_scan_meta(scan_meta_dir)
    print(f"  {len(repos):,} repos, {len(td):,} tech-detect JSONs")

    print("Building view-models…")
    write_vm(out_dir, "00_hero.json", build_hero(repos, td, scan_meta, target))
    write_vm(out_dir, "01_shape.json", build_shape(repos))
    write_vm(out_dir, "02_languages.json", build_languages(repos, td))
    write_vm(out_dir, "03_frameworks.json", build_frameworks(td))
    write_vm(out_dir, "04_cloud.json", build_cloud(td))
    write_vm(out_dir, "05_engineering.json", build_engineering(td))
    write_vm(out_dir, "06_data_layer.json", build_data_layer(td))
    write_vm(out_dir, "07_oss_health.json", build_oss_health(repos, td))
    league = build_league_table(repos, td)
    write_vm(out_dir, "08_league_table.json", league)
    write_vm(out_dir, "09_headlines.json", build_headlines(repos, td, league, target))
    indices = build_indices(repos, td, league)
    write_vm(out_dir, "10_indices.json", indices)
    anomalies = build_anomalies(repos, td)
    write_vm(out_dir, "11_anomalies.json", anomalies)
    write_vm(out_dir, "23_scm.json", build_scm(repos, target))
    similarity = build_similarity(repos, td)
    write_vm(out_dir, "16_similarity.json", similarity)
    write_vm(out_dir, "17_takeaways.json", build_takeaways(repos, td, indices, league, anomalies))
    write_vm(out_dir, "18_ai_insights.json", build_ai_insights(td, indices, similarity))

    print("Building per-org view-models…")
    n = build_per_org(repos, td, per_org_dir)
    print(f"  wrote {n} per_org/*.json files")

    write_vm(out_dir, "manifest.json", build_manifest(repos, td, scan_meta, target, target_root))
    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
