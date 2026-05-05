#!/usr/bin/env python3
"""Stage 4 — render the report's view-models as a magazine-style HTML page.

Reads from $TARGET_ROOT/viewmodels/ and writes a single self-contained
HTML file to $TARGET_ROOT/site/index.html. The page works as:

  • A responsive screen experience (fluid layout, mobile-friendly).
  • A print-to-PDF artefact (A4 page breaks, restrained colour, no
    interactive chrome). Open in any modern browser, File → Print →
    Save as PDF and you get a clean magazine-style PDF.

Stack:
  • Tailwind CSS via the v3 Play CDN (no build step).
  • Apache ECharts for most charts (bars, treemaps, donuts, radars).
  • D3 for the bubble-pack "org galaxy" feature visualisation.
  • Inter / Playfair Display via Google Fonts.

The Python here just stitches together HTML strings and inlines the
view-models as `<script type="application/json">` blocks. All chart
initialisation happens client-side from those blobs, so the same HTML
file is fully portable — no separate JSON to ship alongside.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from datetime import datetime, timezone


# ───────────────────────── helpers ─────────────────────────


def resolve_target_root() -> Path:
    root = os.environ.get("TARGET_ROOT")
    if not root:
        sys.exit(
            "ERROR: TARGET_ROOT env var is required.\n"
            "       Use run_all.sh <slug>."
        )
    p = Path(root).resolve()
    if not p.is_dir():
        sys.exit(f"ERROR: TARGET_ROOT does not exist: {p}")
    return p


def load_vms(target_root: Path) -> dict:
    """Load every view-model JSON, keyed by file stem (without .json)."""
    vm_dir = target_root / "viewmodels"
    if not vm_dir.is_dir():
        sys.exit(
            f"ERROR: viewmodels not found at {vm_dir}\n"
            "       run stage 3 first (03_build_viewmodels.py)."
        )
    out: dict[str, dict] = {}
    for p in sorted(vm_dir.glob("*.json")):
        out[p.stem] = json.loads(p.read_text())
    return out


def fmt_int(n: int | float | None) -> str:
    if n is None:
        return "—"
    return f"{int(n):,}"


def vm_blob(name: str, data) -> str:
    """Inline a view-model into a script tag the JS layer can read."""
    payload = json.dumps(data, separators=(",", ":"))
    return f'<script type="application/json" id="vm-{name}">{payload}</script>'


# ───────────────────────── page sections ─────────────────────────


def cover(vms: dict, target: dict) -> str:
    h = vms["00_hero"]
    t = h["totals"]
    title = target.get("title", "State of Code")
    subtitle = target.get("subtitle", "")
    audience = target.get("audience_label", "organisations")
    return f"""
<section id="cover" data-nav-label="Cover" class="page cover bg-paper text-ink">
  <div class="h-full grid grid-rows-[auto_1fr_auto] gap-12">
    <div class="text-xs tracking-[0.3em] uppercase text-stone-500 flex items-center justify-between">
      <span>State of Code · {target.get("slug","").upper()}</span>
      <span>{datetime.now().strftime("%B %Y")}</span>
    </div>
    <div class="flex flex-col justify-end pb-8">
      <h1 class="font-display font-black text-display tracking-tight leading-[0.92] mb-8">
        {title}
      </h1>
      <p class="text-2xl md:text-3xl font-light text-stone-700 max-w-3xl leading-snug">
        {subtitle}
      </p>
    </div>
    <div class="grid grid-cols-3 gap-8 pt-8 border-t border-stone-300">
      <div>
        <div class="font-mono text-stat font-bold leading-none">{fmt_int(t["repos"])}</div>
        <div class="mt-2 text-xs uppercase tracking-wider text-stone-500">repositories</div>
      </div>
      <div>
        <div class="font-mono text-stat font-bold leading-none">{fmt_int(t["orgs"])}</div>
        <div class="mt-2 text-xs uppercase tracking-wider text-stone-500">{audience}</div>
      </div>
      <div>
        <div class="font-mono text-stat font-bold leading-none">{int(round(t["size_gb"])):,}<span class="text-3xl font-light text-stone-500"> GB</span></div>
        <div class="mt-2 text-xs uppercase tracking-wider text-stone-500">of code</div>
      </div>
    </div>
  </div>
</section>
"""


def foreword(vms: dict, target: dict) -> str:
    blurb = target.get(
        "hero_blurb",
        "We analysed every public repository across the target organisations. This is what we found.",
    )
    return f"""
<section id="foreword" data-nav-label="Foreword" class="page bg-paper text-ink">
  <div class="max-w-2xl mx-auto pt-16">
    <div class="text-xs tracking-[0.3em] uppercase text-stone-500 mb-6">Foreword</div>
    <p class="font-display text-2xl leading-relaxed first-letter:font-display first-letter:font-black first-letter:text-7xl first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:leading-none">
      {blurb}
    </p>
  </div>
</section>
"""


def methodology(vms: dict) -> str:
    h = vms["00_hero"]
    s = h["scan"]
    elapsed = s.get("scan_wall_clock_seconds")
    elapsed_str = f"{elapsed // 60}m {elapsed % 60}s" if elapsed else "—"
    return f"""
<section id="methodology" data-nav-label="Methodology" class="page bg-paper text-ink">
  <div class="max-w-3xl mx-auto pt-16">
    <div class="text-xs tracking-[0.3em] uppercase text-stone-500 mb-6">Methodology</div>
    <h2 class="font-display text-4xl mb-8">How this report was built</h2>
    <div class="grid grid-cols-2 gap-12 text-sm leading-relaxed text-stone-700">
      <div>
        <h3 class="font-semibold text-ink mb-2 uppercase tracking-wide text-xs">What we did</h3>
        <p class="mb-4">Enumerated every public repository owned by each organisation in the target list via the GitHub API. Shallow-cloned each active (non-archived, non-fork) repo and ran a heuristic technology detector against the HEAD tree.</p>
        <p>Aggregated the per-repo signals into the section view-models that drive every chart in this report.</p>
      </div>
      <div>
        <h3 class="font-semibold text-ink mb-2 uppercase tracking-wide text-xs">What we measured</h3>
        <ul class="space-y-1 list-none">
          <li><span class="font-mono">{fmt_int(h["totals"]["repos"])}</span> repositories enumerated</li>
          <li><span class="font-mono">{fmt_int(h["totals"]["active_repos"])}</span> active (non-archived, non-fork) scanned</li>
          <li><span class="font-mono">{fmt_int(s.get("scan_succeeded"))}</span> tech-detect outputs collected</li>
          <li><span class="font-mono">{fmt_int(s.get("scan_failed"))}</span> empty repos (no HEAD commit)</li>
          <li>Wall-clock for the scan: <span class="font-mono">{elapsed_str}</span></li>
        </ul>
      </div>
    </div>
    <div class="mt-12 grid grid-cols-2 gap-12 text-sm leading-relaxed text-stone-700">
      <div>
        <h3 class="font-semibold text-ink mb-2 uppercase tracking-wide text-xs">What we deliberately can't claim</h3>
        <ul class="space-y-1 list-disc pl-5">
          <li>No DORA metrics — we have no commit/PR/deploy data.</li>
          <li>Public repos only — internal code is invisible.</li>
          <li>Heuristic detection — "uses Spring" means Spring config files are present, not running in production.</li>
        </ul>
      </div>
      <div>
        <h3 class="font-semibold text-ink mb-2 uppercase tracking-wide text-xs">Reproducibility</h3>
        <p>Every chart on every page is driven by a JSON view-model checked into the dataset. The pipeline that produced them is open-sourced under <span class="font-mono">reports/state-of-code/</span> in the RepoGuru repository.</p>
      </div>
    </div>
  </div>
</section>
"""


def section_opener(roman: str, title: str, kicker: str) -> str:
    slug = roman.lower()
    return f"""
<section id="part-{slug}" data-nav-label="{title}" data-nav-part="{roman}" class="page page-break section-opener bg-ink text-paper">
  <div class="h-full grid grid-rows-[auto_1fr_auto] gap-8">
    <div class="text-xs tracking-[0.3em] uppercase text-stone-400">Part {roman}</div>
    <div class="flex flex-col justify-center">
      <div class="font-display text-[16rem] leading-none font-black opacity-20 select-none">{roman}</div>
      <h2 class="font-display text-6xl md:text-7xl font-bold leading-tight -mt-12 max-w-3xl">{title}</h2>
    </div>
    <p class="font-display text-2xl italic text-stone-300 max-w-2xl leading-snug">{kicker}</p>
  </div>
</section>
"""


def section_shape(vms: dict) -> str:
    s = vms["01_shape"]
    z = s["zombie_ratio"]
    extr = s["extremes"]
    return f"""
<section class="page page-break bg-paper text-ink">
  <div class="space-y-8">
    {kicker_line("Where the code lives")}
    <h3 class="font-display text-4xl max-w-3xl">A handful of organisations dominate. The rest fill the long tail.</h3>
    <div class="grid grid-cols-12 gap-6">
      <div class="col-span-7">
        <div id="chart-shape-top-orgs" class="chart h-[820px]"></div>
      </div>
      <aside class="col-span-5 space-y-6 text-sm leading-relaxed text-stone-700">
        <p>The top organisation alone accounts for <span class="font-mono font-semibold text-ink">{int((s["top_orgs_by_repo_count"][0]["repo_count"]/s["totals"]["repos"])*100)}%</span> of all repositories. The top eight cover most of the corpus; the remaining bodies trail in a long tail of single-digit estates.</p>
        {stat_card("Largest single repository", f"{extr['largest_single_repo']['slug']}", f"{extr['largest_single_repo']['size_gb']} GB")}
      </aside>
    </div>
  </div>
</section>

<section class="page page-break bg-paper text-ink">
  <div class="space-y-8">
    {kicker_line("The graveyard ratio")}
    <h3 class="font-display text-4xl max-w-3xl">Active code, archived code, forks of other people's code.</h3>
    <div class="grid grid-cols-12 gap-6">
      <div class="col-span-6">
        <div id="chart-shape-status-donut" class="chart h-[360px]"></div>
      </div>
      <div class="col-span-6">
        <div id="chart-shape-size-buckets" class="chart h-[360px]"></div>
      </div>
    </div>
    <div class="grid grid-cols-3 gap-6 pt-6 border-t border-stone-300">
      {stat_card("Untouched in 2+ years", f"{z['pct_of_all']}%", f"{fmt_int(z['zombie_repos'])} repositories")}
      {stat_card("Most active organisation", extr['most_active_org'], "by repo count")}
      {stat_card("Smallest active org", extr['smallest_org_active']['org'], f"{extr['smallest_org_active']['active_count']} active")}
    </div>
  </div>
</section>

<section class="page page-break bg-paper text-ink">
  <div class="space-y-8">
    {kicker_line("Activity over time")}
    <h3 class="font-display text-4xl max-w-3xl">When was this code last touched?</h3>
    <div class="grid grid-cols-12 gap-6">
      <div class="col-span-12">
        <div id="chart-shape-pushyear" class="chart h-[360px]"></div>
      </div>
    </div>
    <p class="text-sm leading-relaxed text-stone-700 max-w-3xl">Each bar is the year of the last push for repositories whose default branch was last updated in that year. The shape is a long fade from a recent peak — most active code is still being written, but a meaningful tail of estates haven't moved in a decade.</p>
  </div>
</section>

<section class="page page-break bg-paper text-ink">
  <div class="space-y-8">
    {kicker_line("Org galaxy")}
    <h3 class="font-display text-4xl max-w-3xl">Every organisation, sized by repository count.</h3>
    <div id="chart-shape-galaxy" class="w-full h-[640px]"></div>
    <p class="text-xs text-stone-500">Each circle is one organisation. Area is proportional to total repository count.</p>
  </div>
</section>
"""


def section_languages(vms: dict) -> str:
    return f"""
<section class="page page-break bg-paper text-ink">
  <div class="space-y-8">
    {kicker_line("The lingua franca")}
    <h3 class="font-display text-4xl max-w-3xl">Markdown is everywhere. JavaScript is doing most of the heavy lifting.</h3>
    <div class="grid grid-cols-12 gap-6">
      <div class="col-span-12">
        <div id="chart-lang-by-repo" class="chart h-[820px]"></div>
      </div>
    </div>
    <p class="text-sm leading-relaxed text-stone-700 max-w-3xl">Two views of the same data tell different stories. Counting <em>repositories that contain</em> a given language puts ubiquitous tools (Markdown, YAML) at the top. Counting <em>files</em> shifts the picture: the languages doing real work emerge, weighted by codebase size.</p>
  </div>
</section>

<section class="page page-break bg-paper text-ink">
  <div class="space-y-8">
    {kicker_line("By volume of code")}
    <h3 class="font-display text-4xl max-w-3xl">Where the bytes actually live.</h3>
    <div id="chart-lang-treemap" class="w-full h-[600px]"></div>
  </div>
</section>
"""


def section_frameworks(vms: dict) -> str:
    f = vms["03_frameworks"]
    pct = f["totals"]["pct_with_any"]
    return f"""
<section class="page page-break bg-paper text-ink">
  <div class="space-y-8">
    {kicker_line("Frameworks & stacks")}
    <h3 class="font-display text-4xl max-w-3xl">{pct}% of repositories declared at least one detectable web framework.</h3>
    <div class="grid grid-cols-12 gap-6">
      <div class="col-span-8">
        <div id="chart-frameworks-bar" class="chart h-[820px]"></div>
      </div>
      <aside class="col-span-4 space-y-4 text-sm leading-relaxed text-stone-700">
        <p>The top framework is <span class="font-mono font-semibold text-ink">{f['top_tools'][0]['name'] if f['top_tools'] else '—'}</span>, present in {f['top_tools'][0]['pct'] if f['top_tools'] else 0}% of framework-using repos.</p>
        <p>The shape of this chart is the procurement gravity well — anything in the top five is a default for new starts, not a niche choice.</p>
      </aside>
    </div>
  </div>
</section>
"""


def section_cloud(vms: dict) -> str:
    c = vms["04_cloud"]
    s = c["shares"]
    return f"""
<section class="page page-break bg-paper text-ink">
  <div class="space-y-8">
    {kicker_line("The cloud diaspora")}
    <h3 class="font-display text-4xl max-w-3xl">AWS leads, Azure follows, GCP trails. Most repos use no detectable cloud at all.</h3>
    <div class="grid grid-cols-12 gap-6">
      <div class="col-span-6">
        <div id="chart-cloud-donut" class="chart h-[400px]"></div>
      </div>
      <div class="col-span-6 grid grid-cols-3 gap-4 content-center">
        {stat_card("AWS", f"{s['aws_pct']}%", f"{fmt_int(c['totals']['aws_repos'])} repos")}
        {stat_card("Azure", f"{s['azure_pct']}%", f"{fmt_int(c['totals']['azure_repos'])} repos")}
        {stat_card("GCP", f"{s['gcp_pct']}%", f"{fmt_int(c['totals']['gcp_repos'])} repos")}
      </div>
    </div>
  </div>
</section>

<section class="page page-break bg-paper text-ink">
  <div class="space-y-8">
    {kicker_line("Top services per cloud")}
    <h3 class="font-display text-4xl max-w-3xl">What gets adopted, in what order.</h3>
    <div class="grid grid-cols-3 gap-6">
      <div><h4 class="text-xs uppercase tracking-wider text-stone-500 mb-2">AWS</h4><div id="chart-cloud-aws" class="chart h-[760px]"></div></div>
      <div><h4 class="text-xs uppercase tracking-wider text-stone-500 mb-2">Azure</h4><div id="chart-cloud-azure" class="chart h-[760px]"></div></div>
      <div><h4 class="text-xs uppercase tracking-wider text-stone-500 mb-2">GCP</h4><div id="chart-cloud-gcp" class="chart h-[760px]"></div></div>
    </div>
  </div>
</section>
"""


def section_engineering(vms: dict) -> str:
    e = vms["05_engineering"]
    g = e["discipline_gaps"]
    return f"""
<section class="page page-break bg-paper text-ink">
  <div class="space-y-8">
    {kicker_line("Engineering discipline")}
    <h3 class="font-display text-4xl max-w-3xl">{g['no_cicd_or_testing_pct']}% of scanned repositories have neither CI nor any detectable test framework.</h3>
    <div class="grid grid-cols-12 gap-6">
      <div class="col-span-6"><h4 class="text-xs uppercase tracking-wider text-stone-500 mb-2">CI / CD</h4><div id="chart-eng-cicd" class="chart h-[760px]"></div></div>
      <div class="col-span-6"><h4 class="text-xs uppercase tracking-wider text-stone-500 mb-2">Testing</h4><div id="chart-eng-test" class="chart h-[760px]"></div></div>
    </div>
    <div class="grid grid-cols-3 gap-6 pt-6 border-t border-stone-300">
      {stat_card("No CI/CD detected", f"{g['no_cicd_pct']}%", f"{fmt_int(g['no_cicd_repos'])} repos")}
      {stat_card("No testing detected", f"{g['no_testing_pct']}%", f"{fmt_int(g['no_testing_repos'])} repos")}
      {stat_card("Neither", f"{g['no_cicd_or_testing_pct']}%", f"{fmt_int(g['no_cicd_or_testing_repos'])} repos")}
    </div>
  </div>
