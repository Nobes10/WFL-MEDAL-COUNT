import { useEffect, useMemo, useState } from 'react';
import {
  canonicalClubKey,
  UMPIRE_PAY_BANDS,
  UMPIRE_PAY_DUAL_FIELD_BANDS,
  umpirePayBandForId,
  umpirePayBandIdForGrade,
  umpirePayRatesForBand,
  umpireRolesForBand,
} from '../../electron/constants.js';

/** Default grades on every fixture sheet (blank rows if that grade has no game). */
const PAY_SHEET_CORE_BANDS = ['u15', 'u18', 'reserves', 'league'];

function normalizePayBandIds(bandIds) {
  const wanted = new Set(
    (bandIds?.length ? bandIds : PAY_SHEET_CORE_BANDS).map((id) => String(id))
  );
  return UMPIRE_PAY_BANDS.filter((band) => wanted.has(band.id)).map((band) => band.id);
}

function leagueTitle(competition, settings) {
  if (competition === 'wwfl') return "Whyalla Women's Football League";
  return settings?.leagueName || 'Whyalla Football League';
}

function formatPayRate(value) {
  if (value === '' || value == null) return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '');
}

function formatRolePayRate(roleType, rates, bandId) {
  if (roleType === 'field' && UMPIRE_PAY_DUAL_FIELD_BANDS.has(bandId)) {
    const two = formatPayRate(rates.field2);
    const three = formatPayRate(rates.field3 ?? rates.field);
    if (two && three) return `2:$${two} / 3:$${three}`;
    if (three) return `3:$${three}`;
    if (two) return `2:$${two}`;
    return '';
  }
  return formatPayRate(rates[roleType]);
}

function voteScaleFor(competition, grade) {
  if (competition === 'wwfl' || grade?.women) return [4, 3, 2, 1];
  return [3, 2, 1];
}

function formatSlipDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-AU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return date.toLocaleDateString('en-AU');
  }
}

function formatSlipTime(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-AU', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  } catch {
    return '';
  }
}

function payGameTimeValue(slip) {
  if (!slip?.date) return Number.MAX_SAFE_INTEGER;
  const date = slip.date instanceof Date ? slip.date : new Date(slip.date);
  if (Number.isNaN(date.getTime())) return Number.MAX_SAFE_INTEGER;
  return date.getTime();
}

