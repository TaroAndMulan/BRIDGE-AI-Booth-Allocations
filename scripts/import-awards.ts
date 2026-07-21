import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSheet, type CellValue } from 'read-excel-file/node';

/**
 * Backup award importer. Reads results_2.xlsx — the exact same sheet as
 * results.xlsx plus one extra `award` column — and writes src/generated/awards.json
 * ([{ booth, medal }]). It is the offline fallback for the live Apps Script board.
 *
 * The `award` column is filled per category × track group: 1 = gold, 2 = silver,
 * 3 = bronze, and 4 or higher = an honorable mention. Usually that's 4 & 5, but a
 * group can carry an extra one (6, and so on) whenever the judges award more. Blank
 * = no award. Text labels ("gold", "honorable", "ชมเชย", …) are accepted too and
 * normalized to the same medal, so a human filling the sheet live can't get it wrong.
 */
type Medal = 'gold' | 'silver' | 'bronze' | 'honorable';

const MEDAL_FROM_RANK: Record<number, Medal> = { 1: 'gold', 2: 'silver', 3: 'bronze' };

const MEDAL_FROM_TEXT: Record<string, Medal> = {
  gold: 'gold', g: 'gold', 'gold medal': 'gold', ทอง: 'gold', เหรียญทอง: 'gold',
  silver: 'silver', s: 'silver', 'silver medal': 'silver', เงิน: 'silver', เหรียญเงิน: 'silver',
  bronze: 'bronze', b: 'bronze', 'bronze medal': 'bronze', ทองแดง: 'bronze', เหรียญทองแดง: 'bronze',
  honorable: 'honorable', 'honorable mention': 'honorable', hm: 'honorable', h: 'honorable',
  honourable: 'honorable', consolation: 'honorable', ชมเชย: 'honorable',
};

type ColumnKey = 'booth' | 'award';

const COLUMN_ALIASES: Record<ColumnKey, string[]> = {
  booth: ['เลขบูธ', 'booth', 'booth number', 'booth no'],
  award: ['award', 'รางวัล', 'medal', 'rank', 'อันดับ', 'result'],
};

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inputPath = path.resolve(repositoryRoot, process.argv[2] ?? 'data/results_2.xlsx');
const outputPath = path.resolve(repositoryRoot, 'src/generated/awards.json');

function text(value: CellValue | undefined): string {
  return value === null || value === undefined ? '' : String(value).trim();
}

function normalizeHeader(value: CellValue | undefined): string {
  return text(value)
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findColumns(header: CellValue[]): Record<ColumnKey, number> {
  const normalizedHeaders = header.map(normalizeHeader);
  const result = {} as Record<ColumnKey, number>;
  const missing: string[] = [];

  for (const [key, aliases] of Object.entries(COLUMN_ALIASES) as [ColumnKey, string[]][]) {
    const index = normalizedHeaders.findIndex((headerName) => aliases.includes(headerName));
    if (index === -1) missing.push(aliases[0]);
    else result[key] = index;
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required column${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}. ` +
        'results_2.xlsx must have the booth column plus an "award" column (1-3, 4+ for honorable, or a medal name).',
    );
  }

  return result;
}

/** A cell → medal, accepting an integer rank (1-3 = medals, 4+ = honorable) or a
 *  text label. Blank = no award; 0 or negative is not a valid rank. */
function parseAward(value: string): Medal | null {
  if (value === '') return null;
  const asNumber = Number(value);
  if (Number.isInteger(asNumber)) {
    if (asNumber >= 4) return 'honorable'; // 4, 5, 6, … are all honorable mentions
    return MEDAL_FROM_RANK[asNumber] ?? null; // 1-3 are the single medals; 0/negative invalid
  }
  return MEDAL_FROM_TEXT[value.toLowerCase().replace(/\s+/g, ' ').trim()] ?? null;
}

function parseAwards(rows: CellValue[][]): { awards: { booth: string; medal: Medal }[]; warnings: string[] } {
  if (rows.length === 0) throw new Error('The first worksheet is empty.');

  const columns = findColumns(rows[0]);
  const awards: { booth: string; medal: Medal }[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  rows.slice(1).forEach((row, rowIndex) => {
    const spreadsheetRow = rowIndex + 2;
    const booth = text(row[columns.booth]).toUpperCase().replace(/\s+/g, '');
    const rawAward = text(row[columns.award]);
    if (!booth && !rawAward) return; // spacer / totals row

    const medal = parseAward(rawAward);
    if (rawAward !== '' && medal === null) {
      errors.push(`Row ${spreadsheetRow}: award "${rawAward}" is not a rank (1, 2, 3, or 4+ for honorable) or a medal name.`);
      return;
    }
    if (medal === null) return; // booth present but no award — simply not a winner

    if (!booth) {
      errors.push(`Row ${spreadsheetRow}: an award is set but เลขบูธ (booth) is blank.`);
      return;
    }
    if (seen.has(booth)) {
      errors.push(`Row ${spreadsheetRow}: booth ${booth} appears more than once.`);
      return;
    }
    seen.add(booth);
    awards.push({ booth, medal });
  });

  if (errors.length > 0) throw new Error(`Awards import failed:\n- ${errors.join('\n- ')}`);

  return { awards, warnings };
}

async function main() {
  let rows: CellValue[][];
  try {
    rows = await readSheet(inputPath);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not read ${path.relative(repositoryRoot, inputPath)}: ${reason}\n` +
        'Create results_2.xlsx (a copy of results.xlsx with an added "award" column) first.',
    );
  }

  const { awards, warnings } = parseAwards(rows);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(awards, null, 2)}\n`, 'utf8');

  for (const warning of warnings) console.warn(`Warning: ${warning}`);

  const byMedal = new Map<Medal, number>();
  for (const award of awards) byMedal.set(award.medal, (byMedal.get(award.medal) ?? 0) + 1);

  console.log(`Imported ${awards.length} awards from ${path.relative(repositoryRoot, inputPath)}.`);
  for (const [medal, count] of byMedal) console.log(`  ${medal}: ${count}`);
  console.log(`Generated ${path.relative(repositoryRoot, outputPath)}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
