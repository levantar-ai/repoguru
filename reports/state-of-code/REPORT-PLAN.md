# State-of-Code report — generic plan

A marketing-style "State of …" report (modelled on Google's *State of
DevOps*, GitHub's *Octoverse*, Snyk's *Open Source Security Report*)
built on a complete enumeration of public repositories belonging to
some organisation set — a government, an industry, a region, a Fortune
500. The same engine, structure, and view-models apply regardless of
the target's domain.

This document captures the generator-side blueprint. Target-specific
narrative (cover blurb, voice, predicted headlines) lives in each
target's `target.json` and any narrative document under
`targets/<slug>/`.

---

## 1. Why this report type exists

Public source code is unusually visible — most of it is open by
default, especially when a target organisation set commits to
transparency. That gives a "State of …" report access to *ground
truth* the survey-based equivalents (DORA, Octoverse) can only
approximate.

A report against any target serves four audiences:

| Audience | What they take from it |
|---|---|
| Executives at the target organisations | "How does my org compare?" — board-level talking points. |
| Vendors / suppliers to the target | Market sizing, framework adoption signals, procurement leverage. |
| Journalists and analysts | Quotable headlines, dataset to write their own angles against. |
| The report's publisher | Proof their tooling can analyse a 20k-repo portfolio in minutes. |

---

## 2. Reports worth modelling on

| Report | What it does well | What we borrow |
|---|---|---|
| **Google DORA / State of DevOps** | Tier framing (Elite/High/Medium/Low). Four metrics, repeated annually so trends compound. | Maturity ladder per org. Year-on-year framing baked in from v1. |
| **GitHub Octoverse** | Hero stats journalists quote. Regional cuts. Page-filling typography. | "By the numbers" cover spread. Per-language deep dives. |
| **Snyk Open Source Security Report** | Alarming-but-actionable headlines per ecosystem. | Per-language risk readouts. |
| **GitGuardian State of Secrets Sprawl** | One scary statistic per page. Single-issue framing. | Pull-quote-per-spread model. |
| **Sonatype Software Supply Chain** | Persona-targeted ("for the CISO", "for the developer"). | Multiple TL;DRs by audience. |
| **HashiCorp State of Cloud Strategy** | Maturity-stage segmentation. Vendor consolidation narrative. | Multi-cloud / lock-in section. |
| **Stripe / Cloudflare Year in Review** | Visual polish, design-as-marketing. | Cover spreads, pull quotes. |
| **JetBrains Developer Ecosystem** | Self-comparison widgets, lots of regional cuts. | "Compare yourself" chrome. |

---

## 3. Section structure

### Front matter
- **Cover + hero spread** — one huge number per pillar (repos, orgs, GB
  of code) and the report's title.
- **Foreword (1 page)** — punchy "why this dataset, why now" framing.
- **Methodology summary (1 page)** — what was measured, what wasn't,
  where the data came from. Credibility lives here.

### Part I — Shape of the corpus
1. Total scale: repos, orgs, GB of code, age.
2. Where the code lives (top-N league table by repo count).
3. Active vs archived (the "graveyard ratio" per org — a real story).
4. Growth curve: when were repos created, when were they last touched.
5. The long tail: how many micro-repos, how many monsters.

### Part II — Languages
6. Top languages by repo count *and* by total file count.
7. The legacy footprint: what's still on EOL'd languages and versions.
8. Per-org primary languages — the "tribes" of the corpus.
9. (If feasible) comparison vs an industry baseline like Octoverse.

### Part III — Frameworks & stacks
10. Top web frameworks by repo count.
11. Per-org top framework — vendor-stack callouts.
12. Frontend split: React / Vue / Angular / server-rendered HTML.
13. Static-site adoption (Jekyll, Hugo, Gatsby).

### Part IV — Cloud diaspora
14. AWS / Azure / GCP / on-prem split per org.
15. Multi-cloud vs single-cloud — vendor concentration map.
16. Container adoption: Docker / Kubernetes / Helm.
17. Infrastructure-as-code: Terraform / CloudFormation / Pulumi.
18. Top services per cloud.

