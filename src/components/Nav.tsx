import { LayoutGrid, Award as AwardIcon } from 'lucide-react';
import type { Tab } from '../App';

const BASE = import.meta.env.BASE_URL;

// Logos served from public/ — the Google-Drive originals loaded unreliably.
const CHULA_LOGO = `${BASE}chula-logo.png`;
const BRIDGE_LOGO = `${BASE}bridge-ai-logo.png`;

type NavProps = {
  tab: Tab;
  onSelectTab: (tab: Tab) => void;
  showBackup: boolean;
};

/**
 * Fixed nav bar: brand (logos + summit wordmark) at the far-left edge, section
 * tabs at the far-right edge. No video — a plain, legible bar.
 */
export default function Nav({ tab, onSelectTab, showBackup }: NavProps) {
  return (
    <header className="site-nav">
      <div className="nav-inner">
        <a
          className="brand"
          href="#top"
          aria-label="BRIDGE-AI Summit 2026 — Exhibition Portal"
          onClick={(e) => {
            e.preventDefault();
            onSelectTab('booths');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <span className="brand-logos">
            <img className="brand-logo" src={CHULA_LOGO} alt="Faculty of Medicine, Chulalongkorn University" />
            <img className="brand-logo" src={BRIDGE_LOGO} alt="BRIDGE-AI Summit 2026" />
          </span>
          <span className="brand-divider" aria-hidden="true" />
          <span className="brand-text">
            <span className="brand-eyebrow">BRIDGE-AI Summit 2026</span>
            <span className="brand-title">Exhibition Portal</span>
          </span>
        </a>

        <nav className="nav-tabs" role="tablist" aria-label="Sections">
          <button
            type="button"
            role="tab"
            aria-label="Team List"
            aria-selected={tab === 'booths'}
            className={`nav-tab${tab === 'booths' ? ' active' : ''}`}
            onClick={() => onSelectTab('booths')}
          >
            <LayoutGrid aria-hidden />
            <span>Team List</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-label="Awards"
            aria-selected={tab === 'awards'}
            className={`nav-tab${tab === 'awards' ? ' active' : ''}`}
            onClick={() => onSelectTab('awards')}
          >
            <AwardIcon aria-hidden />
            <span>Awards</span>
          </button>
          {showBackup && (
            <button
              type="button"
              role="tab"
              aria-label="Awards backup"
              aria-selected={tab === 'backup'}
              className={`nav-tab${tab === 'backup' ? ' active' : ''}`}
              onClick={() => onSelectTab('backup')}
            >
              <AwardIcon aria-hidden />
              <span>Backup</span>
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
