import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSheet, type CellValue } from 'read-excel-file/node';

type Category = 'Medical Education Award' | 'Clinical Award' | 'Digital Technology Award' | 'Medical AI Award';
type Track = 'Rising Innovator' | 'Advanced Innovator';

type Team = {
  id: string;
  booth: string;
  category: Category;
  track: Track;
  teamName: string;
  projectName: string;
  teamLeader: string;
};

type ColumnKey = 'booth' | 'category' | 'track' | 'teamName' | 'projectName' | 'teamLeader';

/**
 * Only these six columns are read. The workbook also carries reviewer scores,
 * institutions, and application IDs, which must never reach the bundle.
 */
const COLUMN_ALIASES: Record<ColumnKey, string[]> = {
  booth: ['เลขบูธ', 'booth', 'booth number', 'booth no'],
  category: ['สาขา', 'category', 'award'],
  track: ['track', 'แทร็ก', 'ประเภทผู้สมัคร'],
  teamName: ['ชื่อทีม', 'team name', 'team'],
  projectName: ['ชื่อโครงการ', 'project name', 'project title', 'project'],
  teamLeader: ['หัวหน้าทีม', 'team leader', 'leader'],
};

const CATEGORY_NAMES: Record<string, Category> = {
  a: 'Medical Education Award',
  'medical education': 'Medical Education Award',
  'medical education award': 'Medical Education Award',
  b: 'Clinical Award',
  clinical: 'Clinical Award',
  'clinical award': 'Clinical Award',
  c: 'Digital Technology Award',
  'digital technology': 'Digital Technology Award',
  'digital technology award': 'Digital Technology Award',
  d: 'Medical AI Award',
  'medical ai': 'Medical AI Award',
  'medical ai award': 'Medical AI Award',
};

const TRACK_NAMES: Record<string, Track> = {
  'rising innovator': 'Rising Innovator',
  rising: 'Rising Innovator',
  'advanced innovator': 'Advanced Innovator',
  advanced: 'Advanced Innovator',
};

/** Booth letters encode the category, so the two columns cross-check each other. */
const CATEGORY_LETTERS: Record<Category, string> = {
  'Medical Education Award': 'A',
  'Clinical Award': 'B',
  'Digital Technology Award': 'C',
  'Medical AI Award': 'D',
};

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inputPath = path.resolve(repositoryRoot, process.argv[2] ?? 'data/results.xlsx');
const outputPath = path.resolve(repositoryRoot, 'src/generated/teams.json');

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
    if (index === -1) {
      missing.push(aliases[0]);
    } else {
      result[key] = index;
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required column${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}. ` +
      'Expected headers: เลขบูธ, สาขา, Track, ชื่อทีม, ชื่อโครงการ, หัวหน้าทีม.',
    );
  }

  return result;
}

function parseCategory(value: string): Category | undefined {
  return CATEGORY_NAMES[value.toLowerCase().replace(/\s+/g, ' ').trim()];
}

function parseTrack(value: string): Track | undefined {
  return TRACK_NAMES[value.toLowerCase().replace(/\s+/g, ' ').trim()];
}

function parseTeams(rows: CellValue[][]): { teams: Team[]; warnings: string[] } {
  if (rows.length === 0) throw new Error('The first worksheet is empty.');

  const columns = findColumns(rows[0]);
  const teams = new Map<string, Team>();
  const errors: string[] = [];
  const warnings: string[] = [];

  const requiredColumns = Object.values(columns);

  rows.slice(1).forEach((row, rowIndex) => {
    const spreadsheetRow = rowIndex + 2;
    // Skips spacer rows and the trailing "รวม" totals row, which only fills column A.
    if (requiredColumns.every((column) => text(row[column]) === '')) return;

    const booth = text(row[columns.booth]).toUpperCase().replace(/\s+/g, '');
    const categoryInput = text(row[columns.category]);
    const trackInput = text(row[columns.track]);
    const category = parseCategory(categoryInput);
    const track = parseTrack(trackInput);
    const teamName = text(row[columns.teamName]);
    const projectName = text(row[columns.projectName]);
    const teamLeader = text(row[columns.teamLeader]);

    if (!booth) errors.push(`Row ${spreadsheetRow}: เลขบูธ (booth) is required.`);
    if (!category) {
      errors.push(`Row ${spreadsheetRow}: สาขา "${categoryInput}" is not one of the four awards.`);
    }
    if (!track) {
      errors.push(`Row ${spreadsheetRow}: Track "${trackInput}" must be Rising Innovator or Advanced Innovator.`);
    }
    if (!teamName) errors.push(`Row ${spreadsheetRow}: ชื่อทีม (team name) is required.`);
    if (!projectName) errors.push(`Row ${spreadsheetRow}: ชื่อโครงการ (project name) is required.`);
    if (!teamLeader) errors.push(`Row ${spreadsheetRow}: หัวหน้าทีม (team leader) is required.`);

    if (!booth || !category || !track || !teamName || !projectName || !teamLeader) return;

    if (teams.has(booth)) {
      errors.push(`Row ${spreadsheetRow}: booth ${booth} is assigned more than once.`);
      return;
    }

    const boothLetter = booth.match(/^BAI-([A-D])\d+$/)?.[1];
    if (!boothLetter) {
      warnings.push(`Row ${spreadsheetRow}: booth "${booth}" does not match the BAI-<A-D><number> format.`);
    } else if (boothLetter !== CATEGORY_LETTERS[category]) {
      errors.push(
        `Row ${spreadsheetRow}: booth ${booth} starts with ${boothLetter}, but ${category} uses ${CATEGORY_LETTERS[category]}.`,
      );
      return;
    }

    if (!/[฀-๿]/.test(teamName)) {
      warnings.push(`Row ${spreadsheetRow}: ชื่อทีม "${teamName}" contains no Thai text — check for a placeholder.`);
    }

    teams.set(booth, {
      id: booth.toLowerCase(),
      booth,
      category,
      track,
      teamName,
      projectName,
      teamLeader,
    });
  });

  if (errors.length > 0) {
    throw new Error(`Excel import failed:\n- ${errors.join('\n- ')}`);
  }

  if (teams.size === 0) throw new Error('The worksheet contains no team rows.');

  const sorted = [...teams.values()].sort((a, b) =>
    a.booth.localeCompare(b.booth, undefined, { numeric: true, sensitivity: 'base' }),
  );

  return { teams: sorted, warnings };
}

async function main() {
  let rows: CellValue[][];

  try {
    rows = await readSheet(inputPath);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not read ${path.relative(repositoryRoot, inputPath)}: ${reason}`);
  }

  const { teams, warnings } = parseTeams(rows);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(teams, null, 2)}\n`, 'utf8');

  for (const warning of warnings) console.warn(`Warning: ${warning}`);

  const byCategory = new Map<Category, number>();
  for (const team of teams) byCategory.set(team.category, (byCategory.get(team.category) ?? 0) + 1);

  console.log(`Imported ${teams.length} teams from ${path.relative(repositoryRoot, inputPath)}.`);
  for (const [category, count] of byCategory) console.log(`  ${category}: ${count}`);
  console.log(`Generated ${path.relative(repositoryRoot, outputPath)}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