### Part V — Engineering discipline
19. CI/CD adoption: which tools, what share?
20. Testing: % of repos with a detectable test framework.
21. The "no CI, no tests" bucket — the dark-matter story.

### Part VI — Data layer
22. Database engines (PostgreSQL / MySQL / SQL Server / Mongo / etc).
23. Per-org database choices.
24. ORM / data-access tooling (split out from engines at presentation
    time — the underlying detector conflates them).

### Part VII — Open-source health
25. The most-starred repos — the OSS heroes.
26. Star distribution (how many repos have any traction at all?).
27. The zombie ratio: % of repos untouched in 24+ months.
28. Empty / abandoned repos (created and never used).

### Part VIII — League table
29. Org-by-org radar charts on 8 dimensions:
    scale, freshness, CI, tests, cloud breadth, OSS share,
    archive ratio, language diversity.
30. Movers and shakers (annual cadence).
31. Best-in-class spotlights — 3–4 named orgs with charts.

### Part IX — Headlines, callouts, did-you-knows
- Pull-quote spreads: outliers, jaw-dropping individual repos, fun
  facts. The section that gets shared on LinkedIn.

### Part X — What this means for…
Audience-specific takeaways. Concrete sub-sections depend on the
target — for a government target it might be "for a Permanent
Secretary" / "for a vendor"; for a private-sector industry report it
might be "for the CISO" / "for the procurement team".

### Appendix
- Per-org one-pager (one per org — sold as a separate artefact, lead
  magnet, or paywalled bonus).
- Open dataset (CSV + Parquet, with clear licensing).
- Reproducibility script (the wrapper we ran).

### Outro: How we did this (the soft sell)
- "11,466 active repos analysed in N minutes using <tooling>."
- One screenshot, one CTA. Don't oversell — credibility comes from
  feeling neutral.

---

## 4. What we deliberately can't claim

Saying these up-front *increases* credibility — DORA does the same.

- **No DORA metrics.** We don't have commit/PR/deployment data to
  derive deploy frequency, lead time, MTTR, change-fail rate.
- **Public only.** Most internal code is invisible. The report's
  numbers are a lower bound; say so.
- **Heuristic detection.** "Detected Spring Boot" means Spring Boot
  config files are present at HEAD — not that the code runs in
  production.
- **No AI/Copilot usage data.** We measure committed code, not
  authoring tools.

---

## 5. Visual / page-level patterns

- **Cover stat in 200pt type** — DORA-style.
- **One section per spread** — hero number on the verso, narrative +
  chart on the recto.
- **Pull-quote callouts every 3–4 pages** — these get screenshotted on
  LinkedIn.
- **"By the numbers" strip** at every section boundary — five stats
  horizontally.
- **Per-org radar charts** — visually distinctive; people share them
  when *their* org appears.
- **"How does your org compare?" worksheet** at the back — interactive
  on web, tear-out on PDF.
- **Branded watermark** on every chart — every repost is free
  distribution.

---

## 6. View-models the engine produces

See `REPORT-STRUCTURE.md` for the per-section data contract.

---

## 7. Sequencing (per target)

1. Run the pipeline end-to-end (~35 min for ~10k repos).
2. Pull a "v0 hero stats" sheet to validate which headlines actually
   hold for this target.
3. Decide between:
   - **A LinkedIn one-page teaser** — ~2 days, validate appetite.
   - **The full report** — 4–6 weeks of design + analysis.
4. Pre-publish the dataset under an open licence (OGL / CC-BY) — it'll
   get journalists writing their own angles; every story links back.

---

## 8. Open questions for any target

- **Branding** — solo authorship or co-author with a respected body?
- **Cadence** — one-shot or annual? Annual compounds value
  year-on-year but commits resourcing.
- **Distribution** — gated download (lead capture) vs open (better
  reach, weaker funnel)?
- **Pre-publish review** — does any named org get a heads-up before
  publication? Convention says yes for big private companies; gov
  transparency norms argue no.