function payCalendarDayKey(slip) {
  if (!slip?.date) return `nodate::${slip?.id || 'game'}`;
  const date = slip.date instanceof Date ? slip.date : new Date(slip.date);
  if (Number.isNaN(date.getTime())) return `nodate::${slip?.id || 'game'}`;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function payGameBlockLabel(slip) {
  const timeLabel = slip.timeLabel || formatSlipTime(slip.date);
  const match = [slip.homeName, slip.awayName].filter(Boolean).join(' v ');
  return [timeLabel, match].filter(Boolean).join(' · ') || slip.gradeName || 'Match';
}

function collectSlipGames(grades, competition) {
  const slips = [];
  for (const grade of grades ?? []) {
    const scale = voteScaleFor(competition, grade);
    for (const round of grade.rounds ?? []) {
      for (const game of round.games ?? []) {
        // Forfeits still count for pre-season print / pay sheets — umpires may still be rostered.
        const dateLabel = formatSlipDate(game.date);
        const payBandId = umpirePayBandIdForGrade(grade);
        slips.push({
          id: String(game.id),
          gradeId: String(grade.id),
          gradeName: grade.name || grade.sourceName || 'Grade',
          sourceName: grade.sourceName || '',
          medalTitle: grade.medalTitle || '',
          payBandId,
          payBandOrder: umpirePayBandForId(payBandId)?.order ?? 99,
          roundId: String(round.id ?? round.name),
          roundName: round.displayName || round.name || 'Round',
          homeName: game.homeName || 'Home',
          awayName: game.awayName || 'Away',
          venueName: String(game.venueName || '').trim(),
          date: game.date || null,
          dateLabel,
          forfeit: Boolean(game.forfeit),
          scale,
        });
      }
    }
  }
  return slips;
}

function gradesFromSlips(slips) {
  const list = [];
  const seen = new Set();
  for (const slip of slips) {
    if (seen.has(slip.gradeId)) continue;
    seen.add(slip.gradeId);
    list.push({
      id: slip.gradeId,
      name: slip.gradeName,
      medalTitle: slip.medalTitle,
    });
  }
  return list;
}

function roundsForGrade(slips, gradeId) {
  const list = [];
  const byId = new Map();
  for (const slip of slips) {
    if (slip.gradeId !== gradeId) continue;
    let round = byId.get(slip.roundId);
    if (!round) {
      round = { id: slip.roundId, name: slip.roundName, slips: [] };
      byId.set(slip.roundId, round);
      list.push(round);
    }
    round.slips.push(slip);
  }
  return list;
}

function blankSlips(competition, count, season) {
  const scale = competition === 'wwfl' ? [4, 3, 2, 1] : [3, 2, 1];
  const n = Math.max(1, Math.min(60, Math.round(Number(count) || 1)));
  return Array.from({ length: n }, (_, index) => ({
    id: `blank-${index + 1}`,
    gradeId: 'blank',
    gradeName: '',
    medalTitle: '',
    roundId: 'blank',
    roundName: '',
    homeName: '',
    awayName: '',
    venueName: '',
    date: null,
    dateLabel: '',
    scale,
    blank: true,
    season,
  }));
}

export function printJobForUmpireSlips({ slips, competition, state, action = 'print' }) {
  const list = slips ?? [];
  const year = state?.season || new Date().getFullYear();
  const tag = competition === 'wwfl' ? 'WWFL' : 'WFL';
  return {
    kind: 'umpire-slips',
    action,
    fileName: `${tag}-Umpire-Vote-Slips-${year}.pdf`,
    title: 'Umpire vote slips',
    season: year,
    competition,
    leagueName: leagueTitle(competition, state?.settings),
    logoUrl: state?.wflLogoUrl,
    scaleLabel: competition === 'wwfl' ? '4-3-2-1' : '3-2-1',
    slips: list,
  };
}

export function printJobForUmpireEnvelopes({ slips, competition, state, action = 'print' }) {
  const list = (slips ?? []).filter((slip) => !slip.blank);
  const year = state?.season || new Date().getFullYear();
  const tag = competition === 'wwfl' ? 'WWFL' : 'WFL';
  return {
    kind: 'umpire-envelopes',
    action,
    fileName: `${tag}-Umpire-Envelopes-${year}.pdf`,
    title: 'Umpire vote envelopes',
    season: year,
    competition,
    leagueName: leagueTitle(competition, state?.settings),
    logoUrl: state?.wflLogoUrl,
    scaleLabel: competition === 'wwfl' ? '4-3-2-1' : '3-2-1',
    slips: list,
  };
}

function rolesForSlip(slip, payRates) {
  const bandId = slip.payBandId || umpirePayBandIdForGrade(slip);
  const rates = umpirePayRatesForBand(payRates, bandId);
  return umpireRolesForBand(bandId).map((role) => ({
    ...role,
    rate: formatRolePayRate(role.type, rates, bandId),
    rateIsPlain: !(role.type === 'field' && UMPIRE_PAY_DUAL_FIELD_BANDS.has(bandId)),
  }));
}

function normalizePayRoundKey(slip) {
  const name = String(slip?.roundName || '');
  const numbered = name.match(/round\s*(\d+)/i) || name.match(/\br\s*(\d+)\b/i);
  if (numbered) return `r${numbered[1]}`;
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (cleaned) return cleaned;
  return String(slip?.roundId || 'round').toLowerCase();
}

/** Club pairing for a fixture, order-independent (West v South == South v West). */
function payFixturePairKey(slip) {
  const home = canonicalClubKey(slip?.homeName) || String(slip?.homeName || '').trim().toUpperCase();
  const away = canonicalClubKey(slip?.awayName) || String(slip?.awayName || '').trim().toUpperCase();
  return [home, away].filter(Boolean).sort().join('::') || 'fixture';
}

function payFixtureSheetKey(slip) {
  return `${normalizePayRoundKey(slip)}::${payFixturePairKey(slip)}`;
}

/**
 * Expand a selection to every grade for the same round fixture.
 * Selecting Round 1 West v South in one grade pulls 15s, 18s, Reserves and League.
 */
export function expandPaySheetSlips(selectedSlips, allSlips) {
  const selected = (selectedSlips ?? []).filter((slip) => !slip.blank);
  if (!selected.length) return [];
  const keys = new Set(selected.map(payFixtureSheetKey));
  const pool = (allSlips ?? []).filter((slip) => !slip.blank);
  const expanded = pool.filter((slip) => keys.has(payFixtureSheetKey(slip)));
  return expanded.length ? expanded : selected;
}

function featuredPayMatch(games) {
  if (!games?.length) return null;
  return (
    games.find((game) => game.payBandId === 'league' || game.payBandId === 'women') ||
    games.find((game) => game.payBandId === 'reserves') ||
    games[games.length - 1]
  );
}

function pickSheetVenue(games) {
  const featured = featuredPayMatch(games);
  if (featured?.venueName) return String(featured.venueName).trim();
  const named = (games ?? []).map((game) => String(game.venueName || '').trim()).filter(Boolean);
  return named[0] || '';
}

function payRoundSortValue(sheet) {
  const name = `${sheet?.roundName || ''} ${sheet?.roundKey || ''}`;
  if (/\bgrand\s*final/i.test(name)) return 10000;
  if (/\bpreliminary/i.test(name)) return 9000;
  if (/\bsemi/i.test(name)) return 8000;
  if (/\bqualifying|\belimination|\bfinal/i.test(name)) return 7000;
  const numbered = name.match(/round\s*(\d+)/i) || name.match(/\br(\d+)\b/i);
  if (numbered) return Number(numbered[1]);
  return 0;
}

function payVenueSortKey(venueName) {
  const venue = String(venueName || '').trim().toLowerCase();
  // Memorial first, then the rest A–Z.
  if (/memorial/.test(venue)) return `0-${venue}`;
  return `1-${venue || 'zzz'}`;
}

function paySheetDateValue(sheet) {
  const games = sheet?.games ?? [];
  for (const game of games) {
    if (game.placeholder || !game.date) continue;
    const date = game.date instanceof Date ? game.date : new Date(game.date);
    if (!Number.isNaN(date.getTime())) return date.getTime();
  }
  return 0;
}

/** Memorial last→first through the season, then the same for every other ground. */
function sortPaySheetsByVenueThenSeasonEnd(sheets) {
  return [...sheets].sort((a, b) => {
    const venueCmp = payVenueSortKey(a.venueName).localeCompare(payVenueSortKey(b.venueName));
    if (venueCmp) return venueCmp;
    const roundCmp = payRoundSortValue(b) - payRoundSortValue(a);
    if (roundCmp) return roundCmp;
    const dateCmp = paySheetDateValue(b) - paySheetDateValue(a);
    if (dateCmp) return dateCmp;
    const homeCmp = String(a.homeName).localeCompare(String(b.homeName));
    if (homeCmp) return homeCmp;
    return String(a.awayName).localeCompare(String(b.awayName));
  });
}

function payGradeLabel(slip) {
  return slip?.gradeName || slip?.sourceName || 'Grade';
}

/** Round 8 packs 4 kick-offs on a page — pad shorter days so each game stays that size. */
const PAY_DAY_SLOTS = 4;

function padPayDayGames(games, bandId = 'women') {
  const list = [...(games ?? [])];
  const roleCount =
    list.find((game) => game?.roles?.length)?.roles.length || umpireRolesForBand(bandId).length;
  let n = 0;
  while (list.length < PAY_DAY_SLOTS) {
    list.push({
      id: `pay-spacer-${n++}`,
      spacer: true,
      gradeName: '\u00a0',
      roles: Array.from({ length: roleCount }, (_, index) => ({
        id: `spacer-role-${index}`,
        label: '\u00a0',
        rate: '',
      })),
    });
  }
  return list;
}

function renderPayGradeRows(slip, payRates) {
  const roles = slip.roles?.length ? slip.roles : rolesForSlip(slip, payRates);
  if (!roles.length) return null;
  const spacer = Boolean(slip.spacer);
  // One tbody per grade — avoids rowspan breaking across printed pages.
  return (
    <tbody
      key={slip.id}
      className={`umpire-pay-grade-block${spacer ? ' is-spacer' : ''}`}
    >
      <tr className="umpire-pay-grade-row">
        <th colSpan={4}>{spacer ? '\u00a0' : payGradeLabel(slip)}</th>
      </tr>
      {roles.map((role) => (
        <tr key={role.id}>
          <td className="role">{spacer ? '\u00a0' : role.label}</td>
          <td className="pay">
            {spacer ? (
              '\u00a0'
            ) : role.rate ? (
              <b>
                {role.rateIsPlain === false || String(role.rate).includes('$')
                  ? role.rate
                  : `$${role.rate}`}
              </b>
            ) : (
              <span className="umpire-fill short" />
            )}
          </td>
          <td>{spacer ? '\u00a0' : <span className="umpire-fill" />}</td>
          <td>{spacer ? '\u00a0' : <span className="umpire-fill" />}</td>
        </tr>
      ))}
    </tbody>
  );
}

/**
 * Single-grade leagues (WWFL while only Women is ticked): one sheet per venue day,
 * every match that day listed in kick-off order.
 */
function groupPaySheetsByVenueDay(slips, payRates, bandId) {
  const sheets = [];
  const byKey = new Map();
  for (const slip of slips ?? []) {
    if (slip.blank) continue;
    const slipBand = slip.payBandId || umpirePayBandIdForGrade(slip);
    if (slipBand !== bandId) continue;
    const dayKey = payCalendarDayKey(slip);
    const venue = String(slip.venueName || '').trim() || 'Venue TBC';
    const key = `${dayKey}::${venue}`;
    let sheet = byKey.get(key);
    if (!sheet) {
      sheet = {
        id: key,
        byDay: true,
        roundKey: dayKey,
        roundName: slip.roundName || '',
        pairKey: dayKey,
        homeName: '',
        awayName: '',
        dateLabel: slip.dateLabel || formatSlipDate(slip.date),
        venueName: venue === 'Venue TBC' ? '' : venue,
        games: [],
      };
      byKey.set(key, sheet);
      sheets.push(sheet);
    }
    const timeLabel = formatSlipTime(slip.date);
    sheet.games.push({
      ...slip,
      timeLabel,
      gradeName: payGameBlockLabel({ ...slip, timeLabel }),
      roles: rolesForSlip(slip, payRates),
    });
    if (!sheet.dateLabel && slip.dateLabel) sheet.dateLabel = slip.dateLabel;
    if (!sheet.roundName && slip.roundName) sheet.roundName = slip.roundName;
  }
  for (const sheet of sheets) {
    sheet.games.sort((a, b) => payGameTimeValue(a) - payGameTimeValue(b));
    for (const game of sheet.games) {
      game.gradeName = payGameBlockLabel(game);
    }
    if (sheet.games.length === 1) {
      const only = sheet.games[0];
      sheet.homeName = only.homeName || '';
      sheet.awayName = only.awayName || '';
      sheet.roundName = only.roundName || sheet.roundName;
      sheet.dateLabel = only.dateLabel || sheet.dateLabel;
      // Single match keeps the normal grade banner (Women), not the kick-off label.
      only.gradeName = umpirePayBandForId(bandId)?.label || only.gradeName;
    } else {
      sheet.homeName = '';
      sheet.awayName = '';
      const rounds = [...new Set(sheet.games.map((game) => game.roundName).filter(Boolean))];
      sheet.roundName = rounds.length === 1 ? rounds[0] : 'Match day';
    }
    sheet.venueName = pickSheetVenue(sheet.games) || sheet.venueName;
    if (!sheet.dateLabel) {
      sheet.dateLabel = formatSlipDate(sheet.games[0]?.date) || '';
    }
  }
  return sortPaySheetsByVenueThenSeasonEnd(sheets);
}

/** One pay sheet = one fixture pairing for a round, with the selected grades for that match. */
export function groupPaySheets(slips, payRates = {}, bandIds = PAY_SHEET_CORE_BANDS) {
  const selectedBands = normalizePayBandIds(bandIds);
  if (!selectedBands.length) return [];
  // Only one grade on the sheet (e.g. WWFL Women) — pack same-day games together by time.
  if (selectedBands.length === 1) {
    return groupPaySheetsByVenueDay(slips, payRates, selectedBands[0]);
  }
  const sheets = [];
  const byKey = new Map();
  for (const slip of slips ?? []) {
    if (slip.blank) continue;
    const key = payFixtureSheetKey(slip);
    let sheet = byKey.get(key);
    if (!sheet) {
      sheet = {
        id: key,
        roundKey: normalizePayRoundKey(slip),
        roundName: slip.roundName || '',
        pairKey: payFixturePairKey(slip),
        homeName: slip.homeName || '',
        awayName: slip.awayName || '',
        dateLabel: slip.dateLabel || '',
        venueName: String(slip.venueName || '').trim(),
        games: [],
      };
      byKey.set(key, sheet);
      sheets.push(sheet);
    }
    sheet.games.push({
      ...slip,
      roles: rolesForSlip(slip, payRates),
    });
    if (!sheet.roundName && slip.roundName) sheet.roundName = slip.roundName;
    if (!sheet.dateLabel && slip.dateLabel) sheet.dateLabel = slip.dateLabel;
  }
  const kept = [];
  for (const sheet of sheets) {
    // Prefer one grade per band so a duplicate fixture row does not double up.
    const byBand = new Map();
    for (const game of sheet.games) {
      const band = game.payBandId || umpirePayBandIdForGrade(game);
      if (!byBand.has(band)) byBand.set(band, game);
    }
    const padded = [];
    let realCount = 0;
    for (const bandId of selectedBands) {
      const band = umpirePayBandForId(bandId);
      const existing = byBand.get(bandId);
      if (existing) {
        padded.push(existing);
        realCount += 1;
        continue;
      }
      const placeholder = {
        id: `${sheet.id}::${bandId}`,
        gradeId: bandId,
        gradeName: band.label,
        sourceName: band.label,
        payBandId: bandId,
        payBandOrder: band.order,
        roundName: sheet.roundName,
        homeName: sheet.homeName,
        awayName: sheet.awayName,
        venueName: sheet.venueName,
        dateLabel: sheet.dateLabel,
        placeholder: true,
      };
      padded.push({
        ...placeholder,
        roles: rolesForSlip(placeholder, payRates),
      });
    }
    if (!realCount) continue;
    sheet.games = padded;
    const featured = featuredPayMatch(sheet.games.filter((game) => !game.placeholder));
    if (featured) {
      sheet.homeName = featured.homeName || sheet.homeName;
      sheet.awayName = featured.awayName || sheet.awayName;
      if (featured.roundName) sheet.roundName = featured.roundName;
      if (featured.dateLabel) sheet.dateLabel = featured.dateLabel;
    }
    sheet.venueName = pickSheetVenue(sheet.games.filter((game) => !game.placeholder));
    kept.push(sheet);
  }
  return sortPaySheetsByVenueThenSeasonEnd(kept);
}

/** Blank finals pay sheets — match lines empty, grade rows from the selected bands. */
export function blankFinalsPaySheets(bandIds, payRates = {}, count = 5) {
  const selectedBands = normalizePayBandIds(bandIds);
  if (!selectedBands.length) return [];
  const n = Math.max(1, Math.min(40, Math.round(Number(count)) || 1));
  const sheets = [];
  for (let i = 0; i < n; i += 1) {
    const id = `blank-finals::${i + 1}`;
    sheets.push({
      id,
      blank: true,
      roundKey: 'finals',
      roundName: '',
      pairKey: `blank-finals-${i + 1}`,
      homeName: '',
      awayName: '',
      dateLabel: '',
      venueName: '',
      games: selectedBands.map((bandId) => {
        const band = umpirePayBandForId(bandId);
        const placeholder = {
          id: `${id}::${bandId}`,
          gradeId: bandId,
          gradeName: band.label,
          sourceName: band.label,
          payBandId: bandId,
          payBandOrder: band.order,
          roundName: '',
          homeName: '',
          awayName: '',
          venueName: '',
          dateLabel: '',
          placeholder: true,
          blank: true,
        };
        return {
          ...placeholder,
          roles: rolesForSlip(placeholder, payRates),
        };
      }),
    });
  }
  return sheets;
}

export function printJobForUmpirePaySheet({
  slips,
  allSlips,
  sheets: readySheets,
  bandIds,
  competition,
  state,
  action = 'print',
}) {
  const payRates = state?.settings?.umpirePayRates ?? {};
  const selected = (slips ?? []).filter((slip) => !slip.blank);
  const list = expandPaySheetSlips(selected, allSlips ?? selected);
  const sheets = readySheets?.length
    ? readySheets
    : groupPaySheets(list, payRates, bandIds ?? PAY_SHEET_CORE_BANDS);
  const year = state?.season || new Date().getFullYear();
  const tag = competition === 'wwfl' ? 'WWFL' : 'WFL';
  const finalsOnly = sheets.length > 0 && sheets.every((sheet) => sheet.blank);
  return {
    kind: 'umpire-pay',
    action,
    fileName: `${tag}-Umpire-Pay-Sheet${finalsOnly ? '-Finals' : ''}-${year}.pdf`,
    title: finalsOnly ? 'Umpire pay sheet · finals' : 'Umpire pay sheet',
    season: year,
    competition,
    leagueName: leagueTitle(competition, state?.settings),
    logoUrl: state?.wflLogoUrl,
    payRates,
    slips: list,
    sheets,
  };
}

function groupPaySheetsByVenue(sheets) {
  const groups = [];
  const byVenue = new Map();
  for (const sheet of sheets ?? []) {
    const venue = String(sheet.venueName || '').trim() || 'Venue TBC';
    let group = byVenue.get(venue);
    if (!group) {
      group = { venue, sheets: [] };
      byVenue.set(venue, group);
      groups.push(group);
    }
    group.sheets.push(sheet);
  }
  return groups;
}

export function UmpireSlips({ state, grades, competition, onPrint }) {
  const slips = useMemo(() => collectSlipGames(grades, competition), [grades, competition]);
  const gradeOptions = useMemo(() => gradesFromSlips(slips), [slips]);
  const [selected, setSelected] = useState(() => new Set());
  const [paySelected, setPaySelected] = useState(() => new Set());
  const [payBands, setPayBands] = useState(
    () => (competition === 'wwfl' ? new Set(['women']) : new Set(PAY_SHEET_CORE_BANDS))
  );
  const [activeGradeId, setActiveGradeId] = useState(null);
  const [blankCount, setBlankCount] = useState(6);
  const [blankFinalsCount, setBlankFinalsCount] = useState(5);
  const [mode, setMode] = useState('slips');

  const payRates = state?.settings?.umpirePayRates ?? {};
  const payBandOptions = useMemo(
    () =>
      competition === 'wwfl'
        ? UMPIRE_PAY_BANDS.filter((band) => band.id === 'women')
        : UMPIRE_PAY_BANDS.filter((band) => band.id !== 'women'),
    [competition]
  );
  const payBandIds = useMemo(() => normalizePayBandIds([...payBands]), [payBands]);
  const allPaySheets = useMemo(
    () => groupPaySheets(slips, payRates, payBandIds),
    [slips, payRates, payBandIds]
  );
  const payVenueGroups = useMemo(() => groupPaySheetsByVenue(allPaySheets), [allPaySheets]);

  useEffect(() => {
    setPayBands(competition === 'wwfl' ? new Set(['women']) : new Set(PAY_SHEET_CORE_BANDS));
  }, [competition]);

  useEffect(() => {
    setSelected(new Set());
    setActiveGradeId(gradeOptions[0]?.id ?? null);
    setMode(slips.length ? 'slips' : 'blank');
  }, [competition, slips, gradeOptions]);

  useEffect(() => {
    setPaySelected(new Set(allPaySheets.map((sheet) => sheet.id)));
  }, [allPaySheets]);

  const rounds = useMemo(
    () => roundsForGrade(slips, activeGradeId),
    [slips, activeGradeId]
  );

  const selectedSlips = useMemo(
    () => slips.filter((slip) => selected.has(slip.id)),
    [slips, selected]
  );

  const selectedPaySheets = useMemo(
    () => allPaySheets.filter((sheet) => paySelected.has(sheet.id)),
    [allPaySheets, paySelected]
  );

  const gradeSelectedCount = useMemo(() => {
    if (!activeGradeId) return 0;
    return slips.filter((slip) => slip.gradeId === activeGradeId && selected.has(slip.id)).length;
  }, [slips, selected, activeGradeId]);

  const gradeTotalCount = useMemo(() => {
    if (!activeGradeId) return 0;
    return slips.filter((slip) => slip.gradeId === activeGradeId).length;
  }, [slips, activeGradeId]);

  const printSlips =
    mode === 'blank' ? blankSlips(competition, blankCount, state?.season) : selectedSlips;

  function toggle(id) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePaySheet(id) {
    setPaySelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePayBand(bandId) {
    setPayBands((current) => {
      const next = new Set(current);
      if (next.has(bandId)) next.delete(bandId);
      else next.add(bandId);
      return next;
    });
  }

  function selectGradeAll() {
    if (!activeGradeId) return;
    setSelected((current) => {
      const next = new Set(current);
      for (const slip of slips) {
        if (slip.gradeId === activeGradeId) next.add(slip.id);
      }
      return next;
    });
  }

  function clearGrade() {
    if (!activeGradeId) return;
    setSelected((current) => {
      const next = new Set(current);
      for (const slip of slips) {
        if (slip.gradeId === activeGradeId) next.delete(slip.id);
      }
      return next;
    });
  }

  function selectPayVenue(venue) {
    setPaySelected((current) => {
      const next = new Set(current);
      for (const sheet of allPaySheets) {
        const name = String(sheet.venueName || '').trim() || 'Venue TBC';
        if (name === venue) next.add(sheet.id);
      }
      return next;
    });
  }

  function clearPayVenue(venue) {
    setPaySelected((current) => {
      const next = new Set(current);
      for (const sheet of allPaySheets) {
        const name = String(sheet.venueName || '').trim() || 'Venue TBC';
        if (name === venue) next.delete(sheet.id);
      }
      return next;
    });
  }

  function startPrint(action) {
    if (!printSlips.length) return;
    onPrint?.(printJobForUmpireSlips({ slips: printSlips, competition, state, action }));
  }

  function startEnvelopePrint(action) {
    const list = mode === 'blank' ? [] : selectedSlips;
    if (!list.length) return;
    onPrint?.(printJobForUmpireEnvelopes({ slips: list, competition, state, action }));
  }

  function startPayPrint(action, sheets = selectedPaySheets) {
    if (!sheets.length || !payBandIds.length) return;
    onPrint?.(
      printJobForUmpirePaySheet({
        sheets,
        bandIds: payBandIds,
        slips: sheets.flatMap((sheet) => sheet.games.filter((game) => !game.placeholder)),
        allSlips: slips,
        competition,
        state,
        action,
      })
    );
  }

  function startBlankFinalsPayPrint(action) {
    const sheets = blankFinalsPaySheets(payBandIds, payRates, blankFinalsCount);
    if (!sheets.length) return;
    startPayPrint(action, sheets);
  }

  const league = leagueTitle(competition, state?.settings);
  const scaleLabel = competition === 'wwfl' ? '4-3-2-1' : '3-2-1';
  const activeGrade = gradeOptions.find((item) => item.id === activeGradeId) ?? null;
  const envelopeCount = mode === 'slips' ? selectedSlips.length : 0;
  const payCount = selectedPaySheets.length;
  const blankFinalsTotal = Math.max(0, Math.min(40, Math.round(Number(blankFinalsCount)) || 0));

  return (
    <div className="umpire-slips">
      <header className="umpire-slips-head">
        <div>
          <p className="eyebrow">Pre-season print</p>
          <h2>
            {competition === 'wwfl' ? 'WWFL' : 'WFL'} · {scaleLabel}
          </h2>
          <p className="muted">
            {mode === 'pay'
              ? competition === 'wwfl'
                ? 'Pay sheets by ground — with only Women selected, same-day matches at a ground share one sheet in kick-off order.'
                : 'Pay sheets by ground — tick which grades go on each sheet, then pick fixtures. Memorial last game first, then back through the season.'
              : mode === 'blank'
                ? 'Blank Best and Fairest vote slips for umpires to fill in by hand.'
                : 'Best and Fairest vote slips and DL envelope faces from the fixtures.'}
          </p>
        </div>
        <div className="umpire-slips-actions">
          {mode === 'pay' ? (
            <>
              <button
                type="button"
                className="primary"
                disabled={!payCount}
                onClick={() => startPayPrint('print')}
              >
                Print pay sheets {payCount || ''}
              </button>
              <button type="button" disabled={!payCount} onClick={() => startPayPrint('save')}>
                Save pay PDF
              </button>
              <button
                type="button"
                disabled={!allPaySheets.length}
                onClick={() => {
                  setPaySelected(new Set(allPaySheets.map((sheet) => sheet.id)));
                  startPayPrint('print', allPaySheets);
                }}
              >
                Print all grounds
              </button>
              <button
                type="button"
                disabled={!payBandIds.length || !blankFinalsTotal}
                onClick={() => startBlankFinalsPayPrint('print')}
              >
                Print blank finals {blankFinalsTotal || ''}
              </button>
              <button
                type="button"
                disabled={!payBandIds.length || !blankFinalsTotal}
                onClick={() => startBlankFinalsPayPrint('save')}
              >
                Save blank finals PDF
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="primary"
                disabled={!printSlips.length}
                onClick={() => startPrint('print')}
              >
                Print slips {printSlips.length || ''}
              </button>
              <button type="button" disabled={!printSlips.length} onClick={() => startPrint('save')}>
                Save slips PDF
              </button>
              {mode === 'slips' ? (
                <>
                  <button
                    type="button"
                    disabled={!envelopeCount}
                    onClick={() => startEnvelopePrint('print')}
                  >
                    Print envelopes {envelopeCount || ''}
                  </button>
                  <button
                    type="button"
                    disabled={!envelopeCount}
                    onClick={() => startEnvelopePrint('save')}
                  >
                    Save envelopes PDF
                  </button>
                </>
              ) : null}
            </>
          )}
        </div>
      </header>

      <div className="umpire-slips-modes">
        <button
          type="button"
          className={mode === 'slips' ? 'active' : ''}
          disabled={!slips.length}
          onClick={() => setMode('slips')}
        >
          Vote slips
        </button>
        <button
          type="button"
          className={mode === 'pay' ? 'active' : ''}
          onClick={() => setMode('pay')}
        >
          Pay sheets
        </button>
        <button type="button" className={mode === 'blank' ? 'active' : ''} onClick={() => setMode('blank')}>
          Blank slips
        </button>
      </div>

      {mode === 'blank' ? (
        <label className="umpire-blank-count">
          <strong>How many blank slips?</strong>
          <input
            type="number"
            min={1}
            max={60}
            value={blankCount}
            onChange={(event) => setBlankCount(event.target.value)}
          />
          <span className="muted">
            Grade, round and match lines left empty for the umpire to fill. {league}.
          </span>
        </label>
      ) : mode === 'pay' ? (
          <div className="umpire-pay-pick">
            <fieldset className="umpire-pay-grades">
              <legend>Grades on each sheet</legend>
              <div className="umpire-pay-grade-checks">
                {payBandOptions.map((band) => {
                  const on = payBands.has(band.id);
                  return (
                    <label key={band.id} className={`umpire-pay-grade-check${on ? ' is-on' : ''}`}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => togglePayBand(band.id)}
                      />
                      <span>{band.label}</span>
                    </label>
                  );
                })}
              </div>
              <p className="muted">
                {payBandIds.length
                  ? `${payBandIds.length} grade${payBandIds.length === 1 ? '' : 's'} printed per fixture · blank rows if that grade is not scheduled`
                  : 'Tick at least one grade to build pay sheets'}
              </p>
            </fieldset>

            <div className="umpire-pay-finals">
              <div>
                <h3>Blank finals</h3>
                <p className="muted">
                  Empty match lines for finals day — fill in teams, round, date and venue by hand.
                </p>
              </div>
              <label className="umpire-blank-count umpire-pay-finals-count">
                <strong>How many?</strong>
                <input
                  type="number"
                  min={1}
                  max={40}
                  value={blankFinalsCount}
                  onChange={(event) => setBlankFinalsCount(event.target.value)}
                />
              </label>
            </div>

            {!payBandIds.length ? (
              <p className="muted">Select grades above to list fixtures.</p>
            ) : !slips.length ? (
              <p className="muted">Sync fixtures to list season pay sheets, or print blank finals above.</p>
            ) : !payVenueGroups.length ? (
              <p className="muted">No fixtures match the selected grades.</p>
            ) : (
              <>
            <div className="umpire-pick-toolbar">
              <div>
                <h3>Pay sheets by ground</h3>
                <p className="muted">
                  {payCount} of {allPaySheets.length} fixtures selected · Memorial first, last round
                  down to round 1
                </p>
              </div>
              <div className="row">
                <button
                  type="button"
                  onClick={() => setPaySelected(new Set(allPaySheets.map((sheet) => sheet.id)))}
                >
                  Select all
                </button>
                <button type="button" onClick={() => setPaySelected(new Set())}>
                  Clear all
                </button>
              </div>
            </div>

            {payVenueGroups.map((group) => {
              const selectedInVenue = group.sheets.filter((sheet) => paySelected.has(sheet.id)).length;
              return (
                <section key={group.venue} className="umpire-pay-venue">
                  <header className="umpire-pay-venue-head">
                    <div>
                      <h4>{group.venue}</h4>
                      <span>
                        {selectedInVenue}/{group.sheets.length} fixtures
                      </span>
                    </div>
                    <div className="row">
                      <button type="button" onClick={() => selectPayVenue(group.venue)}>
                        All here
                      </button>
                      <button type="button" onClick={() => clearPayVenue(group.venue)}>
                        Clear
                      </button>
                    </div>
                  </header>
                  <div className="umpire-pick-matches">
                    {group.sheets.map((sheet) => {
                      const on = paySelected.has(sheet.id);
                      const multiDay = sheet.byDay && (sheet.games?.length || 0) > 1;
                      return (
                        <button
                          key={sheet.id}
                          type="button"
                          className={`umpire-match-chip${on ? ' is-on' : ''}`}
                          aria-pressed={on}
                          onClick={() => togglePaySheet(sheet.id)}
                        >
                          <span className="umpire-match-chip-mark" aria-hidden="true">
                            {on ? '✓' : ''}
                          </span>
                          <span className="umpire-match-chip-body">
                            {multiDay ? (
                              <>
                                <span className="umpire-match-chip-teams">
                                  <b>{sheet.dateLabel || 'Match day'}</b>
                                </span>
                                <span className="umpire-match-chip-meta">
                                  {sheet.games.length} matches
                                  {sheet.games[0]?.timeLabel && sheet.games[sheet.games.length - 1]?.timeLabel
                                    ? ` · ${sheet.games[0].timeLabel}–${sheet.games[sheet.games.length - 1].timeLabel}`
                                    : ''}
                                  {sheet.roundName ? ` · ${sheet.roundName}` : ''}
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="umpire-match-chip-teams">
                                  <b>{sheet.homeName || 'Home'}</b>
                                  <em>v</em>
                                  <b>{sheet.awayName || 'Away'}</b>
                                </span>
                                <span className="umpire-match-chip-meta">
                                  {[sheet.roundName, sheet.dateLabel].filter(Boolean).join(' · ')}
                                </span>
                              </>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
              </>
            )}
          </div>
      ) : !gradeOptions.length ? (
        <p className="muted">Sync fixtures first, or use Blank slips.</p>
      ) : (
        <div className="umpire-pick">
          <nav className="umpire-pick-grades" aria-label="Grades">
            {gradeOptions.map((grade) => {
              const count = slips.filter((slip) => slip.gradeId === grade.id && selected.has(slip.id)).length;
              const total = slips.filter((slip) => slip.gradeId === grade.id).length;
              return (
                <button
                  key={grade.id}
                  type="button"
                  className={grade.id === activeGradeId ? 'active' : ''}
                  onClick={() => setActiveGradeId(grade.id)}
                >
                  <strong>{grade.name}</strong>
                  <small>
                    {count}/{total}
                  </small>
                </button>
              );
            })}
          </nav>

          <div className="umpire-pick-panel">
            <div className="umpire-pick-toolbar">
              <div>
                <h3>{activeGrade?.name || 'Grade'}</h3>
                <p className="muted">
                  {gradeSelectedCount} of {gradeTotalCount} matches selected in this grade ·{' '}
                  {selectedSlips.length} total
                </p>
              </div>
              <div className="row">
                <button type="button" onClick={selectGradeAll}>
                  All in grade
                </button>
                <button type="button" onClick={clearGrade}>
                  Clear grade
                </button>
              </div>
            </div>

            <div className="umpire-pick-rounds">
              {rounds.map((round) => {
                const onCount = round.slips.filter((slip) => selected.has(slip.id)).length;
                return (
                  <section key={round.id} className="umpire-pick-round">
                    <header>
                      <div>
                        <h4>{round.name}</h4>
                        <span>
                          {onCount}/{round.slips.length} matches
                        </span>
                      </div>
                    </header>
                    <div className="umpire-pick-matches">
                      {round.slips.map((slip) => {
                        const on = selected.has(slip.id);
                        const details = [slip.roundName, slip.dateLabel, slip.venueName].filter(Boolean);
                        return (
                          <button
                            key={slip.id}
                            type="button"
                            className={`umpire-match-chip${on ? ' is-on' : ''}`}
                            aria-pressed={on}
                            onClick={() => toggle(slip.id)}
                          >
                            <span className="umpire-match-chip-mark" aria-hidden="true">
                              {on ? '✓' : ''}
                            </span>
                            <span className="umpire-match-chip-body">
                              <span className="umpire-match-chip-teams">
                                <b>{slip.homeName}</b>
                                <em>v</em>
                                <b>{slip.awayName}</b>
                              </span>
                              {details.length ? (
                                <span className="umpire-match-chip-meta">{details.join(' · ')}</span>
                              ) : null}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {mode === 'slips' && (printSlips.length || envelopeCount) ? (
        <section className="umpire-slips-preview" aria-label="Print preview">
          <div className="umpire-preview-grid">
            {printSlips.length ? (
              <div>
                <h3>Slip preview</h3>
                <div className="umpire-slip-preview-card">
                  <UmpireSlipCard
                    slip={printSlips[0]}
                    leagueName={league}
                    logoUrl={state?.wflLogoUrl}
                    season={state?.season}
                  />
                </div>
                <p className="muted">
                  {printSlips.length} slip{printSlips.length === 1 ? '' : 's'} · cut and put in the envelope
                </p>
              </div>
            ) : null}
            {envelopeCount ? (
              <div>
                <h3>Envelope preview</h3>
                <div className="umpire-slip-preview-card">
                  <UmpireEnvelopeCard
                    slip={selectedSlips[0]}
                    leagueName={league}
                    logoUrl={state?.wflLogoUrl}
                    season={state?.season}
                  />
                </div>
                <p className="muted">
                  {envelopeCount} envelope face{envelopeCount === 1 ? '' : 's'} · cut and stick on the DL
                  envelope
                </p>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function UmpirePaySheet({
  slips,
  sheets,
  leagueName,
  logoUrl,
  season,
  payRates = {},
}) {
  const year = season || new Date().getFullYear();
  const daySheets = sheets?.length ? sheets : groupPaySheets(slips, payRates);
  return (
    <div className="umpire-pay-sheet">
      {daySheets.map((sheet, sheetIndex) => {
        const match = featuredPayMatch(sheet.games);
        const blank = Boolean(sheet.blank);
        const byDay = Boolean(sheet.byDay);
        const multiDay = byDay && (sheet.games?.length || 0) > 1;
        const homeName = blank || multiDay ? '' : sheet.homeName || match?.homeName || '';
        const awayName = blank || multiDay ? '' : sheet.awayName || match?.awayName || '';
        const bandId = sheet.games?.[0]?.payBandId || 'women';
        const dayGames = byDay ? padPayDayGames(sheet.games, bandId) : sheet.games;
        return (
          <section
            key={sheet.id}
            className={`umpire-pay-day${sheetIndex > 0 ? ' is-break' : ''}${blank ? ' is-blank' : ''}${byDay ? ' is-by-day' : ''}`}
          >
            <header className="umpire-pay-head">
              <div className="umpire-pay-brand">
                {logoUrl ? <img src={logoUrl} alt="" /> : null}
                <div>
                  <p>{leagueName}</p>
                  <h1>Umpire pay sheet</h1>
                </div>
              </div>
              <div className="umpire-pay-match">
                <p>
                  {blank
                    ? 'Finals · match details'
                    : multiDay
                      ? 'Match day'
                      : 'Match details'}
                </p>
                {multiDay ? (
                  <>
                    <strong>{sheet.dateLabel || match?.dateLabel || year}</strong>
                    <span>
                      {[
                        sheet.roundName || match?.roundName,
                        `${sheet.games.length} matches`,
                        sheet.venueName || 'Venue TBC',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </>
                ) : (
                  <>
                    <strong className={blank ? 'umpire-pay-match-blank' : undefined}>
                      {homeName && awayName ? (
                        <>
                          {homeName} <em>v</em> {awayName}
                        </>
                      ) : (
                        <>
                          <span className="umpire-fill" />
                          <em>v</em>
                          <span className="umpire-fill" />
                        </>
                      )}
                    </strong>
                    {blank ? (
                      <span className="umpire-pay-match-meta-blank">
                        <span className="umpire-fill" />
                        <span className="umpire-fill" />
                        <span className="umpire-fill" />
                      </span>
                    ) : (
                      <span>
                        {[
                          sheet.roundName || match?.roundName,
                          sheet.dateLabel || match?.dateLabel || year,
                          sheet.venueName || 'Venue TBC',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    )}
                  </>
                )}
              </div>
            </header>

            <table className="umpire-pay-table">
              <thead>
                <tr>
                  <th className="role">Umpire</th>
                  <th className="pay">Pay rate</th>
                  <th>Name</th>
                  <th>Sign</th>
                </tr>
              </thead>
              {dayGames.map((slip) => renderPayGradeRows(slip, payRates))}
            </table>
          </section>
        );
      })}
    </div>
  );
}

export function UmpireEnvelopeCard({ slip, leagueName, logoUrl, season }) {
  const year = season || new Date().getFullYear();
  return (
    <article className={`umpire-envelope${slip.blank ? ' is-blank' : ''}`}>
      <header className="umpire-envelope-brand">
        {logoUrl ? <img src={logoUrl} alt="" /> : null}
        <div>
          <p>{leagueName}</p>
          <h1>Best and Fairest</h1>
          <h2>{year}</h2>
        </div>
      </header>

      <div className="umpire-envelope-hero">
        <p className="umpire-envelope-round">
          {slip.blank || !slip.roundName ? <span className="umpire-fill" /> : slip.roundName}
        </p>
        <div className="umpire-envelope-match">
          {slip.blank ? (
            <>
              <span className="umpire-fill" />
              <em>v</em>
              <span className="umpire-fill" />
            </>
          ) : (
            <>
              <strong>{slip.homeName}</strong>
              <em>v</em>
              <strong>{slip.awayName}</strong>
            </>
          )}
        </div>
        <p className="umpire-envelope-grade">
          {slip.blank || !slip.gradeName ? <span className="umpire-fill" /> : slip.gradeName}
        </p>
      </div>

      <div className="umpire-envelope-meta-line">
        <span>
          <small>Date</small>
          {slip.blank || !slip.dateLabel ? <i className="umpire-fill" /> : <b>{slip.dateLabel}</b>}
        </span>
        <span>
          <small>Venue</small>
          {slip.blank || !slip.venueName ? <i className="umpire-fill" /> : <b>{slip.venueName}</b>}
        </span>
      </div>
    </article>
  );
}

export function UmpireSlipCard({ slip, leagueName, logoUrl, season }) {
  const scale = slip.scale ?? [3, 2, 1];
  const year = season || new Date().getFullYear();
  const womenScale = scale.length > 3;
  return (
    <article
      className={`umpire-slip${slip.blank ? ' is-blank' : ''}${womenScale ? ' is-women-scale' : ''}`}
    >
      <header className="umpire-slip-brand">
        {logoUrl ? <img src={logoUrl} alt="" /> : null}
        <div>
          <p>{leagueName}</p>
          <h1>Best and Fairest</h1>
          <h2>{year}</h2>
        </div>
      </header>

      <div className="umpire-slip-meta-line">
        <span>
          <small>Grade</small>
          {slip.blank ? <i className="umpire-fill" /> : <b>{slip.gradeName}</b>}
        </span>
        <span>
          <small>Round</small>
          {slip.blank ? <i className="umpire-fill" /> : <b>{slip.roundName}</b>}
        </span>
        <span>
          <small>Date</small>
          {slip.blank || !slip.dateLabel ? <i className="umpire-fill" /> : <b>{slip.dateLabel}</b>}
        </span>
        <span>
          <small>Venue</small>
          {slip.blank || !slip.venueName ? <i className="umpire-fill" /> : <b>{slip.venueName}</b>}
        </span>
        <span className="umpire-slip-meta-match">
          <small>Match</small>
          {slip.blank ? (
            <b className="umpire-slip-meta-teams">
              <i className="umpire-fill" />
              <em>v</em>
              <i className="umpire-fill" />
            </b>
          ) : (
            <b className="umpire-slip-meta-teams">
              {slip.homeName}
              <em>v</em>
              {slip.awayName}
            </b>
          )}
        </span>
      </div>

      <table className="umpire-slip-votes">
        <thead>
          <tr>
            <th className="pts">Pts</th>
            <th className="num">No.</th>
            <th>Player</th>
            <th>Club</th>
          </tr>
        </thead>
        <tbody>
          {scale.map((points) => (
            <tr key={points}>
              <td className="pts">
                <b>{points}</b>
              </td>
              <td className="num">
                <span className="umpire-fill short" />
              </td>
              <td>
                <span className="umpire-fill" />
              </td>
              <td>
                <span className="umpire-fill" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <footer className="umpire-slip-sign">
        <table className="umpire-slip-sign-table">
          <thead>
            <tr>
              <th>Umpire 1</th>
              <th>Umpire 2</th>
              <th>Umpire 3</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <small>Name</small>
                <span className="umpire-fill" />
              </td>
              <td>
                <small>Name</small>
                <span className="umpire-fill" />
              </td>
              <td>
                <small>Name</small>
                <span className="umpire-fill" />
              </td>
            </tr>
            <tr>
              <td>
                <small>Signature</small>
                <span className="umpire-fill" />
              </td>
              <td>
                <small>Signature</small>
                <span className="umpire-fill" />
              </td>
              <td>
                <small>Signature</small>
                <span className="umpire-fill" />
              </td>
            </tr>
          </tbody>
        </table>
      </footer>
    </article>
  );
}
