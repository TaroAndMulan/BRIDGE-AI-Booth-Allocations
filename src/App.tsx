import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  ChevronsUpDown,
  ArrowUp,
  ArrowDown,
  ClipboardList,
  FileText,
  Activity,
  Stethoscope,
  MonitorSmartphone,
  BrainCircuit,
  LayoutGrid,
  Award as AwardIcon,
} from 'lucide-react';
import { TEAMS, CATEGORIES, categoryLabel } from './data';
import { MANUAL, TEAM_LIST } from './documents';
import { createTeamSearch } from './search';
import { sortTeams, nextSort, type Sort, type SortKey } from './sort';
import Nav from './components/Nav';
import DocumentCard from './components/DocumentCard';
import AwardsView from './components/AwardsView';

type Tab = 'booths' | 'awards' | 'backup';

/** The backup tab is unlisted; it reveals itself only when the URL carries #backup. */
function tabFromHash(): Tab {
  const hash = window.location.hash.toLowerCase();
  if (hash.includes('backup')) return 'backup';
  if (hash.includes('award')) return 'awards';
  return 'booths';
}

const hashHasBackup = () => window.location.hash.toLowerCase().includes('backup');

const CHIP_ITEMS = [
  { label: 'All', value: 'All', Icon: LayoutGrid },
  { label: categoryLabel(CATEGORIES.A), value: CATEGORIES.A, Icon: Activity },
  { label: categoryLabel(CATEGORIES.B), value: CATEGORIES.B, Icon: Stethoscope },
  { label: categoryLabel(CATEGORIES.C), value: CATEGORIES.C, Icon: MonitorSmartphone },
  { label: categoryLabel(CATEGORIES.D), value: CATEGORIES.D, Icon: BrainCircuit },
];

/** Phones get cards instead of a table, so the sortable headers are unreachable there. */
const SORT_OPTIONS: { label: string; value: string }[] = [
  { label: 'Default order', value: 'default' },
  { label: 'Booth, ascending', value: 'booth:asc' },
  { label: 'Booth, descending', value: 'booth:desc' },
  { label: 'Team name, ascending', value: 'teamName:asc' },
  { label: 'Team name, descending', value: 'teamName:desc' },
  { label: 'Team leader, ascending', value: 'teamLeader:asc' },
  { label: 'Team leader, descending', value: 'teamLeader:desc' },
  { label: 'Category, A to D', value: 'category:asc' },
  { label: 'Category, D to A', value: 'category:desc' },
  { label: 'Track, Rising first', value: 'track:asc' },
  { label: 'Track, Advanced first', value: 'track:desc' },
];

function serializeSort(sort: Sort | null): string {
  return sort ? `${sort.key}:${sort.direction}` : 'default';
}

function parseSort(value: string): Sort | null {
  if (value === 'default') return null;
  const [key, direction] = value.split(':');
  return { key: key as SortKey, direction: direction as Sort['direction'] };
}

type SortHeaderProps = {
  label: string;
  sortKey: SortKey;
  sort: Sort | null;
  onSort: (key: SortKey) => void;
  className?: string;
};

