#!/usr/bin/env python3
"""Stage 3b — aggregate git-stats per-repo JSONs into report viewmodels.

Reads $TARGET_ROOT/data/gitstats/<owner>/<repo>.json (produced by
02b_gitstats_all.sh) and writes a fresh batch of viewmodels alongside
the tech-detect ones:

  12_velocity.json     — commit cadence, hour/day distribution
  13_bus_factor.json   — author concentration risk per repo / org
  14_contributors.json — total / unique / vendor email-domain breakdown
  15_hotspots.json     — most-churned files across the corpus

These complement the tech-detect viewmodels with behavioural data
(what's happening in these repos, not just what's installed).
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = None  # set in main


# ───────────────────────── loaders ─────────────────────────


def load_gitstats(target_root: Path) -> dict[tuple[str, str], dict]:
    """Per-repo git-stats JSONs, keyed by (org, repo)."""
    src = target_root / "data" / "gitstats"
    if not src.is_dir():
        sys.exit(f"ERROR: git-stats not found at {src}\n  run 02b_gitstats_all.sh first.")
    out: dict[tuple[str, str], dict] = {}
    for p in src.rglob("*.json"):
        try:
            out[(p.parent.name, p.stem)] = json.loads(p.read_text())
        except json.JSONDecodeError:
            pass
    return out


# ───────────────────────── helpers ─────────────────────────


def pct(n, total):
    return round(100 * n / total, 1) if total else 0.0


VENDOR_DOMAINS = {
    # Public-sector internal
    "*.gov.uk": "Government (UK)",
    "*.nhs.net": "NHS",
    "*.nhs.uk": "NHS",
    "*.parliament.uk": "Parliament",
    "*.police.uk": "Police",
    "*.scot": "Scottish Government",
    "*.wales.gov.uk": "Welsh Government",
    "*.cymru.gov.uk": "Welsh Government",
    # Big-five consultancies
    "*.accenture.com": "Accenture",
    "*.capgemini.com": "Capgemini",
    "capgemini.co.uk": "Capgemini",
    "*.deloitte.co.uk": "Deloitte",
    "*.deloitte.com": "Deloitte",
    "*.ey.com": "EY",
    "*.kpmg.co.uk": "KPMG",
    "*.kpmg.com": "KPMG",
    "*.pwc.com": "PwC",
    "*.pwc.co.uk": "PwC",
    "ibm.com": "IBM",
    "*.ibm.com": "IBM",
    "atos.net": "Atos",
    "*.atos.net": "Atos",
    "*.fujitsu.com": "Fujitsu",
    "*.dxc.com": "DXC",
    "*.cognizant.com": "Cognizant",
    "*.tcs.com": "Tata Consultancy",
    "*.infosys.com": "Infosys",
    # Boutique gov-tech
    "*.kainos.com": "Kainos",
    "*.softwire.com": "Softwire",
    "*.equalexperts.com": "Equal Experts",
    "*.madetech.com": "Made Tech",
    "*.dxw.net": "dxw",
    "*.dxw.com": "dxw",
    "*.scottlogic.com": "Scott Logic",
    "*.bjss.com": "BJSS",
    "*.thoughtworks.com": "ThoughtWorks",
    "*.bjss.co.uk": "BJSS",
    # Big-tech (cloud/contractor)
    "*.microsoft.com": "Microsoft",
    "*.amazon.com": "Amazon",
    "*.amazon.co.uk": "Amazon",
    "*.google.com": "Google",
    "*.github.com": "GitHub",
    "*.redhat.com": "Red Hat",
    # Generic public mail providers
    "gmail.com": "Personal mail",
    "googlemail.com": "Personal mail",
    "outlook.com": "Personal mail",
    "hotmail.com": "Personal mail",
    "yahoo.com": "Personal mail",
    "yahoo.co.uk": "Personal mail",
    "live.com": "Personal mail",
    "icloud.com": "Personal mail",
    "protonmail.com": "Personal mail",
    "users.noreply.github.com": "GitHub-anonymised",
}


def classify_email(email: str) -> tuple[str, str]:
    """Return (vendor, domain) for an email. Falls back to "Other"."""
    if not email or "@" not in email:
        return "Unknown", ""
    domain = email.rsplit("@", 1)[1].lower().strip()
    # Exact match
    if domain in VENDOR_DOMAINS:
        return VENDOR_DOMAINS[domain], domain
    # Suffix match for *.foo patterns
    for pat, vendor in VENDOR_DOMAINS.items():
        if pat.startswith("*.") and domain.endswith(pat[1:]):
            return vendor, domain
    return "Other", domain


# ───────────────────────── viewmodel builders ─────────────────────────


CONVENTIONAL_COMMIT_RE = re.compile(
    r"^(feat|fix|chore|docs|refactor|test|style|perf|build|ci|revert|deps|security)(\([^)]+\))?(!)?:\s",
    re.IGNORECASE,
)
WIP_KEYWORDS = re.compile(
    r"\b(wip|tmp|temp|todo|fixme|hack|xxx|fix\s+this|fix\s+later|hotfix|broken|don'?t\s+merge|do\s+not\s+merge)\b",
    re.IGNORECASE,
)
PROFANITY = re.compile(r"\b(fuck|shit|crap|damn|wtf|bollocks)\b", re.IGNORECASE)


def build_velocity(gs: dict) -> dict:
    """12 — commit cadence + Time Crystal heatmap + commit-message NLP."""
    hour_hist = Counter()
    weekday_hist = Counter()
    weekday_hour: list[list[int]] = [[0] * 24 for _ in range(7)]  # 7×24 heatmap
    weekend_pct_per_repo = []
    commits_per_repo = []
    age_days_per_repo = []
    total_commits = 0
    repos_with_data = 0

    cc_count = 0
    cc_breakdown: Counter = Counter()
    wip_count = 0
    profanity_count = 0
    msg_total = 0
    non_ascii_count = 0
    non_ascii_samples: list = []

    for slug, data in gs.items():
        commits = data.get("commits") or []
        if not commits:
            continue
        repos_with_data += 1
        n = len(commits)
        commits_per_repo.append(n)
        total_commits += n
        weekend = 0
        ts = []
        for c in commits:
            t = c.get("t") or 0
            if t > 0:
                dt = datetime.fromtimestamp(t, tz=timezone.utc)
                hour_hist[dt.hour] += 1
                wd = dt.weekday()
                weekday_hist[wd] += 1
                weekday_hour[wd][dt.hour] += 1
                if wd >= 5:
                    weekend += 1
                ts.append(t)
            subject = c.get("s") or ""
            if not subject:
                continue
            msg_total += 1
            m = CONVENTIONAL_COMMIT_RE.match(subject)
            if m:
                cc_count += 1
                cc_breakdown[m.group(1).lower()] += 1
            if WIP_KEYWORDS.search(subject):
                wip_count += 1
            if PROFANITY.search(subject):
                profanity_count += 1
            if is_non_ascii_subject(subject):
                non_ascii_count += 1
                if len(non_ascii_samples) < 25:
                    non_ascii_samples.append({"slug": data.get("slug"), "subject": subject[:140]})
        if ts:
            age_days_per_repo.append((max(ts) - min(ts)) / 86400)
        weekend_pct_per_repo.append(pct(weekend, n))

    commits_per_repo.sort()
    age_days_per_repo.sort()
    weekend_pct_per_repo.sort()

    def quantile(arr, q):
        if not arr:
            return 0
        return arr[min(int(q * len(arr)), len(arr) - 1)]

    # 7×24 heatmap as a flat list of {weekday, hour, count} triples — easier for ECharts
    heatmap = []
    for w in range(7):
        for h in range(24):
            heatmap.append({"weekday": w, "hour": h, "count": weekday_hour[w][h]})

    return {
        "totals": {
            "repos_with_history": repos_with_data,
            "total_commits_in_window": total_commits,
            "messages_analysed": msg_total,
        },
        "hour_distribution_utc": [
            {"hour": h, "count": hour_hist[h]} for h in range(24)
        ],
        "weekday_distribution": [
            {"weekday": ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][d], "count": weekday_hist[d]}
            for d in range(7)
        ],
        "weekday_hour_heatmap": heatmap,
        "weekend_share_pct": round(
            100 * sum(weekday_hist[d] for d in (5, 6)) / max(sum(weekday_hist.values()), 1), 2
        ),
        "commits_per_repo": {
            "median": quantile(commits_per_repo, 0.5),
            "p25": quantile(commits_per_repo, 0.25),
            "p75": quantile(commits_per_repo, 0.75),
            "p90": quantile(commits_per_repo, 0.90),
            "p99": quantile(commits_per_repo, 0.99),
        },
        "history_window_days_per_repo": {
            "median": round(quantile(age_days_per_repo, 0.5), 1),
            "p25": round(quantile(age_days_per_repo, 0.25), 1),
            "p75": round(quantile(age_days_per_repo, 0.75), 1),
            "p90": round(quantile(age_days_per_repo, 0.90), 1),
        },
        "weekend_committer_pct_per_repo": {
            "median": quantile(weekend_pct_per_repo, 0.5),
            "p75": quantile(weekend_pct_per_repo, 0.75),
            "p90": quantile(weekend_pct_per_repo, 0.90),
        },
        "commit_message_nlp": {
            "messages_analysed": msg_total,
            "conventional_commits_count": cc_count,
            "conventional_commits_pct": round(100 * cc_count / max(msg_total, 1), 1),
            "conventional_breakdown": [
                {"type": t, "count": c}
                for t, c in cc_breakdown.most_common()
            ],
            "wip_or_todo_count": wip_count,
            "wip_or_todo_pct": round(100 * wip_count / max(msg_total, 1), 2),
            "profanity_count": profanity_count,
            "profanity_pct": round(100 * profanity_count / max(msg_total, 1), 4),
            "non_ascii_count": non_ascii_count,
            "non_ascii_pct": round(100 * non_ascii_count / max(msg_total, 1), 3),
            "non_ascii_samples": non_ascii_samples,
        },
    }


def domain_of(email: str) -> str:
    """Extract just the email domain (everything after the @). Returns
    'unknown' if no @ in the string. Used for anonymisation — we don't
    publish full email addresses anywhere in the report."""
    if not email or "@" not in email:
        return "unknown"
    return email.rsplit("@", 1)[1].lower().strip()


def build_bus_factor(gs: dict) -> dict:
    """13 — author concentration per repo, aggregated to org level.

    Key signal: `% of last-N commits by top author`. >80% = single
    point of failure, with all the strategic risk that implies.

    All visible per-author identifiers are shown as the EMAIL DOMAIN
    only (e.g. `@accenture.com` not `joe.bloggs@accenture.com`). The
    underlying analysis still keys on the full email so two authors
    sharing a domain don't get merged.
    """
    by_org: dict[str, list[float]] = defaultdict(list)
    at_risk = []  # repos where top author > 80%
    distribution_buckets = Counter()  # repo bucket
    overall_concentrations = []

    for slug, data in gs.items():
        commits = data.get("commits") or []
        if len(commits) < 5:  # too few to be meaningful
            continue
        author_counts: Counter = Counter()
        for c in commits:
            ae = (c.get("ae") or "").lower().strip()
            if ae:
                author_counts[ae] += 1
        if not author_counts:
            continue
        n = sum(author_counts.values())
        top_author, top_n = author_counts.most_common(1)[0]
        top_pct = round(100 * top_n / n, 1)
        overall_concentrations.append(top_pct)
        org = data.get("slug", slug if isinstance(slug, str) else f"{slug[0]}/{slug[1]}").split("/", 1)[0]
        by_org[org].append(top_pct)
        if top_pct > 80:
            at_risk.append({
                "slug": data.get("slug"),
                "top_author_domain": "@" + domain_of(top_author),
                "top_pct": top_pct,
                "commits_in_window": n,
            })
        # Buckets
        if top_pct > 80:
            distribution_buckets[">80%"] += 1
        elif top_pct > 60:
            distribution_buckets["60-80%"] += 1
        elif top_pct > 40:
            distribution_buckets["40-60%"] += 1
        elif top_pct > 20:
            distribution_buckets["20-40%"] += 1
        else:
            distribution_buckets["≤20%"] += 1

    # Per-org median concentration (qualifier: ≥3 repos with data).
    org_rows = []
    for org, vals in by_org.items():
        if len(vals) < 3:
            continue
        vals_sorted = sorted(vals)
        median = vals_sorted[len(vals_sorted) // 2]
        org_rows.append({
            "org": org,
            "repos_measured": len(vals),
            "median_top_author_pct": round(median, 1),
            "high_risk_repos_count": sum(1 for v in vals if v > 80),
        })
    org_rows.sort(key=lambda r: r["median_top_author_pct"], reverse=True)

    overall_concentrations.sort()

    def qstats(arr):
        if not arr:
            return {}
        return {
            "p25": arr[int(len(arr) * 0.25)],
            "median": arr[len(arr) // 2],
            "p75": arr[int(len(arr) * 0.75)],
            "p90": arr[int(len(arr) * 0.90)],
        }

    return {
        "totals": {
            "repos_measured": len(overall_concentrations),
            "single_point_of_failure_count": sum(1 for v in overall_concentrations if v > 80),
            "single_point_of_failure_pct": pct(sum(1 for v in overall_concentrations if v > 80), len(overall_concentrations)),
        },
        "concentration_distribution": [
            {"bucket": k, "repos": v}
            for k, v in [(">80%", distribution_buckets[">80%"]),
                          ("60-80%", distribution_buckets["60-80%"]),
                          ("40-60%", distribution_buckets["40-60%"]),
                          ("20-40%", distribution_buckets["20-40%"]),
                          ("≤20%", distribution_buckets["≤20%"])]
        ],
        "concentration_quantiles_pct": qstats(overall_concentrations),
        "per_org_top25": org_rows[:25],
        "high_risk_repos_top25": sorted(at_risk, key=lambda r: r["commits_in_window"], reverse=True)[:25],
    }


BOT_NAME_PATTERNS = re.compile(
    r"^("
    r"dependabot|dependabot\[bot\]|dependabot-preview|dependabot-preview\[bot\]"
    r"|renovate|renovate\[bot\]|renovate-bot"
    r"|github-actions|github-actions\[bot\]|gh-actions"
    r"|pre-commit-ci|pre-commit-ci\[bot\]"
    r"|snyk-bot|snyk\[bot\]"
    r"|mergify|mergify\[bot\]"
    r"|gitleaks|gitleaks-bot"
    r"|codecov|codecov\[bot\]|codecov-commenter"
    r"|deepsource-autofix|deepsource-bot|deepsource-autofix\[bot\]"
    r"|imgbot|imgbot\[bot\]"
    r"|allcontributors|all-contributors\[bot\]|allcontributors\[bot\]"
    r"|fossabot|fossabot\[bot\]"
    r"|stale|stale\[bot\]"
    r"|jenkins|jenkins-x"
    r"|semantic-release-bot"
    r"|github-merge-queue|github-merge-queue\[bot\]"
    r"|web-flow"  # GitHub web UI commits — usually merges via UI
    r")$",
    re.IGNORECASE,
)
BOT_EMAIL_PATTERNS = re.compile(
    r"(@bots\.github\.com|noreply@github\.com|@dependabot|@renovate"
    r"|@snyk-bot|actions@github\.com|@semantic-release-bot|@imgbot)",
    re.IGNORECASE,
)


def is_bot(name: str, email: str) -> bool:
    n = (name or "").strip().lower()
    e = (email or "").strip().lower()
    if BOT_NAME_PATTERNS.match(n):
        return True
    if "[bot]" in n:
        return True
    if BOT_EMAIL_PATTERNS.search(e):
        return True
    return False


def is_non_ascii_subject(subject: str) -> bool:
    """Cheap proxy for non-English commit messages: any character above
    the basic Latin block. Catches CJK, Cyrillic, Arabic, etc. — the
    interesting outliers in a UK-gov report."""
    return any(ord(c) > 127 for c in subject)


def build_contributors(gs: dict) -> dict:
    """14 — contributor graph + vendor email-domain exposure."""
    distinct_authors: set = set()
    distinct_emails: set = set()
    domain_commits: Counter = Counter()
    domain_authors: dict[str, set] = defaultdict(set)
    vendor_commits: Counter = Counter()
    vendor_authors: dict[str, set] = defaultdict(set)

    by_org_domain_share: dict[str, Counter] = defaultdict(Counter)
    cross_org_authors: dict[str, set] = defaultdict(set)  # email -> set of orgs

    # Bot vs human commits — interesting because Dependabot/Renovate
    # generate tens of thousands of automated commits; the "human"
    # number is what tells us about real engineering activity.
    bot_commits = 0
    human_commits = 0
    bot_breakdown: Counter = Counter()  # bot name → commit count
    bots_per_org: dict[str, int] = defaultdict(int)
    humans_per_org: dict[str, int] = defaultdict(int)

    for slug_tuple, data in gs.items():
        commits = data.get("commits") or []
        org = data.get("slug", "").split("/", 1)[0]
        for c in commits:
            ae = (c.get("ae") or "").lower().strip()
            an = (c.get("an") or "").lower().strip()
            if is_bot(an, ae):
                bot_commits += 1
                bot_breakdown[an] += 1
                if org:
                    bots_per_org[org] += 1
                continue
            if org:
                humans_per_org[org] += 1
            human_commits += 1
            if not ae:
                continue
            distinct_emails.add(ae)
            distinct_authors.add((ae, an))
            vendor, domain = classify_email(ae)
            if domain:
                domain_commits[domain] += 1
                domain_authors[domain].add(ae)
            vendor_commits[vendor] += 1
            vendor_authors[vendor].add(ae)
            if org:
                by_org_domain_share[org][vendor] += 1
                cross_org_authors[ae].add(org)

    # Cross-org: collapse by EMAIL DOMAIN, not by individual email.
    # The interesting signal is "this domain spans N orgs", not which
    # named individual is doing the work.
    cross_org_by_domain: dict[str, set] = defaultdict(set)
    cross_org_emails_per_domain: dict[str, set] = defaultdict(set)
    for ae, orgs in cross_org_authors.items():
        if len(orgs) >= 3:
            d = domain_of(ae)
            for o in orgs:
                cross_org_by_domain[d].add(o)
            cross_org_emails_per_domain[d].add(ae)
    cross_org = [
        {
            "domain": "@" + d,
            "orgs": sorted(orgs),
            "distinct_authors": len(cross_org_emails_per_domain[d]),
        }
        for d, orgs in cross_org_by_domain.items()
    ]
    cross_org.sort(key=lambda r: (len(r["orgs"]), r["distinct_authors"]), reverse=True)

    # Per-org top vendor share (tells the story of "Department X is N% Capgemini").
    org_rows = []
    for org, c in by_org_domain_share.items():
        total = sum(c.values()) or 1
        top_vendor, top_n = c.most_common(1)[0] if c else ("Unknown", 0)
        external_pct = round(
            100 * sum(v for k, v in c.items() if k not in {"Government (UK)", "NHS", "Parliament", "GitHub-anonymised"})
            / total, 1
        )
        org_rows.append({
            "org": org,
            "total_commits": total,
            "top_vendor": top_vendor,
            "top_vendor_pct": round(100 * top_n / total, 1),
            "external_pct": external_pct,
            "vendor_breakdown": [{"vendor": k, "commits": v, "pct": round(100*v/total, 1)} for k, v in c.most_common(10)],
        })
    org_rows.sort(key=lambda r: r["total_commits"], reverse=True)

    total_with_bots = bot_commits + human_commits
    bot_pct = round(100 * bot_commits / max(total_with_bots, 1), 1)
    bot_org_rows = [
        {"org": o, "bot_commits": bots_per_org[o], "human_commits": humans_per_org[o],
         "bot_pct": round(100 * bots_per_org[o] / max(bots_per_org[o] + humans_per_org[o], 1), 1)}
        for o in (set(bots_per_org) | set(humans_per_org))
    ]
    bot_org_rows.sort(key=lambda r: r["bot_pct"], reverse=True)

    return {
        "totals": {
            "unique_emails": len(distinct_emails),
            "unique_authors_approx": len(distinct_authors),
            "total_commits": sum(domain_commits.values()),
            "human_commits": human_commits,
            "bot_commits": bot_commits,
            "bot_pct_of_total": bot_pct,
        },
        "bots": {
            "top_bots_by_commits": [
                {"name": n, "commits": c}
                for n, c in bot_breakdown.most_common(25)
            ],
            "per_org_bot_share_top25": [r for r in bot_org_rows if r["bot_commits"] >= 50][:25],
        },
        "top_vendors_by_commits": [
            {"vendor": v, "commits": c, "authors": len(vendor_authors[v]), "pct": round(100*c/sum(vendor_commits.values()), 2)}
            for v, c in vendor_commits.most_common(20)
        ],
        "top_email_domains": [
            {"domain": d, "commits": c, "authors": len(domain_authors[d])}
            for d, c in domain_commits.most_common(40)
        ],
        "per_org_vendor_top10": org_rows[:25],
        "cross_org_contributors_top25": cross_org[:25],
    }


AI_PATTERNS = {
    "claude": re.compile(r"\b(claude(?:[-\s]?code)?|anthropic)\b", re.IGNORECASE),
    "copilot": re.compile(r"\b(copilot|github\s*copilot)\b", re.IGNORECASE),
    "chatgpt": re.compile(r"\b(chatgpt|openai|gpt-?[34])\b", re.IGNORECASE),
    "cursor": re.compile(r"\b(cursor\s*ai|cursor[\s-]ide)\b", re.IGNORECASE),
    "aider": re.compile(r"\baider\b", re.IGNORECASE),
    "cody": re.compile(r"\bcody\b", re.IGNORECASE),
    "codeium": re.compile(r"\bcodeium\b", re.IGNORECASE),
    "windsurf": re.compile(r"\bwindsurf\b", re.IGNORECASE),
    "cline": re.compile(r"\bcline\b", re.IGNORECASE),
    "tabnine": re.compile(r"\btabnine\b", re.IGNORECASE),
    "ai-generic": re.compile(r"\b(ai[-\s]generated|generated[-\s]by[-\s]ai|written[-\s]by[-\s]ai|ai[-\s]assisted|llm[-\s]generated)\b", re.IGNORECASE),
}
# Co-Authored-By trailer detection — a strong signal vs casual mentions.
COAUTHOR_AI_RE = re.compile(
    r"co-authored-by:[^\n]*?(claude|copilot|cody|aider|cursor|chatgpt|openai)",
    re.IGNORECASE,
)


def build_ai_adoption(gs: dict) -> dict:
    """19 — AI assistant adoption signal from commit messages.

    Per-org and per-corpus counts of:
      - Mentions of named AI assistants (Claude, Copilot, ChatGPT, …)
      - Co-Authored-By trailers naming an AI
      - First-seen month per assistant per org (adoption timeline)
    """
    pattern_counts: Counter = Counter()
    coauthor_count = 0
    per_org: dict[str, Counter] = defaultdict(Counter)
    per_org_repos_with_ai: dict[str, set] = defaultdict(set)
    first_seen: dict[str, int] = {}  # pattern -> earliest unix timestamp
    sample_messages: dict[str, list[str]] = defaultdict(list)
    repos_with_any: set = set()

    total_msgs = 0
    for slug_tuple, data in gs.items():
        commits = data.get("commits") or []
        org = data.get("slug", "").split("/", 1)[0]
        repo_slug = data.get("slug", "")
        for c in commits:
            subject = c.get("s") or ""
            if not subject:
                continue
            total_msgs += 1
            t = c.get("t") or 0
            matched_any = False
            for name, rx in AI_PATTERNS.items():
                if rx.search(subject):
                    pattern_counts[name] += 1
                    per_org[org][name] += 1
                    per_org_repos_with_ai[org].add(repo_slug)
                    matched_any = True
                    if t and (name not in first_seen or t < first_seen[name]):
                        first_seen[name] = t
                    if len(sample_messages[name]) < 5:
                        sample_messages[name].append({
                            "slug": repo_slug,
                            "subject": subject[:200],
                            "ts": t,
                        })
            if COAUTHOR_AI_RE.search(subject):
                coauthor_count += 1
            if matched_any:
                repos_with_any.add(repo_slug)

    org_rows = []
    for org, c in per_org.items():
        org_rows.append({
            "org": org,
            "ai_mentions": sum(c.values()),
            "repos_with_ai_mention": len(per_org_repos_with_ai[org]),
            "by_assistant": [{"name": k, "count": v} for k, v in c.most_common()],
        })
    org_rows.sort(key=lambda r: r["ai_mentions"], reverse=True)

    first_seen_human = {
        k: datetime.fromtimestamp(v, tz=timezone.utc).strftime("%Y-%m") if v else None
        for k, v in first_seen.items()
    }

    return {
        "totals": {
            "messages_analysed": total_msgs,
            "messages_with_ai_mention": sum(pattern_counts.values()),
            "messages_with_coauthor_ai_trailer": coauthor_count,
            "repos_with_any_ai_mention": len(repos_with_any),
            "ai_mention_rate_pct": round(100 * sum(pattern_counts.values()) / max(total_msgs, 1), 4),
        },
        "by_assistant": [
            {"name": k, "mentions": v, "first_seen_month": first_seen_human.get(k)}
            for k, v in pattern_counts.most_common()
        ],
        "per_org_top25": org_rows[:25],
        "sample_messages": {k: v[:3] for k, v in sample_messages.items()},
    }


def normalise_subject(s: str) -> str:
    """Normalise a commit subject for duplicate detection. Strip merge
    refs, leading/trailing whitespace, lowercase."""
    s = s.strip().lower()
    s = re.sub(r"^merge (pull request|branch).+", "merge", s)
    s = re.sub(r"\s+", " ", s)
    return s


def build_message_quality(gs: dict) -> dict:
    """20 — commit message quality + duplicates.

    Memory-efficient duplicate detection: the dict is keyed by the
    normalised subject string itself (more readable than hashing for
    output) but bounded by unique-message count, not total commits.
    With 2.28M commits and high duplication (release notes, merge
    messages, dependabot), unique distinct subjects ≈ 500k–1M, each
    ~80 bytes + a small int — comfortably under 200 MB peak.

    What "good" vs "bad" looks like:
      - GOOD: 25–72 character subjects with imperative verbs ("fix
        login redirect on Safari"). Industry guidance: 50/72 rule.
      - BAD: very short (<10 char, often "fix", "wip", "tmp") OR
        very long rambling subjects (>100 char), or empty.
    """
    length_buckets = Counter()  # buckets in 10-char ranges
    raw_lengths = []
    bad_short = 0   # < 10 chars
    bad_long = 0    # > 100 chars
    empty = 0
    good_band = 0   # 25-72 chars
    per_org_lengths: dict[str, list[int]] = defaultdict(list)

    # Duplicate detection: normalised subject → count.
    dup_count: Counter = Counter()

    for slug_tuple, data in gs.items():
        commits = data.get("commits") or []
        org = data.get("slug", "").split("/", 1)[0]
        for c in commits:
            subject = (c.get("s") or "").strip()
            if not subject:
                empty += 1
                continue
            length = len(subject)
            raw_lengths.append(length)
            per_org_lengths[org].append(length)
            bucket = (length // 10) * 10
            length_buckets[bucket] += 1
            if length < 10:
                bad_short += 1
            elif length > 100:
                bad_long += 1
            elif 25 <= length <= 72:
                good_band += 1
            dup_count[normalise_subject(subject)] += 1

    raw_lengths.sort()

    def quantile(arr, q):
        if not arr:
            return 0
        return arr[min(int(q * len(arr)), len(arr) - 1)]

    n = len(raw_lengths)
    top_dupes = [
        {"subject": subj[:120], "count": cnt}
        for subj, cnt in dup_count.most_common(50)
        if cnt >= 100  # only the seriously-duplicated ones
    ]

    org_rows = []
    for org, lengths in per_org_lengths.items():
        if len(lengths) < 50:
            continue
        s = sorted(lengths)
        org_rows.append({
            "org": org,
            "n": len(lengths),
            "median_length": s[len(s) // 2],
            "p25": s[int(len(s) * 0.25)],
            "p75": s[int(len(s) * 0.75)],
        })
    org_rows.sort(key=lambda r: r["median_length"], reverse=True)

    return {
        "totals": {
            "messages_analysed": n,
            "empty_messages": empty,
            "bad_short_count": bad_short,
            "bad_short_pct": round(100 * bad_short / max(n, 1), 1),
            "bad_long_count": bad_long,
            "bad_long_pct": round(100 * bad_long / max(n, 1), 1),
            "good_band_count": good_band,
            "good_band_pct": round(100 * good_band / max(n, 1), 1),
            "unique_subjects": len(dup_count),
            "duplication_ratio_pct": round(100 * (1 - len(dup_count) / max(n, 1)), 1),
        },
        "length_quantiles": {
            "p10": quantile(raw_lengths, 0.10),
            "p25": quantile(raw_lengths, 0.25),
            "median": quantile(raw_lengths, 0.50),
            "p75": quantile(raw_lengths, 0.75),
            "p90": quantile(raw_lengths, 0.90),
            "p99": quantile(raw_lengths, 0.99),
        },
        "length_histogram": [
            {"bucket": f"{b}-{b+9}", "count": length_buckets[b]}
            for b in sorted(length_buckets.keys())
            if b <= 200  # cap display
        ],
        "per_org_subject_length_top25": org_rows[:25],
        "per_org_subject_length_bottom25": sorted(org_rows, key=lambda r: r["median_length"])[:25],
        "top_duplicates_top50": top_dupes,
    }


_DOMAIN_VENDOR_LOOKUP = {
    # Public-sector internal — common patterns
    ("gov.uk",): "Government (UK)",
    ("nhs.net", "nhs.uk"): "NHS",
    ("parliament.uk",): "Parliament",
    # Personal mail
    ("gmail.com", "googlemail.com", "outlook.com", "hotmail.com",
     "yahoo.com", "yahoo.co.uk", "live.com", "icloud.com", "protonmail.com"): "Personal mail",
    # GitHub anonymised
    ("users.noreply.github.com",): "GitHub-anonymised",
}


def vendor_for_domain(domain: str) -> str:
    domain = domain.lower().strip()
    for suffixes, vendor in _DOMAIN_VENDOR_LOOKUP.items():
        for s in suffixes:
            if domain == s or domain.endswith("." + s):
                return vendor
    return "Other"


def build_time_by_domain(gs: dict) -> dict:
    """21 — hour-of-day stacked by email-domain vendor class.

    Reveals whether external (vendor) commits skew differently from
    .gov.uk commits — does the vendor day end at 5pm or carry on
    into evenings?"""
    vendors_seen: set = set()
    hour_vendor: dict[int, Counter] = {h: Counter() for h in range(24)}
    for slug_tuple, data in gs.items():
        commits = data.get("commits") or []
        for c in commits:
            t = c.get("t") or 0
            ae = (c.get("ae") or "").lower().strip()
            if not ae or t <= 0:
                continue
            vendor = vendor_for_domain(domain_of(ae))
            vendors_seen.add(vendor)
            dt = datetime.fromtimestamp(t, tz=timezone.utc)
            hour_vendor[dt.hour][vendor] += 1

    vendor_order = ["Government (UK)", "NHS", "Parliament", "GitHub-anonymised",
                    "Personal mail", "Other"]
    # Keep only vendors seen.
    vendor_order = [v for v in vendor_order if v in vendors_seen]

    return {
        "vendors": vendor_order,
        "hours": [
            {
                "hour": h,
                **{v: hour_vendor[h][v] for v in vendor_order},
            }
            for h in range(24)
        ],
    }


def build_hotspots(gs: dict) -> dict:
    """15 — most-churned files. Two views:
       a) absolute churn (which files change most)
       b) churn rate (changes per active-day across all repos containing
          that file) — normalises out "this file is hot because the repo
          is huge" vs "this file is genuinely hot".

    'Absolute churn' is informative for raw scale; 'churn rate' is the
    one that tells you which files are *actually* turbulent.
    """
    INFRA = {
        "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "Cargo.lock",
        "Gemfile.lock", "poetry.lock", "composer.lock", "go.sum",
        "package.json", "CHANGELOG.md", "VERSION",
    }

    global_churn: Counter = Counter()
    by_org_top: dict[str, Counter] = defaultdict(Counter)
    # For each file: how many active-days it lived across the repos
    # that contained it. Sum of (latest - earliest commit timestamp,
    # in days) per repo it appeared in.
    file_active_days: Counter = Counter()
    file_repos: Counter = Counter()  # how many repos this file appears in

    infra_total = 0
    code_total = 0

    for slug_tuple, data in gs.items():
        org = data.get("slug", "").split("/", 1)[0]
        commits = data.get("commits") or []
        if commits:
            ts = [c.get("t") for c in commits if c.get("t")]
            repo_active_days = max(1.0, ((max(ts) - min(ts)) / 86400)) if len(ts) >= 2 else 1.0
        else:
            repo_active_days = 1.0
        for entry in data.get("file_churn_top25") or []:
            path, n = entry["path"], entry["n"]
            base = path.rsplit("/", 1)[-1]
            if base in INFRA:
                infra_total += n
                continue
            code_total += n
            global_churn[path] += n
            by_org_top[org][path] += n
            file_active_days[path] += repo_active_days
            file_repos[path] += 1

    # Churn rate per file = total churn / total active-repo-days. Higher
    # = file changes more often in the time it's been alive.
    rate_rows = []
    for path, churn in global_churn.items():
        days = file_active_days[path] or 1
        rate_rows.append({
            "path": path,
            "churn": churn,
            "repos": file_repos[path],
            "rate_per_day": round(churn / days, 3),
        })
    rate_rows.sort(key=lambda r: r["rate_per_day"], reverse=True)
    # Filter out files in <2 repos to avoid 1-off outliers.
    rate_rows_filtered = [r for r in rate_rows if r["repos"] >= 2]

    return {
        "totals": {
            "files_tracked": len(global_churn),
            "infra_churn_total": infra_total,
            "code_churn_total": code_total,
        },
        "top_files_global_top25": [
            {"path": p, "churn": n}
            for p, n in global_churn.most_common(25)
        ],
        "top_files_by_rate_top25": rate_rows_filtered[:25],
        "top_file_per_org_top25": [
            {"org": org, "path": c.most_common(1)[0][0] if c else None,
             "churn": c.most_common(1)[0][1] if c else 0}
            for org, c in by_org_top.items()
            if c
        ][:25],
    }


# ───────────────────────── orchestrator ─────────────────────────


def main() -> int:
    target_root_env = os.environ.get("TARGET_ROOT")
    if not target_root_env:
        sys.exit("ERROR: TARGET_ROOT env var is required")
    target_root = Path(target_root_env).resolve()
    out_dir = target_root / "viewmodels"
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"Loading git-stats from {target_root / 'data' / 'gitstats'}…")
    gs = load_gitstats(target_root)
    print(f"  {len(gs):,} per-repo records")

    print("Building git-stats viewmodels…")
    payload = {
        "12_velocity.json": build_velocity(gs),
        "13_bus_factor.json": build_bus_factor(gs),
        "14_contributors.json": build_contributors(gs),
        "15_hotspots.json": build_hotspots(gs),
        "19_ai_adoption.json": build_ai_adoption(gs),
        "20_message_quality.json": build_message_quality(gs),
        "21_time_by_domain.json": build_time_by_domain(gs),
    }
    for name, data in payload.items():
        p = out_dir / name
        with open(p, "w") as f:
            json.dump(data, f, indent=2)
        print(f"  wrote {p.name}")

    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
