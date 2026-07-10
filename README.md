# Booth Allocation Search

A static React site where BRIDGE-AI Summit 2026 hackathon teams look up their booth number. Teams
search by team name, project name, team leader, or booth number, scoped by award category and track.
A team's presence in the results means it passed the entrance qualification round.

There is no database or backend. The booth list is baked into the bundle at build time from an Excel
workbook.

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
count out of each PDF at build time and injects them as `__MANUAL_SIZE__`, `__MANUAL_PAGES__`,
`__TEAM_LIST_SIZE__`, and `__TEAM_LIST_PAGES__`, so replacing a file updates its label automatically.

### Replacing the team list

Copy it straight in — it is a text PDF, and re-encoding makes it larger:

```bash
cp data/team_list.pdf public/team-list.pdf
```

### Replacing the manual

Drop the new PDF in `data/manual.pdf` and re-encode it into `public/`:

```bash
gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.5 -dPDFSETTINGS=/printer \
   -dNOPAUSE -dQUIET -dBATCH -sOutputFile=public/manual.pdf data/manual.pdf
```

The manual is image-heavy: this cuts 13.1 MB to 2.1 MB with no visible loss and identical selectable
text. Only the re-encoded copy is committed; `data/manual.pdf` is gitignored as the print master.
Do not skip this step — PDFs are already internally compressed, so gzip on the server saves nothing
and users would download the full file.

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
