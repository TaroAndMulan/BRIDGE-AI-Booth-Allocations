import Fuse from 'fuse.js';
import type { Team } from './data';

const FUZZY_SEARCH_OPTIONS = {
  keys: [
    { name: 'projectName', weight: 0.4 },
    { name: 'teamName', weight: 0.4 },
    { name: 'teamLeader', weight: 0.2 },
  ],
  threshold: 0.35,
  ignoreLocation: true,
  minMatchCharLength: 2,
};

/**
 * Thai text is written without spaces, and the leader column mixes "นายสมชาย"
 * with "นาย สมชาย". Dropping whitespace makes both spellings match either query.
 */
function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '');
}

/** Lets "A01", "bai a01", and "BAI-A01" all find booth BAI-A01. */
function normalizeBooth(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function hasLiteralMatch(team: Team, query: string): boolean {
  const normalizedQuery = normalize(query);
  const normalizedBoothQuery = normalizeBooth(query);

  // A Thai query normalizes to an empty booth string, and every booth "includes" that.
  const matchesBooth = normalizedBoothQuery.length > 0
    && normalizeBooth(team.booth).includes(normalizedBoothQuery);

  return matchesBooth
    || normalize(team.teamName).includes(normalizedQuery)
    || normalize(team.projectName).includes(normalizedQuery)
    || normalize(team.teamLeader).includes(normalizedQuery);
}

export function createTeamSearch(teams: Team[]) {
  const fuzzyIndex = new Fuse(teams, FUZZY_SEARCH_OPTIONS);

  return (searchTerm: string): Team[] => {
    const query = searchTerm.trim();
    if (!query) return teams;

    const literalMatches = teams.filter((team) => hasLiteralMatch(team, query));
    if (query.length < 2) return literalMatches;

    const seenTeamIds = new Set(literalMatches.map((team) => team.id));
    const fuzzyMatches = fuzzyIndex
      .search(query)
      .map((result) => result.item)
      .filter((team) => {
        if (seenTeamIds.has(team.id)) return false;
        seenTeamIds.add(team.id);
        return true;
      });

    return [...literalMatches, ...fuzzyMatches];
  };
}
