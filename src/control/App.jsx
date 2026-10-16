import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { NormalizedLogo } from '../shared/NormalizedLogo.jsx';
const TeamOfTheYear = lazy(() => import('./TeamOfTheYear.jsx').then((mod) => ({ default: mod.TeamOfTheYear })));
const LifeMembers = lazy(() => import('./LifeMembers.jsx').then((mod) => ({ default: mod.LifeMembers })));

const api = window.wflMedal;

const PRESO_STARTS_KEY = 'wfl-preso-start-rounds';
const RUNSHEET_INCLUDE_KEY = 'wfl-runsheet-include';
const RUNSHEET_ORDER_KEY = 'wfl-runsheet-order';
const RUNSHEET_SCOPED_KEY = 'wfl-runsheet-scoped';
const COMP_KEY = 'wfl-competition';
const RUNSHEET_SPLASH = 'splash';
const RUNSHEET_TOTY = 'toty';
const RUNSHEET_LIFE = 'lifemembers';

function readPresoStarts() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PRESO_STARTS_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function readJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function readIdList(key) {
  const parsed = readJson(key, []);
  return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
}

function readFlagMap(key) {
  const parsed = readJson(key, {});
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

function compBucket(competition) {
  return competition === 'wwfl' ? 'wwfl' : 'wfl';
}

function runsheetOrderKey(competition) {
  return `${RUNSHEET_ORDER_KEY}-${compBucket(competition)}`;
}

function runsheetIncludeKey(competition) {
  return `${RUNSHEET_INCLUDE_KEY}-${compBucket(competition)}`;
}

function runsheetRowOwner(id, womenIds, menIds) {
  const key = String(id);
  if (key === RUNSHEET_SPLASH) return 'both';
  if (key === RUNSHEET_TOTY || key === RUNSHEET_LIFE) return 'wfl';
  if (key.startsWith(`${RUNSHEET_SPLASH}-before-`)) {
    const gradeId = key.slice(`${RUNSHEET_SPLASH}-before-`.length);
    if (womenIds.has(gradeId)) return 'wwfl';
    if (menIds.has(gradeId)) return 'wfl';
    return 'drop';
  }
  if (key.startsWith('leaderboard-')) {
    const gradeId = key.slice('leaderboard-'.length);
    if (womenIds.has(gradeId)) return 'wwfl';
    if (menIds.has(gradeId)) return 'wfl';
    return 'drop';
  }
  if (key.startsWith(`${RUNSHEET_SPLASH}-`)) return 'both';
  if (womenIds.has(key)) return 'wwfl';
  if (menIds.has(key)) return 'wfl';
  return 'drop';
}

function splitLegacyRunsheet(order, include, roster) {
  const womenIds = new Set((roster ?? []).filter((grade) => grade.women).map((grade) => String(grade.id)));
  const menIds = new Set((roster ?? []).filter((grade) => !grade.women).map((grade) => String(grade.id)));
  const nextOrder = { wfl: [], wwfl: [] };
  for (const id of order ?? []) {
    const owner = runsheetRowOwner(id, womenIds, menIds);
    if (owner === 'both' || owner === 'wfl') nextOrder.wfl.push(id);
    if (owner === 'both' || owner === 'wwfl') nextOrder.wwfl.push(id);
  }
  if (menIds.size && !nextOrder.wfl.some((id) => menIds.has(id))) nextOrder.wfl = [];
  if (womenIds.size && !nextOrder.wwfl.some((id) => womenIds.has(id))) nextOrder.wwfl = [];
  function flagsFor(ids) {
    const out = {};
    for (const id of ids) {
      if (Object.prototype.hasOwnProperty.call(include ?? {}, id)) out[id] = include[id] !== false;
    }
    return out;
  }
  return {
    ready: true,
    order: nextOrder,
    include: {
      wfl: nextOrder.wfl.length ? flagsFor(nextOrder.wfl) : {},
      wwfl: nextOrder.wwfl.length ? flagsFor(nextOrder.wwfl) : {},
    },
  };
}

function loadRunsheetState() {
  if (window.localStorage.getItem(RUNSHEET_SCOPED_KEY) === '1') {
    return {
      ready: true,
      order: {
        wfl: readIdList(runsheetOrderKey('wfl')),
        wwfl: readIdList(runsheetOrderKey('wwfl')),
      },
      include: {
        wfl: readFlagMap(runsheetIncludeKey('wfl')),
        wwfl: readFlagMap(runsheetIncludeKey('wwfl')),
      },
    };
  }
  return {
    ready: false,
    order: { wfl: [], wwfl: [] },
    include: { wfl: {}, wwfl: {} },
    legacyOrder: readIdList(RUNSHEET_ORDER_KEY),
    legacyInclude: readFlagMap(RUNSHEET_INCLUDE_KEY),
  };
}

function readCompetition() {
  try {
    return window.localStorage.getItem(COMP_KEY) === 'wwfl' ? 'wwfl' : 'wfl';
  } catch {
    return 'wfl';
  }
}

function isWomenGrade(grade) {
  if (!grade) return false;
  if (grade.women === true) return true;
  const text = `${grade.sourceName || ''} ${grade.name || ''}`;
  return /women/i.test(text);
}

function gradesForComp(grades, comp) {
  return (grades ?? []).filter((grade) => (comp === 'wwfl' ? isWomenGrade(grade) : !isWomenGrade(grade)));
}

function nightDecks(state, competition) {
  const all = state?.presentation?.allDecks ?? [];
  const current = state?.presentation?.decks ?? [];
  if (competition === 'wwfl') return all.length ? all : current;
  if (current.length) return current;
  return gradesForComp(state?.grades ?? [], competition);
}

function deckLabel(deck, decks) {
  if (!deck) return 'Grade';
  const shared = (decks ?? []).filter((item) => item.name === deck.name).length > 1;
  if (shared && deck.medalTitle) return `${deck.name} · ${deck.medalTitle}`;
  return deck.name || 'Grade';
}

function isSplashRowId(id) {
  const key = String(id || '');
  return key === RUNSHEET_SPLASH || key.startsWith(`${RUNSHEET_SPLASH}-`);
}

function newSplashId() {
  return `${RUNSHEET_SPLASH}-${Date.now().toString(36)}${Math.floor(Math.random() * 36).toString(36)}`;
}

function preSplashId(gradeId) {
  return `${RUNSHEET_SPLASH}-before-${gradeId}`;
}

function leaderboardRowId(gradeId) {
  return `leaderboard-${gradeId}`;
}

function defaultRunsheetRows(decks) {
  const rows = [{ type: 'splash', id: RUNSHEET_SPLASH }];
  (decks ?? []).forEach((item, index) => {
    if (index > 0) rows.push({ type: 'splash', id: preSplashId(item.id) });
    rows.push({ type: 'grade', id: item.id });
    rows.push({ type: 'leaderboard', id: leaderboardRowId(item.id), gradeId: String(item.id) });
  });
  rows.push({ type: 'toty', id: RUNSHEET_TOTY });
  rows.push({ type: 'lifemembers', id: RUNSHEET_LIFE });
  return rows;
}

function runsheetRowForComp(row, competition, grades) {
  const listed = (gradeId) => (grades ?? []).some((item) => String(item.id) === String(gradeId));
  if (row.type === 'grade' || row.type === 'leaderboard') {
    const gradeId = row.type === 'leaderboard' ? row.gradeId : row.id;
    if (competition === 'wwfl') return listed(gradeId);
    const item = (grades ?? []).find((gradeItem) => String(gradeItem.id) === String(gradeId));
    return gradesForComp([item].filter(Boolean), competition).length > 0;
  }
  if (row.type === 'toty' || row.type === 'lifemembers') return true;
  if (row.type === 'splash' && String(row.id).startsWith(`${RUNSHEET_SPLASH}-before-`)) {
    const gradeId = String(row.id).slice(`${RUNSHEET_SPLASH}-before-`.length);
    if (competition === 'wwfl') return listed(gradeId);
    const item = (grades ?? []).find((gradeItem) => String(gradeItem.id) === gradeId);
    return gradesForComp([item].filter(Boolean), competition).length > 0;
  }
  return true;
}

function splashIntroduces(row, rows, state) {
  const index = rows.findIndex((item) => item.id === row.id);
  const next = index >= 0 ? rows[index + 1] : null;
  if (next?.type !== 'grade') return null;
  return nightDecks(state, state.competition).find((item) => item.id === next.id) ?? null;
}

function runsheetRowInfo(row, rows, state) {
  const splashCount = rows.filter((item) => item.type === 'splash').length;
  const splashNumber =
    row.type === 'splash'
      ? rows.slice(0, rows.findIndex((item) => item.id === row.id) + 1).filter((item) => item.type === 'splash').length
      : 0;
  const decks = nightDecks(state, state.competition);
  const deck =
    row.type === 'grade'
      ? decks.find((item) => item.id === row.id)
      : row.type === 'leaderboard'
        ? decks.find((item) => String(item.id) === String(row.gradeId))
        : null;
  const intro = row.type === 'splash' ? splashIntroduces(row, rows, state) : null;
  const gradeLabelText = deckLabel(deck || intro, decks);
  const roundHint = deck
    ? deck.firstRound != null && deck.lastRound != null
      ? deck.firstRound === deck.lastRound
        ? `Round ${deck.firstRound}`
        : `Rounds ${deck.firstRound}–${deck.lastRound}`
      : deck.roundCount
        ? `${deck.roundCount} ${deck.roundCount === 1 ? 'round' : 'rounds'}`
        : null
    : null;
  const title =
    row.type === 'splash'
      ? intro && row.id !== RUNSHEET_SPLASH
        ? `Pre-screen · ${gradeLabelText}`
        : splashCount > 1 && row.id !== RUNSHEET_SPLASH
          ? `Splash ${splashNumber}`
          : 'Opening splash'
      : row.type === 'leaderboard'
        ? `Leaderboard · ${gradeLabelText}`
        : row.type === 'toty'
          ? 'Team of the year'
          : row.type === 'lifemembers'
            ? 'Life members'
            : gradeLabelText;
  const clubHint = (state.splash?.teams ?? []).length
    ? `${state.splash?.title || 'WFL Medal Count'} · ${state.splash.teams.length} clubs A–Z`
    : 'WFL Medal Count and all club logos';
  const detail =
    row.type === 'splash'
      ? intro && row.id !== RUNSHEET_SPLASH
        ? `Before ${intro.medalTitle || intro.name}`
        : clubHint
      : row.type === 'leaderboard'
        ? deck?.medalTitle
          ? `Full tally · ${deck.medalTitle}`
          : 'Full tally for this grade'
        : row.type === 'toty'
          ? 'Lines one at a time, then the field'
          : row.type === 'lifemembers'
          ? (state.lifeMembers?.members ?? []).length
            ? `${state.lifeMembers.members.length} ${state.lifeMembers.members.length === 1 ? 'recipient' : 'recipients'}`
            : 'Add recipients on the Life members tab'
          : [deck?.medalTitle, roundHint].filter(Boolean).join(' · ');
  return { title, detail, isGrade: row.type === 'grade' };
}

function orderRunsheetRows(decks, savedOrder) {
  const defaults = defaultRunsheetRows(decks);
  if (!savedOrder?.length) return defaults;
  const byId = new Map(defaults.map((row) => [String(row.id), row]));
  const ordered = [];
  const seen = new Set();
  for (const id of savedOrder) {
    const key = String(id);
    if (!key || seen.has(key)) continue;
    if (isSplashRowId(key) && !byId.has(key)) {
      ordered.push({ type: 'splash', id: key });
      seen.add(key);
      continue;
    }
    const row = byId.get(key);
    if (!row) continue;
    ordered.push(row);
    seen.add(key);
    byId.delete(key);
  }
  for (const row of defaults) {
    if (!byId.has(String(row.id))) continue;
    if (row.type === 'splash' && row.id !== RUNSHEET_SPLASH) {
      byId.delete(String(row.id));
      continue;
    }
    if (row.type === 'leaderboard') {
      const gradeIndex = ordered.findIndex((item) => item.type === 'grade' && String(item.id) === String(row.gradeId));
      if (gradeIndex >= 0) {
        ordered.splice(gradeIndex + 1, 0, row);
        byId.delete(String(row.id));
        continue;
      }
    }
    ordered.push(row);
    byId.delete(String(row.id));
  }
  return ordered;
}

function isTypingTarget(event) {
  const el = event.target?.closest?.('input, textarea, select, [contenteditable="true"]')
    || document.activeElement;
  if (!el) return false;
  const tag = String(el.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
}

function voteStatus(game) {
  if (game?.forfeit) return 'done';
  const votes = game?.votes ?? {};
  if (votes.three && votes.two && votes.one) return 'done';
  if (votes.three || votes.two || votes.one) return 'partial';
  return 'empty';
}

function homeGradeTone(item) {
  const text = `${item?.name || ''} ${item?.medalTitle || ''} ${item?.sourceName || ''}`.toLowerCase();
  if (/women/.test(text)) return 'women';
  if (/u\/?12|under 12/.test(text)) return 'u12';
  if (/u\/?15|under 15/.test(text)) return 'u15';
  if (/u\/?18|under 18/.test(text)) return 'u18';
  if (/reserv/.test(text)) return 'reserves';
  return 'league';
}

function homeGradeMark(tone) {
  if (tone === 'u12') return '12';
  if (tone === 'u15') return '15';
  if (tone === 'u18') return '18';
  if (tone === 'reserves') return 'R';
  if (tone === 'women') return 'L';
  return 'L';
}

function ControlHome({ state, grades, competition, onEnterVotes, onShowNight, onOpenToty, onOpenLife, onOpenGrade }) {
  return (
    <div className="control-home">
      <div className="control-home-hero">
        {state.wflLogoUrl ? <img src={state.wflLogoUrl} alt="WFL" /> : null}
        <p>{competition === 'wwfl' ? "Whyalla Women's Football League" : 'Whyalla Football League'}</p>
        <h1>Medal Count</h1>
        <h2>{state.season}</h2>
      </div>
      <div className="control-home-actions">
        <button className="primary" type="button" onClick={onEnterVotes}>
          Enter votes
        </button>
        <button type="button" onClick={onShowNight}>
          Presentation
        </button>
        <button disabled={state.sync?.running} type="button" onClick={() => api.syncSeason()}>
          {state.sync?.running ? 'Syncing…' : 'Sync from website'}
        </button>
      </div>
      {!grades.length ? (
        <p className="muted">
          {competition === 'wwfl'
            ? 'Sync from the website to load WWFL fixtures.'
            : 'Sync from the website to load WFL fixtures.'}
        </p>
      ) : null}
      <div className="control-home-board">
        <div
          className="control-home-grades"
          style={{ '--grade-count': Math.max(grades.length, 1) }}
        >
          {grades.map((item) => {
            const done = item.progress?.done ?? 0;
            const total = item.progress?.total ?? 0;
            const complete = total > 0 && done >= total;
            const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
            const tone = homeGradeTone(item);
            return (
              <button
                key={item.id}
                type="button"
                className={`home-grade${complete ? ' is-complete' : ''}`}
                data-tone={tone}
                onClick={() => onOpenGrade(item.id)}
              >
                <span className="home-grade-shine" aria-hidden="true" />
                <span className="home-grade-medal" aria-hidden="true">{homeGradeMark(tone)}</span>
                <small>{item.name}</small>
                <span className="home-grade-foot">
                  <strong>{item.medalTitle || item.name}</strong>
                  <span className="home-grade-bar" aria-hidden="true">
                    <span style={{ width: `${pct}%` }} />
                  </span>
                  <em>
                    {done}/{total} games
                    {complete ? <span className="home-grade-ready">Complete</span> : null}
                  </em>
                </span>
              </button>
            );
          })}
        </div>
        <div className="control-home-extras">
        <button type="button" className="home-grade" data-tone="toty" onClick={onOpenToty}>
          <span className="home-grade-shine" aria-hidden="true" />
          <span className="home-grade-medal" aria-hidden="true">TY</span>
          <small>Team</small>
          <span className="home-grade-foot">
            <strong>Team of the year</strong>
            <span className="home-grade-bar" aria-hidden="true">
              <span
                style={{
                  width: `${state.toty?.total ? Math.min(100, Math.round(((state.toty.filled ?? 0) / state.toty.total) * 100)) : 0}%`,
                }}
              />
            </span>
            <em>
              {state.toty?.filled ?? 0}/{state.toty?.total ?? 22} selected
            </em>
          </span>
        </button>
        <button type="button" className="home-grade" data-tone="life" onClick={onOpenLife}>
          <span className="home-grade-shine" aria-hidden="true" />
          <span className="home-grade-medal" aria-hidden="true">LM</span>
          <small>Honour</small>
          <span className="home-grade-foot">
            <strong>Life members</strong>
            <span className="home-grade-bar" aria-hidden="true">
              <span style={{ width: (state.lifeMembers?.members ?? []).length ? '100%' : '0%' }} />
            </span>
            <em>
              {(state.lifeMembers?.members ?? []).length}{' '}
              {(state.lifeMembers?.members ?? []).length === 1 ? 'recipient' : 'recipients'}
            </em>
          </span>
        </button>
        </div>
      </div>
    </div>
  );
}

function formatWhen(value) {
  if (!value) return 'Not synced yet';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function PlayerPhoto({ src, name }) {
  if (src) return <img className="photo" src={src} alt={name} />;
  return <div className="photo placeholder">{(name || '?').slice(0, 1)}</div>;
}

export function App() {
  const [state, setState] = useState(null);
  const [tab, setTab] = useState('home');
  const [query, setQuery] = useState('');
  const [addNumber, setAddNumber] = useState('');
  const [addClubId, setAddClubId] = useState('');
  const [printJob, setPrintJob] = useState(null);
  const [announcerOpen, setAnnouncerOpen] = useState(false);
  const [announcerIds, setAnnouncerIds] = useState([]);
  const [presoStarts, setPresoStarts] = useState(readPresoStarts);
  const [runsheetByComp, setRunsheetByComp] = useState(loadRunsheetState);
  const [runsheetDrag, setRunsheetDrag] = useState(null);
  const [competition, setCompetition] = useState(readCompetition);
  const runsheetDragHandle = useRef(false);

  useEffect(() => {
    if (!printJob) return undefined;
    if (printJob.action === 'save') {
      let cancelled = false;
      const run = async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 80));
        const sheet = document.querySelector('.print-sheet');
        if (!sheet || cancelled) {
          if (!cancelled) setPrintJob(null);
          return;
        }
        const result = await api.savePrintPdf({
          fileName: printJob.fileName,
          html: sheet.outerHTML,
        });
        if (!cancelled && result?.error) window.alert(`Could not save the sheet: ${result.error}`);
        if (!cancelled) setPrintJob(null);
      };
      run();
      return () => {
        cancelled = true;
      };
    }
    const timer = window.setTimeout(() => window.print(), 80);
    const done = () => setPrintJob(null);
    const root = document.documentElement;
    if (printJob.kind === 'announcer') root.classList.add('print-announcer');
    window.addEventListener('afterprint', done);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', done);
      root.classList.remove('print-announcer');
    };
  }, [printJob]);

  useEffect(() => {
    if (!announcerOpen) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setAnnouncerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [announcerOpen]);

  useEffect(() => {
    api.getState().then(setState);
    const offState = api.onState(setState);
    const offCursor = api.onStateCursor?.((patch) => {
      setState((current) => {
        if (!current || !patch) return current;
        return {
          ...current,
          audienceView: patch.audienceView ?? current.audienceView,
          presentation: patch.presentation
            ? { ...current.presentation, ...patch.presentation }
            : current.presentation,
          toty: patch.toty ? { ...current.toty, ...patch.toty } : current.toty,
          lifeMembers: patch.lifeMembers
            ? { ...current.lifeMembers, ...patch.lifeMembers }
            : current.lifeMembers,
          scoreboard: patch.scoreboard ? { ...current.scoreboard, ...patch.scoreboard } : current.scoreboard,
        };
      });
    });
    return () => {
      offState?.();
      offCursor?.();
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(PRESO_STARTS_KEY, JSON.stringify(presoStarts));
    } catch {
      /* ignore quota / private mode */
    }
  }, [presoStarts]);

  useEffect(() => {
    if (runsheetByComp.ready) return;
    const roster = state?.gradeRoster;
    if (!roster?.length) return;
    setRunsheetByComp(splitLegacyRunsheet(runsheetByComp.legacyOrder, runsheetByComp.legacyInclude, roster));
  }, [state?.gradeRoster, runsheetByComp.ready, runsheetByComp.legacyOrder, runsheetByComp.legacyInclude]);

  useEffect(() => {
    if (!runsheetByComp.ready) return;
    try {
      window.localStorage.setItem(runsheetOrderKey('wfl'), JSON.stringify(runsheetByComp.order?.wfl ?? []));
      window.localStorage.setItem(runsheetOrderKey('wwfl'), JSON.stringify(runsheetByComp.order?.wwfl ?? []));
      window.localStorage.setItem(runsheetIncludeKey('wfl'), JSON.stringify(runsheetByComp.include?.wfl ?? {}));
      window.localStorage.setItem(runsheetIncludeKey('wwfl'), JSON.stringify(runsheetByComp.include?.wwfl ?? {}));
      window.localStorage.setItem(RUNSHEET_SCOPED_KEY, '1');
      window.localStorage.removeItem(RUNSHEET_ORDER_KEY);
      window.localStorage.removeItem(RUNSHEET_INCLUDE_KEY);
    } catch {
      /* ignore quota / private mode */
    }
  }, [runsheetByComp]);

  useEffect(() => {
    try {
      window.localStorage.setItem(COMP_KEY, competition);
    } catch {
      /* ignore */
    }
    api.setCompetition?.(competition);
  }, [competition]);

  useEffect(() => {
    const onKey = (event) => {
      if (announcerOpen || isTypingTarget(event)) return;
      const view = state?.audienceView;
      if (event.key === 'l' || event.key === 'L') {
        event.preventDefault();
        if (view === 'leaderboard') api.showPresentation();
        else api.showLeaderboard('current');
        return;
      }
      if (event.key === 'v' || event.key === 'V') {
        event.preventDefault();
        if (view === 'scoreboard') api.showPresentation();
        else api.showScoreboard();
        return;
      }
      if (event.key === 't' || event.key === 'T') {
        event.preventDefault();
        if (view === 'toty') api.showPresentation();
        else api.showToty();
        return;
      }
      if (event.key === 'm' || event.key === 'M') {
        event.preventDefault();
        if (view === 'lifemembers') api.showPresentation();
        else api.showLifeMembers();
        return;
      }
      if (event.key === 'h' || event.key === 'H') {
        event.preventDefault();
        setTab('home');
        return;
      }
      if (event.key === 'p' || event.key === 'P' || (event.key === 'Escape' && view && view !== 'presentation')) {
        event.preventDefault();
        api.showPresentation();
        return;
      }
      if (event.key === 'F11') {
        event.preventDefault();
        api.updateSettings({ audienceFullscreen: state?.settings?.audienceFullscreen === false });
        return;
      }
      if (view === 'toty' || view === 'lifemembers' || view === 'splash') {
        if (event.key === 'ArrowRight' || event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          api.presentationStep(1);
        }
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          api.presentationStep(-1);
        }
        return;
      }
      if (tab !== 'show' || (view && view !== 'presentation')) return;
      if (event.key === 'ArrowRight' || event.key === 'Enter') {
        event.preventDefault();
        api.presentationStep(1);
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        api.presentationStep(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tab, announcerOpen, state?.audienceView, state?.settings?.audienceFullscreen]);

  const visibleGrades = gradesForComp(state?.grades, competition);
  const grade =
    visibleGrades.find((item) => item.id === state?.activeGradeId) ?? visibleGrades[0] ?? null;

  const visibleGradeIds = visibleGrades.map((item) => item.id).join(',');
  useEffect(() => {
    if (!state || !visibleGrades.length) return;
    if (visibleGrades.some((item) => item.id === state.activeGradeId)) return;
    api.setActiveGrade(visibleGrades[0].id);
  }, [competition, state?.activeGradeId, visibleGradeIds]);

  const games = useMemo(
    () => (grade?.rounds ?? []).flatMap((round) => round.games.map((game) => ({ ...game, roundName: round.name, roundId: round.id }))),
    [grade]
  );
  const selected = games.find((game) => game.id === state?.selectedGameId) ?? games[0] ?? null;

  useEffect(() => {
    setQuery('');
    setAddNumber('');
    setAddClubId('');
  }, [selected?.id]);

  if (!state) {
    return <div className="boot">Loading…</div>;
  }

  const filteredPlayers = (selected?.players ?? []).filter((player) => {
    const hay = `${player.name} ${player.number} ${player.clubName} ${player.clubLabel ?? ''}`.toLowerCase();
    return hay.includes(query.toLowerCase());
  });

  const homePlayers = filteredPlayers.filter((player) => player.clubId === selected?.homeId);
  const awayPlayers = filteredPlayers.filter((player) => player.clubId === selected?.awayId);

  function voteFor(playerId) {
    if (!selected) return;
    api.assignVote(selected.id, playerId);
  }

  const runsheetComp = compBucket(competition);
  const runsheetOrder = runsheetByComp.order?.[runsheetComp] ?? [];
  const runsheetInclude = runsheetByComp.include?.[runsheetComp] ?? {};

  function setRunsheetOrder(updater) {
    setRunsheetByComp((current) => {
      const base = current.ready
        ? current
        : splitLegacyRunsheet(current.legacyOrder, current.legacyInclude, state?.gradeRoster ?? []);
      const prev = base.order?.[runsheetComp] ?? [];
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return {
        ...base,
        ready: true,
        order: { ...base.order, [runsheetComp]: next },
      };
    });
  }

  function setRunsheetInclude(updater) {
    setRunsheetByComp((current) => {
      const base = current.ready
        ? current
        : splitLegacyRunsheet(current.legacyOrder, current.legacyInclude, state?.gradeRoster ?? []);
      const prev = base.include?.[runsheetComp] ?? {};
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return {
        ...base,
        ready: true,
        include: { ...base.include, [runsheetComp]: next },
      };
    });
  }

  function runsheetIncluded(id) {
    return runsheetInclude[id] !== false;
  }

  function setRunsheetRow(id, included) {
    setRunsheetInclude((current) => ({ ...current, [id]: included }));
  }

  function moveRunsheetTo(fromId, toId) {
    if (!fromId || !toId || fromId === toId) return;
    const decks = nightDecks(state, competition);
    setRunsheetOrder((current) => {
      const ids = orderRunsheetRows(decks, current).map((row) => row.id);
      const from = ids.indexOf(fromId);
      const to = ids.indexOf(toId);
      if (from < 0 || to < 0) return ids;
      const copy = ids.slice();
      const [item] = copy.splice(from, 1);
      copy.splice(to, 0, item);
      return copy;
    });
  }

  function parkRunsheet(id) {
    setRunsheetRow(id, false);
  }

  function restoreRunsheet(id) {
    setRunsheetRow(id, true);
  }

  function addSplash() {
    const decks = nightDecks(state, competition);
    const id = newSplashId();
    setRunsheetOrder((current) => {
      const ids = orderRunsheetRows(decks, current).map((row) => row.id);
      let insertAt = 0;
      ids.forEach((rowId, index) => {
        if (isSplashRowId(rowId)) insertAt = index + 1;
      });
      const copy = ids.slice();
      copy.splice(insertAt, 0, id);
      return copy;
    });
  }

  function removeSplash(id) {
    if (!isSplashRowId(id) || id === RUNSHEET_SPLASH) return;
    const decks = nightDecks(state, competition);
    setRunsheetOrder((current) => orderRunsheetRows(decks, current).map((row) => row.id).filter((rowId) => rowId !== id));
    setRunsheetInclude((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  function createNightRunsheet() {
    const decks = nightDecks(state, competition);
    const rows = defaultRunsheetRows(decks);
    setRunsheetOrder(rows.map((row) => row.id));
    setRunsheetInclude(Object.fromEntries(rows.map((row) => [row.id, true])));
  }

  function startRunsheet(fromId) {
    const decks = nightDecks(state, competition);
    const rows = orderRunsheetRows(decks, runsheetOrder).filter((row) =>
      runsheetRowForComp(row, competition, decks)
    );
    const startAt = fromId ? rows.findIndex((row) => row.id === fromId) : 0;
    const items = rows.slice(Math.max(0, startAt)).filter((row) => runsheetIncluded(row.id)).map((row) => ({
      type: row.type,
      id: row.id,
      start: row.type === 'grade' ? presoStarts[row.id] : undefined,
    }));
    if (!items.length) return;
    api.presentationStart({ items });
  }

  const nextPick = !selected?.votes?.three ? 3 : !selected?.votes?.two ? 2 : !selected?.votes?.one ? 1 : null;

  return (
    <>
    <div className="app">
      <header className="top">
        <div className="brand">
          {state.wflLogoUrl ? <img src={state.wflLogoUrl} alt="WFL" /> : null}
          <div>
            <strong>{competition === 'wwfl' ? 'WWFL Medal Count' : 'WFL Medal Count'}</strong>
            <span>{state.season}</span>
          </div>
          <label className="comp-switch">
            <span className="muted">Competition</span>
            <select
              value={competition}
              onChange={(event) => setCompetition(event.target.value === 'wwfl' ? 'wwfl' : 'wfl')}
            >
              <option value="wfl">WFL</option>
              <option value="wwfl">WWFL</option>
            </select>
          </label>
        </div>
        <div className="top-actions">
          <button disabled={state.sync?.running} onClick={() => api.syncSeason()}>
            {state.sync?.running ? 'Syncing…' : 'Sync from website'}
          </button>
          {state.settings?.presentTarget === 'obs' ? (
            <button
              className="primary"
              onClick={() => state.obsUrl && api.copyText(state.obsUrl)}
            >
              Copy OBS address
            </button>
          ) : (
            <button className="primary" onClick={() => api.toggleAudience()}>
              {state.audienceOpen ? 'Close audience' : 'Audience display'}
            </button>
          )}
          <button
            className="danger"
            onClick={() => {
              const ok = window.confirm(
                'Clear all votes, team of the year, and life members? Fixtures and settings stay.'
              );
              if (ok) api.clearEnteredData();
            }}
          >
            Clear data
          </button>
        </div>
      </header>

      <nav className="tabs">
        {[
          ['home', 'Home'],
          ['votes', 'Enter votes'],
          ['board', 'Leaderboard'],
          ['show', 'Presentation'],
          ['sponsors', 'Sponsors'],
          ['settings', 'Settings'],
        ].map(([id, label]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      {tab !== 'settings' && tab !== 'toty' && tab !== 'lifemembers' && tab !== 'show' && tab !== 'home' ? (
      <div className="grades">
        {visibleGrades.map((item) => {
          const complete = item.progress.total > 0 && item.progress.done >= item.progress.total;
          return (
            <button
              key={item.id}
              className={`${item.id === grade?.id ? 'active' : ''} ${complete ? 'complete' : ''}`.trim()}
              onClick={() => api.setActiveGrade(item.id)}
            >
              {item.name}
              <em>
                {item.progress.done}/{item.progress.total}
              </em>
            </button>
          );
        })}
        <button
          className="primary grades-print"
          disabled={!visibleGrades.length}
          onClick={() => {
            setAnnouncerIds(visibleGrades.map((item) => item.id));
            setAnnouncerOpen(true);
          }}
        >
          Print announcer
        </button>
      </div>
      ) : null}

      {tab === 'votes' && (
        <div className="votes-layout">
          <aside className="rounds">
            {(grade?.rounds ?? []).map((round) => (
              <section key={round.id}>
                <h3>{round.name}</h3>
                {round.games.map((game) => {
                  const status = voteStatus(game);
                  return (
                    <button
                      key={game.id}
                      className={`game ${selected?.id === game.id ? 'selected' : ''} ${status} ${game.forfeit ? 'forfeit' : ''}`}
                      onClick={() => api.selectGame(game.id)}
                      title={`${game.homeName} v ${game.awayName}`}
                    >
                      {game.forfeit ? (
                        <span className="game-score forfeit-score">{game.forfeitLine || 'Forfeit'}</span>
                      ) : (
                        <span className="game-score home">{game.homeScoreLine ?? '—'}</span>
                      )}
                      <span className="game-logos">
                        <ClubMark src={game.homeLogoUrl} name={game.homeName} />
                        <span className="game-vs">
                          <em>v</em>
                        </span>
                        <ClubMark src={game.awayLogoUrl} name={game.awayName} />
                      </span>
                      {game.forfeit ? (
                        <span className="game-score" />
                      ) : (
                        <span className="game-score away">{game.awayScoreLine ?? '—'}</span>
                      )}
                    </button>
                  );
                })}
              </section>
            ))}
          </aside>

          <main className="sheet">
            {!selected ? (
              <div className="empty">
                Sync from the website to load team sheets, then pick 3-2-1 for each game before the night.
              </div>
            ) : (
              <>
                <div className="match-head">
                  <div>
                    <p className="eyebrow">{selected.roundName}</p>
                    <h2>
                      {selected.homeName} v {selected.awayName}
                    </h2>
                    <p className="muted">
                      {selected.forfeit
                        ? selected.forfeitLoserId === selected.homeId
                          ? `Forfeit · ${selected.homeName} forfeited · no votes`
                          : selected.forfeitLoserId === selected.awayId
                            ? `Forfeit · ${selected.awayName} forfeited · no votes`
                            : 'Forfeit · no votes required'
                        : selected.scoreLine && selected.scoreLine !== '—'
                          ? selected.scoreLine
                          : selected.status}
                      {!selected.forfeit && (selected.players.length ? ` · ${selected.players.length} players` : ' · no team sheet yet')}
                    </p>
                  </div>
                  {selected.forfeit ? null : (
                    <div className="vote-picks">
                      {[3, 2, 1].map((points) => {
                        const key = points === 3 ? 'three' : points === 2 ? 'two' : 'one';
                        const player = selected.players.find((item) => item.id === selected.votes?.[key]);
                        return (
                          <div
                            key={points}
                            className={`pick ${nextPick === points ? 'armed' : ''} ${player ? 'filled' : ''}`}
                            onClick={() => player && voteFor(player.id)}
                            title={player ? 'Click to remove this vote' : undefined}
                          >
                            <b>{points}</b>
                            {player ? (
                              <span>
                                {player.name}
                                <small>{player.clubLabel || player.clubName}</small>
                              </span>
                            ) : (
                              <span className="pick-empty">—</span>
                            )}
                          </div>
                        );
                      })}
                      <button className="ghost" onClick={() => api.clearVotes(selected.id)}>
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                {selected.forfeit ? (
                  <div className="empty">No 3-2-1 for this game. It will show as a forfeit in the presentation.</div>
                ) : (
                  <>
                    <div className="toolbar">
                      <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search player or number"
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter' || filteredPlayers.length || !query.trim()) return;
                          event.preventDefault();
                          api.addGamePlayer(selected.id, {
                            name: query.trim(),
                            number: addNumber.trim(),
                            clubId: addClubId || selected.homeId,
                          });
                          setQuery('');
                          setAddNumber('');
                        }}
                      />
                      {!filteredPlayers.length && query.trim() ? (
                        <>
                          <input
                            className="player-number"
                            value={addNumber}
                            onChange={(event) => setAddNumber(event.target.value)}
                            placeholder="No."
                            inputMode="numeric"
                            aria-label="Jumper number"
                          />
                          <select
                            value={addClubId || selected.homeId || ''}
                            onChange={(event) => setAddClubId(event.target.value)}
                            aria-label="Club"
                          >
                            <option value={selected.homeId || ''}>{selected.homeName}</option>
                            <option value={selected.awayId || ''}>{selected.awayName}</option>
                          </select>
                          <button
                            type="button"
                            className="primary"
                            onClick={() => {
                              api.addGamePlayer(selected.id, {
                                name: query.trim(),
                                number: addNumber.trim(),
                                clubId: addClubId || selected.homeId,
                              });
                              setQuery('');
                              setAddNumber('');
                            }}
                          >
                            Add
                          </button>
                        </>
                      ) : null}
                      <span className="muted">
                        {nextPick
                          ? `Click a player for ${nextPick}. Click a voted player to remove.`
                          : '3-2-1 in. Click a voted player to remove, or Clear.'}
                      </span>
                    </div>

                    <div className="teams">
                      <TeamColumn
                        name={selected.homeName}
                        logo={selected.homeLogoUrl}
                        players={homePlayers}
                        votes={selected.votes}
                        nextPick={nextPick}
                        onPick={voteFor}
                      />
                      <TeamColumn
                        name={selected.awayName}
                        logo={selected.awayLogoUrl}
                        players={awayPlayers}
                        votes={selected.votes}
                        nextPick={nextPick}
                        onPick={voteFor}
                      />
                    </div>
                  </>
                )}
              </>
            )}
          </main>
        </div>
      )}

      {tab === 'home' && (
        <ControlHome
          state={state}
          grades={visibleGrades}
          competition={competition}
          onEnterVotes={() => setTab('votes')}
          onShowNight={() => setTab('show')}
          onOpenToty={() => setTab('toty')}
          onOpenLife={() => setTab('lifemembers')}
          onOpenGrade={(gradeId) => {
            api.setActiveGrade(gradeId);
            setTab('votes');
          }}
        />
      )}

      {tab === 'toty' && (
        <Suspense fallback={<div className="boot">Loading team of the year…</div>}>
          <TeamOfTheYear state={state} />
        </Suspense>
      )}

      {tab === 'lifemembers' && (
        <Suspense fallback={<div className="boot">Loading life members…</div>}>
          <LifeMembers state={state} />
        </Suspense>
      )}

      {tab === 'board' && (
        <div className="board board-cols" style={{ '--grade-cols': Math.max(visibleGrades.length, 1) }}>
          <p className="muted board-intro">
            Running totals from votes already entered. Print a leaderboard here, or Print announcer beside the grade tabs for the 3-2-1 script.
          </p>
          {visibleGrades.map((item) => (
            <section key={item.id} className={`board-block${item.id === grade?.id ? ' current' : ''}`}>
              <header className="board-head">
                <div>
                  <h2>{item.medalTitle}</h2>
                  <p className="muted">{item.name}</p>
                </div>
                <div className="board-actions">
                  <button
                    className="primary"
                    disabled={!(item.leaderboard ?? []).length}
                    onClick={() => setPrintJob(printJobForGrade(item, state))}
                  >
                    Print
                  </button>
                </div>
              </header>
              {(item.leaderboard ?? []).length ? (
                <ol>
                  {item.leaderboard.map((row, index) => (
                    <li key={row.id}>
                      <span className="pos">{index + 1}</span>
                      <PlayerPhoto src={row.photoUrl} name={row.name} />
                      {row.logoUrl ? <img className="logo-sm" src={row.logoUrl} alt="" /> : null}
                      <div>
                        <strong>{row.name}</strong>
                      </div>
                      <b>{row.votes}</b>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="muted">No votes yet</p>
              )}
            </section>
          ))}
        </div>
      )}

      {tab === 'show' && (() => {
        const decks = nightDecks(state, competition);
        const allRows = orderRunsheetRows(decks, runsheetOrder).filter((row) =>
          runsheetRowForComp(row, competition, decks)
        );
        const activeRows = allRows.filter((row) => runsheetIncluded(row.id));
        const unusedRows = allRows.filter((row) => !runsheetIncluded(row.id));
        const dragOver = runsheetDrag?.overId;
        const renderRow = (row, list, unused) => {
          const info = runsheetRowInfo(row, list, state);
          const current = !unused && state.presentation.runCurrent === row.id;
          const rowIndex = list.findIndex((item) => item.id === row.id);
          const next = rowIndex >= 0 ? list[rowIndex + 1] : null;
          const hasBoard = !unused && row.type === 'grade' && next?.type === 'leaderboard';
          return (
            <li
              key={row.id}
              className={`${current ? 'active' : ''}${dragOver === row.id ? ' drop' : ''}${runsheetDrag?.id === row.id ? ' dragging' : ''}${unused ? ' unused-row' : ''}${info.isGrade && !unused ? ' grade-row' : ''}${hasBoard ? ' has-board' : ''}${!unused && row.type === 'leaderboard' ? ' board-row' : ''}`.trim()}
              draggable
              onDragStart={(event) => {
                if (!runsheetDragHandle.current) {
                  event.preventDefault();
                  return;
                }
                event.dataTransfer.setData('text/plain', row.id);
                event.dataTransfer.effectAllowed = unused ? 'move' : 'move';
                setRunsheetDrag({ id: row.id, from: unused ? 'unused' : 'active', overId: row.id });
              }}
              onDragEnd={() => {
                runsheetDragHandle.current = false;
                setRunsheetDrag(null);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                if (runsheetDrag && runsheetDrag.overId !== row.id) {
                  setRunsheetDrag((currentDrag) => (currentDrag ? { ...currentDrag, overId: row.id } : currentDrag));
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                const fromId = runsheetDrag?.id || event.dataTransfer.getData('text/plain');
                if (!fromId) return;
                if (runsheetDrag?.from === 'unused' && !unused) restoreRunsheet(fromId);
                if (runsheetDrag?.from === 'active' && unused) parkRunsheet(fromId);
                moveRunsheetTo(fromId, row.id);
                setRunsheetDrag(null);
              }}
            >
              <span
                className="runsheet-handle"
                title="Drag to reorder"
                onPointerDown={() => {
                  runsheetDragHandle.current = true;
                }}
              >
                ⋮⋮
              </span>
              <div>
                <strong>{info.title}</strong>
                <small>{info.detail}</small>
              </div>
              {info.isGrade && !unused ? (
                <label>
                  Start round
                  <input
                    type="number"
                    min="1"
                    inputMode="numeric"
                    placeholder="Start"
                    value={presoStarts[row.id] ?? ''}
                    onChange={(event) =>
                      setPresoStarts((currentStarts) => ({ ...currentStarts, [row.id]: event.target.value }))
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        startRunsheet(row.id);
                      }
                    }}
                  />
                </label>
              ) : null}
              <div className="runsheet-actions">
                {unused ? (
                  <button type="button" onClick={() => restoreRunsheet(row.id)}>
                    Restore
                  </button>
                ) : (
                  <button type="button" onClick={() => parkRunsheet(row.id)}>
                    Remove
                  </button>
                )}
                {row.type === 'splash' && row.id !== RUNSHEET_SPLASH ? (
                  <button type="button" onClick={() => removeSplash(row.id)}>
                    Delete
                  </button>
                ) : null}
                {unused ? null : (
                  <button className="primary" type="button" onClick={() => startRunsheet(row.id)}>
                    From here
                  </button>
                )}
              </div>
            </li>
          );
        };
        const liveStatus =
          state.audienceView === 'splash'
            ? `Opening splash · ${state.splash?.roundName || 'Grand Final'}`
            : state.audienceView === 'leaderboard' && state.scoreboard?.leaderboardScope === 'grade'
              ? `Leaderboard · ${state.scoreboard?.medalTitle || state.scoreboard?.gradeName || 'Grade'}`
            : state.audienceView === 'toty'
              ? state.toty?.beat?.lineLabel
                ? `Team of the year · ${state.toty.beat.lineLabel}`
                : 'Team of the year'
              : state.audienceView === 'lifemembers'
                ? state.lifeMembers?.current?.name
                  ? `Life members · ${state.lifeMembers.current.name}`
                  : 'Life members'
                : `Slide ${(state.presentation.slideIndex ?? 0) + 1} of ${state.presentation.slides?.length ?? 0}`;
        return (
        <div className="show">
          <header className="show-toolbar">
            <button
              className="primary show-start-all"
              disabled={!activeRows.length}
              onClick={() => startRunsheet()}
            >
              Start night
            </button>
            <button type="button" onClick={() => api.presentationStep(-1)}>
              Back
            </button>
            <button className="primary" type="button" onClick={() => api.presentationStep(1)}>
              Next
            </button>
            <p className="show-status">{liveStatus}</p>
          </header>
          <div className="show-layout">
            <section className="show-night">
              <h3 className="runsheet-heading">On the night</h3>
              <p className="muted show-note">Each grade is followed by its leaderboard. Next walks this list.</p>
              <ul
                className="show-presos"
                onDragOver={(event) => {
                  if (runsheetDrag?.from === 'unused') event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const fromId = runsheetDrag?.id || event.dataTransfer.getData('text/plain');
                  if (fromId) restoreRunsheet(fromId);
                  setRunsheetDrag(null);
                }}
              >
                {activeRows.length ? activeRows.map((row) => renderRow(row, activeRows, false)) : (
                  <li className="runsheet-empty">Nothing on the night yet. Restore a row from Unused, or add a splash.</li>
                )}
              </ul>
            </section>
            <aside className="show-rail">
              <section>
                <h3 className="runsheet-heading">Audience</h3>
                <div className="present-target">
                  <button
                    type="button"
                    className={state.settings?.presentTarget !== 'obs' ? 'primary' : ''}
                    onClick={() => api.setPresentTarget('display')}
                  >
                    Second display
                  </button>
                  <button
                    type="button"
                    className={state.settings?.presentTarget === 'obs' ? 'primary' : ''}
                    onClick={() => api.setPresentTarget('obs')}
                  >
                    OBS
                  </button>
                </div>
                {state.settings?.presentTarget === 'obs' ? (
                  <div className="obs-box">
                    <p className="muted">
                      In OBS add a Browser source with this address. Set it to 1920 × 1080, and leave Shutdown source when not visible unticked.
                    </p>
                    <button
                      type="button"
                      disabled={!state.obsUrl}
                      onClick={() => state.obsUrl && api.copyText(state.obsUrl)}
                    >
                      {state.obsUrl || 'Starting the OBS page…'}
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => api.toggleAudience()}>
                    {state.audienceOpen ? 'Close second display' : 'Open second display'}
                  </button>
                )}
                <div className="show-audience">
                  <button
                    className={state.audienceView === 'presentation' ? 'primary' : ''}
                    onClick={() => api.showPresentation()}
                  >
                    Medal count
                  </button>
                  <button
                    className={state.audienceView === 'splash' ? 'primary' : ''}
                    onClick={() => api.showSplash()}
                  >
                    Opening splash
                  </button>
                  <button
                    className={state.audienceView === 'toty' ? 'primary' : ''}
                    onClick={() => api.showToty()}
                  >
                    Team of the year
                  </button>
                  <button
                    className={state.audienceView === 'lifemembers' ? 'primary' : ''}
                    onClick={() => api.showLifeMembers()}
                  >
                    Life members
                  </button>
                  <button onClick={() => api.showScoreboard()}>Live vote count</button>
                  <button onClick={() => api.showLeaderboard()}>All grades</button>
                </div>
              </section>
              <section>
                <h3 className="runsheet-heading">Unused</h3>
                <ul
                  className="show-presos unused"
                  onDragOver={(event) => {
                    if (runsheetDrag?.from === 'active') event.preventDefault();
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const fromId = runsheetDrag?.id || event.dataTransfer.getData('text/plain');
                    if (fromId) parkRunsheet(fromId);
                    setRunsheetDrag(null);
                  }}
                >
                  {unusedRows.length ? unusedRows.map((row) => renderRow(row, unusedRows, true)) : (
                    <li className="runsheet-empty">Removed rows land here. Restore puts them back on the night.</li>
                  )}
                </ul>
              </section>
              <section>
                <h3 className="runsheet-heading">Team of the year sponsor</h3>
                <ul className="sponsor-picks">
                  {(state.sponsors ?? []).map((sponsor) => (
                    <li key={sponsor.id}>
                      <button
                        type="button"
                        className={sponsor.id === state.toty?.sponsor?.id ? 'active' : ''}
                        onClick={() => api.setTotySponsor(sponsor.id === state.toty?.sponsor?.id ? null : sponsor.id)}
                      >
                        {sponsor.imageUrl ? <img src={sponsor.imageUrl} alt="" /> : null}
                        <span>{sponsor.name || 'Sponsor'}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {!(state.sponsors ?? []).length ? (
                  <p className="muted">Add a sponsor on the Sponsors tab first.</p>
                ) : null}
              </section>
            </aside>
          </div>
          <div className="show-toolbar-actions">
            <button type="button" onClick={createNightRunsheet}>
              Create runsheet
            </button>
            <button
              type="button"
              disabled={!activeRows.length}
              onClick={() => setPrintJob(printJobForRunsheet(activeRows, state, presoStarts))}
            >
              Print
            </button>
            <button
              type="button"
              disabled={!activeRows.length}
              onClick={() =>
                setPrintJob({
                  ...printJobForRunsheet(activeRows, state, presoStarts),
                  action: 'save',
                  fileName: runsheetFileName(state.season),
                })
              }
            >
              Save
            </button>
            <button type="button" onClick={addSplash}>
              Add splash
            </button>
            <button type="button" className="ghost" onClick={() => setRunsheetOrder([])}>
              Reset order
            </button>
          </div>
        </div>
        );
      })()}

      {tab === 'settings' && <SettingsPanel state={state} grade={grade} grades={visibleGrades} />}

      {tab === 'sponsors' && (
        <div className="sponsors">
          <p>Sponsors are stored on this PC and shown on every audience slide. They work offline.</p>
          <button className="primary" onClick={() => api.addSponsor()}>
            Add sponsor images
          </button>
          <ul>
            {(state.sponsors ?? []).map((sponsor) => (
              <li key={sponsor.id}>
                {sponsor.imageUrl ? <img src={sponsor.imageUrl} alt="" /> : null}
                <input
                  defaultValue={sponsor.name}
                  onBlur={(event) => api.renameSponsor(sponsor.id, event.target.value)}
                />
                <button onClick={() => api.moveSponsor(sponsor.id, -1)}>Up</button>
                <button onClick={() => api.moveSponsor(sponsor.id, 1)}>Down</button>
                <button onClick={() => api.removeSponsor(sponsor.id)}>Remove</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
    {printJob ? <PrintSheet job={printJob} /> : null}
    {announcerOpen ? (
      <AnnouncerPicker
        grades={visibleGrades}
        selectedIds={announcerIds}
        onChange={setAnnouncerIds}
        onCancel={() => setAnnouncerOpen(false)}
        onPrint={() => {
          const selected = (state.grades ?? []).filter((item) => announcerIds.includes(item.id));
          if (!selected.length) return;
          setPrintJob(printJobForAnnouncer(selected, state));
          setAnnouncerOpen(false);
        }}
        onSave={() => {
          const selected = (state.grades ?? []).filter((item) => announcerIds.includes(item.id));
          if (!selected.length) return;
          setPrintJob({
            ...printJobForAnnouncer(selected, state),
            action: 'save',
            fileName: announcerFileName(selected, state.season),
          });
          setAnnouncerOpen(false);
        }}
      />
    ) : null}
    </>
  );
}

function printJobForGrade(grade, state) {
  return {
    kind: 'leaderboard',
    title: grade.medalTitle || grade.name,
    subtitle: grade.name,
    season: grade.season || state.season,
    leagueName: state.settings?.leagueName || 'Whyalla Football League',
    logoUrl: state.wflLogoUrl,
    rows: grade.leaderboard ?? [],
  };
}

function printJobForSlide(slide, state) {
  return {
    kind: 'leaderboard',
    title: slide.medalTitle || 'Medal Count',
    subtitle: `Top ${slide.topN ?? (slide.board ?? []).length} after ${slide.throughRound}`,
    season: slide.season || state.season,
    leagueName: state.settings?.leagueName || 'Whyalla Football League',
    logoUrl: state.wflLogoUrl,
    rows: slide.board ?? [],
  };
}

function announcerPicks(game, clubs = []) {
  return [3, 2, 1].map((points) => {
    const key = points === 3 ? 'three' : points === 2 ? 'two' : 'one';
    const player = (game.players ?? []).find((item) => item.id === game.votes?.[key]);
    if (!player) {
      return { points, name: '—', number: '', logoUrl: null };
    }
    const club =
      (clubs ?? []).find((item) => item.id === player.clubId) ??
      (clubs ?? []).find((item) => item.name === player.clubName);
    return {
      points,
      name: player.name,
      number: player.number || '',
      logoUrl: club?.logoUrl ?? null,
    };
  });
}

function announcerPageGroups(rounds) {
  const buckets = [[], [], [], []];
  const extra = [];
  for (const round of rounds ?? []) {
    const n = round.n;
    if (n == null) extra.push(round);
    else if (n < 5) buckets[0].push(round);
    else if (n < 9) buckets[1].push(round);
    else if (n < 13) buckets[2].push(round);
    else buckets[3].push(round);
  }
  const pages = buckets.filter((bucket) => bucket.length);
  if (extra.length) {
    if (pages.length) pages[pages.length - 1].push(...extra);
    else pages.push(extra);
  }
  return pages;
}

function announcerPageVoteStyle(rounds, { first = false, hasGradeTitle = false, hasWinner = false, lastSheet = false } = {}) {
  const pageMm = first ? 268 : lastSheet ? 276 : 284;
  let used = 4;
  if (hasGradeTitle) used += 9;
  if (hasWinner) used += 16;
  let votes = 0;
  for (const round of rounds ?? []) {
    used += 7;
    for (const game of round.games ?? []) {
      used += 5.6;
      if (game.forfeit) used += 4;
      else votes += (game.picks ?? []).length;
    }
  }
  if (!votes) return undefined;
  const row = Math.max(3.4, (pageMm - used) / votes);
  return { '--vote-row': `${row.toFixed(3)}mm` };
}

function announcerRounds(grade, clubs) {
  return (grade?.rounds ?? []).map((round) => ({
    name: round.name,
    n: (() => {
      const match = String(round.name ?? '').match(/\b(?:round|rd)\s*(\d+)\b/i);
      const value = match ? Number(match[1]) : NaN;
      return Number.isFinite(value) ? value : null;
    })(),
    games: (round.games ?? []).map((game) => ({
      id: game.id,
      homeName: game.homeName,
      awayName: game.awayName,
      scoreLine: game.scoreLine,
      forfeit: game.forfeit,
      forfeitLine: game.forfeitLine,
      picks: announcerPicks(game, clubs),
    })),
  }));
}

function runsheetFileName(season) {
  const year = season || new Date().getFullYear();
  return `WFL-Runsheet-${year}.pdf`;
}

function printJobForRunsheet(rows, state, presoStarts) {
  const items = (rows ?? [])
    .filter((row) => row.type !== 'splash' && row.type !== 'home')
    .map((row, index) => {
    const info = runsheetRowInfo(row, rows, state);
    if (row.type === 'toty') {
      return {
        id: row.id,
        n: index + 1,
        kind: 'toty',
        title: info.title,
        detail: 'Lines one at a time, then the field',
      };
    }
    if (row.type === 'lifemembers') {
      const count = (state.lifeMembers?.members ?? []).length;
      return {
        id: row.id,
        n: index + 1,
        kind: 'life',
        title: info.title,
        detail: count
          ? `${count} ${count === 1 ? 'recipient' : 'recipients'}`
          : 'No recipients yet',
      };
    }
    if (row.type === 'leaderboard') {
      return {
        id: row.id,
        n: index + 1,
        kind: 'board',
        title: info.title,
        detail: info.detail,
        cue: 'Full leaderboard after this grade',
      };
    }
    const deck = nightDecks(state, state.competition).find((item) => item.id === row.id);
    const start = String(presoStarts?.[row.id] ?? '').trim();
    return {
      id: row.id,
      n: index + 1,
      kind: 'grade',
      title: deck?.medalTitle || deck?.name || info.title,
      detail: [deck?.name && deck.name !== deck.medalTitle ? deck.name : null, start ? `From round ${start}` : info.detail]
        .filter(Boolean)
        .join(' · '),
      cue: 'Title slide, then the count, then the award, then the leaderboard',
    };
  });
  return {
    kind: 'runsheet',
    title: 'Medal Count',
    subtitle: 'Night runsheet',
    season: state.season,
    leagueName: state.settings?.leagueName || 'Whyalla Football League',
    logoUrl: state.wflLogoUrl,
    items,
  };
}

function printJobForAnnouncer(grades, state) {
  const list = (Array.isArray(grades) ? grades : [grades]).filter(Boolean);
  const first = list[0];
  return {
    kind: 'announcer',
    title: list.length === 1 ? first?.medalTitle || first?.name || 'Medal Count' : 'Medal Count',
    subtitle: list.length === 1 ? 'Announcer sheet' : `${list.length} announcer sheets`,
    season: first?.season || state.season,
    leagueName: state.settings?.leagueName || 'Whyalla Football League',
    logoUrl: state.wflLogoUrl,
    sections: list.map((grade) => ({
      id: grade.id,
      title: grade.medalTitle || grade.name,
      name: grade.name,
      rounds: announcerRounds(grade, state.clubs),
      winner: grade.leaderboard?.[0]
        ? {
            name: grade.leaderboard[0].name,
            number: grade.leaderboard[0].number || '',
            logoUrl: grade.leaderboard[0].logoUrl ?? null,
            photoUrl: grade.leaderboard[0].photoUrl ?? null,
            votes: grade.leaderboard[0].votes,
          }
        : null,
    })),
  };
}

function PrintSheet({ job }) {
  const rows = job.rows ?? [];
  const items = job.items ?? [];
  const sections =
    job.sections ??
    [{ id: 'one', title: job.title, rounds: job.rounds ?? [] }];
  const many = sections.length > 1;
  return (
    <div className={`print-sheet${job.kind === 'announcer' ? ' announcer' : ''}${job.kind === 'runsheet' ? ' runsheet' : ''}`}>
      <header className="print-head">
        {job.logoUrl ? <img src={job.logoUrl} alt="" /> : null}
        <div>
          <p>{job.leagueName}</p>
          <h1>{job.title}</h1>
          <h2>
            {job.subtitle}
            {job.season ? ` · ${job.season}` : ''}
          </h2>
        </div>
      </header>
      {job.kind === 'runsheet' ? (
        <>
          <ol className="print-runsheet">
            {items.map((item) => (
              <li key={item.id} className={`print-run-item ${item.kind}`}>
                <b>{String(item.n).padStart(2, '0')}</b>
                <div>
                  <h3>{item.title}</h3>
                  {item.detail ? <p>{item.detail}</p> : null}
                  {item.cue ? <p className="print-run-cue">{item.cue}</p> : null}
                </div>
              </li>
            ))}
          </ol>
          <p className="print-foot">
            Night runsheet · no votes or winners · {job.action === 'save' ? 'saved' : 'printed'} {new Date().toLocaleString()}
          </p>
        </>
      ) : job.kind === 'announcer' ? (
        <>
          {sections.map((section, index) => {
            const pages = announcerPageGroups(section.rounds);
            return (
            <section key={section.id || section.title} className={`print-grade${index ? ' next' : ''}`}>
              {pages.map((rounds, pageIndex) => {
                const first = index === 0 && pageIndex === 0;
                const lastOfSection = pageIndex === pages.length - 1;
                const lastSheet = index === sections.length - 1 && lastOfSection;
                const hasGradeTitle = pageIndex === 0 && many;
                const hasWinner = lastOfSection && Boolean(section.winner);
                return (
                <div
                  key={`${section.id}-page-${pageIndex}`}
                  className={`print-page${first ? ' first' : ''}${lastSheet ? ' last-sheet' : ''}`}
                  style={announcerPageVoteStyle(rounds, { first, hasGradeTitle, hasWinner, lastSheet })}
                >
              {pageIndex === 0 && many ? (
                <h2 className="print-grade-title">
                  {section.title}
                  {section.name && section.name !== section.title ? ` · ${section.name}` : ''}
                </h2>
              ) : null}
              {rounds.map((round) => (
                <section key={`${section.id}-${round.name}`} className="print-round">
                  <h3>{round.name}</h3>
                  {(round.games ?? []).map((game) => (
                    <article key={game.id} className="print-game">
                      <div className="print-match">
                        <strong>
                          {game.homeName} v {game.awayName}
                        </strong>
                        <span>{game.forfeit ? game.forfeitLine || 'Forfeit' : game.scoreLine || '—'}</span>
                      </div>
                      {game.forfeit ? (
                        <p className="print-skip">No 3-2-1</p>
                      ) : (
                        <ol>
                          {game.picks.map((pick) => (
                            <li key={pick.points}>
                              <b>{pick.points}</b>
                              {pick.logoUrl ? <img className="print-club" src={pick.logoUrl} alt="" /> : <i className="print-club" />}
                              <span>
                                {pick.name}
                                {pick.number ? <small>No. {pick.number}</small> : null}
                              </span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </article>
                  ))}
                </section>
              ))}
              {pageIndex === pages.length - 1 && section.winner ? (
                <div className="print-winner">
                  <p>And the winner is</p>
                  <div className="print-winner-who">
                    {section.winner.photoUrl ? (
                      <img className="print-photo" src={section.winner.photoUrl} alt="" />
                    ) : null}
                    {section.winner.logoUrl ? (
                      <img className="print-club" src={section.winner.logoUrl} alt="" />
                    ) : null}
                    <span>
                      <strong>{section.winner.name}</strong>
                      <small>
                        {[section.winner.number ? `No. ${section.winner.number}` : '', `${section.winner.votes} votes`]
                          .filter(Boolean)
                          .join(' · ')}
                      </small>
                    </span>
                  </div>
                </div>
              ) : null}
                </div>
                );
              })}
            </section>
            );
          })}
          <p className="print-foot">
            Announcer copy · {job.action === 'save' ? 'saved' : 'printed'} {new Date().toLocaleString()}
          </p>
        </>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th className="num">#</th>
                <th>Player</th>
                <th>Club</th>
                <th className="num">3s</th>
                <th className="num">2s</th>
                <th className="num">1s</th>
                <th className="num">Votes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id || index}>
                  <td className="num">{index + 1}</td>
                  <td>
                    <span className="print-player">
                      {row.photoUrl ? <img className="print-photo" src={row.photoUrl} alt="" /> : null}
                      {row.logoUrl ? <img className="print-club" src={row.logoUrl} alt="" /> : null}
                      <strong>{row.name}</strong>
                    </span>
                  </td>
                  <td>{row.clubName}</td>
                  <td className="num">{row.threes ?? 0}</td>
                  <td className="num">{row.twos ?? 0}</td>
                  <td className="num">{row.ones ?? 0}</td>
                  <td className="num votes">{row.votes}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="print-foot">Printed {new Date().toLocaleString()}</p>
        </>
      )}
    </div>
  );
}

function announcerFileName(grades, season) {
  const year = season || new Date().getFullYear();
  const safe = (value) => String(value || '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
  if (grades.length === 1) return `WFL-Announcer-${safe(grades[0].name)}-${year}.pdf`;
  return `WFL-Announcer-${year}.pdf`;
}

function AnnouncerPicker({ grades, selectedIds, onChange, onCancel, onPrint, onSave }) {
  function toggle(id) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]);
  }
  return (
    <div className="modal-back" onClick={onCancel} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-labelledby="announcer-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="announcer-title">Print announcer sheets</h3>
        <p className="muted">Choose which grades to include, then print or save a PDF copy to the desktop.</p>
        <div className="row">
          <button type="button" onClick={() => onChange(grades.map((item) => item.id))}>
            All
          </button>
          <button type="button" onClick={() => onChange([])}>
            None
          </button>
        </div>
        <ul className="picker">
          {grades.map((item) => (
            <li key={item.id}>
              <label>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(item.id)}
                  onChange={() => toggle(item.id)}
                />
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.medalTitle}</small>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <div className="row">
          <button className="primary" type="button" disabled={!selectedIds.length} onClick={onPrint}>
            Print
          </button>
          <button type="button" disabled={!selectedIds.length} onClick={onSave}>
            Save to desktop
          </button>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsPanel({ state, grade, grades }) {
  const s = state.settings ?? {};
  const medalKeys = Object.keys(s.medalTitles ?? {});

  function setFlag(key, value) {
    api.updateSettings({ [key]: value });
  }

  return (
    <div className="settings">
      <div className="settings-grid">
        <section>
          <h3>League & branding</h3>
          <SettingText
            label="League name"
            hint="Shown at the top of the audience display"
            value={s.leagueName}
            onCommit={(value) => setFlag('leagueName', value)}
          />
          <Toggle
            label="Show league name"
            hint="Name above the medal title on audience slides"
            checked={s.showLeagueName}
            onChange={(value) => setFlag('showLeagueName', value)}
          />
          <Toggle
            label="Show WFL logo"
            hint="Oval logo in the top-left of audience slides"
            checked={s.showWflLogo}
            onChange={(value) => setFlag('showWflLogo', value)}
          />
          <Toggle
            label="Show season year"
            hint="Year in the top-right of audience slides"
            checked={s.showSeasonYear}
            onChange={(value) => setFlag('showSeasonYear', value)}
          />
          <Toggle
            label="Show sponsors"
            hint="Sponsor strip on audience slides"
            checked={s.showSponsors}
            onChange={(value) => setFlag('showSponsors', value)}
          />
          <Toggle
            label="Placeholder grand final"
            hint="If the grand final isn’t filled in yet, put two random clubs on the opening splash"
            checked={s.placeholderGrandFinal}
            onChange={(value) => setFlag('placeholderGrandFinal', value)}
          />
        </section>

        <section>
          <h3>Audience window</h3>
          <div className="present-target">
            <button
              type="button"
              className={s.presentTarget !== 'obs' ? 'primary' : ''}
              onClick={() => api.setPresentTarget('display')}
            >
              Second display
            </button>
            <button
              type="button"
              className={s.presentTarget === 'obs' ? 'primary' : ''}
              onClick={() => api.setPresentTarget('obs')}
            >
              OBS
            </button>
          </div>
          {s.presentTarget === 'obs' ? (
            <p className="muted">
              Browser source in OBS: {state.obsUrl || 'starting…'}. Set the source to 1920 × 1080 and leave Shutdown source when not visible unticked.
            </p>
          ) : null}
          <p className="muted">
            {state.audienceView === 'leaderboard'
              ? 'Audience is on the full leaderboard.'
              : state.audienceView === 'scoreboard'
                ? 'Audience is on the live vote count.'
                : state.audienceView === 'toty'
                  ? 'Audience is on Team of the year. Next/Back reveals one player at a time, then the field.'
                  : state.audienceView === 'lifemembers'
                    ? 'Audience is on life members. Next/Back goes title, then one recipient at a time.'
                    : state.audienceView === 'splash'
                      ? 'Audience is on the opening splash. Next starts the medal count.'
                  : 'Audience is on medal count.'}
          </p>
          <div className="row">
            <button className="primary" onClick={() => api.toggleAudience()}>
              Audience display
            </button>
            <button
              className={state.audienceView === 'presentation' ? 'primary' : ''}
              onClick={() => api.showPresentation()}
            >
              Medal count
            </button>
            <button
              className={state.audienceView === 'splash' ? 'primary' : ''}
              onClick={() => api.showSplash()}
            >
              Opening splash
            </button>
            <button
              className={state.audienceView === 'toty' ? 'primary' : ''}
              onClick={() => api.showToty()}
            >
              Team of the year
            </button>
            <button
              className={state.audienceView === 'lifemembers' ? 'primary' : ''}
              onClick={() => api.showLifeMembers()}
            >
              Life members
            </button>
            <button onClick={() => api.showScoreboard()}>Live vote count</button>
            <button onClick={() => api.showLeaderboard()}>Full leaderboard</button>
          </div>
          <Toggle
            label="Fullscreen"
            hint="Fills the screen on this device. With two monitors it uses the other display."
            checked={s.audienceFullscreen}
            onChange={(value) => setFlag('audienceFullscreen', value)}
          />
          <Toggle
            label="Always on top"
            hint="Keeps the audience window above other apps"
            checked={s.audienceAlwaysOnTop}
            onChange={(value) => setFlag('audienceAlwaysOnTop', value)}
          />
        </section>

        <section>
          <h3>Presentation slides</h3>
          <p className="muted">Changes apply to the slide list straight away.</p>
          <Toggle
            label="Opening title slide"
            hint="Medal name before the first round"
            checked={s.showTitleSlide}
            onChange={(value) => setFlag('showTitleSlide', value)}
          />
          <Toggle
            label="Round scoreboard"
            hint="Logos and scores before each round’s votes"
            checked={s.showRoundScoreboard}
            onChange={(value) => setFlag('showRoundScoreboard', value)}
          />
          <Toggle
            label="Forfeit slides"
            hint="A dedicated slide naming the team that forfeits"
            checked={s.showForfeitSlides}
            onChange={(value) => setFlag('showForfeitSlides', value)}
          />
          <Toggle
            label="Hold slide before votes"
            hint="Show the score first, then reveal 3-2-1"
            checked={s.showVoteHoldSlide}
            onChange={(value) => setFlag('showVoteHoldSlide', value)}
          />
          <Toggle
            label="Match score on votes"
            hint="Score tile above the 3-2-1 cards"
            checked={s.showMatchScoreOnVotes}
            onChange={(value) => setFlag('showMatchScoreOnVotes', value)}
          />
          <Toggle
            label="Leaderboard after each round"
            hint="Running tally once that round’s votes are done"
            checked={s.showLeaderboardAfterRound}
            onChange={(value) => setFlag('showLeaderboardAfterRound', value)}
          />
          <Toggle
            label="Winner slide"
            hint="Season winner after the last round"
            checked={s.showWinnerSlide}
            onChange={(value) => setFlag('showWinnerSlide', value)}
          />
          <Toggle
            label="Include finals"
            hint="Off by default. Medal votes are home-and-away only."
            checked={s.showFinals}
            onChange={(value) => setFlag('showFinals', value)}
          />
          <SettingNumber
            label="Leaderboard size"
            hint="How many players to show (3–20)"
            value={s.leaderboardSize}
            min={3}
            max={20}
            onCommit={(value) => setFlag('leaderboardSize', value)}
          />
        </section>

        <section>
          <h3>Names & medals</h3>
          <p className="muted">Override the grade button labels and medal titles shown to the audience.</p>
          {medalKeys.map((key) => (
            <div key={key} className="name-pair">
              <SettingText
                label={`${key} label`}
                value={s.gradeLabels?.[key] ?? ''}
                onCommit={(value) => api.updateSettings({ gradeLabels: { [key]: value } })}
              />
              <SettingText
                label={`${key} medal`}
                value={s.medalTitles?.[key] ?? ''}
                onCommit={(value) => api.updateSettings({ medalTitles: { [key]: value } })}
              />
            </div>
          ))}
        </section>

        <section>
          <h3>Live vote count</h3>
          <p className="muted">
            Full-screen medal tally for the selected grade. It updates as 3-2-1 is entered, and sits beside each game in the presentation.
          </p>
          <div className="round-picks">
            {(grades ?? state.grades ?? []).map((item) => (
              <button
                key={item.id}
                className={item.id === grade?.id ? 'active' : ''}
                onClick={() => api.setActiveGrade(item.id)}
              >
                {item.name}
              </button>
            ))}
          </div>
          <div className="row">
            <button className="primary" onClick={() => api.showScoreboard()}>
              Show live vote count
            </button>
            <button onClick={() => api.showLeaderboard()}>Show full leaderboard</button>
            <button onClick={() => api.showToty()}>Show team of the year</button>
            <button onClick={() => api.showLifeMembers()}>Show life members</button>
            <button onClick={() => api.showSplash()}>Show opening splash</button>
            <button onClick={() => api.showPresentation()}>Show medal count</button>
          </div>
        </section>

        <section>
          <h3>Season data</h3>
          <p className="muted">
            {state.season} · {state.sync?.running ? state.sync.message : `Last sync: ${formatWhen(state.lastSyncedAt)}`}
          </p>
          <div className="row">
            <button className="primary" disabled={state.sync?.running} onClick={() => api.syncSeason()}>
              {state.sync?.running ? 'Syncing…' : 'Sync from website'}
            </button>
            <button onClick={() => api.openDataFolder()}>Open data folder</button>
            <button
              onClick={() => {
                if (
                  window.confirm(
                    'Fill 3-2-1 at random for every game, and fill Team of the year from League players? This replaces votes and TOTY picks already entered. Forfeits stay empty.'
                  )
                ) {
                  api.fillRandomVotes();
                }
              }}
            >
              Randomly fill 3-2-1
            </button>
          </div>
          <p className="muted">
            Random fill picks three different players from each team sheet and a full League team of the year. Use it to test the presentation or leaderboard.
          </p>
          <div className="row">
            <button
              onClick={() => {
                if (
                  window.confirm(
                    'Clear the app? This deletes games, votes, players, clubs, team of the year, life members, and sponsors — like a fresh install. Settings stay. Sync from the website after this.'
                  )
                ) {
                  api.resetSeason();
                }
              }}
            >
              Clear app data
            </button>
          </div>
          <p className="muted">
            Wipes season data as if the app was newly installed. Settings are kept. Then use Sync from website.
          </p>
          {state.dataPath ? <p className="muted path">{state.dataPath}</p> : null}
          <Toggle
            label="Refresh scores when the app opens"
            hint="Quiet MatchDay score update at launch for game results"
            checked={s.refreshScoresOnLaunch}
            onChange={(value) => setFlag('refreshScoresOnLaunch', value)}
          />
        </section>

        <section>
          <h3>Hotkeys</h3>
          <p className="muted">
            Work from this window or the audience display. Ignored while you are typing in a field.
          </p>
          <div className="hotkey-list">
            <div>
              <span className="hotkey-keys"><kbd>L</kbd></span>
              <span>Full leaderboard for every grade, five columns. Press again to return to medal count.</span>
            </div>
            <div>
              <span className="hotkey-keys"><kbd>V</kbd></span>
              <span>Live vote count (top players). Press again to return to medal count.</span>
            </div>
            <div>
              <span className="hotkey-keys"><kbd>T</kbd></span>
              <span>Switch straight to team of the year. Press again to return to medal count.</span>
            </div>
            <div>
              <span className="hotkey-keys"><kbd>M</kbd></span>
              <span>Switch straight to life members. Press again to return to medal count.</span>
            </div>
            <div>
              <span className="hotkey-keys"><kbd>H</kbd></span>
              <span>Open the control Home tab. Does not change the audience display.</span>
            </div>
            <div>
              <span className="hotkey-keys"><kbd>P</kbd></span>
              <span>Switch straight to medal count.</span>
            </div>
            <div>
              <span className="hotkey-keys"><kbd>F11</kbd></span>
              <span>Toggle audience fullscreen on this device.</span>
            </div>
            <div>
              <span className="hotkey-keys"><kbd>Esc</kbd></span>
              <span>Back to medal count from the leaderboard, live vote count, opening splash, team of the year, or life members.</span>
            </div>
            <div>
              <span className="hotkey-keys"><kbd>←</kbd> <kbd>→</kbd></span>
              <span>Previous / next slide on medal count, opening splash, Team of the year, or life members.</span>
            </div>
            <div>
              <span className="hotkey-keys"><kbd>Enter</kbd></span>
              <span>Next slide from Presentation, or from the audience window.</span>
            </div>
            <div>
              <span className="hotkey-keys"><kbd>Space</kbd></span>
              <span>Next slide on the audience window.</span>
            </div>
            <div>
              <span className="hotkey-keys"><kbd>Backspace</kbd></span>
              <span>Previous slide on the audience window.</span>
            </div>
          </div>
          <div className="row">
            <button
              onClick={() => {
                if (window.confirm('Reset every setting to the built-in defaults?')) api.resetSettings();
              }}
            >
              Reset all settings
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} />
      <span>
        <strong>{label}</strong>
        {hint ? <small>{hint}</small> : null}
      </span>
    </label>
  );
}

function SettingNumber({ label, hint, value, min, max, onCommit }) {
  const [draft, setDraft] = useState(String(value ?? ''));
  useEffect(() => {
    setDraft(String(value ?? ''));
  }, [value]);
  function commit() {
    const next = Number(draft);
    if (!Number.isFinite(next)) {
      setDraft(String(value ?? ''));
      return;
    }
    onCommit(next);
  }
  return (
    <label className="settings-field">
      <strong>{label}</strong>
      {hint ? <small>{hint}</small> : null}
      <input
        type="number"
        min={min}
        max={max}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
      />
    </label>
  );
}

function SettingText({ label, hint, value, onCommit }) {
  const [draft, setDraft] = useState(value ?? '');
  useEffect(() => {
    setDraft(value ?? '');
  }, [value]);
  return (
    <label className="settings-field">
      <strong>{label}</strong>
      {hint ? <small>{hint}</small> : null}
      <input
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => onCommit(draft)}
        onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
      />
    </label>
  );
}

function ClubMark({ src, name }) {
  if (src) return <NormalizedLogo src={src} alt={name} pad={0.06} />;
  const initial = String(name || '?').trim().charAt(0).toUpperCase();
  return <span className="club-mark">{initial}</span>;
}

function TeamColumn({ name, logo, players, votes, nextPick, onPick }) {
  return (
    <section>
      <header>
        {logo ? <NormalizedLogo src={logo} pad={0.06} /> : null}
        <h3>{name}</h3>
      </header>
      <ul>
        {players.map((player) => {
          const points =
            player.id === votes?.three ? 3 : player.id === votes?.two ? 2 : player.id === votes?.one ? 1 : null;
          return (
            <li key={player.id}>
              <button
                className={points ? `has-vote v${points}` : ''}
                disabled={!points && !nextPick}
                onClick={() => onPick(player.id)}
                title={points ? 'Click to remove this vote' : undefined}
              >
                <span className="num">{player.number || '—'}</span>
                <PlayerPhoto src={player.photoUrl} name={player.name} />
                <span className="who">
                  {player.name}
                  {player.captainRole ? <small>{player.captainRole.replaceAll('_', ' ')}</small> : null}
                </span>
                {points ? <b>{points}</b> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function slideLabel(slide, showGrade = false) {
  let label = slide.type;
  if (slide.type === 'title') label = `Opening · ${slide.medalTitle}`;
  else if (slide.type === 'round') label = `Scoreboard · ${slide.roundName}`;
  else if (slide.type === 'match') {
    label = slide.forfeit ? slide.forfeitLine || `${slide.homeName} v ${slide.awayName} · Forfeit` : `${slide.homeName} v ${slide.awayName}`;
  } else if (slide.type === 'votes') {
    if (slide.reveal == null) label = `${slide.homeName} v ${slide.awayName}`;
    else {
      const player = (slide.picks ?? []).find((pick) => pick.points === slide.reveal);
      label = `${slide.reveal} · ${player?.name ?? ''}`;
    }
  } else if (slide.type === 'vote') label = `${slide.points} · ${slide.name}`;
  else if (slide.type === 'leaderboard') label = `Top ${slide.topN ?? 8} after ${slide.throughRound}`;
  else if (slide.type === 'sponsor') label = `Sponsor · ${slide.name}`;
  else if (slide.type === 'winner') label = `Winner · ${slide.winner?.name ?? ''}`;
  if (showGrade && slide.gradeName) return `${slide.gradeName} · ${label}`;
  return label;
}
