# Data Model & Source of Truth

This document describes `data/results.xlsx`, the workbook that drives the Booth Allocations site,
and how it becomes the data the public sees.

## What the site is for

Teams that passed the entrance qualification round of the BRIDGE-AI Summit 2026 hackathon look up
their **booth number**. A team searches by team name, project name, team leader, or booth number.

**Presence in this dataset means the team qualified.** There is no "rejected" list and no pass/fail
column — a team that finds itself on the site has advanced. This is why the workbook must never be
published as-is: it also carries reviewer scores that would let anyone rank the qualifiers.

## Source of truth

`data/results.xlsx` — a two-sheet workbook.

| Sheet | Name | Contents |
| --- | --- | --- |
| 1 | `ผู้เข้ารอบ` (qualifiers) | One row per qualifying team. **This is the sheet the importer reads.** |
| 2 | `สรุป` (summary) | Human-written counts and a caveat note. Not read by any code. |

The workbook lives in `data/`, **not** `public/`. Anything in `public/` is copied verbatim into
`dist/` and served at the site root, which would have exposed reviewer scores, institutions, and
application IDs at `https://<site>/results.xlsx`.

## Sheet 1 columns

Twelve columns. Only six are read; the rest never enter the JavaScript bundle.

| Col | Header | Meaning | Published? |
| --- | --- | --- | --- |
| A | `รวม` | Row-count helper. Only the header row and a trailing totals row (`90`) are filled. | No |
| B | `เลขบูธ` | Booth number, e.g. `BAI-A01`. **The value applicants come for.** | **Yes** |
| C | `สาขา` | Award category, one of four. | **Yes** |
| D | `Track` | `Rising Innovator` or `Advanced Innovator`. | **Yes** |
| E | `ประเภท (ไม่ต้องบอก)` | `ผ่านการแข่ง` / `การันตี ป.โท`. Header says *do not disclose*. | No |
| F | `Application ID` | e.g. `BAI26-G1-MED-002`. Internal; applicants neither know nor need it. | No |
| G | `ชื่อทีม` | Team name. Thai, frequently with embedded English. | **Yes** |
| H | `ชื่อโครงการ` | Project title in English. | **Yes** |
| I | `หัวหน้าทีม` | Team leader's full name. | **Yes** |
| J | `สถาบัน (ไม่ต้องบอก)` | Institution. Header says *do not disclose*. | No |
| K | `คะแนนเฉลี่ย (เต็ม 30)` | Average reviewer score out of 30. Confidential. | No |
| L | `จำนวนกรรมการ` | Number of reviewers who scored the entry. Confidential. | No |

Two headers say `(ไม่ต้องบอก)` — "no need to tell" — outright. Scores and application IDs are
withheld on the same reasoning. The importer reads columns B, C, D, G, H, I and nothing else, so
the private columns cannot reach the browser even by accident.

## Taxonomy

Four award categories, each split into two tracks. **90 teams total.**

| Category | Booth prefix | Rising | Advanced | Total | Booth range |
| --- | --- | --- | --- | --- | --- |
| Medical Education Award | `BAI-A` | 5 | 4 | 9 | `BAI-A01` – `BAI-A09` |
| Clinical Award | `BAI-B` | 10 | 5 | 15 | `BAI-B01` – `BAI-B15` |
| Digital Technology Award | `BAI-C` | 15 | 22 | 37 | `BAI-C01` – `BAI-C37` |
| Medical AI Award | `BAI-D` | 15 | 14 | 29 | `BAI-D01` – `BAI-D29` |
| **Total** | | **45** | **45** | **90** | |

These counts were verified against sheet 2's own summary table; they agree exactly.

### Booth numbering

Booths are `BAI-<letter><two digits>`. The letter is fully determined by the category:
`A` = Medical Education, `B` = Clinical, `C` = Digital Technology, `D` = Medical AI.

Numbering is contiguous within each letter (no gaps, no duplicates), and **Rising Innovator teams
are numbered first, then Advanced Innovator** — e.g. `BAI-A01`–`A05` are Rising, `A06`–`A09` are
Advanced. The importer enforces the letter/category agreement and fails the build on a mismatch,
which catches a whole class of copy-paste error in the spreadsheet.

### Tracks vs. the private `ประเภท` column

The two are nearly, but not exactly, the same thing:

