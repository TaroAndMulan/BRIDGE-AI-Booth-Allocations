export type PdfDocument = {
  /** Served from public/. BASE_URL keeps it correct if the site moves to a subpath. */
  url: string;
  /** What the browser saves it as. */
  filename: string;
  /** Read off the file at build time; never hand-written. */
  size: string;
  pages: number;
};

/** What a qualifying team has to do next: deadlines, poster spec, schedule. */
export const MANUAL: PdfDocument = {
  url: `${import.meta.env.BASE_URL}manual.pdf`,
  filename: 'BRIDGE-AI-Summit-2026-Exhibition-Manual.pdf',
  size: __MANUAL_SIZE__,
  pages: __MANUAL_PAGES__,
};

/** The official announcement — the printable form of the table on this page. */
export const TEAM_LIST: PdfDocument = {
  url: `${import.meta.env.BASE_URL}team-list.pdf`,
  filename: 'BRIDGE-AI-Summit-2026-Qualifying-Teams.pdf',
  size: __TEAM_LIST_SIZE__,
  pages: __TEAM_LIST_PAGES__,
};
