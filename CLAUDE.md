# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A **static** React + Vite + TypeScript site (Tailwind v4) where BRIDGE-AI Summit 2026 hackathon teams
look up their booth, download their certificate, and view the awards board. There is **no backend for
the booth list** — everything is baked into the bundle at build time from Excel workbooks. The only
runtime network call is the Awards **live** view (a Google Apps Script scoreboard).

Deployment is `deploy.sh`: `npm run build` then `scp -r dist/* dghadmin@161.200.105.34:/var/www/bridge`.
Everything the site serves (booth data, PDFs, certificates) is a static file under `dist/`.

## Commands

```bash
npm run dev                 # Vite dev server at http://localhost:3000 (falls back to 3001 if busy)
npm run lint                # tsc --noEmit — the only "test"; there is no test suite
npm run build               # validate-data-source → import:certificates → vite build → dist/
./deploy.sh                 # build + scp dist/* to the server

npm run import:excel              # data/results.xlsx          → src/generated/teams.json
npm run import:awards              # data/results_2.xlsx        → src/generated/awards.json
npm run import:certificates       # data/certificate/PDF/**    → public/certificates/ + src/generated/certificates.json
npm run import:award-certificates # data/certificate/PDF_AWARD → public/award-certificates/ + src/generated/award-certificates.json
```

`import:award-certificates` needs the `pdftotext` binary (poppler-utils) at build time.

Each importer accepts an alternate path: `npm run import:excel -- /path/to/file.xlsx`.
There is no test runner; `npm run lint` (typecheck) is the check to run before finishing.

## The core pattern: build-time codegen, committed JSON, gitignored sources

Almost every "data" concern in this repo follows the same shape, and it is the thing to understand
first:

- **Source files are gitignored** and live in `data/` — the `.xlsx` workbooks (reviewer scores,
  institutions, application IDs) and the ~51 MB of certificate PDFs. Publishing them would leak
  private columns, so `data/*.xlsx`, `data/certificate/`, and `public/certificates/` are all ignored.
- **A script in `scripts/` derives a small, public artifact** that *is* committed:
  `src/generated/teams.json`, `src/generated/awards.json`, `src/generated/certificates.json`. The app
  imports these JSON files directly; `npm run dev` reads them without any build step.
- **Importers fail without overwriting** the previous JSON on bad input (missing columns, unknown
  category/track, duplicate booths, booth/category-letter mismatch). Treat a failed import as "old
  data preserved," not "data lost."

Consequence: after changing a source workbook or PDF you must re-run the matching importer and
**commit the regenerated JSON**, or the deployed site ships stale/placeholder data. `awards.json`
currently may hold placeholder winners until real judging is imported.

`vite.config.ts` does a related build-time trick for the two document PDFs: it reads byte size + page
count + a content hash out of each PDF and injects them as `__MANUAL_*__` / `__TEAM_LIST_*__` defines.
The hash is appended to the URL as `?v=` — `public/` files keep stable URLs and `deploy.sh` scp's over
them in place, so without the hash a browser would serve a cached old PDF. Certificates use the same
`?v=hash` scheme, with the hash stored per-id in `certificates.json`.

## Booth ↔ category ↔ certificate identity

The booth number is the primary key everywhere. Format is `BAI-<A|B|C|D><nn>`; `team.id` is its
lowercase form (`bai-a01`). **The letter encodes the category** (A=Medical Education, B=Clinical,
C=Digital Technology, D=Medical AI), so importers cross-check the two and reject mismatches.

Certificate PDFs are named `Bridge Certificate <Category> [1|2]_<SUFFIX>.pdf`. Only the `_<SUFFIX>` at
the end matters: `_A01` → `BAI-A01`. The folder and the ` 1`/` 2` batch label are decorative.
`import-certificates.ts` copies each to `public/certificates/<id>.pdf`, so `src/certificates.ts` can
build the URL straight from `team.id` with no lookup table — the perfect 1:1 booth↔certificate mapping
is what makes this work.

**Award certificates are the exception to name-based mapping.** The winners' PDFs in
`data/certificate/PDF_AWARD/` are named only by number, so `import-award-certificates.ts` runs
`pdftotext` and recovers the booth from the project title in the text (it matches `team.projectName`
verbatim), plus the award from the "1st Place"/"Grand Prize"/"Popular Vote" line. Output:
`public/award-certificates/<id>.pdf` (medal) and `<id>-<grand|popular>.pdf` (special), keyed in
`src/generated/award-certificates.json`. A booth can hold both a medal and a special award.

## Tabs and routing

`src/App.tsx` is the whole app shell. Three tabs, selected by URL hash (no router):

- **booths** (default, clean URL) — the searchable team table + the two document cards + the
  certificate download column + the announcement modal.
- **awards** (`#awards`) — `<AwardsView source="backup">`, the baked `awards.json` board (instant).
- **backup** (`#backup`, hidden) — `<AwardsView source="live">`, fetches the live Apps Script
  scoreboard. The nav entry only appears once someone visits `#backup`.

The awards board is 8 groups (4 categories × 2 tracks), each with Gold/Silver/Bronze + 2 Honorable
Mentions. On top of the medals sit two **cross-cutting special awards** — one Popular Award, two Grand
Prizes — modeled in `awards.ts` (`SpecialAward`, `SPECIAL_META`) and attached to an `AwardEntry` in
`awardsSource.ts` from the award-certificate manifest. They render as a badge, a "Special award" filter
row, and per-card download buttons in `AwardsView.tsx`. Note the board only shows medal winners, so a
special-award team must also hold a medal to appear (all three currently do). `VITE_AWARDS_API_URL`
sets the live endpoint (a default is baked in).
`VITE_DATA_SOURCE` (`excel` default | `mock`) chooses the bundled booth dataset; `mock` uses the small
sample in `src/data.ts` for UI work.

## Styling

Almost all CSS is in `src/styles/bridge-theme.css` (design tokens as CSS vars: `--navy`, `--peach`,
`--paper`, radii, shadows). Match existing tokens rather than hardcoding colors. The team table
becomes a stack of cards below 860px via `data-label` attributes on `<td>` — any new column must set
`data-label` to render correctly on mobile. Note the contrast constraint baked into the design:
white-on-peach fails, so primary buttons use navy fill (see `.announce-cta`).

## Reference docs

- [README.md](README.md) — run/import/deploy details, the awards-backup `award` column encoding, PDF
  replacement (Ghostscript re-encode only helps image-heavy PDFs), and the certificate workflow.
- [docs/DATA.md](docs/DATA.md) — workbook structure, which columns are public, taxonomy, and
  data-quality findings.
