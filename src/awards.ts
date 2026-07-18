import { CATEGORIES, TRACKS, type Category, type Track, type Team } from './data';

/**
 * The five awarded places in every category × track group: gold, silver, bronze,
 * and two honorable mentions (ranks 4 and 5). Both the live Apps Script source and
 * the Excel backup collapse onto this single type via `medalFromRank`, so the board
 * renders identically no matter where the ranking came from.
 */
export type Medal = 'gold' | 'silver' | 'bronze' | 'honorable';

export const MEDAL_META: Record<Medal, { label: string; thai: string; emoji: string; order: number }> = {
  gold: { label: 'Gold Medal', thai: 'เหรียญทอง', emoji: '🥇', order: 0 },
  silver: { label: 'Silver Medal', thai: 'เหรียญเงิน', emoji: '🥈', order: 1 },
  bronze: { label: 'Bronze Medal', thai: 'เหรียญทองแดง', emoji: '🥉', order: 2 },
  honorable: { label: 'Honorable Mention', thai: 'ชมเชย', emoji: '🏅', order: 3 },
};

/**
 * Rank within a category × track group → medal. Ranks 1-3 are the single medals;
 * 4 and 5 are the two honorable mentions. Rank 6+ (or 0/blank) is not awarded.
 * This is the one mapping shared by both data sources.
 */
export function medalFromRank(rank: number): Medal | null {
  switch (rank) {
    case 1:
      return 'gold';
    case 2:
      return 'silver';
    case 3:
      return 'bronze';
    case 4:
    case 5:
      return 'honorable';
    default:
      return null;
  }
}

export type AwardEntry = {
  booth: string;
  medal: Medal;
  category: Category;
  track: Track;
  /** Display text, preferring our own richer data over the source's. */
  projectName: string;
  teamName: string | null;
  teamLeader: string | null;
  /** Weighted total, live source only (null on the Excel backup). */
  final: number | null;
  /** Original 1-5 rank when known; orders the two honorable mentions. */
  rank: number | null;
};

export type AwardGroup = {
  category: Category;
  track: Track;
  entries: AwardEntry[];
};

const CATEGORY_ORDER = Object.values(CATEGORIES);
const TRACK_ORDER = Object.values(TRACKS);

/**
 * Bucket entries into the 8 category × track groups, in the canonical A→D /
 * Rising→Advanced order, each sorted gold → honorable. Empty groups are dropped so
 * the board only shows what has been awarded.
 */
export function groupAwards(entries: AwardEntry[]): AwardGroup[] {
  const groups: AwardGroup[] = [];
  for (const category of CATEGORY_ORDER) {
    for (const track of TRACK_ORDER) {
      const inGroup = entries
        .filter((e) => e.category === category && e.track === track)
        .sort((a, b) => {
          const byMedal = MEDAL_META[a.medal].order - MEDAL_META[b.medal].order;
          if (byMedal !== 0) return byMedal;
          // Tie only happens between the two honorable mentions: keep 4 before 5,
          // or fall back to the higher score.
          if (a.rank != null && b.rank != null) return a.rank - b.rank;
          if (a.final != null && b.final != null) return b.final - a.final;
          return 0;
        });
      if (inGroup.length) groups.push({ category, track, entries: inGroup });
    }
  }
  return groups;
}

/** Build a display entry from a matched team plus a decided medal. */
export function entryFromTeam(
  team: Team,
  medal: Medal,
  extra: { final?: number | null; rank?: number | null } = {},
): AwardEntry {
  return {
    booth: team.booth,
    medal,
    category: team.category,
    track: team.track,
    projectName: team.projectName,
    teamName: team.teamName,
    teamLeader: team.teamLeader,
    final: extra.final ?? null,
    rank: extra.rank ?? null,
  };
}
