#!/usr/bin/env python3
"""Helper: extract last-N-commit metadata from a cloned repo.

Called per repo from 02b_gitstats_all.sh. Args: <repo-path> <out-json>
<slug> <max-commits>. Writes a compact JSON record.
"""
import json
import os
import subprocess
import sys


def main() -> int:
    if len(sys.argv) != 5:
        print("usage: _gitstats_extract.py <repo> <out> <slug> <max>", file=sys.stderr)
        return 2
    work, out, slug, max_n_s = sys.argv[1:]
    max_n = int(max_n_s)

    US, RS = "\x1f", "\x1e"
    fmt = US.join(["%H", "%an", "%ae", "%at", "%P", "%s"]) + RS

    try:
        raw = subprocess.check_output(
            ["git", "-C", work, "log", f"--max-count={max_n}", "--no-merges",
             f"--pretty=format:{fmt}", "--encoding=UTF-8"],
            timeout=120,
        ).decode("utf-8", errors="replace")
    except subprocess.CalledProcessError:
        return 2
    except subprocess.TimeoutExpired:
        return 3

    commits = []
    for chunk in raw.split(RS):
        chunk = chunk.strip("\n").strip()
        if not chunk:
            continue
        parts = chunk.split(US, 5)
        if len(parts) < 6:
            continue
        h, an, ae, at, parents, subject = parts
        commits.append({
            "h": h,
            "an": an,
            "ae": ae,
            "t": int(at) if at.isdigit() else 0,
            "p": len(parents.split()) if parents.strip() else 0,
            "s": subject,
        })

    file_churn: dict[str, int] = {}
    commit_file_counts: dict[str, int] = {}
    try:
        raw2 = subprocess.check_output(
            ["git", "-C", work, "log", f"--max-count={max_n}", "--no-merges",
             "--name-only", "--pretty=format:COMMIT %H"],
            timeout=120,
        ).decode("utf-8", errors="replace")
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
        raw2 = ""

    cur = None
    for line in raw2.splitlines():
        if line.startswith("COMMIT "):
            cur = line[7:].strip()
            commit_file_counts[cur] = 0
        elif line.strip() and cur:
            file_churn[line] = file_churn.get(line, 0) + 1
            commit_file_counts[cur] = commit_file_counts.get(cur, 0) + 1

    hot = sorted(file_churn.items(), key=lambda kv: -kv[1])[:25]

    payload = {
        "slug": slug,
        "max_commits": max_n,
        "commit_count": len(commits),
        "commits": commits,
        "file_churn_top25": [{"path": p, "n": n} for p, n in hot],
        "commit_file_counts": commit_file_counts,
    }
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out + ".tmp", "w") as f:
        json.dump(payload, f, separators=(",", ":"))
    os.rename(out + ".tmp", out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
