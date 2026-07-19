# Booth Allocation Search

A static React site where BRIDGE-AI Summit 2026 hackathon teams look up their booth number. Teams
search by team name, project name, team leader, or booth number, scoped by award category and track.
A team's presence in the results means it passed the entrance qualification round.

There is no database or backend for the booth list — it is baked into the bundle at build time from
an Excel workbook. The **Awards** tab is the one runtime exception: its live view reads a read-only
judging scoreboard over the network (see [Awards](#awards)), while its backup view is baked in like
everything else.

See [docs/DATA.md](docs/DATA.md) for the workbook's structure, which columns are public, and the
data-quality notes.

## Run locally

Requires Node.js 18 or newer.

```bash
npm install
npm run dev
```

The development server is available at <http://localhost:3000>.

## Data sources

`VITE_DATA_SOURCE` controls which dataset is bundled:

- `excel` (default): the teams in `src/generated/teams.json`, produced by the importer.
- `mock`: a small sample set in `src/data.ts`, useful for UI work.

The variable is applied when Vite starts or builds. Changing it after deployment does not change an
existing build.

## Importing the workbook

The source of truth is `data/results.xlsx`. Replace that file, then:

```bash
npm run import:excel   # validates and regenerates src/generated/teams.json
npm run build          # writes the static site to dist/
```

To import from another path, pass it as an argument:

```bash
npm run import:excel -- /path/to/results.xlsx
```

> **Keep the workbook out of `public/`.** Vite copies `public/` verbatim into `dist/`, which would
> publish the reviewer scores, institutions, and application IDs it contains. `data/*.xlsx` is
> gitignored for the same reason — only the derived `src/generated/teams.json` is committed.

## Awards

A separate **Awards** tab shows the medal board — 8 groups (4 categories × 2 tracks), each awarding
**Gold, Silver, Bronze, and two Honorable Mentions**, so 40 winners in total. Two independent sources
render the same board:

- **Live** (the visible "Awards" tab) — fetches the judges' scoreboard from a Google Apps Script Web
  App at runtime. Rankings appear only once judging is complete; until then the tab reads *"No awards
  announced yet."* Set the endpoint with `VITE_AWARDS_API_URL` (a summit default is baked in, so this
  is optional). Only ranked results are read — no judge names or raw scores.
- **Backup** (a hidden tab) — reads the winners from `data/results_2.xlsx`, baked into the bundle like
  the booth list. Use it if the live scoreboard is unavailable. **Reach it at `/#backup`** (e.g.
  <http://localhost:3000/#backup>); the hidden "Awards (backup)" tab then appears in the nav.

### Updating the backup (`results_2.xlsx`)

`data/results_2.xlsx` is a copy of `results.xlsx` — same rows and columns — plus **one extra column
named `award`**. Only the **`เลขบูธ`** (booth) and **`award`** columns are read; every other column is
ignored (they exist only so the file mirrors `results.xlsx`).

Fill each winner's `award` cell with its **placing within that booth's own category × track group**,
and leave everyone else blank:

| `award` | Medal |
| --- | --- |
| `1` | 🥇 Gold |
| `2` | 🥈 Silver |
| `3` | 🥉 Bronze |
| `4` | 🏅 Honorable Mention |
| `5` | 🏅 Honorable Mention |
| *(blank)* | not a winner |

So **each of the 8 groups gets exactly one `1`, one `2`, one `3`, and two rows marked `4` and `5`** —
40 filled cells in all, the rest blank. You never state which group a `1` belongs to: membership comes
from that row's own `สาขา` and `Track`, so `1` is simply the gold of whatever category and track the
booth sits in. Example — the Medical Education / Rising Innovator group:

| `เลขบูธ` | `สาขา` | `Track` | … | `award` |
| --- | --- | --- | --- | --- |
| `BAI-A01` | Medical Education Award | Rising Innovator | … | `1` |
| `BAI-A02` | Medical Education Award | Rising Innovator | … | `2` |
| `BAI-A03` | Medical Education Award | Rising Innovator | … | `3` |
| `BAI-A04` | Medical Education Award | Rising Innovator | … | `4` |
| `BAI-A05` | Medical Education Award | Rising Innovator | … | `5` |
| `BAI-A11` | Medical Education Award | Rising Innovator | … | *(blank)* |

Text labels also work and are normalized — `gold`, `silver`, `bronze`, `honorable` (and the Thai
`ชมเชย`) — but **integers `1`–`5` are recommended**: they match the live scoreboard's own ranking and
can't be mistyped.

Then regenerate and ship:

```bash
npm run import:awards    # validates results_2.xlsx -> src/generated/awards.json
./deploy.sh              # or: npm run build
```

Import from another path with `npm run import:awards -- /path/to/results_2.xlsx`.

> **Commit the regenerated `awards.json` before going live.** `src/generated/awards.json` is committed
> (like `teams.json`) and is exactly what the backup tab renders. It currently holds **placeholder /
> dummy winners** for previewing the layout — running `npm run import:awards` on your real
> `results_2.xlsx` overwrites it; commit that result, or the live site will ship the dummy data.
> `data/results_2.xlsx` itself stays gitignored like the other workbooks.

The import **fails without overwriting** the previous `awards.json` on: a missing `booth` or `award`
column, an `award` value that isn't `1`–`5` or a known medal name, an `award` set on a row whose booth
is blank, or a booth listed twice.

## The two PDFs

Both are served from `public/`, which Vite copies into `dist/` and `deploy.sh` ships to the server.
No external hosting is involved. They are declared in [src/documents.ts](src/documents.ts).

| File | Shown as | Order |
| --- | --- | --- |
| `public/team-list.pdf` | ประกาศรายชื่อทีมที่ผ่านการคัดเลือกเข้าสู่รอบนิทรรศการ | First |
| `public/manual.pdf` | คู่มือการจัดแสดงผลงานนิทรรศการ | Second |

Both render as `DocumentCard`s stacked below the page intro: the announcement a team looks for
first, then the manual it acts on.

Neither "PDF · 2.1 MB · 15 หน้า" line is hardcoded: `vite.config.ts` reads the byte size and page
count out of each PDF at build time. It also hashes the bytes, and `src/documents.ts` appends that
hash to the URL (`/manual.pdf?v=3e02d746`). Vite content-hashes the JS and CSS filenames, but
`public/` files keep stable URLs and `deploy.sh` scp's over them in place — without the hash a
browser could keep serving a cached copy of the old manual, deadlines and all. The query changes
only when the file's contents change; the server ignores it and serves the same file.

### Replacing a PDF

Drop the new file in `data/`, then produce the `public/` copy. **Check that re-encoding actually
shrinks it** — Ghostscript re-encodes images, so it only helps an image-heavy PDF and will *inflate*
a text one.

```bash
# Manual: image-heavy master, 13.1 MB -> 2.1 MB with no visible loss and identical text.
gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.5 -dPDFSETTINGS=/printer \
   -dNOPAUSE -dQUIET -dBATCH -sOutputFile=public/manual.pdf data/manual.pdf

# Team list: a text PDF. /printer makes it bigger (476 KB -> 497 KB), so copy it verbatim.
cp data/team_list.pdf public/team-list.pdf
```

Then `./deploy.sh`. No source file changes: the labels and the cache-busting hash all follow the
new bytes. Only the `public/` copies are committed; `data/*.pdf` is gitignored as the master.

Do not rely on gzip to shrink a PDF on the server — they are already internally compressed.

### Expected columns

The importer reads the first worksheet and needs these six headers, in any order. English aliases
(`Booth`, `Category`, `Team Name`, `Project Name`, `Team Leader`) are also accepted.

| `เลขบูธ` | `สาขา` | `Track` | `ชื่อทีม` | `ชื่อโครงการ` | `หัวหน้าทีม` |
| --- | --- | --- | --- | --- | --- |
| BAI-A01 | Medical Education Award | Rising Innovator | ชื่อทีมภาษาไทย | English project title | นาย เอกธนา อาศิรวาท |

Every other column — including `Application ID`, `สถาบัน`, and `คะแนนเฉลี่ย` — is ignored and never
reaches the browser.

Categories must be one of `Medical Education Award`, `Clinical Award`, `Digital Technology Award`,
or `Medical AI Award`. Tracks must be `Rising Innovator` or `Advanced Innovator`. Booth letters must
agree with the category (`A`/`B`/`C`/`D` respectively).

The importer fails without overwriting the previous data on missing columns, unknown categories or
tracks, blank required fields, duplicate booths, and booth/category mismatches. It warns on team
names that contain no Thai text.

## Checks

```bash
npm run lint
npm run build
```