</section>
"""


def section_data(vms: dict) -> str:
    d = vms["06_data_layer"]
    pct = d["totals"]["pct_with_any"]
    return f"""
<section class="page page-break bg-paper text-ink">
  <div class="space-y-8">
    {kicker_line("The data layer")}
    <h3 class="font-display text-4xl max-w-3xl">{pct}% of scanned repositories declared a database or ORM dependency.</h3>
    <div class="grid grid-cols-12 gap-6">
      <div class="col-span-8"><div id="chart-data-bar" class="chart h-[820px]"></div></div>
      <aside class="col-span-4 space-y-4 text-sm leading-relaxed text-stone-700">
        <p>The detector here treats engines and ORMs as one bucket — Postgres sits alongside SQLAlchemy and Knex. Read it as "what the data layer relies on", not "which database is running".</p>
        <p>Even with that conflation, the leader is unambiguous: <span class="font-mono font-semibold text-ink">{d['top_tools'][0]['name'] if d['top_tools'] else '—'}</span> is the dominant choice.</p>
      </aside>
    </div>
  </div>
</section>
"""


def section_oss(vms: dict) -> str:
    o = vms["07_oss_health"]
    z = o["zombies"]
    em = o["empty"]
    most = o["most_starred"][0] if o["most_starred"] else None
    return f"""
<section class="page page-break bg-paper text-ink">
  <div class="space-y-8">
    {kicker_line("Open-source health")}
    <h3 class="font-display text-4xl max-w-3xl">A handful of repositories carry most of the public weight.</h3>
    <div class="grid grid-cols-12 gap-6">
      <div class="col-span-6"><div id="chart-oss-stars" class="chart h-[400px]"></div></div>
      <div class="col-span-6"><div id="chart-oss-most" class="chart h-[820px]"></div></div>
    </div>
    <div class="grid grid-cols-3 gap-6 pt-6 border-t border-stone-300">
      {stat_card("Most-starred repo", most['slug'] if most else '—', f"{fmt_int(most['stars']) if most else '0'} stars")}
      {stat_card(f"Untouched in {z['threshold_years']}+ years", f"{z['pct']}%", f"{fmt_int(z['count'])} repos")}
      {stat_card("Empty repositories", fmt_int(em['count']), f"{em['pct']}% of all")}
    </div>
  </div>
</section>
"""


def section_league(vms: dict) -> str:
    return f"""
<section class="page page-break bg-paper text-ink">
  <div class="space-y-8">
    {kicker_line("League table")}
    <h3 class="font-display text-4xl max-w-3xl">The top eight, scored across eight dimensions.</h3>
    <div id="chart-league" class="chart w-full h-[640px]"></div>
    <p class="text-xs text-stone-500 max-w-3xl">Each axis is normalised across the corpus. Scale = repository count. Freshness = % pushed in last 12 months. CI / Test = % of scanned repos with detected CI / test tooling. Cloud breadth = number of clouds used (0–3). OSS share = % with at least one star. Archive ratio = % archived. Language diversity = distinct languages detected.</p>
  </div>
</section>
"""


def section_headlines(vms: dict) -> str:
    h = vms["09_headlines"]
    quotes = h.get("did_you_know", [])
    strip = h.get("by_the_numbers_strip", [])
    quote_html = "".join(
        f'''
    <blockquote class="font-display text-2xl md:text-3xl italic leading-snug text-ink relative pl-8 border-l-2 border-accent">
      <span class="absolute -left-1 -top-3 font-display text-7xl text-accent leading-none">"</span>
      {q}
    </blockquote>
        '''
        for q in quotes
    )
    strip_html = "".join(
        f'<div class="text-center"><div class="font-mono text-2xl font-bold text-ink">{s}</div></div>'
        for s in strip
    )
    return f"""
<section class="page page-break bg-paper text-ink">
  <div class="space-y-12">
    {kicker_line("Headlines")}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-12">
      {quote_html}
    </div>
    <div class="pt-12 border-t border-stone-300 grid grid-cols-{max(len(strip),1)} gap-4">
      {strip_html}
    </div>
  </div>
</section>
"""


def outro(vms: dict, target: dict) -> str:
    h = vms["00_hero"]
    s = h["scan"]
    elapsed = s.get("scan_wall_clock_seconds")
    return f"""
<section id="outro" data-nav-label="Colophon" class="page page-break bg-ink text-paper">
  <div class="h-full grid grid-rows-[auto_1fr_auto] gap-8">
    <div class="text-xs tracking-[0.3em] uppercase text-stone-400">Colophon</div>
    <div class="flex flex-col justify-center max-w-2xl">
      <h2 class="font-display text-5xl mb-6">How this report was made.</h2>
      <p class="text-lg text-stone-300 leading-relaxed mb-4">
        Every chart in this report is driven by a JSON view-model derived from the raw scan data.
        The pipeline that produced them — enumeration, tech-detect, aggregation, render — is open and reproducible.
      </p>
      <p class="text-lg text-stone-300 leading-relaxed">
        <span class="font-mono">{fmt_int(s.get("scan_succeeded"))}</span> repositories were scanned in <span class="font-mono">{elapsed//60 if elapsed else "—"}</span> minutes using <strong>RepoGuru</strong>.
      </p>
    </div>
    <div class="text-xs text-stone-500 flex justify-between">
      <span>Generated {datetime.now(timezone.utc).strftime("%Y-%m-%d")}</span>
      <span>{target.get("title","")}</span>
    </div>
  </div>
</section>
"""


def section_indices(vms: dict) -> str:
    """Composite indices spread — multi-axis league tables."""
    if "10_indices" not in vms:
        return ""
    idx = vms["10_indices"]
    rk = idx["rankings"]

    def league(title, key, hint):
        rows = rk.get(key, [])[:25]
        items = "".join(
            f'<li class="flex justify-between border-b border-stone-200 py-2"><span class="font-medium">{i+1}. {r["org"]}</span><span class="font-mono text-sm">{r["score"]}</span></li>'
            for i, r in enumerate(rows)
        )
        return f"""
        <div>
          <h4 class="text-xs uppercase tracking-wider text-stone-500 mb-1">{title}</h4>
          <p class="text-xs text-stone-500 mb-3">{hint}</p>
          <ul class="text-sm">{items}</ul>
        </div>"""

    qual = idx.get("qualifier_threshold_active_repos", 5)
    return f"""
<section class="page page-break bg-paper text-ink">
  <div class="space-y-8">
    {kicker_line("Composite indices")}
    <h3 class="font-display text-4xl max-w-3xl">Different organisations lead different metrics. Multi-dimensional, not one-number.</h3>
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-8">
      {league("Code Health", "code_health", "CI + tests + recent push + non-empty")}
      {league("Modernity", "modernity", "freshness + recent + diversity")}
      {league("OSS Power", "oss_power", "stars × footprint × topic curation")}
      {league("Dark Matter", "dark_matter", "archived + zombie + empty (high = bad)")}
    </div>
    <p class="text-xs text-stone-500 max-w-3xl pt-4 border-t border-stone-300">Only orgs with ≥{qual} active repositories qualify for the rankings (avoids one-repo councils stunting the leaderboard with 100% scores). All scores are 0–100. Methodology and weights are documented in <span class="font-mono">scripts/03_build_viewmodels.py</span>.</p>
  </div>
</section>
"""


def section_velocity(vms: dict) -> str:
    if "12_velocity" not in vms:
        return ""
    v = vms["12_velocity"]
    cpr = v["commits_per_repo"]
    return f"""
<section class="page page-break bg-paper text-ink" id="sec-velocity-detail" data-nav-label="Velocity detail">
  <div class="space-y-8">
    <div class="flex items-baseline gap-4 flex-wrap">
      {kicker_line("Velocity & cadence")}
      {commit_window_badge()}
    </div>
    <h3 class="font-display text-4xl max-w-3xl">When public-sector developers actually push code.</h3>
    <div class="grid grid-cols-12 gap-6">
      <div class="col-span-7">
        <div id="chart-velocity-hour" class="chart h-[300px]"></div>
        <div id="chart-velocity-weekday" class="chart h-[260px] mt-4"></div>
      </div>
      <aside class="col-span-5 space-y-4 text-sm leading-relaxed text-stone-700">
        <p>Each commit's author timestamp tells us when it was written. Aggregated across the corpus, the rhythm of public-sector software work emerges.</p>
        {stat_card("Median commits in window per repo", str(cpr.get("median", 0)), f"p25={cpr.get('p25')}, p90={cpr.get('p90')}")}
        {stat_card("Weekend share of all commits", f"{v.get('weekend_share_pct', 0)}%", "Sat + Sun")}
        {stat_card("Total commits analysed", fmt_int(v["totals"]["total_commits_in_window"]), f"across {fmt_int(v['totals']['repos_with_history'])} repos")}
      </aside>
    </div>
  </div>
</section>
"""


def section_bus_factor(vms: dict) -> str:
    if "13_bus_factor" not in vms:
        return ""
    b = vms["13_bus_factor"]
    t = b["totals"]
    q = b["concentration_quantiles_pct"]
    return f"""
<section class="page page-break bg-paper text-ink" id="sec-bus-factor" data-nav-label="Bus factor distribution">
  <div class="space-y-8">
    <div class="flex items-baseline gap-4 flex-wrap">
      {kicker_line("Bus factor")}
      {commit_window_badge()}
    </div>
    <h3 class="font-display text-4xl max-w-3xl">{t['single_point_of_failure_pct']}% of actively-maintained repositories depend on a single contributor for more than 80% of their recent commits.</h3>
    <div class="grid grid-cols-12 gap-6">
      <div class="col-span-6">
        <div id="chart-bus-distribution" class="chart h-[400px]"></div>
      </div>
      <div class="col-span-6 space-y-4">
        {stat_card("Single-point-of-failure repos", fmt_int(t['single_point_of_failure_count']), f"{t['single_point_of_failure_pct']}% of measured")}
        {stat_card("Median top-author share", f"{q.get('median', 0)}%", f"p25 {q.get('p25', 0)}% · p75 {q.get('p75', 0)}% · p90 {q.get('p90', 0)}%")}
        {stat_card("Repos measured", fmt_int(t['repos_measured']), "with ≥5 commits in window")}
      </div>
    </div>
    <p class="text-xs text-stone-500 max-w-3xl">"Top-author share" is the percentage of last-1000 commits attributable to the single most-active contributor. A score of 100% means one person wrote every recent commit; if they leave, the codebase loses its institutional memory.</p>
  </div>
</section>
"""


def section_contributors(vms: dict) -> str:
    if "14_contributors" not in vms:
        return ""
    c = vms["14_contributors"]
    t = c["totals"]
    return f"""
<section class="page page-break bg-paper text-ink" id="sec-contributors-detail" data-nav-label="Contributor graph">
  <div class="space-y-8">
    <div class="flex items-baseline gap-4 flex-wrap">
      {kicker_line("The contributor graph")}
      {commit_window_badge()}
    </div>
    <h3 class="font-display text-4xl max-w-3xl">Who actually writes UK government code, and which email domain do they use?</h3>
    <div class="grid grid-cols-12 gap-6">
      <div class="col-span-7"><div id="chart-vendors" class="chart h-[820px]"></div></div>
      <aside class="col-span-5 space-y-4 text-sm leading-relaxed text-stone-700">
        <p>Each commit is attributed to an email address. Grouping email domains into vendors reveals the contractor footprint inside government code.</p>
        {stat_card("Unique contributors", fmt_int(t['unique_authors_approx']), f"{fmt_int(t['unique_emails'])} distinct email addresses")}
        {stat_card("Total commits in window", fmt_int(t['total_commits']), "across the corpus")}
      </aside>
    </div>
    <p class="text-xs text-stone-500 max-w-3xl">"GitHub-anonymised" addresses (`*.users.noreply.github.com`) are GitHub's privacy-preserving default; the contributor's identity is real, just not their email. "Personal mail" is gmail / outlook / etc. — typically civil-servant or contractor side-projects rather than vendor commits.</p>
  </div>
</section>
"""


def section_hotspots(vms: dict) -> str:
    if "15_hotspots" not in vms:
        return ""
    h = vms["15_hotspots"]
    t = h["totals"]
    return f"""
<section class="page page-break bg-paper text-ink" id="sec-hotspots-detail" data-nav-label="Hotspots">
  <div class="space-y-8">
    <div class="flex items-baseline gap-4 flex-wrap">
      {kicker_line("Hotspots")}
      {commit_window_badge()}
    </div>
    <h3 class="font-display text-4xl max-w-3xl">The files everyone keeps changing.</h3>
    <div class="grid grid-cols-12 gap-6">
      <div class="col-span-12"><div id="chart-hotspots" class="chart h-[820px]"></div></div>
    </div>
    <p class="text-xs text-stone-500 max-w-3xl">Lockfiles (package-lock.json, yarn.lock, Gemfile.lock, etc.) and CHANGELOGs are tracked separately as "infrastructure churn" since they change automatically with every dependency update. The chart shows real source-file churn only. Across the measured corpus: <span class="font-mono">{fmt_int(t['code_churn_total'])}</span> code-file changes, <span class="font-mono">{fmt_int(t['infra_churn_total'])}</span> infra changes.</p>
  </div>
</section>
"""


def section_anomalies(vms: dict) -> str:
    if "11_anomalies" not in vms:
        return ""
    a = vms["11_anomalies"]
    sp = a.get("spotlights", {})
    proto = a.get("prototype_graveyard", {})

    def card(title, slug, line, hint):
        return f"""
        <div class="border border-stone-300 p-5">
          <div class="text-xs uppercase tracking-wider text-stone-500 mb-2">{title}</div>
          <div class="font-mono text-base text-ink mb-1">{slug}</div>
          <div class="font-display text-2xl text-ink">{line}</div>
          <div class="text-xs text-stone-500 mt-2">{hint}</div>
        </div>"""

    cards = []
    if sp.get("kitchen_sink"):
        ks = sp["kitchen_sink"]
        cards.append(card("Most languages in one repo", ks["slug"], f"{ks['languages']} languages", f"{ks['stars']} ★"))
    if sp.get("famous_abandoned_top5"):
        fa = sp["famous_abandoned_top5"][0]
        cards.append(card("Famous abandoned", fa["slug"], f"{fmt_int(fa['stars'])} ★ · {fa['years_idle']}y idle", "no commits in years"))
    if sp.get("largest_active"):
        la = sp["largest_active"]
        cards.append(card("Largest active repo", la["slug"], f"{la['size_gb']} GB", f"{la['stars']} ★"))
    if sp.get("smallest_active"):
        sm = sp["smallest_active"]
        cards.append(card("Smallest active repo", sm["slug"], f"{sm['size_kb']} KB", "still receiving commits"))
    if sp.get("exemplars_top5"):
        ex = sp["exemplars_top5"][0]
        cards.append(card("The exemplar", ex["slug"], f"{fmt_int(ex['stars'])} ★", "CI + tests + framework + database"))

    cards_html = "\n".join(cards)

    return f"""
<section class="page page-break bg-paper text-ink">
  <div class="space-y-8">
    {kicker_line("Anomalies & outliers")}
    <h3 class="font-display text-4xl max-w-3xl">Five repositories worth knowing by name.</h3>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards_html}
    </div>
    <div class="pt-8 border-t border-stone-300">
      <h4 class="font-display text-2xl mb-2">The prototype graveyard</h4>
      <p class="text-base text-stone-700 max-w-3xl">{fmt_int(proto.get('count', 0))} repositories in the corpus contain &quot;prototype&quot;, &quot;poc&quot;, &quot;spike&quot;, &quot;experiment&quot;, or &quot;demo&quot; in their name — that's <span class="font-mono">{proto.get('pct_of_corpus', 0)}%</span> of the entire public estate. Most are functional artefacts of legitimate exploratory work; a handful are mature codebases that simply never got renamed.</p>
    </div>
  </div>
