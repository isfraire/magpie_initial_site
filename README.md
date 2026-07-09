# Magpie News — live recall & safety alerts

The public, content-marketing half of Magpie: a static, server-rendered site that sweeps the four federal recall databases on a schedule, republishes what matters in plain language, links every alert to its official notice, and funnels visitors into early-access capture.

**Every alert on this site is real.** Data comes from public federal APIs; nothing is fabricated. Severity labels are Magpie's editorial classification and the mapping is published on the page at `#severity`.

## Architecture

```
scripts/sweep.mjs   → fetches CPSC / FDA / FSIS / NHTSA → data/alerts.json + data/sweep-meta.json
scripts/build.mjs   → renders data → site/ (index.html, alerts/<id>.html, sitemap, robots)
src/template.mjs    → SSR templates (SEO meta, OG tags, per-alert permalinks)
src/styles.css      → design system from the v4 prototype, responsive + WCAG-AA fixes
src/app.js          → progressive enhancement (filters, live search, expand, capture prefill)
.github/workflows/  → cron sweep every 6h → rebuild → deploy to GitHub Pages
```

Zero runtime dependencies. Node 20+ only. The page is fully readable, crawlable and linkable without JavaScript; JS adds filtering and niceties.

### Data sources (all free, no API keys)

| Source | Endpoint | Severity mapping |
|---|---|---|
| CPSC | `saferproducts.gov/RestWebServices/Recall?format=json` | keyword heuristic from stated hazard (documented at `#severity`) |
| FDA (food/drug/device) | `api.fda.gov/{food,drug,device}/enforcement.json` | Class I→Critical, II→Elevated, III→Advisory |
| USDA FSIS | `fsis.usda.gov/fsis/api/recall/v/1` | Class I/II/III, falls back to risk level |
| NHTSA | `static.nhtsa.gov/odi/ffdd/rcl/FLAT_RCL.zip` (daily flat file) | do-not-drive / park-outside / loss-of-control / fire → Critical, else Elevated |

**NHTSA note:** there is no "latest recalls" JSON endpoint; the documented route is the daily flat file (~100MB zipped, all years). The sweep streams and filters it by report date. Fine in CI; don't run it on a phone hotspot. FSIS field names for dates vary in the wild — if `field_recall_date` is absent in live responses, check the API doc PDF and adjust the fallback chain in `sweepFSIS()`.

**Failure honesty:** a source outage never blanks the feed. Prior items are kept, the failure is recorded in `sweep-meta.json`, and the status pill renders "N of 4 sources reporting."

## Quick start

```bash
node scripts/build.mjs        # build from the seeded data (real CPSC recalls)
npx serve site                # preview at localhost:3000

node scripts/sweep.mjs        # pull fresh data from all four sources (needs open network)
node scripts/build.mjs
```

## Deploy (GitHub Pages, ~10 minutes)

1. Push this folder to a GitHub repo, `main` branch.
2. Repo **Settings → Pages** → Source: **GitHub Actions**.
3. **Settings → Secrets and variables → Actions → Variables**, add:
   - `MAGPIE_BASE_URL` — e.g. `https://<user>.github.io/magpie-news` (enables sitemap + canonical/OG URLs)
   - `MAGPIE_FORM_ACTION` — your form endpoint (see below)
4. Run the workflow once from the **Actions** tab (or push). It sweeps, commits fresh data, builds and deploys. It then repeats every 6 hours.

The hero badge and status pill are generated from `sweep-meta.json` — the page never claims a freshness it doesn't have.

### Email capture (the funnel)

The capture form POSTs to `MAGPIE_FORM_ACTION`. Fastest options:

- **Formspree** (free tier): create a form, use `https://formspree.io/f/<id>`.
- **Buttondown / ConvertKit**: use their embed endpoint.

A hidden `interested_product` field is prefilled when a visitor clicks **"Own one? Get alerts for your stuff"** on a specific alert — this is your account-linking / capture-intent signal for the concierge MVP, per alert, for free. Until the variable is set, the form degrades honestly (it tells the visitor signups open shortly rather than pretending to submit).

## Decisions carried forward (and their trade-offs)

- **Official sources only in v1.** The prototype's "News alerts" (pre-recall press coverage) is deferred: it needs an editorial/ingestion pipeline we don't want in a lean MVP, and fabricating it is not an option. Trade-off: this reintroduces some alert scarcity on the page — the same structural risk documented when Warranty Sentinel was cut. The featured-alert module and 45-day window partially compensate; news ingestion is the natural v1.1.
- **No per-item dismiss/save.** Those are app affordances for logged-in users; on an anonymous marketing page they promise statefulness the page can't keep, and 30px dismiss targets next to safety alerts invited mis-taps. "Save" became **"Own one? → capture"**, converting the affordance into the funnel.
- **Severity is editorial and says so.** Agencies don't use Critical/Elevated/Advisory; the mapping is published, linked from the footer and every permalink, and the official notice is always one tap away.
- **FDA permalinks:** openFDA enforcement reports have no stable public per-item URL; alerts link to FDA's IRES recall search. If FDA press releases exist for an item they're better links — a v1.1 enrichment.
- **Static over server.** A cron-refreshed static site is the cheapest thing that is fast, crawlable and unbreakable at MVP traffic. When Magpie's app backend exists, this site can read from it instead of sweeping directly.

## Roadmap hooks

- v1.1: FSIS/FDA press-release link enrichment · news ingestion (alert-scarcity mitigation) · per-category RSS
- v2: read from Magpie's own backend · match-count teaser ("3 of these alerts match items in typical households") · Warranty Sentinel cross-promo
