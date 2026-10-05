export const WIDGET_USER_ID = 'b02d2018-5333-4fdb-bff7-e2834ebd23c7';
export const MATCHDAY_BASE = 'https://matchdaydata.com.au/matchday/react_php_scripts';
export const PHOTO_BASE = 'https://matchdaydata.syd1.cdn.digitaloceanspaces.com/players';
export const CLUB_LOGO_BASE = 'https://matchdaydata.syd1.cdn.digitaloceanspaces.com/clubs';
export const WFL_LOGO_URL =
  'https://whyallafootball.com.au/wp-content/uploads/2024/08/wfl-oval-logo-logo-full-color-rgb.svg';

/** MatchDay widget indexes: A Grade, Reserves, U18s, U15s, U12s, A Grade Women. */
export const DEFAULT_GRADE_INDEXES = [0, 1, 2, 3, 4, 7];

export const GRADE_PROFILES = {
  'A Grade': {
    label: 'League',
    medalTitle: 'Jim Hewitson Medal',
    tabOrder: 4,
  },
  Reserves: {
    label: 'Reserves',
    medalTitle: 'Reserves Medal',
    tabOrder: 3,
  },
  U18s: {
    label: "U/18's",
    medalTitle: "U/18's Medal",
    tabOrder: 2,
  },
  U15s: {
    label: "U/15's",
    medalTitle: "U/15's Medal",
    tabOrder: 1,
  },
  U12s: {
    label: "U/12's",
    medalTitle: "U/12's Medal",
    tabOrder: 0,
  },
  'A Grade Women': {
    label: 'League',
    medalTitle: 'Scott Leverington Medal',
    tabOrder: 5,
  },
};

export const MEDAL_TITLES = Object.fromEntries(
  Object.entries(GRADE_PROFILES).map(([key, profile]) => [key, profile.medalTitle])
);

export const CLUB_LOGO_OVERRIDES = {
  ROOPENA: 'override-roopena.png',
};

export const WOMEN_CLUB_LOGO_OVERRIDES = {
  'NORTH WHYALLA': 'override-north-whyalla-women.png',
};

export function looksLikeWomenClub(clubName) {
  return /\bwomens?\b/i.test(String(clubName || '')) || /\bnwfcw\b/i.test(String(clubName || ''));
}

export function mensNorthCrestFile(clubs = []) {
  const junior = (clubs ?? []).find((item) => {
    if (looksLikeWomenClub(item.name)) return false;
    if (canonicalClubKey(item.name) !== 'NORTH WHYALLA') return false;
    const name = String(item.name || '').trim();
    return name !== name.toUpperCase();
  });
  if (junior?.id) return `${junior.id}.png`;
  const any = (clubs ?? []).find(
    (item) => !looksLikeWomenClub(item.name) && canonicalClubKey(item.name) === 'NORTH WHYALLA' && item.id
  );
  return any?.id ? `${any.id}.png` : null;
}

export function overrideLogoFileForClub(clubName, women = looksLikeWomenClub(clubName)) {
  const key = canonicalClubKey(clubName);
  if (women) return WOMEN_CLUB_LOGO_OVERRIDES[key] ?? null;
  return CLUB_LOGO_OVERRIDES[key] ?? null;
}

const WP_CLUB_LOGOS = 'https://whyallafootball.com.au/wp-content/uploads/2024/07';

export const WORDPRESS_CLUB_LOGOS = {
  'CENTRAL WHYALLA': `${WP_CLUB_LOGOS}/logocentral.png`,
  'NORTH WHYALLA': `${WP_CLUB_LOGOS}/logonorth1.png`,
  ROOPENA: `${WP_CLUB_LOGOS}/logoroos1.png`,
  'SOUTH WHYALLA': `${WP_CLUB_LOGOS}/logosouth.png`,
  'WEEROONA BAY': `${WP_CLUB_LOGOS}/logowbfc1.png`,
  'WEST WHYALLA': `${WP_CLUB_LOGOS}/logowest1.png`,
};

