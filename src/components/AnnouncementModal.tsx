import { useEffect, useRef, useState } from 'react';
import { Award, X } from 'lucide-react';

/**
 * An announcement shown over the team list. It appears at most once per browser
 * session, for up to MAX_SHOWS separate visits, then stops — so a returning
 * visitor is reminded a few times without being nagged on every page load or
 * tab switch. Counting is per version: bump ANNOUNCEMENT_VERSION to re-announce
 * to everyone with a fresh count.
 */
const ANNOUNCEMENT_VERSION = 'certificates-2026-2';
const MAX_SHOWS = 5;
const COUNT_KEY = `bridge-announcement-shows:${ANNOUNCEMENT_VERSION}`;
const SESSION_KEY = `bridge-announcement-seen:${ANNOUNCEMENT_VERSION}`;

/**
 * Decide whether to show the announcement now and, if so, record the view.
 * Returns true at most once per session and no more than MAX_SHOWS times total.
 */
function shouldShowAndRecord(): boolean {
  try {
    // Already shown in this tab session (e.g. after switching tabs) — don't repeat.
    if (sessionStorage.getItem(SESSION_KEY)) return false;
    const shown = Number(localStorage.getItem(COUNT_KEY)) || 0;
    if (shown >= MAX_SHOWS) return false;
    sessionStorage.setItem(SESSION_KEY, '1');
    localStorage.setItem(COUNT_KEY, String(shown + 1));
    return true;
  } catch {
    return true; // Storage blocked — show it; it just won't be counted.
  }
}

export default function AnnouncementModal() {
  const [open, setOpen] = useState(false);
  const recorded = useRef(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Decide once on mount. The ref guards against React 18 StrictMode's
  // double-invoked effects in dev, so a single visit is counted once.
  useEffect(() => {
    if (recorded.current) return;
    recorded.current = true;
    if (shouldShowAndRecord()) setOpen(true);
  }, []);

  const dismiss = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="announce-overlay"
      onClick={dismiss}
      role="dialog"
      aria-modal="true"
      aria-labelledby="announce-title"
    >
      {/* Clicks inside the card must not fall through to the backdrop's dismiss. */}
      <div className="announce-card" onClick={(event) => event.stopPropagation()}>
        <button
          ref={closeRef}
          type="button"
          className="announce-close"
          onClick={dismiss}
          aria-label="Close announcement"
        >
          <X size={18} aria-hidden />
        </button>

        <span className="announce-badge" aria-hidden>
          <Award size={28} />
        </span>

        <p className="announce-eyebrow">ประกาศ · Announcement</p>
        <h2 id="announce-title" className="announce-title">
          ใบประกาศนียบัตรพร้อมให้ดาวน์โหลดแล้ว 🎉
        </h2>
        <p className="announce-body">
          Certificates are now available. Download your team's official BRIDGE
          AI&nbsp;Summit&nbsp;2026 certificate from the{' '}
          <strong>Certificate</strong> column in the list below. Award winners can
          also download their medal, Grand&nbsp;Prize, or Popular&nbsp;Award
          certificate from the <strong>Awards</strong> tab.
        </p>

        <button type="button" className="announce-cta" onClick={dismiss}>
          รับทราบ · Got it
        </button>
      </div>
    </div>
  );
}
