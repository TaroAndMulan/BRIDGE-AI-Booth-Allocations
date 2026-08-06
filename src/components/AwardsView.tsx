import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Search, Award, RefreshCw, AlertTriangle, LayoutGrid, Activity, Stethoscope, MonitorSmartphone, BrainCircuit, Download } from 'lucide-react';
import { CATEGORIES, CATEGORY_LETTER, TRACKS, categoryLabel, type Track } from '../data';
import { MEDAL_META, SPECIAL_META, type AwardGroup } from '../awards';
import { getBackupAwards, hasBackupAwards, useLiveAwards } from '../awardsSource';
import { medalCertificateUrl, specialCertificateUrl, awardCertificateFilename } from '../awardCertificates';

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

// The two cross-cutting prizes, shared across every category and track.
const SPECIAL_ITEMS = [
  { label: 'All awards', value: 'All' },
  { label: `${SPECIAL_META.grand.emoji} ${SPECIAL_META.grand.label}`, value: 'grand' },
  { label: `${SPECIAL_META.popular.emoji} ${SPECIAL_META.popular.label}`, value: 'popular' },
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

// ─── Awards board: reads the baked results_2 → awards.json ──────────────────
// This is the public Awards view. It renders instantly from the bundled JSON —
// no Apps Script round-trip. To publish real/final results: fill results_2.xlsx,
// run `npm run import:awards`, then rebuild + deploy.
function BackupAwards() {
  const groups = useMemo(() => getBackupAwards(), []);

  return (
    <AwardsSection
      status={null}
      groups={groups}
      loading={false}
      emptyMessage={
        hasBackupAwards
          ? 'No awards match a known booth yet.'
          : 'Awards have not been published yet. Winners will appear here once results are announced.'
      }
    />
  );
}

// ─── Shared section: header, filter toolbar, and the medal board ────────────
type SectionProps = {
  status: ReactNode | null;
  groups: AwardGroup[];
  loading: boolean;
  emptyMessage: string;
};

function AwardsSection({ status, groups, loading, emptyMessage }: SectionProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedTrack, setSelectedTrack] = useState<string>('All');
  const [selectedSpecial, setSelectedSpecial] = useState<string>('All');

  const query = searchTerm.trim().toLowerCase();

  const visibleGroups = useMemo(() => {
    return groups
      .filter((g) => selectedCategory === 'All' || g.category === selectedCategory)
      .filter((g) => selectedTrack === 'All' || g.track === selectedTrack)
      .map((g) => ({
        ...g,
        entries: g.entries.filter(
          (e) =>
            (selectedSpecial === 'All' || e.special === selectedSpecial) &&
            (!query ||
              [e.booth, e.projectName, e.teamName ?? '', e.teamLeader ?? '', MEDAL_META[e.medal].label,
                e.special ? SPECIAL_META[e.special].label : '']
                .join(' ')
                .toLowerCase()
                .includes(query)),
        ),
      }))
      .filter((g) => g.entries.length > 0);
  }, [groups, selectedCategory, selectedTrack, selectedSpecial, query]);

  // Nest the flat groups under their category so the board reads Category → Track,
  // not a loose grid where unrelated groups sit side by side.
  const categorySections = useMemo(
    () =>
      Object.values(CATEGORIES)
        .map((category) => ({
          category,
          letter: CATEGORY_LETTER[category],
          tracks: visibleGroups.filter((g) => g.category === category),
        }))
        .filter((section) => section.tracks.length > 0),
    [visibleGroups],
  );

  const total = visibleGroups.reduce((n, g) => n + g.entries.length, 0);

  // Fire the confetti exactly once — the first time the board actually has winners
  // to show — and never again on filtering, refresh, or reduced-motion setups.
  const [celebrate, setCelebrate] = useState(false);
  const celebratedRef = useRef(false);
  useEffect(() => {
    if (celebratedRef.current || loading || total === 0) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    celebratedRef.current = true;
    setCelebrate(true);
    const timer = window.setTimeout(() => setCelebrate(false), 8500);
    return () => window.clearTimeout(timer);
  }, [loading, total]);

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('All');
    setSelectedTrack('All');
    setSelectedSpecial('All');
  };

  const anyFilter = Boolean(query) || selectedCategory !== 'All' || selectedTrack !== 'All' || selectedSpecial !== 'All';

  return (
    <>
      {celebrate && <Confetti />}
      <div className="rule" />
      <h1 className="section-title">
        Award <span className="accent">Results</span>
      </h1>
      {status && <p className="awards-status-line">{status}</p>}

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

        <div className="toolbar-row">
          <span className="toolbar-label" id="awards-special-label">Special award</span>
          <div className="toolbar-chips" role="group" aria-labelledby="awards-special-label">
            {SPECIAL_ITEMS.map(({ label, value }) => (
              <button
                key={value}
                type="button"
                className={`chip${selectedSpecial === value ? ' active' : ''}`}
                aria-pressed={selectedSpecial === value}
                onClick={() => setSelectedSpecial(value)}
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
          <p style={{ margin: '0 0 14px' }}>{anyFilter ? 'No winners match your filters.' : emptyMessage}</p>
          {anyFilter && (
            <button type="button" className="link-btn" onClick={clearFilters}>Clear filters</button>
          )}
        </div>
      ) : (
        <>
          <div className="award-board">
            {categorySections.map((section) => (
              <section className="award-cat" data-cat={section.letter} key={section.category}>
                <header className="award-cat-head">
                  <span className="award-cat-bar" aria-hidden />
                  <h2 className="award-cat-name">{section.category}</h2>
                </header>
                <div
                  className={`award-cat-tracks${section.tracks.length === 1 ? ' single' : ''}`}
                  // Longest track's card count. The grid lays out 3 subgrid rows per
                  // card (header / meta / footer) so those bands line up across the two
                  // track columns; see .award-cat-tracks in the stylesheet.
                  style={{
                    ['--card-count' as string]:
                      Math.max(...section.tracks.map((g) => g.entries.length)),
                  }}
                >
                  {section.tracks.map((group) => (
                    <div className="award-track" role="list" key={group.track}>
                      <div className="award-track-head">{trackShort(group.track)}</div>
                      {group.entries.map((entry, i) => {
                        const id = entry.booth.toLowerCase();
                        const medalUrl = medalCertificateUrl(id);
                        const specialUrl = entry.special ? specialCertificateUrl(id) : null;
                        return (
                        <article
                          className={`award-card medal-${entry.medal}${entry.special ? ` has-special special-${entry.special}` : ''}`}
                          role="listitem"
                          key={`${entry.booth}-${entry.medal}-${entry.rank ?? ''}`}
                          // Each card occupies three subgrid rows (+ a gap row): the
                          // header, meta, and footer bands then align across both columns.
                          style={{ gridRow: `${2 + i * 4} / span 3`, animationDelay: `${Math.min(i, 8) * 60}ms` }}
                        >
                          <div className="award-card-top">
                            {/* Booth top-left, medal top-right — mirrors the team-list card. */}
                            <div className="award-card-head">
                              <span className="award-booth">{entry.booth}</span>
                              <span className="award-medal" title={MEDAL_META[entry.medal].label}>
                                <span className="award-medal-emoji" aria-hidden>{MEDAL_META[entry.medal].emoji}</span>
                                <span className="award-medal-label">{MEDAL_META[entry.medal].short}</span>
                              </span>
                            </div>

                            {entry.special && (
                              <div className={`award-special special-${entry.special}`}>
                                <span aria-hidden>{SPECIAL_META[entry.special].emoji}</span>
                                {SPECIAL_META[entry.special].label}
                              </div>
                            )}

                            <div className="award-card-team">
                              <div className="award-team-name">
                                {entry.teamName || entry.projectName || 'To be announced'}
                              </div>
                              {entry.teamName && entry.projectName && (
                                <div className="award-project-sub">{entry.projectName}</div>
                              )}
                            </div>
                          </div>

                          <div className="award-card-mid">
                            {entry.teamLeader && (
                              <div className="award-meta" data-label="Team Leader">
                                <span className="award-meta-value">{entry.teamLeader}</span>
                              </div>
                            )}
                            <div className="award-meta" data-label="Track">
                              <span className="award-meta-value">{trackShort(entry.track)}</span>
                            </div>
                            {entry.final != null && (
                              <div className="award-meta" data-label="Score">
                                <span className="award-meta-value">{entry.final.toFixed(1)}</span>
                              </div>
                            )}
                          </div>

                          {(medalUrl || specialUrl) && (
                            <div className="award-card-actions">
                              <span className="award-actions-label">Download certificate</span>
                              <div className="award-actions-btns">
                                {medalUrl && (
                                  <a
                                    className="cert-btn"
                                    href={medalUrl}
                                    download={awardCertificateFilename(entry.booth, MEDAL_META[entry.medal].short)}
                                    aria-label={`Download ${MEDAL_META[entry.medal].label} certificate for ${entry.booth}`}
                                  >
                                    <Download size={14} aria-hidden />
                                    {MEDAL_META[entry.medal].short}
                                  </a>
                                )}
                                {specialUrl && entry.special && (
                                  <a
                                    className={`cert-btn cert-btn-special special-${entry.special}`}
                                    href={specialUrl}
                                    download={awardCertificateFilename(entry.booth, SPECIAL_META[entry.special].label)}
                                    aria-label={`Download ${SPECIAL_META[entry.special].label} certificate for ${entry.booth}`}
                                  >
                                    <Download size={14} aria-hidden />
                                    {SPECIAL_META[entry.special].short}
                                  </a>
                                )}
                              </div>
                            </div>
                          )}
                        </article>
                        );
                      })}
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

// ─── Celebration: a one-shot confetti burst when the board first reveals ─────
const CONFETTI_COLORS = ['#F5C518', '#C9A227', '#4CC3B5', '#5B8DEF', '#E9564B', '#8E7CFF'];

function Confetti() {
  // Positions/colours are randomised once so the burst is lively but never re-shuffles
  // mid-fall on a re-render.
  const pieces = useMemo(
    () =>
      Array.from({ length: 180 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 1.6,
        duration: 3.8 + Math.random() * 2.6,
        drift: (Math.random() - 0.5) * 200,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        width: 6 + Math.random() * 6,
        height: 8 + Math.random() * 8,
      })),
    [],
  );

  return (
    <div className="confetti" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            width: `${p.width}px`,
            height: `${p.height}px`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            ['--drift' as string]: `${p.drift}px`,
          }}
        />
      ))}
    </div>
  );
}
