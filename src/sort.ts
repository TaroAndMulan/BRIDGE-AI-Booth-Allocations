import { CATEGORY_LETTER, TRACKS, type Team, type Track } from './data';

export type SortKey = 'booth' | 'teamName' | 'teamLeader' | 'category' | 'track';
export type SortDirection = 'asc' | 'desc';
export type Sort = { key: SortKey; direction: SortDirection };

const TRACK_ORDER: Record<Track, number> = {
  [TRACKS.RISING]: 0,
  [TRACKS.ADVANCED]: 1,
};

/**
 * Longest first, so "นางสาว" is not consumed by "นาง" and "ศาสตราจารย์" not by "ศ.".
 * Leaders carry stacked titles like "ผศ.พญ.ดวงนภา", so stripping repeats until stable.
 */
const LEADER_TITLE = new RegExp(
  '^(?:'
  + [
    'ผู้ช่วยศาสตราจารย์', 'รองศาสตราจารย์', 'ศาสตราจารย์',
    'นางสาว', 'นาง', 'นาย', 'น\\.ส\\.', 'ด\\.ช\\.', 'ด\\.ญ\\.',
    'นศพ\\.', 'ผศ\\.', 'รศ\\.', 'ศ\\.', 'นพ\\.', 'พญ\\.', 'ดร\\.',
    'Mrs\\.', 'Mr\\.', 'Ms\\.', 'Miss', 'Dr\\.',
  ].join('|')
  + ')\\s*',
);

/** Sorting leaders by their raw name would just group every "นาย" together. */
function leaderSortKey(fullName: string): string {
  let name = fullName.trim();
  for (let previous = ''; name !== previous;) {
    previous = name;
    name = name.replace(LEADER_TITLE, '').trim();
  }
  return name || fullName.trim();
}

function boothNumber(booth: string): number {
  return Number(booth.replace(/^\D+/, '')) || 0;
}

/**
 * Category, then Rising Innovator before Advanced Innovator, then booth number.
 * Also the tiebreaker for every column sort, so ordering is always total.
 */
function compareDefault(a: Team, b: Team): number {
  return CATEGORY_LETTER[a.category].localeCompare(CATEGORY_LETTER[b.category])
    || TRACK_ORDER[a.track] - TRACK_ORDER[b.track]
    || boothNumber(a.booth) - boothNumber(b.booth);
}

const COMPARATORS: Record<SortKey, (a: Team, b: Team) => number> = {
  booth: (a, b) => a.booth.localeCompare(b.booth, undefined, { numeric: true }),
  // Thai collation, since team names and leaders are mostly Thai.
  teamName: (a, b) => a.teamName.localeCompare(b.teamName, 'th'),
  teamLeader: (a, b) => leaderSortKey(a.teamLeader).localeCompare(leaderSortKey(b.teamLeader), 'th'),
  // Award order A–D, not alphabetical.
  category: (a, b) => CATEGORY_LETTER[a.category].localeCompare(CATEGORY_LETTER[b.category]),
  // Rising before Advanced, which alphabetical order would reverse.
  track: (a, b) => TRACK_ORDER[a.track] - TRACK_ORDER[b.track],
};

export function sortTeams(teams: Team[], sort: Sort | null): Team[] {
  if (!sort) return [...teams].sort(compareDefault);

  const compare = COMPARATORS[sort.key];
  const sign = sort.direction === 'asc' ? 1 : -1;

  return [...teams].sort((a, b) => sign * compare(a, b) || compareDefault(a, b));
}

/** asc → desc → back to the default order. */
export function nextSort(current: Sort | null, key: SortKey): Sort | null {
  if (!current || current.key !== key) return { key, direction: 'asc' };
  return current.direction === 'asc' ? { key, direction: 'desc' } : null;
}