export const EXTRA_CLUB_LOGOS = {
  'CENTRAL AUGUSTA': `${CLUB_LOGO_BASE}/Central_Augusta.png`,
  'WEST AUGUSTA': `${CLUB_LOGO_BASE}/West_Augusta.png`,
  'SOUTH AUGUSTA': `${CLUB_LOGO_BASE}/South_Augusta.png`,
  'PORT FC': `${CLUB_LOGO_BASE}/Port.png`,
};

export function siteLogoFileName(clubName) {
  const key = canonicalClubKey(clubName);
  if (!key) return null;
  return `site-${key.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.png`;
}

export function clubLogoSourceUrl(clubName) {
  const key = canonicalClubKey(clubName);
  return WORDPRESS_CLUB_LOGOS[key] ?? EXTRA_CLUB_LOGOS[key] ?? null;
}

export function gradeProfile(gradeName, gradeId) {
  const direct = GRADE_PROFILES[gradeName];
  if (direct) return direct;
  const byLabel = Object.values(GRADE_PROFILES).find((profile) => profile.label === gradeName);
  if (byLabel) return byLabel;
  const byIndex = GRADE_PROFILES[Object.keys(GRADE_PROFILES)[Number(gradeId)]];
  return (
    byIndex ?? {
      label: gradeName || 'Grade',
      medalTitle: `${gradeName || 'Grade'} Medal`,
      tabOrder: 99,
    }
  );
}

export function medalTitleForGrade(gradeName, gradeId) {
  return gradeProfile(gradeName, gradeId).medalTitle;
}

export function displayNameForGrade(gradeName, gradeId) {
  return gradeProfile(gradeName, gradeId).label;
}

export function looksLikeWomenGradeMeta(meta) {
  if (!meta) return false;
  const name = String(meta.gradeName || meta.name || '');
  return Number(meta.gradeGroup) === 2 || /women/i.test(name);
}

export function mensGradeIndexesFrom(gradesList) {
  const indexes = [];
  (gradesList ?? []).forEach((meta, index) => {
    if (!meta || looksLikeWomenGradeMeta(meta)) return;
    if (GRADE_PROFILES[meta.gradeName]) indexes.push(index);
  });
  return indexes;
}

export function womenGradeIndexesFrom(gradesList) {
  const indexes = [];
  (gradesList ?? []).forEach((meta, index) => {
    if (looksLikeWomenGradeMeta(meta)) indexes.push(index);
  });
  return indexes;
}

export function isWomenGrade(grade) {
  if (!grade) return false;
  if (grade.women === true) return true;
  const source = String(grade.sourceName || grade.name || '');
  return /women/i.test(source) || Number(grade.gradeGroup) === 2;
}

export function gradesForCompetition(grades, competition) {
  const wwfl = normalizeCompetition(competition) === 'wwfl';
  return (grades ?? []).filter((grade) => (wwfl ? isWomenGrade(grade) : !isWomenGrade(grade)));
}

export function isLeagueGrade(grade) {
  if (isWomenGrade(grade)) return false;
  const source = grade?.sourceName || grade?.name;
  if (source === 'A Grade' || source === 'League') return true;
  return gradeProfile(source, grade?.id).label === 'League';
}

export function leagueGradeFrom(grades) {
  const list = grades ?? [];
  return list.find(isLeagueGrade) ?? list.find((grade) => String(grade.id) === '0') ?? null;
}

export function sortGrades(grades) {
  return [...(grades ?? [])].sort(
    (a, b) =>
      gradeProfile(a.sourceName || a.name, a.id).tabOrder -
      gradeProfile(b.sourceName || b.name, b.id).tabOrder
  );
}