</section>
"""


def section_per_org_leaders(vms: dict) -> str:
    """Per-org "primary stack" cross-cut.

    For each top org, the single dominant tool in each category. Reads
    like a stack-fingerprint table — instantly tells you who's a Rails
    shop, who's a Spring shop, who's an Express shop, etc."""
    lang = (vms.get("02_languages") or {}).get("per_org_top_languages", [])
    fw = {r["org"]: r["top_tool"] for r in (vms.get("03_frameworks") or {}).get("per_org_top_tool", [])}
    db = {r["org"]: r["top_tool"] for r in (vms.get("06_data_layer") or {}).get("per_org_top_tool", [])}
    cicd = {r["org"]: r["top_tool"] for r in ((vms.get("05_engineering") or {}).get("cicd") or {}).get("per_org_top_tool", [])}
    test = {r["org"]: r["top_tool"] for r in ((vms.get("05_engineering") or {}).get("testing") or {}).get("per_org_top_tool", [])}
    rows = []
    for r in lang[:25]:
        org = r["org"]
        rows.append({
            "org": org,
            "lang": r["primary"]["language"],
            "fw": fw.get(org) or "—",
            "db": db.get(org) or "—",
            "cicd": cicd.get(org) or "—",
            "test": test.get(org) or "—",
        })
    body = "".join(
        f'<tr class="border-b border-stone-200 hover:bg-stone-100/40">'
        f'<td class="py-2 pr-3 font-mono text-sm">{r["org"]}</td>'
        f'<td class="py-2 px-3 text-sm">{r["lang"]}</td>'
        f'<td class="py-2 px-3 text-sm">{r["fw"]}</td>'
        f'<td class="py-2 px-3 text-sm">{r["db"]}</td>'
        f'<td class="py-2 px-3 text-sm">{r["cicd"]}</td>'
        f'<td class="py-2 px-3 text-sm">{r["test"]}</td>'
        f'</tr>'
        for r in rows
    )
    return f"""
<section class="page page-break bg-paper text-ink" id="sec-per-org-leaders" data-nav-label="Department stacks">
  <div class="space-y-8">
    {kicker_line("Department stacks")}
    <h3 class="font-display text-4xl max-w-3xl">Each department's signature stack — the primary choice in every category.</h3>
    <table class="w-full text-left">
      <thead>
        <tr class="border-b-2 border-ink">
          <th class="py-2 pr-3 text-xs uppercase tracking-wider text-stone-500">Organisation</th>
          <th class="py-2 px-3 text-xs uppercase tracking-wider text-stone-500">Primary language</th>
          <th class="py-2 px-3 text-xs uppercase tracking-wider text-stone-500">Top framework</th>
          <th class="py-2 px-3 text-xs uppercase tracking-wider text-stone-500">Top data tool</th>
          <th class="py-2 px-3 text-xs uppercase tracking-wider text-stone-500">Top CI</th>
          <th class="py-2 px-3 text-xs uppercase tracking-wider text-stone-500">Top test tool</th>
        </tr>
      </thead>
      <tbody>{body}</tbody>
    </table>
  </div>
</section>
"""


def section_iac_containers(vms: dict) -> str:
    c = vms.get("04_cloud") or {}
    container = c.get("container_tools", [])
    iac = c.get("iac_tools", [])
    if not container and not iac:
        return ""
    return f"""
<section class="page page-break bg-paper text-ink" id="sec-iac" data-nav-label="IaC & containers">
  <div class="space-y-8">
    {kicker_line("Infrastructure as code · Containers")}
    <h3 class="font-display text-4xl max-w-3xl">How the deployment surface gets described.</h3>
    <div class="grid grid-cols-12 gap-6">
      <div class="col-span-6">
        <h4 class="text-xs uppercase tracking-wider text-stone-500 mb-2">Containers</h4>
        <div id="chart-containers" class="chart h-[460px]"></div>
      </div>
      <div class="col-span-6">
        <h4 class="text-xs uppercase tracking-wider text-stone-500 mb-2">Infrastructure-as-code</h4>
        <div id="chart-iac" class="chart h-[460px]"></div>
      </div>
    </div>
    <p class="text-xs text-stone-500 max-w-3xl">Detection is heuristic — looks for Dockerfile / docker-compose / k8s manifests / Helm charts (containers) and Terraform / CloudFormation / Pulumi / Ansible files (IaC). Repos using none of these usually deploy via clicks, scripts, or vendor-specific bespoke tooling.</p>
  </div>
</section>
"""


def section_zombie_orgs(vms: dict) -> str:
    o = vms.get("07_oss_health") or {}
    zo = (o.get("zombies") or {}).get("top_zombie_orgs", [])[:25]
    eo = (o.get("empty") or {}).get("top_orgs", [])[:25]
    if not zo and not eo:
        return ""
    z_rows = "".join(
        f'<tr class="border-b border-stone-200"><td class="py-2 pr-3 font-mono text-sm">{r["org"]}</td><td class="py-2 px-3 text-sm font-mono text-right">{fmt_int(r["count"])}</td></tr>'
        for r in zo
    )
    e_rows = "".join(
        f'<tr class="border-b border-stone-200"><td class="py-2 pr-3 font-mono text-sm">{r["org"]}</td><td class="py-2 px-3 text-sm font-mono text-right">{fmt_int(r["count"])}</td></tr>'
        for r in eo
    )
    return f"""
<section class="page page-break bg-paper text-ink" id="sec-zombie-orgs" data-nav-label="Where code goes to die">
  <div class="space-y-8">
    {kicker_line("Where code goes to die")}
    <h3 class="font-display text-4xl max-w-3xl">Concentration of zombie and empty repositories per organisation.</h3>
    <div class="grid grid-cols-2 gap-12">
      <div>
        <h4 class="text-xs uppercase tracking-wider text-stone-500 mb-3">Zombie repos (untouched 2y+)</h4>
        <table class="w-full text-left"><tbody>{z_rows}</tbody></table>
      </div>
      <div>
        <h4 class="text-xs uppercase tracking-wider text-stone-500 mb-3">Empty repos (no HEAD commit)</h4>
        <table class="w-full text-left"><tbody>{e_rows}</tbody></table>
      </div>
    </div>
  </div>
</section>
"""


def section_at_risk_repos(vms: dict) -> str:
    """Names the specific repos at single-point-of-failure risk."""
    b = vms.get("13_bus_factor") or {}
    high = b.get("high_risk_repos_top25", [])[:25]
    if not high:
        return ""
    rows = "".join(
        f'<tr class="border-b border-stone-200">'
        f'<td class="py-2 pr-3 font-mono text-sm">{r["slug"]}</td>'
        f'<td class="py-2 px-3 text-sm font-mono text-stone-600">{r.get("top_author_domain", r.get("top_author",""))}</td>'
        f'<td class="py-2 px-3 text-sm font-mono text-right">{r.get("top_pct",0)}%</td>'
        f'<td class="py-2 px-3 text-sm font-mono text-right">{fmt_int(r.get("commits_in_window",0))}</td>'
        f'</tr>'
        for r in high
    )
    return f"""
<section class="page page-break bg-paper text-ink" id="sec-at-risk" data-nav-label="At-risk repositories">
  <div class="space-y-8">
    {kicker_line("Single points of failure — by name")}
    <h3 class="font-display text-4xl max-w-3xl">Repositories where one contributor wrote &gt;80% of recent commits.</h3>
    <table class="w-full text-left">
      <thead>
        <tr class="border-b-2 border-ink">
          <th class="py-2 pr-3 text-xs uppercase tracking-wider text-stone-500">Repository</th>
          <th class="py-2 px-3 text-xs uppercase tracking-wider text-stone-500">Top author domain</th>
          <th class="py-2 px-3 text-xs uppercase tracking-wider text-stone-500 text-right">Share</th>
          <th class="py-2 px-3 text-xs uppercase tracking-wider text-stone-500 text-right">Commits in window</th>
        </tr>
      </thead>
      <tbody>{rows}</tbody>
    </table>
    <p class="text-xs text-stone-500 max-w-3xl">"Share" is the percentage of last-1000 commits attributable to the named author. These are the most institutional-knowledge-concentrated repositories in the corpus — the ones where losing a single person costs the most.</p>
  </div>
</section>
"""


def section_cross_org_contributors(vms: dict) -> str:
    c = vms.get("14_contributors") or {}
    rows = c.get("cross_org_contributors_top25", [])[:25]
    if not rows:
        return ""
    items = "".join(
        f'<div class="border-l-2 border-stone-300 pl-4 py-2">'
        f'<div class="font-mono text-sm text-ink truncate">{r.get("domain", r.get("author", ""))}</div>'
        f'<div class="text-xs text-stone-600 mt-1">{len(r["orgs"])} orgs · {r.get("distinct_authors", "?")} contributors · {", ".join(r["orgs"][:6])}{"…" if len(r["orgs"]) > 6 else ""}</div>'
        f'</div>'
        for r in rows
    )
    return f"""
<section class="page page-break bg-paper text-ink" id="sec-cross-org" data-nav-label="Civil-service developer network">
  <div class="space-y-8">
    {kicker_line("The cross-organisation network")}
    <h3 class="font-display text-4xl max-w-3xl">Contributors who commit to repositories in multiple government bodies.</h3>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      {items}
    </div>
    <p class="text-xs text-stone-500 max-w-3xl">Contributors with commits in three or more distinct government organisations. Many are GDS or Cabinet Office staff seconded across departments; some are contractors visible across multiple engagements; a few are the OSS maintainers behind shared libraries (govuk-design-system, etc).</p>
  </div>
</section>
"""


def section_per_org_vendors(vms: dict) -> str:
    """Per-org vendor breakdown — which department leans on which vendor."""
    c = vms.get("14_contributors") or {}
    rows = c.get("per_org_vendor_top10", [])[:25]
    if not rows:
        return ""
    cards = "".join(
        f'<div class="border border-stone-300 p-4">'
        f'<div class="flex items-baseline justify-between mb-2">'
        f'<div class="font-mono text-sm font-semibold">{r["org"]}</div>'
        f'<div class="text-xs text-stone-500">{fmt_int(r["total_commits"])} commits</div>'
        f'</div>'
        f'<div class="text-xs text-stone-700 mb-2">Top: <span class="font-semibold">{r["top_vendor"]}</span> ({r["top_vendor_pct"]}%) · External: {r["external_pct"]}%</div>'
        + "".join(
            f'<div class="flex justify-between text-xs py-0.5"><span class="text-stone-700">{v["vendor"]}</span><span class="font-mono text-stone-500">{v["pct"]}%</span></div>'
            for v in r.get("vendor_breakdown", [])[:6]
        )
        + '</div>'
        for r in rows
    )
    return f"""
<section class="page page-break bg-paper text-ink" id="sec-per-org-vendors" data-nav-label="Per-org vendor exposure">
  <div class="space-y-8">
    {kicker_line("Vendor exposure by department")}
    <h3 class="font-display text-4xl max-w-3xl">Email-domain breakdown of every recent commit, per organisation.</h3>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {cards}
    </div>
    <p class="text-xs text-stone-500 max-w-3xl">"External %" excludes <span class="font-mono">.gov.uk</span> / NHS / Parliament / GitHub-anonymised addresses. Numbers reflect last-1000 commits per repo, summed across the org's active repositories.</p>
  </div>
</section>
"""


def section_per_org_hotspots(vms: dict) -> str:
    h = vms.get("15_hotspots") or {}
    rows = h.get("top_file_per_org_top25", [])[:25]
    if not rows:
        return ""
    body = "".join(
        f'<tr class="border-b border-stone-200">'
        f'<td class="py-2 pr-3 font-mono text-sm">{r["org"]}</td>'
        f'<td class="py-2 px-3 text-sm font-mono">{(r.get("path") or "—")[-50:]}</td>'
        f'<td class="py-2 px-3 text-sm font-mono text-right">{fmt_int(r.get("churn",0))}</td>'
        f'</tr>'
        for r in rows
    )
    return f"""
<section class="page page-break bg-paper text-ink" id="sec-per-org-hotspots" data-nav-label="Per-org hotspots">
  <div class="space-y-8">
    {kicker_line("What each department keeps changing")}
    <h3 class="font-display text-4xl max-w-3xl">The single most-modified non-infra file per organisation.</h3>
    <table class="w-full text-left">
      <thead>
        <tr class="border-b-2 border-ink">
          <th class="py-2 pr-3 text-xs uppercase tracking-wider text-stone-500">Organisation</th>
          <th class="py-2 px-3 text-xs uppercase tracking-wider text-stone-500">Most-changed file</th>
          <th class="py-2 px-3 text-xs uppercase tracking-wider text-stone-500 text-right">Changes</th>
        </tr>
      </thead>
      <tbody>{body}</tbody>
    </table>
  </div>
</section>
"""


def section_top_email_domains(vms: dict) -> str:
    c = vms.get("14_contributors") or {}
    rows = c.get("top_email_domains", [])[:25]
    if not rows:
        return ""
    return f"""
<section class="page page-break bg-paper text-ink" id="sec-email-domains" data-nav-label="Top email domains">
  <div class="space-y-8">
    {kicker_line("Top 25 email domains by commit volume")}
    <h3 class="font-display text-4xl max-w-3xl">Raw email-domain leaderboard.</h3>
    <div class="grid grid-cols-12 gap-6">
      <div class="col-span-12">
        <div id="chart-email-domains" class="chart h-[760px]"></div>
      </div>
    </div>
    <p class="text-xs text-stone-500 max-w-3xl">Unaggregated — every distinct email domain that appears across the corpus, ranked by commit count. The vendor mapping in the previous section collapses these into named entities; this is the raw shape of the data.</p>
  </div>
</section>
"""


def section_quadrant(vms: dict) -> str:
    """Activity vs discipline 2x2 quadrant — the editorial signature chart."""
    league = vms.get("08_league_table") or {}
    if not league.get("rows"):
        return ""
    return f"""
<section class="page page-break bg-paper text-ink" id="sec-quadrant" data-nav-label="Shipping vs sprinting">
  <div class="space-y-8">
    {kicker_line("Activity × Discipline")}
    <h3 class="font-display text-4xl max-w-3xl">Every organisation, plotted on freshness against engineering discipline.</h3>
    <div id="chart-quadrant" class="chart w-full h-[700px]"></div>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
      <div class="border-l-2 border-emerald-600 pl-3"><div class="text-xs uppercase tracking-wider text-stone-500">Top right</div><div class="font-display text-xl">Shipping</div><div class="text-xs text-stone-600">High activity, high discipline. The exemplars.</div></div>
      <div class="border-l-2 border-amber-600 pl-3"><div class="text-xs uppercase tracking-wider text-stone-500">Bottom right</div><div class="font-display text-xl">Sprinting</div><div class="text-xs text-stone-600">High activity, low discipline. Risk concentrated here.</div></div>
      <div class="border-l-2 border-sky-600 pl-3"><div class="text-xs uppercase tracking-wider text-stone-500">Top left</div><div class="font-display text-xl">Mature & quiet</div><div class="text-xs text-stone-600">Low activity, high discipline. Stable but stagnant.</div></div>
      <div class="border-l-2 border-rose-700 pl-3"><div class="text-xs uppercase tracking-wider text-stone-500">Bottom left</div><div class="font-display text-xl">Dark matter</div><div class="text-xs text-stone-600">Low activity, low discipline. The graveyard.</div></div>
    </div>
  </div>
</section>
"""


def section_active_no_ci(vms: dict) -> str:
    """Recently-active repos lacking CI — the actionable risk subset."""
    league = vms.get("08_league_table") or {}
    if not league.get("rows"):
        return ""
    # Compute on the fly: orgs with high freshness but low ci_score.
    rows = sorted(
        [r for r in league["rows"] if r.get("scale_active_count", 0) >= 5],
        key=lambda r: (r.get("freshness_pct_pushed_12mo", 0) - r.get("ci_score_pct", 0)),
        reverse=True,
    )[:25]
    body = "".join(
        f'<tr class="border-b border-stone-200">'
        f'<td class="py-2 pr-3 font-mono text-sm">{r["org"]}</td>'
        f'<td class="py-2 px-3 text-sm font-mono text-right">{r.get("scale_active_count", 0)}</td>'
        f'<td class="py-2 px-3 text-sm font-mono text-right text-emerald-700">{r.get("freshness_pct_pushed_12mo", 0)}%</td>'
        f'<td class="py-2 px-3 text-sm font-mono text-right text-rose-700">{r.get("ci_score_pct", 0)}%</td>'
        f'<td class="py-2 px-3 text-sm font-mono text-right">{round(r.get("freshness_pct_pushed_12mo", 0) - r.get("ci_score_pct", 0), 1)}</td>'
        f'</tr>'
        for r in rows
    )
    return f"""
<section class="page page-break bg-paper text-ink" id="sec-active-no-ci" data-nav-label="Active without CI">
  <div class="space-y-8">
    {kicker_line("Active without CI")}
    <h3 class="font-display text-4xl max-w-3xl">Organisations writing the most code with the least safety net.</h3>
    <table class="w-full text-left">
      <thead>
        <tr class="border-b-2 border-ink">
          <th class="py-2 pr-3 text-xs uppercase tracking-wider text-stone-500">Organisation</th>
          <th class="py-2 px-3 text-xs uppercase tracking-wider text-stone-500 text-right">Active repos</th>
          <th class="py-2 px-3 text-xs uppercase tracking-wider text-stone-500 text-right">Pushed in 12mo</th>
          <th class="py-2 px-3 text-xs uppercase tracking-wider text-stone-500 text-right">Has CI/CD</th>
          <th class="py-2 px-3 text-xs uppercase tracking-wider text-stone-500 text-right">Δ (gap)</th>
        </tr>
      </thead>
      <tbody>{body}</tbody>
    </table>
    <p class="text-xs text-stone-500 max-w-3xl">"Δ" is freshness minus CI coverage — high values flag organisations actively writing code without proportional automated-test safety nets. A 60-point gap means: most code is moving, but most of it has no CI.</p>
  </div>
