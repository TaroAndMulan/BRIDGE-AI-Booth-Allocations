import { CATEGORIES, TRACKS, type Category, type Track, type Team } from './data';

/**
 * The five awarded places in every category × track group: gold, silver, bronze,
 * and two honorable mentions (ranks 4 and 5). Both the live Apps Script source and
 * the Excel backup collapse onto this single type via `medalFromRank`, so the board
 * renders identically no matter where the ranking came from.
 */
export type Medal = 'gold' | 'silver' | 'bronze' | 'honorable';

export const MEDAL_META: Record<Medal, { label: string; short: string; thai: string; emoji: string; order: number }> = {
  gold: { label: 'Gold Medal', short: 'Gold', thai: 'เหรียญทอง', emoji: '🥇', order: 0 },
  silver: { label: 'Silver Medal', short: 'Silver', thai: 'เหรียญเงิน', emoji: '🥈', order: 1 },
  bronze: { label: 'Bronze Medal', short: 'Bronze', thai: 'เหรียญทองแดง', emoji: '🥉', order: 2 },
  honorable: { label: 'Honorable Mention', short: 'Honorable', thai: 'ชมเชย', emoji: '🏅', order: 3 },
};

/**
 * Cross-cutting prizes awarded once for the whole competition, on top of a team's
 * category × track medal: one Popular Award and two Grand Prizes. A team can hold
 * both a medal and one of these, so it lives alongside `medal`, not instead of it.
 */
export type SpecialAward = 'grand' | 'popular';

export const SPECIAL_META: Record<SpecialAward, { label: string; short: string; thai: string; emoji: string }> = {
  grand: { label: 'Grand Prize', short: 'Grand Prize', thai: 'รางวัลใหญ่', emoji: '🏆' },
  popular: { label: 'Popular Award', short: 'Popular', thai: 'ขวัญใจมหาชน', emoji: '⭐' },
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
  /** A cross-cutting prize (Grand Prize / Popular Award), when the team won one. */
  special: SpecialAward | null;
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
  extra: { final?: number | null; rank?: number | null; special?: SpecialAward | null } = {},
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
    special: extra.special ?? null,
  };
}