function SortHeader({ label, sortKey, sort, onSort, className }: SortHeaderProps) {
  const isActive = sort?.key === sortKey;
  const ariaSort = isActive
    ? (sort.direction === 'asc' ? 'ascending' : 'descending')
    : 'none';

  return (
    <th className={className} aria-sort={ariaSort}>
      <button
        type="button"
        className={`sort-btn${isActive ? ' is-active' : ''}`}
        onClick={() => onSort(sortKey)}
      >
        {label}
        {!isActive && <ChevronsUpDown size={13} className="sort-icon" aria-hidden />}
        {isActive && sort.direction === 'asc' && <ArrowUp size={13} className="sort-icon" aria-hidden />}
        {isActive && sort.direction === 'desc' && <ArrowDown size={13} className="sort-icon" aria-hidden />}
      </button>
    </th>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>(tabFromHash);
  const [backupUnlocked, setBackupUnlocked] = useState(hashHasBackup);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [sort, setSort] = useState<Sort | null>(null);

  // A hand-typed #backup (or #awards) selects that tab and, for backup, unlocks it.
  useEffect(() => {
    const onHashChange = () => {
      setTab(tabFromHash());
      if (hashHasBackup()) setBackupUnlocked(true);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const selectTab = (next: Tab) => {
    setTab(next);
    // Keep the URL in step without adding history entries or refiring hashchange.
    const url =
      next === 'booths'
        ? window.location.pathname + window.location.search
        : `#${next}`;
    window.history.replaceState(null, '', url);
  };

  const showBackup = backupUnlocked || tab === 'backup';

  // Sort before searching: the search keeps literal matches in the order it is given.
  const visibleTeams = useMemo(() => {
    const inCategory = TEAMS.filter(
      (team) => selectedCategory === 'All' || team.category === selectedCategory,
    );
    return sortTeams(inCategory, sort);
  }, [selectedCategory, sort]);

  const searchTeams = useMemo(() => createTeamSearch(visibleTeams), [visibleTeams]);

  const filteredTeams = useMemo(
    () => searchTeams(searchTerm),
    [searchTeams, searchTerm],
  );

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('All');
  };

  const handleSort = (key: SortKey) => setSort((current) => nextSort(current, key));

  // A filtered-to-one-value column would repeat the same cell on every row.
  const showCategoryColumn = selectedCategory === 'All';
  const columnCount = showCategoryColumn ? 5 : 4;

  return (
    <>
      <Nav />

      <main className="booth-shell" id="top">
        <div className="tab-bar" role="tablist" aria-label="Sections">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'booths'}
            className={`tab-btn${tab === 'booths' ? ' active' : ''}`}
            onClick={() => selectTab('booths')}
          >
            <LayoutGrid aria-hidden />
            Booth Allocation
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'awards'}
            className={`tab-btn${tab === 'awards' ? ' active' : ''}`}
            onClick={() => selectTab('awards')}
          >
            <AwardIcon aria-hidden />
            Awards
          </button>
          {showBackup && (
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'backup'}
              className={`tab-btn${tab === 'backup' ? ' active' : ''}`}
              onClick={() => selectTab('backup')}
            >
              <AwardIcon aria-hidden />
              Awards (backup)
            </button>
          )}
        </div>

        {tab === 'awards' && <AwardsView source="live" />}
        {tab === 'backup' && <AwardsView source="backup" />}

        {tab === 'booths' && (
        <>
        <p className="eyebrow">BRIDGE-AI Summit 2026</p>
        <div className="rule" />
        <h1 className="section-title">
          Booth <span className="accent">Allocations</span>
        </h1>
        <p className="section-sub">
          Search for your team by team name, project title, team leader, or booth number.
          Teams listed here have been selected for the Exhibition Round. Please note your
          assigned booth number for poster preparation and on-site registration.
        </p>

        <div className="doc-cards">
          <DocumentCard
            doc={TEAM_LIST}
            Icon={ClipboardList}
            eyebrow="ประกาศผลอย่างเป็นทางการ · Official announcement"
            title="ประกาศรายชื่อทีมที่ผ่านการคัดเลือกเข้าสู่รอบนิทรรศการ"
            subtitle="Qualifying Teams — all 90 booths, grouped by award and track"
          />
          <DocumentCard
            doc={MANUAL}
            Icon={FileText}
            eyebrow="สำหรับทีมที่ผ่านการคัดเลือก · For qualifying teams"
            title="คู่มือการจัดแสดงผลงานนิทรรศการ"
            subtitle="Exhibition Preparation Guide — deadlines, poster spec, and the on-site schedule"
          />
        </div>

        <div className="booth-toolbar">
          <label className="search-field">
            <Search aria-hidden />
            <input
              className="search-input"
              type="text"
              placeholder="Search by team, project, leader, or booth…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search teams"
            />
          </label>

          <div className="toolbar-row">
            <span className="toolbar-label" id="category-filter-label">Category</span>
            <div className="toolbar-chips" role="group" aria-labelledby="category-filter-label">
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

          <label className="toolbar-row mobile-sort">
            <span className="toolbar-label">Sort by</span>
            <select
              className="mobile-sort-select"
              value={serializeSort(sort)}
              onChange={(e) => setSort(parseSort(e.target.value))}
            >
              {SORT_OPTIONS.map(({ label, value }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="booth-panel">
          <div style={{ overflowX: 'auto' }}>
            <table className="booth-table">
              <thead>
                <tr>
                  <SortHeader label="Booth" sortKey="booth" sort={sort} onSort={handleSort} />
                  <SortHeader label="Team & Project" sortKey="teamName" sort={sort} onSort={handleSort} />
                  <SortHeader label="Team Leader" sortKey="teamLeader" sort={sort} onSort={handleSort} />
                  {showCategoryColumn && (
                    <SortHeader label="Category" sortKey="category" sort={sort} onSort={handleSort} className="col-narrow" />
                  )}
                  <SortHeader label="Track" sortKey="track" sort={sort} onSort={handleSort} className="col-narrow" />
                </tr>
              </thead>
              <tbody>
                {filteredTeams.map((team) => (
                  <tr key={team.id}>
                    <td className="cell-booth">
                      <div className="booth-cell">{team.booth}</div>
                    </td>
                    <td className="cell-team">
                      <div className="project-name">{team.teamName}</div>
                      <div className="project-sub">{team.projectName}</div>
                    </td>
                    <td data-label="Team Leader">
                      <div className="leader-cell">{team.teamLeader}</div>
                    </td>
                    {showCategoryColumn && (
                      <td className="col-narrow" data-label="Category">
                        <div className="cat-cell">{categoryLabel(team.category)}</div>
                      </td>
                    )}
                    <td className="col-narrow" data-label="Track">
                      <div className="track-cell">{team.track}</div>
                    </td>
                  </tr>
                ))}
                {filteredTeams.length === 0 && (
                  <tr>
                    <td colSpan={columnCount}>
                      <div className="empty-state">
                        <Search size={30} style={{ color: 'var(--line-strong)', margin: '0 auto 12px' }} />
                        <p style={{ margin: '0 0 14px' }}>No teams match your search.</p>
                        <button type="button" className="link-btn" onClick={clearFilters}>
                          Clear filters
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="result-count">
          Showing {filteredTeams.length} team{filteredTeams.length !== 1 ? 's' : ''} of {TEAMS.length}
        </p>
        </>
        )}
      </main>
    </>
  );
}