</section>
"""


def section_full_league(vms: dict) -> str:
    """Full league-table — every org, every metric. Sortable feel via colour-coded bars."""
    league = vms.get("08_league_table") or {}
    if not league.get("rows"):
        return ""
    rows = league["rows"][:25]
    body = "".join(
        f'<tr class="border-b border-stone-200">'
        f'<td class="py-2 pr-3 font-mono text-sm">{r["org"]}</td>'
        f'<td class="py-2 px-3 text-sm font-mono text-right">{fmt_int(r.get("scale_repo_count", 0))}</td>'
        f'<td class="py-2 px-3 text-sm font-mono text-right">{fmt_int(r.get("scale_active_count", 0))}</td>'
        f'<td class="py-2 px-3 text-sm font-mono text-right">{r.get("freshness_pct_pushed_12mo", 0)}%</td>'
        f'<td class="py-2 px-3 text-sm font-mono text-right">{r.get("ci_score_pct", 0)}%</td>'
        f'<td class="py-2 px-3 text-sm font-mono text-right">{r.get("test_score_pct", 0)}%</td>'
        f'<td class="py-2 px-3 text-sm font-mono text-right">{r.get("oss_share_starred_pct", 0)}%</td>'
        f'<td class="py-2 px-3 text-sm font-mono text-right">{r.get("archive_ratio_pct", 0)}%</td>'
        f'<td class="py-2 px-3 text-sm font-mono text-right">{r.get("language_diversity", 0)}</td>'
        f'<td class="py-2 px-3 text-sm font-mono text-right">{r.get("cloud_breadth", 0)}</td>'
        f'</tr>'
        for r in rows
    )
    return f"""
<section class="page page-break bg-paper text-ink" id="sec-full-league" data-nav-label="Full league table">
  <div class="space-y-8">
    {kicker_line("The full league table")}
    <h3 class="font-display text-4xl max-w-3xl">Every top-25 organisation, every metric, side by side.</h3>
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr class="border-b-2 border-ink">
            <th class="py-2 pr-3 text-xs uppercase tracking-wider text-stone-500">Org</th>
            <th class="py-2 px-3 text-xs uppercase tracking-wider text-stone-500 text-right">Total</th>
            <th class="py-2 px-3 text-xs uppercase tracking-wider text-stone-500 text-right">Active</th>
            <th class="py-2 px-3 text-xs uppercase tracking-wider text-stone-500 text-right">Fresh</th>
            <th class="py-2 px-3 text-xs uppercase tracking-wider text-stone-500 text-right">CI</th>
            <th class="py-2 px-3 text-xs uppercase tracking-wider text-stone-500 text-right">Tests</th>
            <th class="py-2 px-3 text-xs uppercase tracking-wider text-stone-500 text-right">OSS</th>
            <th class="py-2 px-3 text-xs uppercase tracking-wider text-stone-500 text-right">Arch.</th>
            <th class="py-2 px-3 text-xs uppercase tracking-wider text-stone-500 text-right">Langs</th>
            <th class="py-2 px-3 text-xs uppercase tracking-wider text-stone-500 text-right">Clouds</th>
          </tr>
        </thead>
        <tbody>{body}</tbody>
      </table>
    </div>
  </div>
</section>
"""


def commit_window_badge() -> str:
    """A small visual marker that flags sections sourced from the
    last-1,000-commits-per-repo scan, distinct from GitHub-API
    metadata which has no such window."""
    return (
        '<span class="commit-window-badge" title="Computed from the last 1,000 commits per repository">'
        '<span class="commit-window-dot"></span>Last 1,000 commits / repo</span>'
    )


def section_time_crystal(vms: dict) -> str:
    if "12_velocity" not in vms:
        return ""
    return f"""
<section class="page page-break bg-paper text-ink" id="sec-time-crystal" data-nav-label="The Time Crystal">
  <div class="space-y-8">
    <div class="flex items-baseline gap-4 flex-wrap">
      {kicker_line("The Time Crystal")}
      {commit_window_badge()}
    </div>
    <h3 class="font-display text-4xl max-w-3xl">A 168-cell map of public-sector commit rhythm — every hour of every day of the week.</h3>
    <div id="chart-time-crystal" class="chart w-full h-[440px]"></div>
    <p class="text-xs text-stone-500 max-w-3xl">Every commit's author timestamp aggregated into a 7-day × 24-hour heatmap (UTC). Darker cells contain more commits. The shape reveals the cultural rhythm of public-sector software: working-hour bands, lunch dips, evening pushes, the weekend trough.</p>
  </div>
</section>
"""


def section_commit_culture(vms: dict) -> str:
    if "12_velocity" not in vms:
        return ""
    nlp = (vms["12_velocity"] or {}).get("commit_message_nlp") or {}
    if not nlp:
        return ""
    return f"""
<section class="page page-break bg-paper text-ink" id="sec-commit-culture" data-nav-label="Commit-message culture">
  <div class="space-y-8">
    <div class="flex items-baseline gap-4 flex-wrap">
      {kicker_line("Commit-message culture")}
      {commit_window_badge()}
    </div>
    <h3 class="font-display text-4xl max-w-3xl">{nlp.get('conventional_commits_pct', 0)}% of UK government commits follow the Conventional Commits spec. The rest? Free verse.</h3>
    <div class="grid grid-cols-12 gap-6">
      <div class="col-span-7">
        <div id="chart-cc-breakdown" class="chart h-[420px]"></div>
      </div>
      <aside class="col-span-5 space-y-4">
        {stat_card("Conventional commits", f"{nlp.get('conventional_commits_pct', 0)}%", f"{fmt_int(nlp.get('conventional_commits_count', 0))} of {fmt_int(nlp.get('messages_analysed', 0))} messages")}
        {stat_card("WIP / TODO / FIXME / HACK", f"{nlp.get('wip_or_todo_pct', 0)}%", f"{fmt_int(nlp.get('wip_or_todo_count', 0))} commits with hesitation in the message")}
        {stat_card("Recorded profanity", f"{fmt_int(nlp.get('profanity_count', 0))}", f"{nlp.get('profanity_pct', 0)}% — civil servants are remarkably restrained")}
      </aside>
    </div>
    <p class="text-xs text-stone-500 max-w-3xl">Conventional Commits (`feat:`, `fix:`, `chore:` prefixes) are a 2017 specification widely adopted in industry. Public-sector adoption is lower than the open-source baseline — partly because Dependabot/Renovate generate the bulk of `chore:`+`build:` commits, partly because most internal teams have not codified a commit format.</p>
  </div>
</section>
"""


def section_tribes(vms: dict) -> str:
    sim = vms.get("16_similarity")
    if not sim:
        return ""
    tribes = sim.get("tribes", [])[:25]
    pairs = sim.get("top_pairs_top25", [])[:10]
    outliers = sim.get("stack_outliers_top25", [])[:6]

    pair_rows = "".join(
        f'<li class="flex items-baseline justify-between border-b border-stone-200 py-1.5"><span class="font-mono text-sm">{p["a"]} <span class="text-stone-400">↔</span> {p["b"]}</span><span class="font-mono text-xs text-stone-500">{p["similarity"]:.0%}</span></li>'
        for p in pairs
    )
    out_rows = "".join(
        f'<li class="flex items-baseline justify-between border-b border-stone-200 py-1.5"><span class="font-mono text-sm">{r["org"]}</span><span class="font-mono text-xs text-stone-500">{r["max_similarity"]:.0%}</span></li>'
        for r in outliers
    )
    tribe_cards = "".join(
        f'<div class="border-l-2 border-accent pl-4 py-2"><div class="font-mono text-sm font-semibold">{t["label_org"]}</div><div class="text-xs text-stone-500 mt-1">{len(t["members"])} orgs · {", ".join(t["members"][:5])}{"…" if len(t["members"]) > 5 else ""}</div></div>'
        for t in tribes
    )
    return f"""
<section class="page page-break bg-paper text-ink" id="sec-tribes" data-nav-label="Stack tribes">
  <div class="space-y-8">
    {kicker_line("Stack similarity")}
    <h3 class="font-display text-4xl max-w-3xl">Organisations grouped by which tools they use, not who pays them.</h3>
    <div class="grid grid-cols-12 gap-6">
      <div class="col-span-7">
        <div id="chart-tribes-network" class="chart w-full h-[700px]"></div>
        <p class="text-xs text-stone-500 mt-3 max-w-2xl">Each node is a UK gov organisation. Edges connect orgs whose tooling vectors are similar above a threshold. Node positions emerge from a force-directed simulation — clusters reveal natural tribes (council shops, NHS data teams, science-data labs).</p>
      </div>
      <aside class="col-span-5 space-y-6">
        <div>
          <div class="text-xs uppercase tracking-wider text-stone-500 mb-2">Top similar pairs</div>
          <ul class="text-sm">{pair_rows}</ul>
        </div>
        <div>
          <div class="text-xs uppercase tracking-wider text-stone-500 mb-2">Stack outliers (least-similar to anyone)</div>
          <ul class="text-sm">{out_rows}</ul>
        </div>
      </aside>
    </div>
    <div class="pt-6 border-t border-stone-300">
      <h4 class="text-xs uppercase tracking-wider text-stone-500 mb-3">Tribes detected ({len(tribes)} clusters of ≥2 orgs)</h4>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">{tribe_cards}</div>
    </div>
  </div>
</section>
"""


def section_audience_takeaways(vms: dict) -> str:
    t = vms.get("17_takeaways")
    if not t:
        return ""
    def card(d):
        bullets = "".join(f'<li class="text-sm leading-relaxed text-stone-700 mb-3 list-disc ml-5">{b}</li>' for b in d["bullets"])
        return f"""
        <div class="bg-paper border border-stone-300 p-6">
          <div class="text-xs uppercase tracking-wider text-stone-500 mb-2">{d["audience"]}</div>
          <h4 class="font-display text-2xl mb-4 leading-tight">{d["lead"]}</h4>
          <ul>{bullets}</ul>
        </div>"""
    return f"""
<section class="page page-break bg-paper text-ink" id="sec-takeaways" data-nav-label="What this means for…">
  <div class="space-y-8">
    {kicker_line("What this means for you")}
    <h3 class="font-display text-4xl max-w-3xl">Four readers, four different reports.</h3>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      {card(t["permanent_secretary"])}
      {card(t["cdio_cto"])}
      {card(t["developer"])}
      {card(t["journalist"])}
    </div>
  </div>
</section>
"""


def section_ai_insights(vms: dict) -> str:
    a = vms.get("18_ai_insights")
    if not a:
        return ""
    cur = "".join(
        f'<div class="border-l-2 border-accent pl-5 py-3 mb-4"><div class="font-display text-2xl mb-1">{c["title"]}</div><div class="text-sm leading-relaxed text-stone-700 mb-2">{c["summary"]}</div><div class="text-xs text-stone-500"><span class="uppercase tracking-wider">Method:</span> {c["method"]}</div></div>'
        for c in a.get("current_capabilities", [])
    )
    road = "".join(
        f'<div class="border border-stone-300 p-5"><div class="font-display text-xl mb-2">{r["title"]}</div><div class="text-sm leading-relaxed text-stone-700 mb-3">{r["what_unlocks"]}</div><div class="text-xs text-stone-500 mb-1"><span class="uppercase tracking-wider">Needs:</span> {r["needs"]}</div><div class="text-xs text-stone-500"><span class="uppercase tracking-wider">Effort:</span> {r["feasibility"]}</div></div>'
        for r in a.get("roadmap_with_extra_data", [])
    )
    return f"""
<section class="page page-break bg-paper text-ink" id="sec-ai-current" data-nav-label="What AI sees today">
  <div class="space-y-8">
    {kicker_line("AI · Current capabilities")}
    <h3 class="font-display text-4xl max-w-3xl">What machine intelligence already extracts from this dataset — without an LLM call.</h3>
    <div class="space-y-2">{cur}</div>
    <p class="text-xs text-stone-500 max-w-3xl">All four insights here are computable today from existing viewmodels. No external services, no model inference — just statistics applied to the dataset already in this report.</p>
  </div>
</section>

<section class="page page-break bg-paper text-ink" id="sec-ai-roadmap" data-nav-label="What AI could unlock">
  <div class="space-y-8">
    {kicker_line("AI · Roadmap")}
    <h3 class="font-display text-4xl max-w-3xl">Seven AI-driven extensions that would transform what this report can say.</h3>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">{road}</div>
    <p class="text-xs text-stone-500 max-w-3xl">Each extension is scoped: what it would unlock for the report, what extra data or service it would need, and roughly how much effort. The cheapest are achievable in hours; the most ambitious (live AI Q&A on the report itself) is a v2 hero feature.</p>
  </div>
</section>
"""


def section_exit_cost(vms: dict) -> str:
    """Specific bus-factor stories — for top at-risk repos, narrate
    what it would cost the host org if the dominant author left."""
    b = vms.get("13_bus_factor")
    if not b:
        return ""
    high = (b.get("high_risk_repos_top25") or [])[:8]
    if not high:
        return ""
    cards = "".join(
        f'<div class="border border-stone-300 p-5 break-words"><div class="font-mono text-sm font-semibold mb-2 break-words">{r["slug"]}</div>'
        f'<div class="text-xs text-stone-500 mb-2">Top author from <span class="font-mono">{r.get("top_author_domain", r.get("top_author",""))}</span></div>'
        f'<div class="font-display text-3xl text-accent">{r.get("top_pct",0)}%</div>'
        f'<div class="text-xs text-stone-500 mt-1">of last {fmt_int(r.get("commits_in_window",0))} commits.</div>'
        f'<div class="text-sm text-stone-700 mt-3 leading-relaxed">If this contributor leaves, the next contributor inherits a codebase where they have written less than {round(100 - (r.get("top_pct",0) or 0), 1)}% of recent history.</div></div>'
        for r in high
    )
    return f"""
<section class="page page-break bg-paper text-ink" id="sec-exit-cost" data-nav-label="Exit cost · top 8">
  <div class="space-y-8">
    <div class="flex items-baseline gap-4 flex-wrap">
      {kicker_line("Exit-cost narratives")}
      {commit_window_badge()}
    </div>
    <h3 class="font-display text-4xl max-w-3xl">If these eight contributors took new jobs tomorrow, what walks out of the door?</h3>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">{cards}</div>
    <p class="text-xs text-stone-500 max-w-3xl">"Top-author share" is the percentage of last-1000-commits attributable to the named contributor. The framing here is illustrative: an org with 70%+ concentration in one named individual is one-resignation away from a continuity gap that the report's data cannot disguise.</p>
  </div>
</section>
"""


def section_scm(vms: dict) -> str:
    """Where the code is hosted — SCM platform distribution."""
    s = vms.get("23_scm")
    if not s:
        return ""
    t = s.get("totals", {})
    plat = s.get("platform_distribution", [])
    diversity = s.get("diversity_buckets", [])
    multi = s.get("multi_platform_orgs", [])
    finding = s.get("finding", "")

    plat_rows = "".join(
        f'<tr class="border-b border-stone-200">'
        f'<td class="py-2 pr-3 font-mono text-sm font-semibold">{r["platform"].title()}</td>'
        f'<td class="py-2 px-3 text-sm font-mono text-right">{fmt_int(r["repos"])}</td>'
        f'<td class="py-2 px-3 text-sm font-mono text-right">{fmt_int(r["active_repos"])}</td>'
        f'<td class="py-2 px-3 text-sm font-mono text-right">{r["pct_of_corpus"]}%</td>'
        f'<td class="py-2 px-3 text-sm font-mono text-right">{r["total_size_gb"]} GB</td>'
        f'</tr>'
        for r in plat
    )
    diversity_rows = "".join(
        f'<tr class="border-b border-stone-200">'
        f'<td class="py-2 pr-3 text-sm">Use {r["platforms_used"]} platform{"s" if r["platforms_used"]!=1 else ""}</td>'
        f'<td class="py-2 px-3 text-sm font-mono text-right">{fmt_int(r["orgs"])}</td>'
        f'</tr>'
        for r in diversity
    )
    multi_html = ""
    if multi:
        rows = "".join(
            f'<tr class="border-b border-stone-200">'
            f'<td class="py-2 pr-3 font-mono text-sm">{r["org"]}</td>'
            f'<td class="py-2 px-3 text-sm">{", ".join(r["platforms_used"])}</td>'
            f'<td class="py-2 px-3 text-sm font-mono text-right">{fmt_int(r["total_repos"])}</td>'
            f'</tr>'
            for r in multi[:25]
        )
        multi_html = f"""
    <div class="pt-6 border-t border-stone-300">
      <h4 class="text-xs uppercase tracking-wider text-stone-500 mb-3">Multi-platform organisations (top 25)</h4>
      <table class="w-full text-left">
        <thead><tr class="border-b-2 border-ink"><th class="py-2 pr-3 text-xs uppercase tracking-wider text-stone-500">Organisation</th><th class="py-2 px-3 text-xs uppercase tracking-wider text-stone-500">Platforms</th><th class="py-2 px-3 text-xs uppercase tracking-wider text-stone-500 text-right">Repos</th></tr></thead>
        <tbody>{rows}</tbody>
      </table>
    </div>"""

    return f"""
