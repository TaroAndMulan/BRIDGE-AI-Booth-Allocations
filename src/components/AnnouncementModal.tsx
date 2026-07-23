import { useEffect, useRef, useState } from 'react';
import { Award, X } from 'lucide-react';

/**
 * A one-time announcement shown over the team list. It remembers dismissal in
 * localStorage keyed by version, so it appears once per visitor — bump
 * ANNOUNCEMENT_VERSION to re-announce something new to everyone.
 */
const ANNOUNCEMENT_VERSION = 'certificates-2026';
const STORAGE_KEY = 'bridge-announcement-dismissed';

function alreadyDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === ANNOUNCEMENT_VERSION;
  } catch {
    return false; // Private mode blocks storage; showing it once is harmless.
  }
}

export default function AnnouncementModal() {
  const [open, setOpen] = useState(() => !alreadyDismissed());
  const closeRef = useRef<HTMLButtonElement>(null);

  const dismiss = () => {
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, ANNOUNCEMENT_VERSION);
    } catch {
      /* Storage blocked — the modal simply reappears next visit. */
    }
  };

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
          <strong>Certificate</strong> column in the list below.
        </p>

        <button type="button" className="announce-cta" onClick={dismiss}>
          รับทราบ · Got it
        </button>
      </div>
    </div>
  );
}
