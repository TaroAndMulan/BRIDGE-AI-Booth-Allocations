import certificates from './generated/certificates.json';

/**
 * { "bai-c26": "a1b2c3d4", … } — booth id to a short content hash, written by
 * scripts/import-certificates.ts. A team absent from this map has no certificate.
 */
const CERTIFICATES = certificates as Record<string, string>;

/**
 * The served URL for a team's certificate, or null if there isn't one.
 * BASE_URL keeps it correct if the site moves to a subpath; ?v= is the content
 * hash, so a replaced certificate busts the browser's cache of the stable URL.
 */
export function certificateUrl(teamId: string): string | null {
  const version = CERTIFICATES[teamId];
  if (!version) return null;
  return `${import.meta.env.BASE_URL}certificates/${teamId}.pdf?v=${version}`;
}

/** What the browser saves the download as, e.g. "Bridge-Certificate-BAI-A01.pdf". */
export function certificateFilename(booth: string): string {
  return `Bridge-Certificate-${booth}.pdf`;
}