<section class="page page-break bg-paper text-ink" id="sec-scm" data-nav-label="Where the code is hosted">
  <div class="space-y-8">
    {kicker_line("Source-code hosting")}
    <h3 class="font-display text-4xl max-w-3xl">{finding}</h3>
    <div class="grid grid-cols-12 gap-6">
      <div class="col-span-7">
        <h4 class="text-xs uppercase tracking-wider text-stone-500 mb-3">Repositories per platform</h4>
        <table class="w-full text-left">
          <thead><tr class="border-b-2 border-ink">
            <th class="py-2 pr-3 text-xs uppercase tracking-wider text-stone-500">Platform</th>
            <th class="py-2 px-3 text-xs uppercase tracking-wider text-stone-500 text-right">Total</th>
            <th class="py-2 px-3 text-xs uppercase tracking-wider text-stone-500 text-right">Active</th>
            <th class="py-2 px-3 text-xs uppercase tracking-wider text-stone-500 text-right">Share</th>
            <th class="py-2 px-3 text-xs uppercase tracking-wider text-stone-500 text-right">Size</th>
          </tr></thead>
          <tbody>{plat_rows}</tbody>
        </table>
      </div>
      <aside class="col-span-5">
        <h4 class="text-xs uppercase tracking-wider text-stone-500 mb-3">Platforms per organisation</h4>
        <table class="w-full text-left">
          <thead><tr class="border-b-2 border-ink"><th class="py-2 pr-3 text-xs uppercase tracking-wider text-stone-500">Coverage</th><th class="py-2 px-3 text-xs uppercase tracking-wider text-stone-500 text-right">Orgs</th></tr></thead>
          <tbody>{diversity_rows}</tbody>
        </table>
        <div class="mt-6 text-xs leading-relaxed text-stone-600 max-w-md">
          <p class="mb-2"><strong>What we checked.</strong> For every organisation in the target list, we attempted enumeration on GitHub, GitLab.com, and Bitbucket Cloud. Azure DevOps is excluded because Microsoft is deprecating public projects; AWS CodeCommit because it requires authenticated access.</p>
          <p>Cloning works against any URL the enumerator emits — git handles GitHub, GitLab, and Bitbucket HTTPS URLs identically.</p>
        </div>
      </aside>
    </div>
    {multi_html}
  </div>
</section>
"""


def section_report_card(vms: dict) -> str:
    """Report-card section — A-F grade distribution + per-org rollup +
    category exemplars. Sourced from the new unified scan output."""
    rc = vms.get("22_report_card")
    if not rc:
        return ""
    t = rc.get("totals", {})
    overall = rc.get("overall_grade_distribution", [])
    cat_dist = rc.get("category_grade_distribution", {})
    cat_means = rc.get("category_means", {})
    org_top = rc.get("per_org_top25_by_score", [])[:25]
    org_bottom = rc.get("per_org_bottom25_by_score", [])[:25]

    cat_means_html = "".join(
        f'<div class="border-l-2 border-stone-300 pl-3"><div class="text-xs uppercase tracking-wider text-stone-500">{cat.replace("_", " ").title()}</div><div class="font-mono text-2xl font-bold">{score}<span class="text-sm font-normal text-stone-500"> / 100</span></div></div>'
        for cat, score in cat_means.items()
    )
    top_rows = "".join(
        f'<tr class="border-b border-stone-200">'
        f'<td class="py-1.5 pr-3 font-mono text-sm">{r["org"]}</td>'
        f'<td class="py-1.5 px-3 text-sm font-mono text-right">{r["repos_scored"]}</td>'
        f'<td class="py-1.5 px-3 text-sm font-mono text-right text-emerald-700">{r["mean_overall"]}</td>'
        f'</tr>'
        for r in org_top[:15]
    )
    bottom_rows = "".join(
        f'<tr class="border-b border-stone-200">'
        f'<td class="py-1.5 pr-3 font-mono text-sm">{r["org"]}</td>'
        f'<td class="py-1.5 px-3 text-sm font-mono text-right">{r["repos_scored"]}</td>'
        f'<td class="py-1.5 px-3 text-sm font-mono text-right text-rose-700">{r["mean_overall"]}</td>'
        f'</tr>'
        for r in org_bottom[:15]
    )
    return f"""
<section class="page page-break bg-paper text-ink" id="sec-report-card" data-nav-label="Report card">
  <div class="space-y-8">
    {kicker_line("Report card · A–F grades")}
    <h3 class="font-display text-4xl max-w-3xl">Every repository scored across five categories. {fmt_int(t.get("repos_scored", 0))} repositories graded.</h3>
    <div class="grid grid-cols-12 gap-6">
      <div class="col-span-7">
        <div id="chart-rc-overall" class="chart h-[360px]"></div>
      </div>
      <aside class="col-span-5 grid grid-cols-1 gap-3">
        {cat_means_html}
      </aside>
    </div>
    <div>
      <div id="chart-rc-categories" class="chart h-[360px]"></div>
    </div>
    <div class="grid grid-cols-2 gap-12 pt-6 border-t border-stone-300">
      <div>
        <h4 class="text-xs uppercase tracking-wider text-stone-500 mb-2">Top 15 organisations by mean score</h4>
        <table class="w-full text-left">
          <thead><tr class="border-b-2 border-ink"><th class="py-2 pr-3 text-xs uppercase tracking-wider text-stone-500">Org</th><th class="py-2 px-3 text-xs uppercase tracking-wider text-stone-500 text-right">Scored</th><th class="py-2 px-3 text-xs uppercase tracking-wider text-stone-500 text-right">Mean</th></tr></thead>
          <tbody>{top_rows}</tbody>
        </table>
      </div>
      <div>
        <h4 class="text-xs uppercase tracking-wider text-stone-500 mb-2">Bottom 15 organisations</h4>
        <table class="w-full text-left">
          <thead><tr class="border-b-2 border-ink"><th class="py-2 pr-3 text-xs uppercase tracking-wider text-stone-500">Org</th><th class="py-2 px-3 text-xs uppercase tracking-wider text-stone-500 text-right">Scored</th><th class="py-2 px-3 text-xs uppercase tracking-wider text-stone-500 text-right">Mean</th></tr></thead>
          <tbody>{bottom_rows}</tbody>
        </table>
      </div>
    </div>
    <p class="text-xs text-stone-500 max-w-3xl">Five categories — Engineering (CI + tests + Dependabot + lockfile), Documentation (README + docs/ + changelog + contributing + security), Supply chain (license + Dependabot + CODEOWNERS + lockfile), Modernity (frameworks + databases + cloud + AI tooling), Testing culture (CI + tests). Each scored 0–100 from filesystem signals; A ≥ 90, B ≥ 75, C ≥ 60, D ≥ 40, F otherwise. Computed by the new <span class="font-mono">repoanalyze report-card</span> CLI subcommand on every repo at clone time.</p>
  </div>
</section>
"""


def section_departments(vms: dict) -> str:
    """List of every organisation included in the report."""
    shape = vms.get("01_shape") or {}
    rows = shape.get("top_orgs_by_repo_count", [])
    if not rows:
        return ""
    # All orgs, sorted alphabetically.
    all_rows = sorted(rows, key=lambda r: r["org"].lower())
    cells = "".join(
        f'<a href="https://github.com/{r["org"]}" target="_blank" rel="noreferrer" '
        f'class="block border border-stone-300 p-3 hover:bg-stone-100/40 transition-colors">'
        f'<div class="font-mono text-sm text-ink truncate">{r["org"]}</div>'
        f'<div class="text-xs text-stone-500 mt-0.5">{fmt_int(r["repo_count"])} repos · {r.get("active_count", 0)} active</div>'
        f'</a>'
        for r in all_rows
    )
    return f"""
<section class="page page-break bg-paper text-ink" id="sec-departments" data-nav-label="Departments included">
  <div class="space-y-8">
    {kicker_line("Organisations in this report")}
    <h3 class="font-display text-4xl max-w-3xl">Every government body whose public code feeds into the analysis.</h3>
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
      {cells}
    </div>
    <p class="text-xs text-stone-500 max-w-3xl">Source list derived from <span class="font-mono">government.github.com/community/</span>, UK section. Includes central departments, agencies, arms-length bodies, devolved administrations, and local councils. Click any tile to open the organisation on GitHub.</p>
  </div>
</section>
"""


def section_ai_adoption(vms: dict) -> str:
    """Real AI Adoption section — looks for AI assistants by name in
    commit messages and (when available) in repo file tooling."""
    a = vms.get("19_ai_adoption")
    if not a:
        return ""
    t = a["totals"]
    ba = a.get("by_assistant", [])

    bars = "".join(
        f'<div class="mb-3"><div class="flex justify-between text-xs mb-1"><span class="font-mono font-semibold">{r["name"]}</span><span class="font-mono text-stone-500">{fmt_int(r["mentions"])}</span></div>'
        f'<div class="h-2 bg-stone-200 rounded"><div class="h-2 bg-accent rounded" style="width:{min(100, 100 * r["mentions"] / max(ba[0]["mentions"], 1))}%"></div></div>'
        f'<div class="text-xs text-stone-500 mt-1">First mention: {r.get("first_seen_month") or "—"}</div></div>'
        for r in ba[:10]
    )
    per_org = a.get("per_org_top25", [])[:25]
    def fmt_assistants(rl):
        bits = []
        for x in (rl or [])[:3]:
            bits.append(f'{x["name"]}({x["count"]})')
        return ", ".join(bits)

    org_rows = "".join(
        f'<tr class="border-b border-stone-200">'
        f'<td class="py-1.5 pr-3 font-mono text-sm">{r["org"]}</td>'
        f'<td class="py-1.5 px-3 text-sm font-mono text-right">{fmt_int(r["ai_mentions"])}</td>'
        f'<td class="py-1.5 px-3 text-sm font-mono text-right">{fmt_int(r["repos_with_ai_mention"])}</td>'
        f'<td class="py-1.5 px-3 text-sm text-stone-600">{fmt_assistants(r.get("by_assistant"))}</td>'
        f'</tr>'
        for r in per_org
    )
    return f"""
<section class="page page-break bg-paper text-ink" id="sec-ai-adoption" data-nav-label="AI assistant adoption">
  <div class="space-y-8">
    <div class="flex items-baseline gap-4 flex-wrap">
      {kicker_line("AI assistant adoption — commit messages")}
      {commit_window_badge()}
    </div>
    <h3 class="font-display text-4xl max-w-3xl">{fmt_int(t["messages_with_ai_mention"])} commit messages mention an AI assistant by name. {fmt_int(t["repos_with_any_ai_mention"])} repositories have at least one such reference.</h3>
    <div class="grid grid-cols-12 gap-8">
      <div class="col-span-7">
        <h4 class="text-xs uppercase tracking-wider text-stone-500 mb-4">By assistant</h4>
        {bars}
      </div>
      <aside class="col-span-5 space-y-4">
        {stat_card("Total AI mentions", fmt_int(t["messages_with_ai_mention"]), f"of {fmt_int(t['messages_analysed'])} messages = {t['ai_mention_rate_pct']}%")}
        {stat_card("Co-Authored-By: AI", fmt_int(t["messages_with_coauthor_ai_trailer"]), "trailers naming an AI as co-author")}
        {stat_card("Repos with any AI mention", fmt_int(t["repos_with_any_ai_mention"]), "across the corpus")}
      </aside>
    </div>
    <div>
      <h4 class="text-xs uppercase tracking-wider text-stone-500 mb-3">Top 25 organisations by AI commit-message mentions</h4>
      <table class="w-full text-left">
        <thead><tr class="border-b-2 border-ink">
          <th class="py-2 pr-3 text-xs uppercase tracking-wider text-stone-500">Organisation</th>
          <th class="py-2 px-3 text-xs uppercase tracking-wider text-stone-500 text-right">Total mentions</th>
          <th class="py-2 px-3 text-xs uppercase tracking-wider text-stone-500 text-right">Repos</th>
          <th class="py-2 px-3 text-xs uppercase tracking-wider text-stone-500">Top assistants</th>
        </tr></thead>
        <tbody>{org_rows}</tbody>
      </table>
    </div>
    <p class="text-xs text-stone-500 max-w-3xl">Pattern-match across the last-1000-commits window: searches commit subjects for named AI assistants (Claude / Copilot / ChatGPT / Cursor / Aider / Cline / Windsurf / Codeium / Tabnine) and Conventional <span class="font-mono">Co-Authored-By:</span> trailers naming an AI. The numbers undercount real usage — many AI-assisted commits don't mention the tool — but the rates are a directional adoption signal.</p>
  </div>
</section>
"""


def section_ai_filescan(vms: dict) -> str:
    """File-system AI tooling configurations across the corpus."""
    fs = vms.get("19a_ai_filescan")
    if not fs:
        return ""
    by_pattern = fs.get("by_pattern", [])
    if not any(p["total_repos"] for p in by_pattern):
        return f"""
<section class="page page-break bg-paper text-ink" id="sec-ai-filescan" data-nav-label="AI tooling configs">
  <div class="space-y-8">
    {kicker_line("AI tooling configuration files")}
    <h3 class="font-display text-4xl max-w-3xl">Zero. Across {fs.get("orgs_scanned", 0)} organisations, no public-sector repository checked into the canonical UK gov set ships with a Claude / Cursor / Copilot / Aider configuration file.</h3>
    <p class="text-sm text-stone-700 max-w-3xl">This is itself a finding: the agentic-coding wave hasn't yet left a fingerprint in committed UK government code. Either the tooling is being used and the configs aren't being committed, or — more likely — adoption simply hasn't begun in earnest at the public-sector level.</p>
    <p class="text-xs text-stone-500 max-w-3xl">Patterns scanned via GitHub code-search across all {fs.get("orgs_scanned", 0)} target organisations: <span class="font-mono">CLAUDE.md</span>, <span class="font-mono">AGENTS.md</span>, <span class="font-mono">.claude/agents/</span>, <span class="font-mono">.claude/skills/</span>, <span class="font-mono">.cursorrules</span>, <span class="font-mono">.cursor/rules</span>, <span class="font-mono">copilot-instructions.md</span>, <span class="font-mono">.aider.conf.yml</span>, <span class="font-mono">.windsurfrules</span>, <span class="font-mono">.clinerules</span>, <span class="font-mono">.continue/config.json</span>.</p>
  </div>
</section>
"""
    rows = "".join(
        f'<tr class="border-b border-stone-200">'
        f'<td class="py-2 pr-3 font-mono text-sm">{p["pattern"]}</td>'
        f'<td class="py-2 px-3 text-sm font-mono text-right">{p["total_repos"]}</td>'
        f'<td class="py-2 px-3 text-sm font-mono text-right">{p["total_orgs"]}</td>'
        f'<td class="py-2 px-3 text-sm">{", ".join(p.get("orgs_top10", [])[:10])}</td>'
        f'</tr>'
        for p in sorted(by_pattern, key=lambda r: -r["total_repos"])
    )
    return f"""
<section class="page page-break bg-paper text-ink" id="sec-ai-filescan" data-nav-label="AI tooling configs">
  <div class="space-y-8">
    {kicker_line("AI tooling configuration files")}
    <h3 class="font-display text-4xl max-w-3xl">Where AI-coding tooling has actually been committed into the source tree.</h3>
    <table class="w-full text-left">
      <thead><tr class="border-b-2 border-ink">
        <th class="py-2 pr-3 text-xs uppercase tracking-wider text-stone-500">Pattern</th>
        <th class="py-2 px-3 text-xs uppercase tracking-wider text-stone-500 text-right">Repos</th>
        <th class="py-2 px-3 text-xs uppercase tracking-wider text-stone-500 text-right">Orgs</th>
        <th class="py-2 px-3 text-xs uppercase tracking-wider text-stone-500">Sample orgs</th>
      </tr></thead>
      <tbody>{rows}</tbody>
    </table>
  </div>
</section>
"""


def section_message_quality(vms: dict) -> str:
    q = vms.get("20_message_quality")
    if not q:
        return ""
    t = q["totals"]
    quant = q["length_quantiles"]
    dupes = q.get("top_duplicates_top50", [])[:25]
    dupe_rows = "".join(
        f'<tr class="border-b border-stone-200">'
        f'<td class="py-1.5 pr-3 font-mono text-sm break-all">"{r["subject"][:80]}"</td>'
        f'<td class="py-1.5 px-3 text-sm font-mono text-right">{fmt_int(r["count"])}</td>'
        f'</tr>'
        for r in dupes
    )
    short_hint = f'{fmt_int(t["bad_short_count"])} commits — "fix", "wip", "tmp"'
    long_hint = f'{fmt_int(t["bad_long_count"])} commits — rambling, multi-sentence'
    return f"""