export function clubLogoFileName(clubName) {
  const titled = String(clubName || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('_');
  return titled;
}

export function canonicalClubKey(clubName) {
  const raw = String(clubName || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
  if (!raw) return '';
  if (raw === 'WAFCW' || raw.startsWith('WAFCW ')) return 'WEST AUGUSTA';
  if (/\bAUGUSTA\b/.test(raw)) {
    if (/\bCENTRAL\b/.test(raw)) return 'CENTRAL AUGUSTA';
    if (/\bWEST\b/.test(raw)) return 'WEST AUGUSTA';
    if (/\bSOUTH\b/.test(raw)) return 'SOUTH AUGUSTA';
    return 'PORT AUGUSTA';
  }
  if (/\bPORT\s*FC\b/.test(raw) || raw === 'PORT' || raw.startsWith('PORT PIRIE')) return 'PORT FC';

  const key = raw
    .replace(/\s*[-–]\s*WOMEN\s*$/, '')
    .replace(/\s+WOMENS?\s*$/, '')
    .replace(/\s+SENIOR WOMEN.*$/, '')
    .trim();

  if (key === 'SWFC' || key.startsWith('SWFC ')) return 'SOUTH WHYALLA';
  if (key === 'NWFC' || key === 'NWFCW' || key.startsWith('NWFC ')) return 'NORTH WHYALLA';
  if (key === 'WWFC' || key.startsWith('WWFC ')) return 'WEST WHYALLA';
  if (key === 'WBFC' || key.startsWith('WBFC ')) return 'WEEROONA BAY';
  if (key === 'CENTRAL' || key === 'CENTRAL WHYALLA' || key.startsWith('CENTRAL WHYALLA')) return 'CENTRAL WHYALLA';
  if (key === 'SOUTH' || key === 'SOUTH WHYALLA' || key.startsWith('SOUTH WHYALLA')) return 'SOUTH WHYALLA';
  if (key === 'NORTH' || key === 'NORTH WHYALLA' || key.startsWith('NORTH WHYALLA')) return 'NORTH WHYALLA';
  if (key === 'WEST' || key === 'WEST WHYALLA' || key.startsWith('WEST WHYALLA')) return 'WEST WHYALLA';
  if (key === 'WEEROONA' || key.startsWith('WEEROONA')) return 'WEEROONA BAY';
  if (key.startsWith('ROOPENA')) return 'ROOPENA';
  return key;
}

export function wordpressClubLogoUrl(clubName) {
  return clubLogoSourceUrl(clubName);
}

function usableLogoFile(club, fileName) {
  if (!fileName) return null;
  if (
    looksLikeWomenClub(club?.name) &&
    Object.values(CLUB_LOGO_OVERRIDES).includes(String(fileName))
  ) {
    return null;
  }
  return fileName;
}

export function logoFileForClub(club, clubs = [], options = {}) {
  if (!club) return null;
  const women = options.women === true || (options.women !== false && looksLikeWomenClub(club.name));
  if (!women && canonicalClubKey(club.name) === 'NORTH WHYALLA') {
    return mensNorthCrestFile(clubs) || (club.id ? `${club.id}.png` : null);
  }
  const override = overrideLogoFileForClub(club.name, women);
  if (override) return override;
  if (club.logoFile && String(club.logoFile).startsWith('site-')) return club.logoFile;
  const own = usableLogoFile(club, club.logoFile);
  if (own) return own;
  if (women) {
    return (
      (clubs ?? []).find(
        (item) =>
          looksLikeWomenClub(item.name) &&
          canonicalClubKey(item.name) === canonicalClubKey(club.name) &&
          usableLogoFile(item, item.logoFile)
      )?.logoFile ?? overrideLogoFileForClub(club.name, false) ?? null
    );
  }
  const key = canonicalClubKey(club.name);
  const preferred = (clubs ?? []).find((item) => {
    if (looksLikeWomenClub(item.name)) return false;
    if (!usableLogoFile(item, item.logoFile)) return false;
    const name = String(item.name || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, ' ');
    return canonicalClubKey(item.name) === key && name === key;
  });
  if (preferred?.logoFile) return preferred.logoFile;
  return (
    (clubs ?? []).find(
      (item) =>
        !looksLikeWomenClub(item.name) &&
        usableLogoFile(item, item.logoFile) &&
        canonicalClubKey(item.name) === key
    )?.logoFile ?? null
  );
}

export function isFinalsRound(round) {
  if (round?.isFinal) return true;
  const name = `${round?.name ?? ''} ${round?.abbreviatedName ?? ''}`.toLowerCase();
  return /\bfinals?\b/.test(name);
}

export function isGrandFinalRound(round) {
  const name = `${round?.name ?? ''} ${round?.abbreviatedName ?? ''}`.toLowerCase();
  return /\bgrand\s*finals?\b/.test(name) || /\bgf\b/.test(name);
}

export function collectGrandFinalFixtures(grades) {
  const fixtures = [];
  for (const grade of grades ?? []) {
    const rounds = grade.rounds ?? [];
    let picked = rounds.filter(isGrandFinalRound);
    if (!picked.length) {
      const finals = rounds.filter(isFinalsRound);
      if (finals.length) picked = [finals[finals.length - 1]];
    }
    for (const round of picked) {
      for (const game of round.games ?? []) {
        if (!game?.homeName && !game?.awayName) continue;
        fixtures.push({
          id: `${grade.id}-${game.id}`,
          gradeId: grade.id,
          gradeName: grade.name,
          medalTitle: grade.medalTitle || grade.name,
          roundName: round.name,
          homeId: game.homeId,
          awayId: game.awayId,
          homeName: game.homeName,
          awayName: game.awayName,
          venueName: game.venueName || '',
        });
      }
    }
  }
  return fixtures;
}

export function isForfeitGame(game) {
  if (game?.forfeit) return true;
  return [game?.homeOutcome, game?.awayOutcome].some((value) => String(value || '').includes('FORFEIT'));
}

export function forfeitDetails(game) {
  if (!isForfeitGame(game)) {
    return { forfeit: false, forfeitWinnerName: null, forfeitLoserName: null, forfeitLine: null };
  }
  let winnerName =
    game.forfeitWinnerId === game.homeId ? game.homeName : game.forfeitWinnerId === game.awayId ? game.awayName : null;
  let loserName =
    game.forfeitLoserId === game.homeId ? game.homeName : game.forfeitLoserId === game.awayId ? game.awayName : null;
  if (!winnerName && game.homeOutcome === 'WON_BY_FORFEIT') winnerName = game.homeName;
  if (!winnerName && game.awayOutcome === 'WON_BY_FORFEIT') winnerName = game.awayName;
  if (!loserName && game.homeOutcome === 'LOST_BY_FORFEIT') loserName = game.homeName;
  if (!loserName && game.awayOutcome === 'LOST_BY_FORFEIT') loserName = game.awayName;
  return {
    forfeit: true,
    forfeitWinnerName: winnerName,
    forfeitLoserName: loserName,
    forfeitLine: loserName ? `${loserName} forfeits` : 'Forfeit',
  };
}

export function emptyVotes() {
  return { three: null, two: null, one: null };
}

export function playerAlreadyVoted(votes, playerId) {
  if (!playerId) return false;
  return votes?.three === playerId || votes?.two === playerId || votes?.one === playerId;
}

export function nextVoteKey(votes) {
  if (!votes?.three) return 'three';
  if (!votes?.two) return 'two';
  if (!votes?.one) return 'one';
  return null;
}

export function applyPlayerVote(votes, playerId) {
  const current = { ...emptyVotes(), ...votes };
  if (!playerId) return current;
  if (playerAlreadyVoted(current, playerId)) {
    return {
      three: current.three === playerId ? null : current.three,
      two: current.two === playerId ? null : current.two,
      one: current.one === playerId ? null : current.one,
    };
  }
  const key = nextVoteKey(current);
  if (!key) return current;
  return { ...current, [key]: playerId };
}

export function uniqueVotes(votes) {
  const next = emptyVotes();
  const seen = new Set();
  for (const key of ['three', 'two', 'one']) {
    const id = votes?.[key] ?? null;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    next[key] = id;
  }
  return next;
}

export const DEFAULT_SETTINGS = {
  leagueName: 'Whyalla Football League',
  showTitleSlide: true,
  showRoundScoreboard: true,
  showForfeitSlides: true,
  showVoteHoldSlide: true,
  showMatchScoreOnVotes: true,
  showLeaderboardAfterRound: true,
  showWinnerSlide: true,
  showSponsors: true,
  showWflLogo: true,
  showSeasonYear: true,
  showLeagueName: true,
  audienceFullscreen: true,
  audienceAlwaysOnTop: false,
  refreshScoresOnLaunch: true,
  leaderboardSize: 8,
  liveVoteCount: 6,
  showFinals: false,
  placeholderGrandFinal: true,
  medalTitles: Object.fromEntries(
    Object.entries(GRADE_PROFILES).map(([key, profile]) => [key, profile.medalTitle])
  ),
  gradeLabels: Object.fromEntries(
    Object.entries(GRADE_PROFILES).map(([key, profile]) => [key, profile.label])
  ),
};

export function mergeSettings(raw = {}) {
  const incoming = raw && typeof raw === 'object' ? raw : {};
  const next = { ...DEFAULT_SETTINGS, ...incoming };
  next.leagueName = String(next.leagueName || DEFAULT_SETTINGS.leagueName).trim().slice(0, 80) || DEFAULT_SETTINGS.leagueName;
  next.leaderboardSize = Math.min(20, Math.max(3, Math.round(Number(next.leaderboardSize) || 8)));
  next.liveVoteCount = 6;
  next.medalTitles = { ...DEFAULT_SETTINGS.medalTitles, ...(incoming.medalTitles ?? {}) };
  next.gradeLabels = { ...DEFAULT_SETTINGS.gradeLabels, ...(incoming.gradeLabels ?? {}) };
  if (next.gradeLabels['A Grade Women'] === "Women's") {
    next.gradeLabels['A Grade Women'] = DEFAULT_SETTINGS.gradeLabels['A Grade Women'];
  }
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (typeof value === 'boolean') next[key] = Boolean(next[key]);
  }
  return next;
}

export function includeRound(round, settings) {
  return Boolean(mergeSettings(settings).showFinals) || !isFinalsRound(round);
}

export function venueDisplayName(surface) {
  const raw = String(surface?.venue?.name || surface?.name || '').trim();
  if (!raw) return '';
  return raw
    .replace(/\s*\([^)]*Whyalla[^)]*\)/gi, '')
    .replace(/\s+\d+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function overlayGradeName(grade, settings) {
  const source = grade?.sourceName || grade?.name;
  const labels = mergeSettings(settings).gradeLabels;
  return labels?.[source] || displayNameForGrade(source, grade?.id);
}

export function overlayMedalTitle(grade, settings) {
  const source = grade?.sourceName || grade?.name;
  const titles = mergeSettings(settings).medalTitles;
  return titles?.[source] || medalTitleForGrade(source, grade?.id);
}

export function normalizeAudienceView(value) {
  if (value === 'scoreboard' || value === 'leaderboard' || value === 'toty' || value === 'lifemembers' || value === 'splash') {
    return value;
  }
  return 'presentation';
}

export const TOTY_FIELD_POSITIONS = [
  { id: 'bp-l', label: 'BP', name: 'Back pocket', x: 22, y: 16 },
  { id: 'fb', label: 'FB', name: 'Full back', x: 50, y: 12 },
  { id: 'bp-r', label: 'BP', name: 'Back pocket', x: 78, y: 16 },
  { id: 'hbf-l', label: 'HB', name: 'Half-back flank', x: 20, y: 30 },
  { id: 'chb', label: 'CHB', name: 'Centre half-back', x: 50, y: 26 },
  { id: 'hbf-r', label: 'HB', name: 'Half-back flank', x: 80, y: 30 },
  { id: 'w-l', label: 'W', name: 'Wing', x: 14, y: 50 },
  { id: 'ruck', label: 'R', name: 'Ruck', x: 50, y: 43 },
  { id: 'c', label: 'C', name: 'Centre', x: 50, y: 50 },
  { id: 'rr', label: 'RR', name: 'Ruck rover', x: 38, y: 56 },
  { id: 'rov', label: 'ROV', name: 'Rover', x: 62, y: 56 },
  { id: 'w-r', label: 'W', name: 'Wing', x: 86, y: 50 },
  { id: 'hff-l', label: 'HF', name: 'Half-forward flank', x: 20, y: 70 },
  { id: 'chf', label: 'CHF', name: 'Centre half-forward', x: 50, y: 74 },
  { id: 'hff-r', label: 'HF', name: 'Half-forward flank', x: 80, y: 70 },
  { id: 'fp-l', label: 'FP', name: 'Forward pocket', x: 22, y: 86 },
  { id: 'ff', label: 'FF', name: 'Full forward', x: 50, y: 90 },
  { id: 'fp-r', label: 'FP', name: 'Forward pocket', x: 78, y: 86 },
];

export const TOTY_BENCH_POSITIONS = [
  { id: 'int-1', label: 'INT', name: 'Interchange 1' },
  { id: 'int-2', label: 'INT', name: 'Interchange 2' },
  { id: 'int-3', label: 'INT', name: 'Interchange 3' },
  { id: 'int-4', label: 'INT', name: 'Interchange 4' },
];

export const TOTY_POSITIONS = [...TOTY_FIELD_POSITIONS, ...TOTY_BENCH_POSITIONS];
export const TOTY_POSITION_IDS = new Set(TOTY_POSITIONS.map((item) => item.id));

export const TOTY_REVEAL_LINES = [
  { id: 'forwards', label: 'Forward line', short: 'FP · FF · FP', spots: ['fp-l', 'ff', 'fp-r'] },
  { id: 'half-forwards', label: 'Half-forward line', short: 'HF · CHF · HF', spots: ['hff-l', 'chf', 'hff-r'] },
  { id: 'centre', label: 'Centre line', short: 'W · C · W', spots: ['w-l', 'c', 'w-r'] },
  { id: 'half-backs', label: 'Half-back line', short: 'HB · CHB · HB', spots: ['hbf-l', 'chb', 'hbf-r'] },
  { id: 'backs', label: 'Back line', short: 'BP · FB · BP', spots: ['bp-l', 'fb', 'bp-r'] },
  { id: 'followers', label: 'Ruck & rovers', short: 'R · RR · ROV', spots: ['ruck', 'rr', 'rov'] },
  { id: 'bench', label: 'Interchange', short: 'INT', spots: ['int-1', 'int-2', 'int-3', 'int-4'] },
];

function buildTotyBeats() {
  const byId = new Map(TOTY_POSITIONS.map((pos) => [pos.id, pos]));
  const beats = [];
  TOTY_REVEAL_LINES.forEach((line, lineIndex) => {
    const spots = line.spots.map((spotId) => {
      const pos = byId.get(spotId);
      return { spotId, posLabel: pos?.label ?? '', posName: pos?.name ?? '' };
    });
    for (let reveal = lineIndex === 0 ? 0 : 1; reveal <= spots.length; reveal += 1) {
      beats.push({
        type: 'line',
        lineIndex,
        lineId: line.id,
        lineLabel: line.label,
        short: line.short,
        spots,
        reveal,
      });
    }
  });
  beats.push({
    type: 'field',
    lineIndex: TOTY_REVEAL_LINES.length - 1,
    lineId: 'team',
    lineLabel: 'Team of the Year',
    short: 'Full team',
    revealStep: TOTY_REVEAL_LINES.length,
  });
  return beats;
}

export const TOTY_BEATS = buildTotyBeats();

export function clampTotyStep(step) {
  const n = Number(step);
  const max = Math.max(0, TOTY_BEATS.length - 1);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(max, Math.floor(n));
}

export function totyBeatAt(step) {
  return TOTY_BEATS[clampTotyStep(step)] ?? TOTY_BEATS[0] ?? null;
}

export function totyRevealedIds(lineCount) {
  const n = Math.max(0, Math.min(TOTY_REVEAL_LINES.length, Math.floor(Number(lineCount) || 0)));
  const ids = [];
  for (const line of TOTY_REVEAL_LINES.slice(0, n)) {
    ids.push(...line.spots);
  }
  return ids;
}

export function emptyTotyPicks() {
  return Object.fromEntries(TOTY_POSITIONS.map((item) => [item.id, null]));
}

export const WFL_MEMBER_CLUB_ID = 'wfl-member';
export const WFL_MEMBER_CLUB_NAME = 'WFL Member';
export const WFL_LOGO_FILE = 'wfl-logo.svg';

export function isWflMemberClub(value) {
  const key = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
  return key === 'WFL-MEMBER' || key === 'WFL MEMBER' || key === 'WFL';
}

export function normalizeLifeMembers(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const next = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const id = String(item.id || '').trim();
    const name = String(item.name || '').trim();
    const playerId = item.playerId ? String(item.playerId) : null;
    if ((!id && !name && !playerId) || (id && seen.has(id))) continue;
    const safeId = id || `lm-${next.length + 1}`;
    const wflMember = isWflMemberClub(item.clubId) || isWflMemberClub(item.clubName);
    seen.add(safeId);
    next.push({
      id: safeId,
      playerId,
      name,
      firstName: String(item.firstName || '').trim(),
      lastName: String(item.lastName || '').trim(),
      clubId: wflMember ? WFL_MEMBER_CLUB_ID : item.clubId ? String(item.clubId) : null,
      clubName: wflMember ? WFL_MEMBER_CLUB_NAME : String(item.clubName || '').trim(),
      photoFile: item.photoFile || null,
      logoFile: wflMember ? WFL_LOGO_FILE : item.logoFile || null,
      year: String(item.year || '').trim(),
      note: String(item.note || '').trim(),
    });
  }
  return next;
}

