import { useMemo, useState, type ReactNode } from 'react';
import { Search, Award, RefreshCw, AlertTriangle, LayoutGrid, Activity, Stethoscope, MonitorSmartphone, BrainCircuit } from 'lucide-react';
import { CATEGORIES, CATEGORY_LETTER, TRACKS, categoryLabel, type Track } from '../data';
import { MEDAL_META, type AwardGroup } from '../awards';
import { getBackupAwards, hasBackupAwards, useLiveAwards } from '../awardsSource';

const CHIP_ITEMS = [
  { label: 'All', value: 'All', Icon: LayoutGrid },
  { label: categoryLabel(CATEGORIES.A), value: CATEGORIES.A, Icon: Activity },
  { label: categoryLabel(CATEGORIES.B), value: CATEGORIES.B, Icon: Stethoscope },
  { label: categoryLabel(CATEGORIES.C), value: CATEGORIES.C, Icon: MonitorSmartphone },
  { label: categoryLabel(CATEGORIES.D), value: CATEGORIES.D, Icon: BrainCircuit },
];

const TRACK_ITEMS = [
  { label: 'All tracks', value: 'All' },
  { label: TRACKS.RISING, value: TRACKS.RISING },
  { label: TRACKS.ADVANCED, value: TRACKS.ADVANCED },
];

type Props = { source: 'live' | 'backup' };

export default function AwardsView({ source }: Props) {
  return source === 'live' ? <LiveAwards /> : <BackupAwards />;
}

