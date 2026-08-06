import manifest from './generated/award-certificates.json';
import type { SpecialAward } from './awards';

/**
 * Written by scripts/import-award-certificates.ts:
 *   { "bai-c11": { medal: { type, version }, special: { award, version } }, … }
 * A winner may have a medal certificate, a special-award certificate, or both.
 */
type MedalCert = { type: string; version: string };
type SpecialCert = { award: SpecialAward; version: string };
type AwardCert = { medal?: MedalCert; special?: SpecialCert };

const AWARD_CERTIFICATES = manifest as Record<string, AwardCert>;

/** BASE_URL keeps subpaths correct; ?v= is the content hash, so a replaced PDF busts the cache. */
function url(file: string, version: string): string {
  return `${import.meta.env.BASE_URL}award-certificates/${file}?v=${version}`;
}

/** The team's medal (Gold/Silver/Bronze/Honorable) certificate, or null if there isn't one. */
export function medalCertificateUrl(teamId: string): string | null {
  const medal = AWARD_CERTIFICATES[teamId]?.medal;
  return medal ? url(`${teamId}.pdf`, medal.version) : null;
}

/** The team's Grand Prize / Popular Award certificate, or null. */
export function specialCertificateUrl(teamId: string): string | null {
  const special = AWARD_CERTIFICATES[teamId]?.special;
  return special ? url(`${teamId}-${special.award}.pdf`, special.version) : null;
}

/** Which special award (if any) the team won — the badge/filter source of truth. */
export function specialAwardOf(teamId: string): SpecialAward | null {
  return AWARD_CERTIFICATES[teamId]?.special?.award ?? null;
}

/** What the browser saves the download as, e.g. "Bridge-Award-BAI-C11-Grand-Prize.pdf". */
export function awardCertificateFilename(booth: string, label: string): string {
  return `Bridge-Award-${booth}-${label.replace(/\s+/g, '-')}.pdf`;
}