<section class="page page-break bg-paper text-ink" id="sec-msg-quality" data-nav-label="Commit-message quality">
  <div class="space-y-8">
    <div class="flex items-baseline gap-4 flex-wrap">
      {kicker_line("Commit-message length & duplication")}
      {commit_window_badge()}
    </div>
    <h3 class="font-display text-4xl max-w-3xl">{t['good_band_pct']}% of commit subjects sit in the &quot;good&quot; band of 25–72 characters. Industry guidance, surprisingly closely followed.</h3>
    <div class="grid grid-cols-12 gap-6">
      <div class="col-span-8">
        <div id="chart-msg-length" class="chart h-[420px]"></div>
      </div>
      <aside class="col-span-4 space-y-4">
        {stat_card("Median length", f"{quant['median']} chars", f"p25={quant['p25']} · p75={quant['p75']} · p99={quant['p99']}")}
        {stat_card("Bad short (&lt;10 char)", f"{t['bad_short_pct']}%", short_hint)}
        {stat_card("Bad long (&gt;100 char)", f"{t['bad_long_pct']}%", long_hint)}
        {stat_card("Duplication ratio", f"{t['duplication_ratio_pct']}%", f"{fmt_int(t['unique_subjects'])} unique of {fmt_int(t['messages_analysed'])} total")}
      </aside>
    </div>
    <div class="pt-4 border-t border-stone-300">
      <h4 class="text-xs uppercase tracking-wider text-stone-500 mb-3">Most-duplicated commit subjects (top 25, ≥100 occurrences)</h4>
      <table class="w-full text-left">
        <thead><tr class="border-b-2 border-ink">
          <th class="py-2 pr-3 text-xs uppercase tracking-wider text-stone-500">Subject</th>
          <th class="py-2 px-3 text-xs uppercase tracking-wider text-stone-500 text-right">Occurrences</th>
        </tr></thead>
        <tbody>{dupe_rows}</tbody>
      </table>
      <p class="text-xs text-stone-500 mt-3 max-w-3xl">"Initial commit" tops the list because that's git's default subject when initialising a new repository. "Add files via upload" appears when contributors use the GitHub web UI rather than git. The shape of this list is a portrait of the platform's defaults more than of a writing style.</p>
    </div>
  </div>
</section>
"""


def section_time_by_domain(vms: dict) -> str:
    t = vms.get("21_time_by_domain")
    if not t:
        return ""
    return f"""
<section class="page page-break bg-paper text-ink" id="sec-time-by-domain" data-nav-label="Hour × email domain">
  <div class="space-y-8">
    <div class="flex items-baseline gap-4 flex-wrap">
      {kicker_line("Commit hour × contributor type")}
      {commit_window_badge()}
    </div>
    <h3 class="font-display text-4xl max-w-3xl">Who commits when, by email domain class.</h3>
    <div id="chart-time-by-domain" class="chart w-full h-[460px]"></div>
    <p class="text-xs text-stone-500 max-w-3xl">Each hour's bar shows commits broken down by email-domain class: government internal, NHS, Parliament, GitHub-anonymised contributors, personal-mail addresses, and "Other" (almost entirely vendor / contractor private domains). The shape reveals whether the .gov.uk pattern aligns with or differs from the contractor pattern across the working day.</p>
  </div>
</section>
"""


def section_file_churn_rate(vms: dict) -> str:
    h = vms.get("15_hotspots") or {}
    rate = h.get("top_files_by_rate_top25", [])[:25]
    if not rate:
        return ""
    return f"""
<section class="page page-break bg-paper text-ink" id="sec-churn-rate" data-nav-label="File churn rate">
  <div class="space-y-8">
    <div class="flex items-baseline gap-4 flex-wrap">
      {kicker_line("Churn rate per file")}
      {commit_window_badge()}
    </div>
    <h3 class="font-display text-4xl max-w-3xl">High-churn files normalised by the active lifetime of the repos that hold them.</h3>
    <div id="chart-churn-rate" class="chart w-full h-[760px]"></div>
    <p class="text-xs text-stone-500 max-w-3xl">"Rate per day" is total changes divided by the sum of (latest – earliest commit date) days across all repos that contain the file. It separates "this file is hot because the repo's huge" from "this file is genuinely turbulent". Files in fewer than 2 repos are excluded to avoid one-off outliers.</p>
  </div>
