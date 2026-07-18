import { useEffect, useState } from 'react';
import { TEAMS, type Category, type Track } from './data';
import importedAwards from './generated/awards.json';
import {
  entryFromTeam,
  groupAwards,
  medalFromRank,
  type AwardEntry,
  type AwardGroup,
  type Medal,
} from './awards';

/**
 * The live judge-scoring dashboard's Apps Script Web App. Override per deployment
 * with VITE_AWARDS_API_URL; the fallback is the summit's public endpoint so the
 * tab works out of the box. See .env.example.
 */
const AWARDS_API_URL =
  (import.meta.env.VITE_AWARDS_API_URL as string | undefined)?.trim() ||
  'https://script.google.com/macros/s/AKfycbw8svzfsfuuj3CuToh52xRYC6gLTl0f6CzyJ2otziD-ungd68xwUZOLOVtMHfYnq_7C/exec';

/** Booth is the join key — it is stable even if a category label is ever reworded. */
const teamByBooth = new Map(TEAMS.map((team) => [team.booth.toUpperCase(), team]));

// ─── Backup source: the Excel-imported awards.json ──────────────────────────
// Shape written by scripts/import-awards.ts: only booth + medal. Everything else
// for display (category, track, names) is read from TEAMS, matched on booth.
type ImportedAward = { booth: string; medal: Medal };

export function getBackupAwards(): AwardGroup[] {
  const entries: AwardEntry[] = [];
  for (const award of importedAwards as ImportedAward[]) {
    const team = teamByBooth.get(String(award.booth).toUpperCase());
    if (!team) continue; // Can't place a booth we don't know — importer already warns.
    entries.push(entryFromTeam(team, award.medal));
  }
  return groupAwards(entries);
}

/** Whether the backup sheet has been imported yet (results_2.xlsx → awards.json). */
export const hasBackupAwards = (importedAwards as ImportedAward[]).length > 0;

// ─── Live source: the Apps Script summary ───────────────────────────────────
type ApiRow = {
  category: string;
  track: string;
  booth: string;
  project: string;
  rank: string | number;
  final: number | null;
};

export type LiveAwards =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; groups: AwardGroup[]; updatedAt: string | null; awardedCount: number };

/**
 * Fetch and shape the live awards. Only `rows[]` is read — the judges[] array
 * (real names, on an unauthenticated endpoint) is deliberately never touched, so
 * no PII reaches the public page. Polls every `pollMs`; pass 0 to fetch once.
 */
export function useLiveAwards(pollMs = 60000): LiveAwards & { reload: () => void } {
  const [state, setState] = useState<LiveAwards>({ status: 'loading' });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`${AWARDS_API_URL}?action=getExhibitionSummary`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!json?.success) throw new Error(json?.error || 'The scoring service returned an error.');

        const rows: ApiRow[] = json.data?.rows ?? [];
        const entries: AwardEntry[] = [];
        for (const row of rows) {
          const rank = Number(row.rank);
          const medal = Number.isFinite(rank) ? medalFromRank(rank) : null;
          if (!medal) continue; // Not in the awarded top 5 (or not yet ranked).

          const team = teamByBooth.get(String(row.booth).toUpperCase());
          const extra = { final: typeof row.final === 'number' ? row.final : null, rank };
          if (team) {
            entries.push(entryFromTeam(team, medal, extra));
          } else {
            // Booth not in our roster: fall back to the endpoint's own fields.
            entries.push({
              booth: row.booth,
              medal,
              category: row.category as Category,
              track: row.track as Track,
              projectName: row.project ?? '',
              teamName: null,
              teamLeader: null,
              ...extra,
            });
          }
        }

        if (cancelled) return;
        setState({
          status: 'ready',
          groups: groupAwards(entries),
          updatedAt: json.data?.updatedAt ?? null,
          awardedCount: entries.length,
        });
      } catch (error) {
        if (cancelled) return;
        setState({ status: 'error', message: error instanceof Error ? error.message : String(error) });
      }
    }

    load();
    const timer = pollMs > 0 ? window.setInterval(load, pollMs) : undefined;
    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, [pollMs, nonce]);

  return { ...state, reload: () => setNonce((n) => n + 1) };
}