// ─── Live tab: streams from the Apps Script scoreboard ──────────────────────
function LiveAwards() {
  const live = useLiveAwards();

  const updated =
    live.status === 'ready' && live.updatedAt
      ? new Date(live.updatedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
      : null;

  return (
    <AwardsSection
      status={
        live.status === 'error' ? (
          <span className="awards-status is-error">
            <AlertTriangle size={15} aria-hidden /> Couldn’t reach the scoring service — {live.message}
            <button type="button" className="link-btn" onClick={live.reload}>Retry</button>
          </span>
        ) : (
          <span className="awards-status">
            <span className="live-dot" aria-hidden />
            {live.status === 'loading' ? 'Connecting…' : updated ? `Updated ${updated}` : 'Live'}
            {live.status === 'ready' && (
              <button type="button" className="link-btn" onClick={live.reload}>
                <RefreshCw size={13} aria-hidden /> Refresh
              </button>
            )}
          </span>
        )
      }
      groups={live.status === 'ready' ? live.groups : []}
      loading={live.status === 'loading'}
      emptyMessage="No awards have been announced yet. Winners will appear here as the judges complete their scoring."
    />
  );
}

// ─── Backup tab: reads the imported results_2.xlsx ──────────────────────────
function BackupAwards() {
  const groups = useMemo(() => getBackupAwards(), []);

  return (
    <AwardsSection
      status={
        <span className="awards-status is-backup">
          <Award size={15} aria-hidden /> Source: results_2.xlsx (manual backup)
        </span>
      }
      groups={groups}
      loading={false}
      emptyMessage={
        hasBackupAwards
          ? 'The backup sheet has no awards that match a known booth.'
          : 'No backup imported yet. Add an “award” column to results_2.xlsx (1-5 per group) and run “npm run import:awards”.'
      }
    />
  );
}

// ─── Shared section: header, filter toolbar, and the medal board ────────────
type SectionProps = {
  status: ReactNode;
  groups: AwardGroup[];
  loading: boolean;
  emptyMessage: string;
};

function AwardsSection({ status, groups, loading, emptyMessage }: SectionProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedTrack, setSelectedTrack] = useState<string>('All');

  const query = searchTerm.trim().toLowerCase();

  const visibleGroups = useMemo(() => {
    return groups
      .filter((g) => selectedCategory === 'All' || g.category === selectedCategory)
      .filter((g) => selectedTrack === 'All' || g.track === selectedTrack)
      .map((g) => ({
        ...g,
        entries: query
          ? g.entries.filter((e) =>
              [e.booth, e.projectName, e.teamName ?? '', e.teamLeader ?? '', MEDAL_META[e.medal].label]
                .join(' ')
                .toLowerCase()
                .includes(query),
            )
          : g.entries,
      }))
      .filter((g) => g.entries.length > 0);
  }, [groups, selectedCategory, selectedTrack, query]);

  // Nest the flat groups under their category so the board reads Category → Track,
  // not a loose grid where unrelated groups sit side by side.
  const categorySections = useMemo(
    () =>
      Object.values(CATEGORIES)
        .map((category) => ({
          category,
          letter: CATEGORY_LETTER[category],
          tracks: visibleGroups.filter((g) => g.category === category),
          count: visibleGroups
            .filter((g) => g.category === category)
            .reduce((n, g) => n + g.entries.length, 0),
        }))
        .filter((section) => section.tracks.length > 0),
    [visibleGroups],
  );

  const total = visibleGroups.reduce((n, g) => n + g.entries.length, 0);
  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('All');
    setSelectedTrack('All');
  };

  return (
    <>
      <div className="rule" />
      <h1 className="section-title">
        Award <span className="accent">Results</span>
      </h1>
      <p className="awards-status-line">{status}</p>

      <div className="booth-toolbar">
        <label className="search-field">
          <Search aria-hidden />
          <input
            className="search-input"
            type="text"
            placeholder="Search winners by team, project, leader, or booth…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search awards"
          />
        </label>

        <div className="toolbar-row">
          <span className="toolbar-label" id="awards-category-label">Category</span>
          <div className="toolbar-chips" role="group" aria-labelledby="awards-category-label">
            {CHIP_ITEMS.map(({ label, value, Icon }) => (
              <button
                key={value}
                type="button"
                className={`chip${selectedCategory === value ? ' active' : ''}`}
                aria-pressed={selectedCategory === value}
                onClick={() => setSelectedCategory(value)}
              >
                <Icon aria-hidden />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="toolbar-row">
          <span className="toolbar-label" id="awards-track-label">Track</span>
          <div className="toolbar-chips" role="group" aria-labelledby="awards-track-label">
            {TRACK_ITEMS.map(({ label, value }) => (
              <button
                key={value}
                type="button"
                className={`chip${selectedTrack === value ? ' active' : ''}`}
                aria-pressed={selectedTrack === value}
                onClick={() => setSelectedTrack(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">
          <RefreshCw size={30} className="spin" style={{ color: 'var(--line-strong)', margin: '0 auto 12px' }} aria-hidden />
          <p style={{ margin: 0 }}>Loading results…</p>
        </div>
      ) : visibleGroups.length === 0 ? (
        <div className="empty-state">
          <Award size={30} style={{ color: 'var(--line-strong)', margin: '0 auto 12px' }} aria-hidden />
          <p style={{ margin: '0 0 14px' }}>{query || selectedCategory !== 'All' || selectedTrack !== 'All' ? 'No winners match your filters.' : emptyMessage}</p>
          {(query || selectedCategory !== 'All' || selectedTrack !== 'All') && (
            <button type="button" className="link-btn" onClick={clearFilters}>Clear filters</button>
          )}
        </div>
      ) : (
        <>
          <div className="award-board">
            {categorySections.map((section) => (
              <section className="award-cat" data-cat={section.letter} key={section.category}>
                <header className="award-cat-head">
                  <span className="award-cat-badge" aria-hidden>{section.letter}</span>
                  <h2 className="award-cat-name">{categoryLabel(section.category)}</h2>
                  <span className="award-cat-count">{section.count} award{section.count !== 1 ? 's' : ''}</span>
                </header>
                <div className={`award-cat-tracks${section.tracks.length === 1 ? ' single' : ''}`}>
                  {section.tracks.map((group) => (
                    <div className="award-track" role="list" key={group.track}>
                      <div className="award-track-head">{trackShort(group.track)}</div>
                      {group.entries.map((entry) => (
                        <div className={`award-row medal-${entry.medal}`} role="listitem" key={`${entry.booth}-${entry.medal}-${entry.rank ?? ''}`}>
                          <span className="award-medal" title={MEDAL_META[entry.medal].label}>
                            <span className="award-medal-emoji" aria-hidden>{MEDAL_META[entry.medal].emoji}</span>
                            <span className="award-medal-label">{MEDAL_META[entry.medal].short}</span>
                          </span>
                          <span className="award-booth">{entry.booth}</span>
                          <span className="award-project">
                            <span className="award-project-name">{entry.projectName || 'To be announced'}</span>
                            {entry.teamLeader && <span className="award-leader">{entry.teamLeader}</span>}
                          </span>
                          {entry.final != null && (
                            <span className="award-score" title="Weighted total score">{entry.final.toFixed(1)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <p className="result-count">
            Showing {total} award{total !== 1 ? 's' : ''}
          </p>
        </>
      )}
    </>
  );
}

/** "Rising Innovator (…)" → "Rising Innovator" for the compact group header. */
function trackShort(track: Track): string {
  return track.split('(')[0].trim();
}