</section>
"""


def kicker_line(text: str) -> str:
    return f'<div class="text-xs tracking-[0.3em] uppercase text-stone-500">{text}</div>'


def stat_card(label: str, value: str, hint: str = "") -> str:
    return f"""
    <div class="border-l-2 border-stone-300 pl-4">
      <div class="text-xs uppercase tracking-wider text-stone-500 mb-1">{label}</div>
      <div class="font-mono text-xl font-semibold text-ink leading-tight">{value}</div>
      <div class="text-xs text-stone-500 mt-1">{hint}</div>
    </div>"""


# ───────────────────────── outer template ─────────────────────────


def render_html(vms: dict, target: dict) -> str:
    blobs = "\n  ".join(vm_blob(name, data) for name, data in vms.items())
    body_sections = [
        cover(vms, target),
        foreword(vms, target),
        methodology(vms),
        section_opener("I", "The Shape of the Corpus", "Where the code lives — by org, by size, by age."),
        section_shape(vms),
        section_opener("II", "The Languages", "What's used, by whom, and at what scale."),
        section_languages(vms),
        section_opener("III", "Frameworks & Stacks", "The procurement gravity wells."),
        section_frameworks(vms),
        section_opener("IV", "The Cloud Diaspora", "Three providers, very unequal shares."),
        section_cloud(vms),
        section_opener("V", "Engineering Discipline", "CI, tests, and the dark matter that has neither."),
        section_engineering(vms),
        section_opener("VI", "The Data Layer", "What the persistence layer actually runs on."),
        section_data(vms),
        section_opener("VII", "Open-Source Health", "Stars, zombies, and the quiet majority."),
        section_oss(vms),
        section_report_card(vms),
        section_scm(vms),
        section_opener("VIII", "The League Table", "Every organisation, scored eight ways."),
        section_league(vms),
        section_full_league(vms),
        section_opener("IX", "Composite Indices", "Multi-axis ranking. Different leaders on each."),
        section_indices(vms),
        section_departments(vms),
        section_opener("X", "Velocity & Cadence", "When public-sector code is actually written."),
        section_velocity(vms),
        section_time_crystal(vms),
        section_time_by_domain(vms),
        section_commit_culture(vms),
        section_message_quality(vms),
        section_opener("XI", "Bus Factor", "Concentration risk in the maintainer pool."),
        section_bus_factor(vms),
        section_at_risk_repos(vms),
        section_exit_cost(vms),
        section_opener("XII", "The Contributor Graph", "Who actually writes this code."),
        section_contributors(vms),
        section_per_org_vendors(vms),
        section_top_email_domains(vms),
        section_cross_org_contributors(vms),
        section_opener("XIII", "Hotspots", "The files everyone keeps changing."),
        section_hotspots(vms),
        section_file_churn_rate(vms),
        section_per_org_hotspots(vms),
        section_opener("XIV", "Department Stacks", "The signature stack of every organisation."),
        section_per_org_leaders(vms),
        section_opener("XV", "IaC & Containers", "How the deployment surface is actually described."),
        section_iac_containers(vms),
        section_opener("XVI", "Where Code Goes To Die", "The graveyard maps."),
        section_zombie_orgs(vms),
        section_opener("XVII", "Activity × Discipline", "The 2×2 quadrant — who's shipping, who's sprinting, who's stagnant."),
        section_quadrant(vms),
        section_active_no_ci(vms),
        section_opener("XVIII", "Stack Tribes", "Organisations clustered by what they actually use."),
        section_tribes(vms),
        section_opener("XIX", "Anomalies", "The repositories worth knowing by name."),
        section_anomalies(vms),
        section_opener("XX", "AI Adoption", "Are public-sector developers using AI assistants? The evidence in the commit log."),
        section_ai_adoption(vms),
        section_ai_filescan(vms),
        section_ai_insights(vms),
        section_opener("XXI", "Headlines", "Pull-quotes from the data."),
        section_headlines(vms),
        section_opener("XXII", "What This Means For You", "Four readers, four different reports."),
        section_audience_takeaways(vms),
        outro(vms, target),
    ]
    body = "\n".join(body_sections)
    title = target.get("title", "State of Code")

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/d3@7.8.5/dist/d3.min.js"></script>
  <script>
    tailwind.config = {{
      theme: {{
        extend: {{
          colors: {{
            paper: '#fbf9f5',
            ink: '#1a1a1a',
            accent: '#a51c30',
          }},
          fontFamily: {{
            sans: ['Inter', 'ui-sans-serif', 'system-ui'],
            display: ['Playfair Display', 'serif'],
            mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
          }},
          fontSize: {{
            display: ['clamp(3.5rem, 9vw, 8rem)', '1'],
            stat: ['clamp(2.5rem, 5vw, 4.5rem)', '1'],
          }},
        }},
      }},
    }};
  </script>
  <style>
    html {{ background: #1a1a1a; }}
    body {{ font-family: 'Inter', system-ui, sans-serif; color: #1a1a1a; }}
    .page {{
      width: 100%;
      max-width: 1100px;
      margin: 0 auto 2rem auto;
      min-height: 100vh;
      padding: 4rem 3rem;
      box-sizing: border-box;
    }}
    @media (max-width: 768px) {{
      .page {{ padding: 2.5rem 1.5rem; }}
    }}
    .chart {{ width: 100%; }}
    /* Print: A4 portrait, page-fill sections, restrained colour. */
    @page {{ size: A4 portrait; margin: 16mm 14mm; }}
    @media print {{
      html, body {{ background: #fbf9f5 !important; }}
      main {{ padding-left: 0 !important; }}
      .page {{
        max-width: none;
        margin: 0;
        padding: 0;
        min-height: auto;
        page-break-inside: avoid;
        break-inside: avoid;
      }}
      .page-break {{ break-before: page; page-break-before: always; }}
      .section-opener, .cover, .outro {{
        min-height: 100vh;
        page-break-after: always;
        break-after: page;
      }}
      .no-print {{ display: none !important; }}
      * {{ -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }}
    }}
    .section-opener, .cover {{ min-height: 100vh; padding: 4rem 3rem; }}

    /* ────────── Side navigator (flush rail, grouped) ────────── */
    #scroll-progress {{
      position: fixed; top: 0; left: 0; height: 2px;
      width: 0%; background: #a51c30; z-index: 60;
      transition: width 80ms linear;
    }}
    /* The rail is anchored to the viewport's left edge — no card
     * chrome, no internal scroll, no drop shadow. Just a quiet column
     * of links with a thin accent line on the left. */
    #side-nav {{
      position: fixed; top: 0; left: 0;
      height: 100vh; width: 240px;
      z-index: 50;
      display: flex; flex-direction: column;
      justify-content: center;
      padding: 1.25rem 0 1.25rem 1.5rem;
      pointer-events: none;
    }}
    #side-nav .nav-list {{
      pointer-events: auto;
      display: flex; flex-direction: column;
      border-left: 1px solid rgba(0, 0, 0, 0.08);
    }}
    #side-nav .nav-link {{
      display: flex; align-items: center; gap: 0.55rem;
      padding: 3px 10px 3px 12px;
      color: rgba(26, 26, 26, 0.42);
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 10.5px;
      letter-spacing: 0.01em;
      line-height: 1.35;
      text-decoration: none;
      cursor: pointer;
      position: relative;
      transition: color 180ms ease;
    }}
    /* The active marker rides the rail's left border — a short
     * accent line that grows out of the seam. */
    #side-nav .nav-link::before {{
      content: ''; position: absolute;
      left: -1px; top: 50%; transform: translateY(-50%);
      width: 2px; height: 0;
      background: #a51c30;
      transition: height 220ms cubic-bezier(0.4, 0, 0.2, 1);
    }}
    #side-nav .nav-link:hover {{ color: rgba(26, 26, 26, 0.72); }}
    #side-nav .nav-link.active {{
      color: #1a1a1a;
      font-weight: 600;
    }}
    #side-nav .nav-link.active::before {{ height: 100%; }}
    #side-nav .nav-num {{
      font-family: 'JetBrains Mono', monospace;
      font-size: 9.5px;
      color: rgba(26, 26, 26, 0.28);
      width: 28px; flex-shrink: 0;
    }}
    #side-nav .nav-link.active .nav-num {{ color: #a51c30; }}
    #side-nav .nav-label {{
      flex: 1; min-width: 0;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }}
    /* Section-opener entries get a touch more presence so the report
     * spine reads cleanly even amid the sub-sections. */
    #side-nav .nav-link.is-part {{
      color: rgba(26, 26, 26, 0.7);
      font-weight: 600;
      letter-spacing: 0.04em;
      padding-top: 6px;
      padding-bottom: 4px;
    }}
    #side-nav .nav-link.is-part .nav-num {{ color: rgba(26, 26, 26, 0.55); }}

    /* Children of a Part — collapsed by default, expanded when the
     * group is .open. Smooth transition + indent so they read as
     * sub-sections of their part. */
    #side-nav .nav-children {{
      max-height: 0;
      overflow: hidden;
      transition: max-height 280ms cubic-bezier(0.4, 0, 0.2, 1);
    }}
    #side-nav .nav-group.open > .nav-children {{
      max-height: 320px;  /* generous; tallest part has ~6 sub-items */
    }}
    #side-nav .nav-link.is-child {{
      padding-left: 36px;
      font-size: 10px;
      color: rgba(26, 26, 26, 0.42);
    }}
    #side-nav .nav-link.is-child::before {{
      left: -1px; width: 1px;
    }}
    #side-nav .nav-link.is-child.active {{ color: #1a1a1a; font-weight: 500; }}
    /* Disclosure caret on parts that have children. */
    #side-nav .nav-link.is-part .nav-caret {{
      display: inline-block;
      width: 10px; height: 10px;
      margin-left: auto;
      flex-shrink: 0;
      opacity: 0.5;
      transition: transform 220ms ease, opacity 200ms ease;
      transform: rotate(0deg);
    }}
    #side-nav .nav-group.open > .nav-link.is-part .nav-caret {{
      transform: rotate(90deg);
      opacity: 0.9;
    }}
    #side-nav .nav-link.is-part:not(.has-children) .nav-caret {{ display: none; }}
    @media (min-width: 1280px) {{
      main {{ padding-left: 260px; }}
    }}
    @media (max-width: 1280px) {{
      #side-nav {{ display: none; }}
    }}
    @media print {{
      #side-nav, #scroll-progress, #pdf-button {{ display: none !important; }}
    }}

    /* ────────── Defensive overflow handling ────────── */
    /* Long domain names + paths can break tables. Force wrapping. */
    table {{ table-layout: auto; }}
    table td {{ overflow-wrap: anywhere; word-break: break-word; }}
    .break-words {{ overflow-wrap: anywhere; word-break: break-word; }}
    .truncate {{ overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }}

    /* ────────── Last-1000-commits badge ────────── */
    .commit-window-badge {{
      display: inline-flex; align-items: center; gap: 0.4rem;
      padding: 4px 10px;
      border: 1px solid rgba(165, 28, 48, 0.3);
      background: rgba(165, 28, 48, 0.04);
      color: #a51c30;
      border-radius: 999px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      white-space: nowrap;
    }}
    .commit-window-dot {{
      width: 5px; height: 5px; border-radius: 50%;
      background: #a51c30;
      box-shadow: 0 0 0 3px rgba(165, 28, 48, 0.15);
    }}

    /* ────────── PDF button (stylish bottom-right) ────────── */
    #pdf-button {{
      position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 55;
      display: inline-flex; align-items: center; gap: 0.5rem;
      padding: 0.65rem 1rem;
      background: #1a1a1a; color: #fbf9f5;
      border: none; border-radius: 999px;
      font-family: 'Inter', system-ui;
      font-size: 12px; font-weight: 600;
      letter-spacing: 0.02em;
      cursor: pointer;
      box-shadow: 0 8px 24px -6px rgba(0, 0, 0, 0.3);
      transition: transform 200ms ease, box-shadow 200ms ease;
    }}
    #pdf-button:hover {{
      transform: translateY(-2px);
      box-shadow: 0 12px 32px -6px rgba(0, 0, 0, 0.4);
    }}
  </style>
</head>
<body class="bg-paper">
  <div id="scroll-progress"></div>
  <aside id="side-nav" aria-label="Section navigator">
    <nav class="nav-list" id="nav-list"></nav>
  </aside>
  <button id="pdf-button" onclick="window.print()" title="Print or save as PDF">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z"/></svg>
    <span>Print / save as PDF</span>
  </button>
  <main>
    {body}
  </main>

  {blobs}

  <script>
  /* ─────────────────── side navigator + scroll progress ─────────────────── */
  (function () {{
    const navList = document.getElementById('nav-list');
    if (!navList) return;
    const navSections = [...document.querySelectorAll('section[data-nav-label]')];
    const links = [];

    /* Walk sections in DOM order, grouping each non-Part item into the
     * preceding Part. Front matter (cover / foreword / methodology)
     * and the outro live in their own implicit groups. */
    const groups = [];
    let current = null;
    navSections.forEach((sec) => {{
      const isPart = !!sec.dataset.navPart;
      if (isPart || !current) {{
        current = {{ opener: sec, children: [] }};
        groups.push(current);
      }}
      if (!isPart && current) {{
        current.children.push(sec);
      }}
    }});

    function makeLink(sec, kind) {{
      const label = sec.dataset.navLabel || sec.id;
      const part = sec.dataset.navPart || '';
      const a = document.createElement('a');
      a.className = 'nav-link ' + kind;
      a.href = '#' + sec.id;
      a.dataset.target = sec.id;
      const num = part || '';
      a.innerHTML = `<span class="nav-num">${{num}}</span><span class="nav-label">${{label}}</span>` +
        (kind === 'is-part' ? `<span class="nav-caret">›</span>` : '');
      a.addEventListener('click', (e) => {{
        e.preventDefault();
        sec.scrollIntoView({{ behavior: 'smooth', block: 'start' }});
      }});
      return a;
    }}

    /* Render each group as a parent link + collapsed children container.
     * The children DOM exists from the start so we can animate
     * max-height; clicking the parent toggles `.open` and reveals
     * them. The active section's group gets `.open` automatically. */
    groups.forEach((g) => {{
      const groupEl = document.createElement('div');
      groupEl.className = 'nav-group';
      const parentLink = makeLink(g.opener, 'is-part');
      if (g.children.length > 0) parentLink.classList.add('has-children');
      groupEl.appendChild(parentLink);
      links.push(parentLink);
      if (g.children.length > 0) {{
        const childrenWrap = document.createElement('div');
        childrenWrap.className = 'nav-children';
        g.children.forEach((c) => {{
          const childLink = makeLink(c, 'is-child');
          childrenWrap.appendChild(childLink);
          links.push(childLink);
        }});
        groupEl.appendChild(childrenWrap);
      }}
      navList.appendChild(groupEl);
    }});

    /* Build a section-id → group element lookup for active-state propagation. */
    const sectionToGroup = new Map();
    groups.forEach((g) => {{
      const groupEl = navList.children[groups.indexOf(g)];
      sectionToGroup.set(g.opener.id, groupEl);
      g.children.forEach((c) => sectionToGroup.set(c.id, groupEl));
    }});

    /* Active-section detection — scroll-driven. Finds the last section
     * whose top is above the 35% line of the viewport, then propagates
     * 'open' to that section's group so its children are visible. */
    function updateActive() {{
      const trigger = window.scrollY + window.innerHeight * 0.35;
      let activeId = navSections[0].id;
      for (const sec of navSections) {{
        if (sec.offsetTop <= trigger) activeId = sec.id;
        else break;
      }}
      links.forEach((l) => l.classList.toggle('active', l.dataset.target === activeId));
      const activeGroup = sectionToGroup.get(activeId);
      navList.querySelectorAll('.nav-group').forEach((g) => {{
        g.classList.toggle('open', g === activeGroup);
      }});
    }}
    window.addEventListener('scroll', updateActive, {{ passive: true }});
    window.addEventListener('resize', updateActive);
    updateActive();

    /* Scroll progress bar. */
    const bar = document.getElementById('scroll-progress');
    function updateProgress() {{
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      const pct = max > 0 ? (h.scrollTop / max) * 100 : 0;
      if (bar) bar.style.width = pct + '%';
    }}
    window.addEventListener('scroll', updateProgress, {{ passive: true }});
    updateProgress();
  }})();

  /* ─────────────────── chart bootstrapping ─────────────────── */
  const VM = {{}};
  document.querySelectorAll('script[type="application/json"][id^="vm-"]').forEach(s => {{
    VM[s.id.slice(3)] = JSON.parse(s.textContent);
  }});

  const ACCENT = '#a51c30';
  const INK = '#1a1a1a';
  const PAPER = '#fbf9f5';
  const MUTED = '#78716c';
  const PALETTE = ['#1a1a1a', '#a51c30', '#c08552', '#5c8a8a', '#7d6b91', '#aa6373', '#3e6b89', '#90744a', '#5e6f5b', '#8b5e3c'];

  const baseTextStyle = {{ fontFamily: 'Inter, system-ui, sans-serif', color: INK, fontSize: 12 }};
  const monoTextStyle = {{ fontFamily: 'JetBrains Mono, monospace', color: INK, fontSize: 12 }};

  function makeChart(elId, opt) {{
    const el = document.getElementById(elId);
    if (!el) return null;
    const c = echarts.init(el, null, {{ renderer: 'svg' }});
    c.setOption(Object.assign({{
      backgroundColor: 'transparent',
      textStyle: baseTextStyle,
      animation: false,
    }}, opt));
    window.addEventListener('resize', () => c.resize());
    window.addEventListener('beforeprint', () => c.resize());
    return c;
  }}

  function hbar(labels, values, color = INK, valueFmt = (v) => v.toLocaleString()) {{
    return {{
      grid: {{ left: 200, right: 60, top: 8, bottom: 8 }},
      xAxis: {{ type: 'value', show: false }},
      yAxis: {{
        type: 'category',
        data: labels,
        inverse: true,
        axisTick: {{ show: false }},
        axisLine: {{ show: false }},
        axisLabel: {{ color: INK, fontSize: 13, fontWeight: 500 }},
      }},
      series: [{{
        type: 'bar',
        data: values,
        barWidth: '60%',
        itemStyle: {{ color }},
        label: {{
          show: true,
          position: 'right',
          formatter: (p) => valueFmt(p.value),
          color: INK,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11,
        }},
      }}],
    }};
  }}

  /* ── Section 01 — Shape ── */
  if (VM['01_shape']) {{
    const s = VM['01_shape'];
    const top = s.top_orgs_by_repo_count.slice(0, 25);
    makeChart('chart-shape-top-orgs', hbar(
      top.map(r => r.org), top.map(r => r.repo_count), INK
    ));

    const t = VM['00_hero'].totals;
    makeChart('chart-shape-status-donut', {{
      series: [{{
        type: 'pie', radius: ['55%', '78%'],
        label: {{ show: true, formatter: '{{b}}\\n{{d}}%', color: INK }},
        labelLine: {{ length: 8, length2: 6 }},
        data: [
          {{ name: 'Active', value: t.active_repos, itemStyle: {{ color: INK }} }},
          {{ name: 'Archived', value: t.archived_repos, itemStyle: {{ color: '#a8a29e' }} }},
          {{ name: 'Forks', value: t.fork_repos, itemStyle: {{ color: '#d6d3d1' }} }},
        ],
      }}],
    }});

    makeChart('chart-shape-size-buckets', {{
      grid: {{ left: 80, right: 30, top: 16, bottom: 30 }},
      xAxis: {{ type: 'category', data: s.size_buckets.map(b => b.bucket), axisLabel: {{ color: INK }} }},
      yAxis: {{ type: 'value', show: false }},
      series: [{{
        type: 'bar', data: s.size_buckets.map(b => b.count),
        itemStyle: {{ color: INK }}, barWidth: '60%',
        label: {{ show: true, position: 'top', color: INK, fontFamily: 'JetBrains Mono, monospace', formatter: (p) => p.value.toLocaleString() }},
      }}],
    }});

    makeChart('chart-shape-pushyear', {{
      grid: {{ left: 50, right: 30, top: 16, bottom: 40 }},
      xAxis: {{ type: 'category', data: s.last_push_by_year.map(r => r.year), axisLabel: {{ color: INK }} }},
      yAxis: {{ type: 'value', axisLabel: {{ color: MUTED }} }},
      series: [{{
        type: 'bar', data: s.last_push_by_year.map(r => r.count),
        itemStyle: {{ color: INK }}, barWidth: '70%',
      }}],
    }});

    /* D3 bubble pack: org galaxy */
    (function () {{
      const el = document.getElementById('chart-shape-galaxy');
      if (!el) return;
      const data = s.top_orgs_by_repo_count;
      const w = el.clientWidth, h = 640;
      const svg = d3.select(el).append('svg').attr('width', w).attr('height', h);
      const root = d3.hierarchy({{ children: data }})
        .sum(d => d.repo_count)
        .sort((a,b) => b.value - a.value);
      d3.pack().size([w, h]).padding(4)(root);
      const g = svg.selectAll('g').data(root.leaves()).enter().append('g')
        .attr('transform', d => `translate(${{d.x}},${{d.y}})`);
      g.append('circle')
        .attr('r', d => d.r)
        .attr('fill', '#1a1a1a')
        .attr('fill-opacity', d => 0.3 + 0.6 * (d.value / root.value));
      g.filter(d => d.r > 22).append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '.35em')
        .attr('fill', '#fbf9f5')
        .attr('font-family', 'Inter, system-ui')
        .attr('font-size', d => Math.min(d.r / 3, 14))
        .attr('font-weight', 600)
        .text(d => d.data.org);
      g.filter(d => d.r > 36).append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '1.6em')
        .attr('fill', '#fbf9f5')
        .attr('font-family', 'JetBrains Mono, monospace')
        .attr('font-size', d => Math.min(d.r / 4.5, 11))
        .attr('opacity', 0.85)
        .text(d => d.data.repo_count.toLocaleString());
    }})();
  }}

  /* ── Section 02 — Languages ── */
  if (VM['02_languages']) {{
    const l = VM['02_languages'];
    const top = l.top_languages_by_repo_count.slice(0, 25);
    makeChart('chart-lang-by-repo', hbar(
      top.map(r => r.language),
      top.map(r => r.repos),
      INK,
      v => v.toLocaleString() + ' repos'
    ));

    const tm = l.top_languages_by_file_count.slice(0, 25).map((r, i) => ({{
      name: r.language, value: r.total_files,
      itemStyle: {{ color: PALETTE[i % PALETTE.length] }},
    }}));
    makeChart('chart-lang-treemap', {{
      series: [{{
        type: 'treemap',
        data: tm,
        roam: false,
        breadcrumb: {{ show: false }},
        nodeClick: false,
        label: {{
          show: true,
          fontFamily: 'Inter, system-ui',
          fontSize: 14,
          fontWeight: 600,
          color: PAPER,
          formatter: (p) => `${{p.name}}\\n${{p.value.toLocaleString()}}`,
        }},
        itemStyle: {{ borderColor: PAPER, borderWidth: 2 }},
        upperLabel: {{ show: false }},
      }}],
    }});
  }}

  /* ── Section 03 — Frameworks ── */
  if (VM['03_frameworks']) {{
    const f = VM['03_frameworks'].top_tools.slice(0, 25);
    makeChart('chart-frameworks-bar', hbar(
      f.map(r => r.name), f.map(r => r.count), INK,
      v => v.toLocaleString() + ' repos'
    ));
  }}

  /* ── Section 04 — Cloud ── */
  if (VM['04_cloud']) {{
    const c = VM['04_cloud'];
    const cd = c.cloud_diversity;
    makeChart('chart-cloud-donut', {{
      series: [{{
        type: 'pie', radius: ['50%', '78%'],
        label: {{ show: true, formatter: '{{b}}\\n{{d}}%', color: INK }},
        data: cd.map((b, i) => ({{
          name: b.clouds_used === 0 ? 'No cloud' : `${{b.clouds_used}} cloud${{b.clouds_used>1?'s':''}}`,
          value: b.repos,
          itemStyle: {{ color: [INK, ACCENT, '#c08552', '#5c8a8a'][i] || MUTED }},
        }})),
      }}],
    }});
    const small = (data, color) => hbar(
      data.map(r => r.name), data.map(r => r.count), color
    );
    makeChart('chart-cloud-aws', small(c.top_aws_services.slice(0, 25), INK));
    makeChart('chart-cloud-azure', small(c.top_azure_services.slice(0, 25), INK));
    makeChart('chart-cloud-gcp', small(c.top_gcp_services.slice(0, 25), INK));
  }}

  /* ── Section 05 — Engineering ── */
  if (VM['05_engineering']) {{
    const e = VM['05_engineering'];
    makeChart('chart-eng-cicd', hbar(
      e.cicd.top_tools.slice(0, 25).map(r => r.name),
      e.cicd.top_tools.slice(0, 25).map(r => r.count),
      INK,
      v => v.toLocaleString()
    ));
    makeChart('chart-eng-test', hbar(
      e.testing.top_tools.slice(0, 25).map(r => r.name),
      e.testing.top_tools.slice(0, 25).map(r => r.count),
      INK,
      v => v.toLocaleString()
    ));
  }}

  /* ── Section 06 — Data ── */
  if (VM['06_data_layer']) {{
    const d = VM['06_data_layer'].top_tools.slice(0, 25);
    makeChart('chart-data-bar', hbar(
      d.map(r => r.name), d.map(r => r.count), INK,
      v => v.toLocaleString() + ' repos'
    ));
  }}

  /* ── Section 07 — OSS Health ── */
  if (VM['07_oss_health']) {{
    const o = VM['07_oss_health'];
    makeChart('chart-oss-stars', {{
      series: [{{
        type: 'pie', radius: ['50%', '75%'],
        label: {{ show: true, formatter: '{{b}}\\n{{d}}%', color: INK }},
        data: o.star_buckets.map((b, i) => ({{
          name: b.bucket + ' stars', value: b.count,
          itemStyle: {{ color: [ACCENT, '#c08552', '#5c8a8a', '#a8a29e'][i] }},
        }})),
      }}],
    }});
    const ms = o.most_starred.slice(0, 25);
    makeChart('chart-oss-most', hbar(
      ms.map(r => r.slug.length > 30 ? r.slug.slice(0, 30) + '…' : r.slug),
      ms.map(r => r.stars), ACCENT,
      v => v.toLocaleString() + ' ★'
    ));
  }}

  /* ── Section 08 — League Table radar ── */
  if (VM['08_league_table']) {{
    const rows = VM['08_league_table'].rows.slice(0, 12);
    const indicators = [
      {{ name: 'Scale', max: rows[0].scale_repo_count }},
      {{ name: 'Freshness', max: 100 }},
      {{ name: 'CI', max: 100 }},
      {{ name: 'Tests', max: 100 }},
      {{ name: 'Cloud breadth', max: 3 }},
      {{ name: 'OSS share', max: 100 }},
      {{ name: 'Languages', max: Math.max(...rows.map(r => r.language_diversity)) }},
      {{ name: 'Active ratio', max: 100 }},
    ];
    makeChart('chart-league', {{
      legend: {{
        show: true, type: 'scroll', bottom: 0, left: 'center',
        textStyle: {{ color: INK, fontSize: 11 }},
      }},
      radar: {{
        indicator: indicators,
        center: ['50%', '46%'],
        radius: '62%',
        splitArea: {{ areaStyle: {{ color: ['rgba(0,0,0,0.02)', 'rgba(0,0,0,0.04)'] }} }},
        axisName: {{ color: INK, fontSize: 12, fontWeight: 600 }},
      }},
      series: [{{
        type: 'radar',
        data: rows.map((r, i) => ({{
          name: r.org,
          value: [
            r.scale_repo_count,
            r.freshness_pct_pushed_12mo,
            r.ci_score_pct,
            r.test_score_pct,
            r.cloud_breadth,
            r.oss_share_starred_pct,
            r.language_diversity,
            100 - r.archive_ratio_pct,
          ],
          lineStyle: {{ width: 2, color: PALETTE[i % PALETTE.length] }},
          itemStyle: {{ color: PALETTE[i % PALETTE.length] }},
          areaStyle: {{ opacity: 0.05 }},
        }})),
      }}],
    }});
  }}

  /* ── Section 12 — Velocity ── */
  if (VM['12_velocity']) {{
    const v = VM['12_velocity'];
    makeChart('chart-velocity-hour', {{
      grid: {{ left: 50, right: 30, top: 30, bottom: 30 }},
      title: {{ text: 'Commits by hour of day (UTC)', textStyle: {{ fontSize: 12, color: MUTED, fontWeight: 500 }} }},
      xAxis: {{ type: 'category', data: v.hour_distribution_utc.map(r => r.hour), axisLabel: {{ color: MUTED }} }},
      yAxis: {{ type: 'value', show: false }},
      series: [{{ type: 'bar', data: v.hour_distribution_utc.map(r => r.count), itemStyle: {{ color: INK }}, barWidth: '70%' }}],
    }});
    makeChart('chart-velocity-weekday', {{
      grid: {{ left: 50, right: 30, top: 30, bottom: 30 }},
      title: {{ text: 'Commits by weekday', textStyle: {{ fontSize: 12, color: MUTED, fontWeight: 500 }} }},
      xAxis: {{ type: 'category', data: v.weekday_distribution.map(r => r.weekday), axisLabel: {{ color: INK, fontSize: 11 }} }},
      yAxis: {{ type: 'value', show: false }},
      series: [{{
        type: 'bar', data: v.weekday_distribution.map((r, i) => ({{
          value: r.count,
          itemStyle: {{ color: i >= 5 ? ACCENT : INK }},
        }})),
        barWidth: '60%',
      }}],
    }});
  }}

  /* ── Section 13 — Bus factor ── */
  if (VM['13_bus_factor']) {{
    const b = VM['13_bus_factor'];
    makeChart('chart-bus-distribution', {{
      grid: {{ left: 80, right: 30, top: 16, bottom: 30 }},
      xAxis: {{ type: 'category', data: b.concentration_distribution.map(r => r.bucket), axisLabel: {{ color: INK, fontSize: 11 }} }},
      yAxis: {{ type: 'value', show: false }},
      series: [{{
        type: 'bar', data: b.concentration_distribution.map((r, i) => ({{
          value: r.repos,
          itemStyle: {{ color: r.bucket === '>80%' ? ACCENT : (r.bucket === '60-80%' ? '#c08552' : INK) }},
        }})),
        barWidth: '60%',
        label: {{ show: true, position: 'top', color: INK, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, formatter: (p) => p.value.toLocaleString() }},
      }}],
    }});
  }}

  /* ── Section 14 — Contributors / vendors ── */
  if (VM['14_contributors']) {{
    const c = VM['14_contributors'];
    const top = c.top_vendors_by_commits.slice(0, 25);
    makeChart('chart-vendors', hbar(
      top.map(r => r.vendor),
      top.map(r => r.commits),
      INK,
      v => v.toLocaleString() + ' commits'
    ));
  }}

  /* ── Section 15 — Hotspots ── */
  if (VM['15_hotspots']) {{
    const h = VM['15_hotspots'];
    const top = h.top_files_global_top25.slice(0, 25);
    makeChart('chart-hotspots', hbar(
      top.map(r => {{
        // Show last 2 path segments only — full paths are noisy.
        const parts = r.path.split('/');
        return parts.slice(-2).join('/');
      }}),
      top.map(r => r.churn),
      INK,
      v => v.toLocaleString() + ' changes'
    ));
  }}

  /* ── IaC & containers ── */
  if (VM['04_cloud']) {{
    const c = VM['04_cloud'];
    if (c.container_tools && c.container_tools.length) {{
      makeChart('chart-containers', hbar(
        c.container_tools.slice(0, 25).map(r => r.name),
        c.container_tools.slice(0, 25).map(r => r.count),
        INK,
        v => v.toLocaleString() + ' repos'
      ));
    }}
    if (c.iac_tools && c.iac_tools.length) {{
      makeChart('chart-iac', hbar(
        c.iac_tools.slice(0, 25).map(r => r.name),
        c.iac_tools.slice(0, 25).map(r => r.count),
        INK,
        v => v.toLocaleString() + ' repos'
      ));
    }}
  }}

  /* ── Top email domains ── */
  if (VM['14_contributors']) {{
    const c = VM['14_contributors'];
    const top = c.top_email_domains.slice(0, 25);
    makeChart('chart-email-domains', hbar(
      top.map(r => r.domain.length > 40 ? r.domain.slice(0, 40) + '…' : r.domain),
      top.map(r => r.commits), INK,
      v => v.toLocaleString() + ' commits'
    ));
  }}

  /* ── Activity × Discipline quadrant ── */
  if (VM['08_league_table']) {{
    const rows = VM['08_league_table'].rows.filter(r => r.scale_active_count >= 5);
    const points = rows.map(r => ({{
      name: r.org,
      value: [r.freshness_pct_pushed_12mo, (r.ci_score_pct + r.test_score_pct) / 2, r.scale_active_count],
    }}));
    const maxScale = Math.max(...rows.map(r => r.scale_active_count)) || 1;
    makeChart('chart-quadrant', {{
      grid: {{ left: 60, right: 30, top: 30, bottom: 50 }},
      tooltip: {{
        formatter: (p) => `<b>${{p.name}}</b><br/>Freshness: ${{p.value[0]}}%<br/>Discipline: ${{p.value[1].toFixed(1)}}%<br/>Active repos: ${{p.value[2].toLocaleString()}}`,
      }},
      xAxis: {{
        type: 'value', min: 0, max: 100, name: 'Freshness (% pushed in last 12 months) →',
        nameLocation: 'middle', nameGap: 30, nameTextStyle: {{ color: MUTED, fontSize: 12 }},
        splitLine: {{ lineStyle: {{ color: '#e7e5e4' }} }},
      }},
      yAxis: {{
        type: 'value', min: 0, max: 100, name: 'Discipline (CI + tests) →',
        nameLocation: 'middle', nameGap: 40, nameTextStyle: {{ color: MUTED, fontSize: 12 }},
        splitLine: {{ lineStyle: {{ color: '#e7e5e4' }} }},
      }},
      series: [
        /* Quadrant background tints */
        {{ type: 'scatter', symbolSize: 0, data: [], markArea: {{
          silent: true, data: [
            [{{ xAxis: 50, yAxis: 50 }}, {{ xAxis: 100, yAxis: 100 }}],  /* shipping */
          ], itemStyle: {{ color: 'rgba(16, 185, 129, 0.05)' }}
        }} }},
        {{ type: 'scatter', symbolSize: 0, data: [], markArea: {{
          silent: true, data: [
            [{{ xAxis: 50, yAxis: 0 }}, {{ xAxis: 100, yAxis: 50 }}],  /* sprinting */
          ], itemStyle: {{ color: 'rgba(245, 158, 11, 0.05)' }}
        }} }},
        {{ type: 'scatter', symbolSize: 0, data: [], markArea: {{
          silent: true, data: [
            [{{ xAxis: 0, yAxis: 50 }}, {{ xAxis: 50, yAxis: 100 }}],  /* mature */
          ], itemStyle: {{ color: 'rgba(14, 165, 233, 0.05)' }}
        }} }},
        {{ type: 'scatter', symbolSize: 0, data: [], markArea: {{
          silent: true, data: [
            [{{ xAxis: 0, yAxis: 0 }}, {{ xAxis: 50, yAxis: 50 }}],  /* dark matter */
          ], itemStyle: {{ color: 'rgba(225, 29, 72, 0.04)' }}
        }} }},
        {{
          type: 'scatter',
          data: points,
          symbolSize: (val) => Math.max(8, Math.min(40, 6 + Math.sqrt(val[2] / maxScale) * 50)),
          itemStyle: {{ color: INK, opacity: 0.7, borderColor: PAPER, borderWidth: 1 }},
          label: {{
            show: true, position: 'right', color: INK, fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
            formatter: (p) => p.value[2] >= 100 ? p.name : '',
          }},
        }},
      ],
    }});
  }}

  /* ── Time Crystal — 7×24 commit heatmap ── */
  if (VM['12_velocity'] && VM['12_velocity'].weekday_hour_heatmap) {{
    const cells = VM['12_velocity'].weekday_hour_heatmap;
    const max = Math.max(...cells.map(c => c.count));
    const data = cells.map(c => [c.hour, c.weekday, c.count]);
    makeChart('chart-time-crystal', {{
      grid: {{ left: 60, right: 30, top: 10, bottom: 60 }},
      tooltip: {{
        position: 'top',
        formatter: (p) => `<b>${{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][p.value[1]]}} ${{String(p.value[0]).padStart(2,'0')}}:00</b><br/>${{p.value[2].toLocaleString()}} commits`,
      }},
      xAxis: {{
        type: 'category',
        data: Array.from({{length: 24}}, (_, i) => String(i).padStart(2, '0')),
        axisLabel: {{ color: MUTED, fontSize: 10 }},
        splitLine: {{ show: false }},
        axisTick: {{ show: false }},
      }},
      yAxis: {{
        type: 'category',
        data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        axisLabel: {{ color: INK, fontSize: 11, fontWeight: 600 }},
        splitLine: {{ show: false }},
        axisTick: {{ show: false }},
      }},
      visualMap: {{
        min: 0, max,
        calculable: false, show: true,
        orient: 'horizontal', left: 'center', bottom: 5,
        inRange: {{ color: ['#fbf9f5', '#e7e5e4', '#a8a29e', '#57534e', '#1a1a1a'] }},
        textStyle: {{ color: MUTED, fontSize: 10 }},
      }},
      series: [{{
        type: 'heatmap', data,
        label: {{ show: false }},
        itemStyle: {{ borderColor: PAPER, borderWidth: 1 }},
        emphasis: {{ itemStyle: {{ borderColor: ACCENT, borderWidth: 2 }} }},
      }}],
    }});
  }}

  /* ── Conventional commits breakdown ── */
  if (VM['12_velocity'] && VM['12_velocity'].commit_message_nlp) {{
    const cc = VM['12_velocity'].commit_message_nlp.conventional_breakdown || [];
    makeChart('chart-cc-breakdown', hbar(
      cc.slice(0, 13).map(r => r.type),
      cc.slice(0, 13).map(r => r.count),
      INK,
      v => v.toLocaleString()
    ));
  }}

  /* ── Tribes network (D3 force-directed) ── */
  (function () {{
    if (!VM['16_similarity']) return;
    const el = document.getElementById('chart-tribes-network');
    if (!el) return;
    const g = VM['16_similarity'].graph;
    const w = el.clientWidth || 700, h = 700;
    const svg = d3.select(el).append('svg').attr('width', w).attr('height', h);
    const links = g.edges.map(e => ({{ source: e.source, target: e.target, value: e.value }}));
    const nodes = g.nodes.map(n => ({{ id: n.id, repos: n.repos }}));

    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(d => 60 + (1 - d.value) * 80).strength(0.4))
      .force('charge', d3.forceManyBody().strength(-90))
      .force('center', d3.forceCenter(w/2, h/2))
      .force('collide', d3.forceCollide().radius(d => 6 + Math.sqrt(d.repos) * 0.6));

    const link = svg.append('g').attr('stroke', '#a8a29e').attr('stroke-opacity', 0.35)
      .selectAll('line').data(links).join('line')
      .attr('stroke-width', d => 0.5 + d.value * 1.5);

    const node = svg.append('g').selectAll('g').data(nodes).join('g')
      .call(d3.drag()
        .on('start', (e, d) => {{ if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; }})
        .on('drag', (e, d) => {{ d.fx = e.x; d.fy = e.y; }})
        .on('end', (e, d) => {{ if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }}));

    node.append('circle')
      .attr('r', d => 4 + Math.sqrt(d.repos) * 0.8)
      .attr('fill', '#1a1a1a')
      .attr('fill-opacity', 0.75)
      .attr('stroke', '#fbf9f5')
      .attr('stroke-width', 1.5);

    node.append('text')
      .attr('x', d => 6 + Math.sqrt(d.repos) * 0.8)
      .attr('y', 3)
      .attr('font-family', 'Inter, system-ui')
      .attr('font-size', d => Math.min(11, 7 + Math.sqrt(d.repos) * 0.3))
      .attr('fill', '#1a1a1a')
      .text(d => d.id);

    sim.on('tick', () => {{
      link
        .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      node.attr('transform', d => `translate(${{d.x}},${{d.y}})`);
    }});
  }})();

  /* ── Report card grade distributions ── */
  if (VM['22_report_card']) {{
    const rc = VM['22_report_card'];
    const overall = rc.overall_grade_distribution || [];
    const gradeColors = {{ A: '#1a1a1a', B: '#5c8a8a', C: '#c08552', D: '#a51c30', F: '#78716c' }};
    makeChart('chart-rc-overall', {{
      title: {{ text: 'Overall grade distribution', textStyle: {{ fontSize: 12, color: MUTED, fontWeight: 500 }} }},
      grid: {{ left: 60, right: 30, top: 36, bottom: 30 }},
      xAxis: {{ type: 'category', data: overall.map(r => r.grade), axisLabel: {{ color: INK, fontSize: 14, fontWeight: 600 }} }},
      yAxis: {{ type: 'value', show: false }},
      series: [{{
        type: 'bar',
        data: overall.map(r => ({{ value: r.count, itemStyle: {{ color: gradeColors[r.grade] || INK }} }})),
        barWidth: '60%',
        label: {{ show: true, position: 'top', color: INK, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, formatter: (p) => p.value.toLocaleString() }},
      }}],
    }});
    const cats = rc.category_grade_distribution || {{}};
    const catNames = Object.keys(cats);
    makeChart('chart-rc-categories', {{
      title: {{ text: 'Grade distribution by category', textStyle: {{ fontSize: 12, color: MUTED, fontWeight: 500 }} }},
      grid: {{ left: 130, right: 30, top: 36, bottom: 30 }},
      tooltip: {{ trigger: 'axis', axisPointer: {{ type: 'shadow' }} }},
      legend: {{ bottom: 0, textStyle: {{ color: INK, fontSize: 11 }} }},
      xAxis: {{ type: 'value', show: false }},
      yAxis: {{ type: 'category', data: catNames.map(c => c.replace(/_/g, ' ')), axisLabel: {{ color: INK, fontSize: 11 }} }},
      series: ['A', 'B', 'C', 'D', 'F'].map(g => ({{
        name: g, type: 'bar', stack: 'total',
        data: catNames.map(c => (cats[c] || []).find(x => x.grade === g)?.count || 0),
        itemStyle: {{ color: gradeColors[g] }},
        emphasis: {{ focus: 'series' }},
      }})),
    }});
  }}

  /* ── Commit-subject length histogram ── */
  if (VM['20_message_quality']) {{
    const q = VM['20_message_quality'];
    const hist = q.length_histogram || [];
    makeChart('chart-msg-length', {{
      grid: {{ left: 60, right: 30, top: 16, bottom: 50 }},
      xAxis: {{
        type: 'category',
        data: hist.map(b => b.bucket),
        axisLabel: {{ color: MUTED, fontSize: 10, rotate: 45 }},
      }},
      yAxis: {{ type: 'value', axisLabel: {{ color: MUTED }} }},
      series: [{{
        type: 'bar',
        data: hist.map(b => {{
          const start = parseInt(b.bucket.split('-')[0], 10);
          let color = INK;
          if (start < 10) color = ACCENT;             /* bad short */
          else if (start > 100) color = ACCENT;       /* bad long */
          else if (start >= 20 && start <= 70) color = '#1a1a1a'; /* good band */
          else color = MUTED;
          return {{ value: b.count, itemStyle: {{ color }} }};
        }}),
        barWidth: '80%',
      }}],
    }});
  }}

  /* ── Hour × email-domain stacked bar ── */
  if (VM['21_time_by_domain']) {{
    const t = VM['21_time_by_domain'];
    const colors = {{
      'Government (UK)': '#1a1a1a',
      'NHS': '#5c8a8a',
      'Parliament': '#7d6b91',
      'GitHub-anonymised': '#a8a29e',
      'Personal mail': '#c08552',
      'Other': '#a51c30',
    }};
    const series = t.vendors.map(v => ({{
      name: v, type: 'bar', stack: 'total',
      data: t.hours.map(h => h[v] || 0),
      itemStyle: {{ color: colors[v] || MUTED }},
      emphasis: {{ focus: 'series' }},
    }}));
    makeChart('chart-time-by-domain', {{
      grid: {{ left: 60, right: 30, top: 30, bottom: 60 }},
      legend: {{ bottom: 0, textStyle: {{ color: INK, fontSize: 11 }} }},
      tooltip: {{ trigger: 'axis', axisPointer: {{ type: 'shadow' }} }},
      xAxis: {{
        type: 'category',
        data: t.hours.map(h => String(h.hour).padStart(2, '0')),
        axisLabel: {{ color: MUTED, fontSize: 10 }},
      }},
      yAxis: {{ type: 'value', axisLabel: {{ color: MUTED }} }},
      series,
    }});
  }}

  /* ── File churn rate ── */
  if (VM['15_hotspots']) {{
    const rate = VM['15_hotspots'].top_files_by_rate_top25 || [];
    if (rate.length) {{
      makeChart('chart-churn-rate', hbar(
        rate.slice(0, 25).map(r => {{
          const parts = r.path.split('/');
          return parts.slice(-2).join('/');
        }}),
        rate.slice(0, 25).map(r => r.rate_per_day),
        INK,
        v => v.toFixed(2) + ' / day'
      ));
    }}
  }}

  /* Resize all charts on print to ensure they fit the new viewport. */
  window.addEventListener('beforeprint', () => {{
    document.querySelectorAll('.chart').forEach(el => {{
      const inst = echarts.getInstanceByDom(el);
      if (inst) inst.resize();
    }});
  }});
  </script>
</body>
</html>
"""


def main() -> int:
    target_root = resolve_target_root()
    target_json = target_root / "target.json"
    target = json.loads(target_json.read_text()) if target_json.exists() else {}
    target = {k: v for k, v in target.items() if not k.startswith("_comment")}

    vms = load_vms(target_root)
    print(f"Loaded {len(vms)} viewmodels.")

    html = render_html(vms, target)
    out_dir = target_root / "site"
    out_dir.mkdir(exist_ok=True)
    out_file = out_dir / "index.html"
    out_file.write_text(html)
    print(f"Rendered: {out_file}")
    print(f"Size:     {len(html) / 1024:.1f} KB")
    print()
    print("Open in a browser, or:")
    print(f"  xdg-open {out_file}")
    print(f"  python3 -m http.server -d {out_dir} 8000")
    return 0


if __name__ == "__main__":
    sys.exit(main())