export function lifeMemberBeats(count) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  const beats = [{ type: 'title' }];
  for (let i = 0; i < n; i += 1) beats.push({ type: 'member', index: i });
  if (n > 1) beats.push({ type: 'all' });
  return beats;
}

export function clampLifeMemberStep(step, count) {
  const max = Math.max(0, lifeMemberBeats(count).length - 1);
  const n = Number(step);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(max, Math.floor(n));
}

export function normalizeToty(raw) {
  const next = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return next;
  for (const [gradeId, picks] of Object.entries(raw)) {
    if (!picks || typeof picks !== 'object' || Array.isArray(picks)) continue;
    const clean = emptyTotyPicks();
    for (const pos of TOTY_POSITIONS) {
      const value = picks[pos.id];
      clean[pos.id] = value ? String(value) : null;
    }
    next[String(gradeId)] = clean;
  }
  return next;
}

function hashSeed(value) {
  let h = 2166136261;
  const text = String(value ?? '');
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Two (or fewer) sponsors for a page. Same seed always returns the same pair. */
export function pickSponsorsForPage(sponsors, seed, count = 2) {
  const list = (sponsors ?? []).filter(Boolean);
  const take = Math.max(0, Math.floor(Number(count) || 0));
  if (!list.length || take <= 0) return [];
  if (list.length <= take) return list.slice();
  let a = hashSeed(seed);
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pool = list.slice();
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    const swap = pool[i];
    pool[i] = pool[j];
    pool[j] = swap;
  }
  return pool.slice(0, take);
}