- All 45 Rising Innovator teams are `ผ่านการแข่ง` (qualified by competing).
- Of the 45 Advanced Innovator teams, 39 are `การันตี ป.โท` (guaranteed master's-programme entry)
  and 6 are `ผ่านการแข่ง`.

Track is public; `ประเภท` is not. Do not derive one from the other in user-facing copy.

## Data quality findings

Checked across all 90 rows. Nothing blocks the import, but these are worth fixing at the source.

1. **Every required field is populated.** No empty booths, categories, tracks, team names, project
   names, or leaders. All 90 booth numbers and all 90 application IDs are unique.
2. **Two team names contain no Thai text.** `BAI-B11` reads `"Please see English title"` — a
   placeholder that will be displayed to the public as-is. `BAI-D29`'s team name is an English
   sentence (`"SkinLens AI: A Hybrid Deployment Architecture…"`) that differs from its own project
   title. The importer prints a warning for both.
3. **One application ID contradicts its category.** `BAI-C32` sits in *Digital Technology Award*
   but carries `BAI26-G2-MAI-007` (the `MAI` = Medical AI prefix). Harmless today because the ID is
   never published, but it suggests a category was changed after the ID was issued.
4. **Three teams have no score yet** (`-` in both `คะแนนเฉลี่ย` and `จำนวนกรรมการ`). Reviewer counts
   elsewhere range from 1 to 5, so scores are averaged over an uneven number of reviewers.
5. **Team-leader names are inconsistently spaced and titled.** 31 begin `นาย`, 28 `นางสาว`, plus
   `นพ.`, `พญ.`, `น.ส.`, `Mr.`, `Ms.`, and 17 with no title at all. About 20 put a space after the
   title (`นาย เอกธนา`) and the rest do not (`นายปองคุณ`). Search normalizes whitespace away so both
   spellings are findable either way.
6. **Free-text fields are long.** The longest team name and project title are both ~330 characters.
   The table clamps them to two lines.

Sheet 2 carries this caveat, which is the most important operational fact in the workbook:

> ⚠ คะแนนบางสาขายังให้ไม่ครบ — รายชื่อ "ผ่านการแข่ง" และเลขบูธอาจเปลี่ยนได้จนกว่ากรรมการจะลงครบ

*Some categories are not fully scored — the qualifier list and booth numbers may change until all
reviewers have submitted.* **Treat the current booth numbers as provisional.**

## Pipeline

```
data/results.xlsx  ──npm run import:excel──>  src/generated/teams.json  ──vite build──>  dist/
   12 columns                                      7 public fields                    no workbook
```

`npm run import:excel` reads sheet 1, validates it, and writes `src/generated/teams.json`. Each
record is exactly:

```json
{
  "id": "bai-a01",
  "booth": "BAI-A01",
  "category": "Medical Education Award",
  "track": "Rising Innovator",
  "teamName": "V-SCENE: จำลองกรณีศึกษาเสมือนจริงเฉพาะบุคคลด้วย AI ในห้องเรียนกลับด้าน",
  "projectName": "V-SCENE: Personalized AI-Driven Flipped Classroom for Cased-Based Learning",
  "teamLeader": "นาย เอกธนา อาศิรวาท"
}
```

The import **fails loudly** — leaving the previously generated JSON untouched — on a missing column,
an unknown category or track, a blank required field, a duplicate booth, or a booth letter that
disagrees with its category. It only *warns* on a non-Thai team name. The trailing `รวม` totals row
is skipped, as is any row blank across all six required columns.

`npm run build` runs `scripts/validate-data-source.ts` first, so a build with `VITE_DATA_SOURCE=excel`
and an empty `teams.json` fails before Vite starts.

## What is safe to publish

`public/` is copied verbatim into `dist/` and served at the site root. Two files live there by
intent, both checked for the same private columns as the workbook — neither contains scores,
application IDs, or institutions:

- `team-list.pdf` — the official announcement of the 90 qualifying teams, booth by booth. The
  printable form of the table on this page. Copied verbatim; it is a text PDF and re-encoding it
  makes it *larger*.
- `manual.pdf` — the exhibition preparation guide. Deadlines, poster spec, on-site schedule. A
  2.1 MB re-encode of a 13 MB image-heavy master.

Both are rendered by the same `DocumentCard`, stacked below the page intro in that order.

Nothing else. The workbook and both source PDFs stay in `data/`, which is gitignored and never
served.

Each download's size and page count are read off the file in `vite.config.ts` at build time, so
replacing a PDF updates its label with no code change.

The rows are not clickable and there is no detail view — every public field is already in the table.

## Table behaviour

By default rows are ordered by category, then Rising Innovator before Advanced Innovator, then booth
number. The current workbook already numbers booths that way, so the sort is a no-op against today's
data — it exists so a future sheet that numbers booths differently cannot silently reorder the table.

Every column header sorts. Clicking cycles ascending → descending → back to the default order. Two
columns deliberately do not sort alphabetically: **Category** follows award order A–D, and **Track**
puts Rising before Advanced (alphabetical order would reverse it). **Team Leader** sorts on the name
with its title stripped, since sorting the raw column would just group every `นาย` together; team
names and leaders both use Thai collation. The default order is the tiebreaker for every column, so
ordering is total and never depends on the workbook's row order.

There is no track filter. Sorting by Track groups the two tracks, which is what a filter would have
achieved.

At 860px and below the table becomes a list of cards — a five-column table would otherwise need
horizontal scrolling, which a booth lookup should never require. The sortable headers are hidden
there, so a "Sort by" select carries the same options.

Category is a filter, not a destination: the whole site is one page, so the chips live in the
toolbar at every width. The nav holds only the brand.

Long names wrap rather than truncate. The longest team name is ~330 characters, and with no detail
view a clamped name would be unreadable anywhere.

The Category column is dropped when a category filter is active, since every row would then repeat
it. The chips above the table already show which category is selected.

## Search behaviour

Users search one combined box, scoped by the selected category and track. Matching happens in two
passes: exact substring matches first, then fuzzy matches appended.

- **Booth** — literal only. Punctuation and spaces are stripped, so `A01`, `bai a01`, and `BAI-A01`
  all find `BAI-A01`. A query with no letters or digits never matches a booth.
- **Team name, project name, team leader** — literal substring, then fuzzy (Fuse.js, threshold
  0.35) to absorb typos like `fliped classrom`.

Whitespace is removed from both the query and the stored value before comparison. Thai is written
without spaces between words, and the leader column is inconsistent about the space after `นาย`, so
this makes `นายเอกธนา` and `นาย เอกธนา` equivalent in both directions.

## Updating the data

1. Replace `data/results.xlsx`. Keep the Thai headers on sheet 1; column order does not matter.
2. Run `npm run import:excel` and read the warnings.
3. Check the printed per-category counts against sheet 2.
4. `npm run build`.

Never move the workbook into `public/`.