/** Round number from names like "Round 12". */
export function roundNumberFromName(name) {
  const match = String(name ?? '').match(/(\d+)/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

/** Home-and-away round only. Ignores finals names like "Finals Round 1". */
export function homeAndAwayRoundNumber(name) {
  const text = String(name ?? '').trim();
  if (!text || isFinalsRound({ name: text })) return null;
  const match = text.match(/\b(?:round|rd)\s*(\d+)\b/i) || text.match(/^r\s*(\d+)$/i) || text.match(/^(\d+)$/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

export const RUNSHEET_SPLASH = 'splash';
export const RUNSHEET_TOTY = 'toty';
export const RUNSHEET_LIFE = 'lifemembers';

export function isSplashRunsheetId(id) {
  const key = String(id || '');
  return key === RUNSHEET_SPLASH || key.startsWith(`${RUNSHEET_SPLASH}-`);
}

export function buildPresentationQueue(items, grades) {
  const known = new Set((grades ?? []).map((grade) => String(grade.id)));
  const queue = [];
  for (const raw of items ?? []) {
    const type =
      raw?.type === 'splash' || isSplashRunsheetId(raw?.id)
        ? 'splash'
        : raw?.type === 'toty' || raw?.id === RUNSHEET_TOTY
          ? 'toty'
          : raw?.type === 'lifemembers' || raw?.id === RUNSHEET_LIFE
            ? 'lifemembers'
            : 'grade';
    if (type === 'splash') {
      queue.push({ type: 'splash', id: String(raw?.id || RUNSHEET_SPLASH) });
      continue;
    }
    if (type === 'toty' || type === 'lifemembers') {
      queue.push({ type });
      continue;
    }
    const id = String(raw?.id || raw?.gradeId || '');
    if (!known.has(id)) continue;
    const start = String(raw?.start ?? '').trim();
    queue.push({ type: 'preso', gradeIds: [id], starts: start ? { [id]: start } : {} });
  }
  return queue;
}

export function normalizePresentationQueue(raw) {
  if (!Array.isArray(raw)) return [];
  const queue = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    if (item.type === 'home') continue;
    if (item.type === 'splash') {
      queue.push({ type: 'splash', id: String(item.id || RUNSHEET_SPLASH) });
      continue;
    }
    if (item.type === 'toty' || item.type === 'lifemembers') {
      queue.push({ type: item.type });
      continue;
    }
    if (item.type === 'preso' && Array.isArray(item.gradeIds) && item.gradeIds.length) {
      const starts =
        item.starts && typeof item.starts === 'object' && !Array.isArray(item.starts) ? item.starts : {};
      for (const gradeId of item.gradeIds) {
        const id = String(gradeId);
        if (!id) continue;
        const start = String(starts[id] ?? '').trim();
        queue.push({
          type: 'preso',
          gradeIds: [id],
          starts: start ? { [id]: start } : {},
        });
      }
    }
  }
  return queue;
}

export function runsheetIdForQueueItem(item, slideGradeId) {
  if (!item) return null;
  if (item.type === 'splash') return item.id || RUNSHEET_SPLASH;
  if (item.type === 'toty') return RUNSHEET_TOTY;
  if (item.type === 'lifemembers') return RUNSHEET_LIFE;
  if (item.type === 'preso') {
    if (slideGradeId && item.gradeIds.includes(String(slideGradeId))) return String(slideGradeId);
    return item.gradeIds[0] ?? null;
  }
  return null;
}

/** Input box round (blank / 1 = start). Returns the first slide at or after that home-and-away round. */
export function startIndexForRound(slides, value) {
  const raw = String(value ?? '').trim();
  if (!raw) return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 1) return 0;
  const wanted = Math.floor(n);
  const list = slides ?? [];
  let afterEarly = 0;
  for (let i = 0; i < list.length; i += 1) {
    const num = homeAndAwayRoundNumber(list[i].roundName);
    if (num != null && num >= wanted) return i;
    if (num != null && num < wanted) afterEarly = i + 1;
  }
  return afterEarly;
}

/** Apply a start round but always keep the grade title slide first. */
export function slidesFromStartRound(slides, value) {
  const list = slides ?? [];
  const from = list.slice(startIndexForRound(list, value));
  const title = list.find((slide) => slide.type === 'title');
  if (title && from[0]?.type !== 'title') return [title, ...from];
  return from;
}

export function normalizeCompetition(value) {
  return value === 'wwfl' ? 'wwfl' : 'wfl';
}

export function createEmptyStore() {
  return {
    season: String(new Date().getFullYear()),
    lastSyncedAt: null,
    activeGradeId: null,
    selectedGameId: null,
    grades: [],
    clubs: [],
    sponsors: [],
    competition: 'wfl',
    audienceView: 'presentation',
    teamOfTheYear: {},
    totySponsorId: null,
    totyStep: 0,
    lifeMembers: [],
    lifeMemberStep: 0,
    presentation: {
      gradeId: null,
      gradeIds: null,
      starts: {},
      slideIndex: 0,
      queue: [],
      queueIndex: 0,
    },
    scoreboard: {
      gradeId: null,
      roundId: null,
      sponsorIds: [],
      leaderboardScope: 'all',
    },
    settings: mergeSettings({}),
    sync: {
      running: false,
      message: '',
      current: 0,
      total: 0,
    },
  };
}
