import { existsSync } from 'fs';
import { join } from 'path';
import {
  forfeitDetails,
  includeRound,
  mergeSettings,
  overlayGradeName,
  overlayMedalTitle,
  roundNumberFromName,
  slidesFromStartRound,
  runsheetIdForQueueItem,
  runsheetCue,
  isGoalkickerCue,
  isAwardCue,
  GOALKICKER_BOARD_SIZE,
  clampCueStep,
  normalizeNightExtras,
  normalizePresentationQueue,
  sortGrades,
  normalizeAudienceView,
  logoFileForClub,
  canonicalClubKey,
  looksLikeWomenClub,
  WORDPRESS_CLUB_LOGOS,
  WOMEN_CLUB_LOGO_OVERRIDES,
  TOTY_POSITIONS,
  TOTY_BEATS,
  clampTotyStep,
  clampLifeMemberStep,
  totyBeatAt,
  emptyTotyPicks,
  normalizeToty,
  normalizeLifeMembers,
  lifeMemberBeats,
  totyGradeFrom,
  collectGrandFinalFixtures,
  pickSponsorsForPage,
  isWflMemberClub,
  isWomenGrade,
  gradesForCompetition,
  normalizeCompetition,
  WOMEN_VOTE_SCALE,
  MEN_VOTE_SCALE,
  WFL_MEMBER_CLUB_ID,
  WFL_MEMBER_CLUB_NAME,
  WFL_LOGO_FILE,
  displayLeagueClubName,
} from './constants.js';
import { mediaUrl } from './store.js';
import { crowdViewFromSettings } from './crowdPhotos.js';

function crowdClubLogoUrl(venue, clubs, women) {
  const name = displayLeagueClubName(venue) || String(venue || '').trim();
  if (!name) return null;
  const file =
    logoFileForClub({ name }, clubs, { women }) || logoFileForClub({ name }, clubs, { women: false });
  return mediaUrl('logos', file);
}

function crowdViewWithLogos(settings, clubs, women) {
  const crowd = crowdViewFromSettings(settings);
  const addLogo = (photo) => ({
    ...photo,
    logoUrl: crowdClubLogoUrl(photo.venue, clubs, women),
  });
  return {
    ...crowd,
    waiting: (crowd.waiting ?? []).map(addLogo),
    approved: (crowd.approved ?? []).map(addLogo),
  };
}
import { buildSlides, clubLabelForVote, gradeProgress, leadingGoalkicker, leadingGoalkickers, playerName, tallyGrade } from './tally.js';
import { scoreFields } from './score.js';

function rememberPlayedClub(entry, player, clubs, women = false) {
  const club = (clubs ?? []).find((item) => String(item.id) === String(player.clubId));
  const rawName = player.clubName || club?.name || '';
  const name = presentClubName(rawName);
  const key = canonicalClubKey(rawName) || String(player.clubId || name);
  if (!key) return;
  if (!entry.clubList) entry.clubList = [];
  const logoFile =
    logoFileForClub(club || { id: player.clubId, name: rawName }, clubs, { women }) ?? club?.logoFile ?? null;
  const existing = entry.clubList.findIndex((item) => item.key === key);
  if (existing >= 0) {
    const item = entry.clubList[existing];
    item.n += 1;
    if (player.clubId) item.id = player.clubId || club?.id || item.id;
    if (name) item.name = name;
    if (women) {
      item.women = true;
      item.logoFile = logoFile || item.logoFile;
    } else if (!item.logoFile) {
      item.logoFile = logoFile;
    }
  } else {
    entry.clubList.push({
      key,
      id: player.clubId || club?.id || null,
      name,
      logoFile,
      n: 1,
      women,
    });
  }
  const home = entry.clubList.reduce((best, item) => (!best || item.n > best.n ? item : best), null);
  if (!home) return;
  entry.clubId = home.id;
  entry.clubName = home.name;
  entry.themeClubName = home.name;
  entry.logoFile = home.logoFile ?? entry.logoFile ?? null;
}

function collectRoster(grades, clubs) {
  const map = new Map();
  for (const grade of grades ?? []) {
    for (const round of grade.rounds ?? []) {
      for (const game of round.games ?? []) {
        for (const player of game.players ?? []) {
          if (!player?.id) continue;
          let current = map.get(player.id);
          const name = playerName(player);
          if (!current) {
            current = {
              id: player.id,
              firstName: player.firstName,
              lastName: player.lastName,
              name,
              number: player.number || '',
              clubId: null,
              clubName: '',
              themeClubName: '',
              position: player.position || '',
              photoFile: player.photoFile ?? null,
              logoFile: null,
              gradeIds: [grade.id],
              gradeNames: [grade.name],
            };
            map.set(player.id, current);
          } else {
            if (!current.gradeIds.includes(grade.id)) {
              current.gradeIds.push(grade.id);
              current.gradeNames.push(grade.name);
            }
            if (name && name !== 'Private Player') {
              current.name = name;
              if (player.firstName) current.firstName = player.firstName;
              if (player.lastName) current.lastName = player.lastName;
            }
            if (player.photoFile) current.photoFile = player.photoFile;
            if (player.number) current.number = player.number;
            if (player.position) current.position = player.position;
          }
          rememberPlayedClub(current, player, clubs, isWomenGrade(grade));
        }
      }
    }
  }
  return [...map.values()]
    .map(({ clubList, ...player }) => player)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

function decorateRoster(rows) {
  return (rows ?? []).map((row) => ({
    ...row,
    photoUrl: mediaUrl('photos', row.photoFile),
    logoUrl: mediaUrl('logos', row.logoFile),
  }));
}

function totyView(store, roster, grades) {
  const league = totyGradeFrom(grades ?? store.grades);
  const gradeId = league?.id ?? null;
  const all = normalizeToty(store.teamOfTheYear);
  const picks = (gradeId && all[gradeId]) || emptyTotyPicks();
  const leagueRoster = gradeId
    ? (roster ?? []).filter((player) => (player.gradeIds ?? []).includes(gradeId))
    : roster ?? [];
  const byId = new Map((roster ?? []).map((player) => [player.id, player]));
  const sponsor =
    (store.sponsors ?? []).find((item) => String(item.id) === String(store.totySponsorId || '')) ?? null;
  const step = clampTotyStep(store.totyStep);
  const beat = totyBeatAt(step);
  return {
    gradeId,
    gradeName: league?.name || 'League',
    roster: leagueRoster,
    picks: Object.fromEntries(TOTY_POSITIONS.map((pos) => [pos.id, byId.get(picks[pos.id]) ?? null])),
    filled: TOTY_POSITIONS.filter((pos) => picks[pos.id]).length,
    total: TOTY_POSITIONS.length,
    step,
    totalSteps: TOTY_BEATS.length,
    beat: beat
      ? {
          type: beat.type,
          lineLabel: beat.lineLabel,
          short: beat.short ?? null,
          reveal: beat.reveal ?? 0,
          revealStep: beat.revealStep ?? 0,
          spots: beat.spots ?? null,
        }
      : null,
    sponsor: sponsor
      ? {
          id: sponsor.id,
          name: sponsor.name,
          imageUrl: mediaUrl('sponsors', sponsor.imageFile),
        }
      : null,
  };
}

const SPLASH_CLUB_NAMES = {
  'CENTRAL WHYALLA': 'Central Whyalla',
  'NORTH WHYALLA': 'North Whyalla',
  ROOPENA: 'Roopena',
  'SOUTH WHYALLA': 'South Whyalla',
  'WEEROONA BAY': 'Weeroona Bay',
  'WEST WHYALLA': 'West Whyalla',
  'CENTRAL AUGUSTA': 'Central Augusta',
  'WEST AUGUSTA': 'West Augusta',
  'SOUTH AUGUSTA': 'South Augusta',
  'PORT FC': 'Port FC',
};

function displayClubName(name) {
  return SPLASH_CLUB_NAMES[canonicalClubKey(name)] || name;
}

function presentClubName(name) {
  const text = String(name || '').trim();
  if (!text || text === 'Home' || text === 'Away') return text;
  if (text.includes('/')) {
    return text
      .split('/')
      .map((part) => displayClubName(part.trim()))
      .join(' / ');
  }
  return displayClubName(text);
}

function isNamedSplashTeam(name) {
  const key = canonicalClubKey(name);
  return Boolean(key) && key !== 'HOME' && key !== 'AWAY';
}

function pickTwoSplashTeams(teams, seed) {
  const list = [...(teams ?? [])];
  if (list.length < 2) return [];
  let rng = 2166136261;
  for (const ch of String(seed)) {
    rng ^= ch.charCodeAt(0);
    rng = Math.imul(rng, 16777619);
  }
  rng >>>= 0;
  const next = () => {
    rng += 0x6d2b79f5;
    let t = rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return [list[0], list[1]];
}

function resolveSplashClub(clubs, id, name) {
  const byId = (clubs ?? []).find((club) => String(club.id) === String(id));
  if (byId) return byId;
  const key = canonicalClubKey(name);
  if (!key) return { id: id || name, name };
  return (clubs ?? []).find((club) => canonicalClubKey(club.name) === key) ?? { id: id || name, name };
}

function splashCrest(club, clubs, logosDir, key, { women = false } = {}) {
  const womenFile = women ? WOMEN_CLUB_LOGO_OVERRIDES[key] : null;
  const logoFile =
    womenFile && logosDir && existsSync(join(logosDir, womenFile))
      ? womenFile
      : logoFileForClub(club, clubs, { women });
  return {
    id: club?.id || key,
    key,
    name: displayClubName(club?.name || key),
    logoUrl: mediaUrl('logos', logoFile),
  };
}

function splashLeagueClubs(clubs, logosDir) {
  const known = Object.keys(WORDPRESS_CLUB_LOGOS);
  const byKey = new Map();
  for (const club of clubs ?? []) {
    if (looksLikeWomenClub(club.name)) continue;
    const key = canonicalClubKey(club.name);
    if (!known.includes(key)) continue;
    const existing = byKey.get(key);
    if (!existing || (club.logoFile && !existing.logoFile)) byKey.set(key, club);
  }
  return known
    .map((key) => splashCrest(byKey.get(key) || { name: SPLASH_CLUB_NAMES[key] || key }, clubs, logosDir, key))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' }));
}

function splashWomenClubs(grades, clubs, logosDir) {
  const byKey = new Map();
  for (const grade of grades ?? []) {
    for (const round of grade.rounds ?? []) {
      for (const game of round.games ?? []) {
        for (const side of [
          resolveSplashClub(clubs, game.homeId, game.homeName),
          resolveSplashClub(clubs, game.awayId, game.awayName),
        ]) {
          const key = canonicalClubKey(side?.name);
          if (!isNamedSplashTeam(side?.name)) continue;
          const existing = byKey.get(key);
          if (!existing || (side.logoFile && !existing.logoFile)) byKey.set(key, side);
        }
      }
    }
  }
  return [...byKey.entries()]
    .map(([key, club]) => splashCrest(club, clubs, logosDir, key, { women: true }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' }));
}

function splashGradesWithFinals(store, grades) {
  const byId = new Map((store.grades ?? []).map((grade) => [String(grade.id), grade]));
  return (grades ?? []).map((grade) => {
    const source = byId.get(String(grade.id));
    if (!source?.rounds?.length) return grade;
    return { ...grade, rounds: source.rounds };
  });
}

function splashView(store, grades, clubs, settings, logosDir) {
  const wwfl = store.competition === 'wwfl';
  const splashGrades = splashGradesWithFinals(store, grades).filter((grade) =>
    wwfl ? isWomenGrade(grade) : !isWomenGrade(grade)
  );
  const teams = wwfl ? splashWomenClubs(splashGrades, clubs, logosDir) : splashLeagueClubs(clubs, logosDir);
  let fixtures = collectGrandFinalFixtures(splashGrades)
    .filter((game) => isNamedSplashTeam(game.homeName) && isNamedSplashTeam(game.awayName))
    .map((game) => {
      const grade = (splashGrades ?? []).find((item) => String(item.id) === String(game.gradeId));
      const home = resolveSplashClub(clubs, game.homeId, game.homeName);
      const away = resolveSplashClub(clubs, game.awayId, game.awayName);
      return {
        ...game,
        gradeName: overlayGradeName(grade || { name: game.gradeName }, settings),
        homeName: displayClubName(home?.name || game.homeName),
        awayName: displayClubName(away?.name || game.awayName),
        venueName: game.venueName || '',
        homeLogoUrl: mediaUrl('logos', logoFileForClub(home, clubs, { women: wwfl })),
        awayLogoUrl: mediaUrl('logos', logoFileForClub(away, clubs, { women: wwfl })),
      };
    });
  if (settings.placeholderGrandFinal && fixtures.length === 0) {
    const [home, away] = pickTwoSplashTeams(teams, `${store.competition}:${store.season}`);
    if (home && away) {
      const grade = splashGrades[0];
      fixtures = [
        {
          id: 'placeholder-gf',
          gradeName: overlayGradeName(grade || { name: 'League' }, settings),
          homeName: home.name,
          awayName: away.name,
          homeLogoUrl: home.logoUrl,
          awayLogoUrl: away.logoUrl,
          roundName: 'Grand Final',
        },
      ];
    }
  }
  return {
    season: store.season,
    competition: wwfl ? 'wwfl' : 'wfl',
    leagueName: wwfl
      ? "Whyalla Women's Football League"
      : settings.leagueName || 'Whyalla Football League',
    title: wwfl ? 'WWFL Medal Count' : 'WFL Medal Count',
    roundName: 'Grand Final',
    fixtures,
    teams,
  };
}

function lifeMembersView(store, roster, clubs) {
  const raw = normalizeLifeMembers(store.lifeMembers);
  const byId = new Map((roster ?? []).map((player) => [String(player.id), player]));
  const members = raw.map((row) => {
    const player = row.playerId ? byId.get(String(row.playerId)) : null;
    const wflMember = isWflMemberClub(row.clubId) || isWflMemberClub(row.clubName);
    const club = wflMember
      ? null
      : (clubs ?? []).find((item) => String(item.id) === String(player?.clubId || row.clubId || '')) ?? null;
    return {
      id: row.id,
      playerId: row.playerId,
      name: player?.name || row.name,
      firstName: player?.firstName || row.firstName,
      lastName: player?.lastName || row.lastName,
      clubName: wflMember ? WFL_MEMBER_CLUB_NAME : player?.clubName || row.clubName || club?.name || '',
      clubId: wflMember ? WFL_MEMBER_CLUB_ID : player?.clubId || row.clubId || club?.id || null,
      number: player?.number || '',
      photoCustom: Boolean(row.photoFile && String(row.photoFile).startsWith(`lm-${row.id}.`)),
      photoUrl: mediaUrl(
        'photos',
        row.photoFile && String(row.photoFile).startsWith(`lm-${row.id}.`)
          ? row.photoFile
          : player?.photoFile || row.photoFile
      ),
      logoUrl: mediaUrl(
        'logos',
        wflMember ? WFL_LOGO_FILE : player?.logoFile || club?.logoFile || row.logoFile
      ),
      wflMember,
      year: row.year || store.season,
      note: row.note,
    };
  });
  const step = clampLifeMemberStep(store.lifeMemberStep, members.length);
  const beats = lifeMemberBeats(members.length);
  const beat = beats[step] ?? beats[0];
  return {
    members,
    step,
    totalSteps: beats.length,
    beat: beat
      ? {
          type: beat.type,
          index: beat.index ?? null,
        }
      : null,
    current: beat?.type === 'member' ? members[beat.index] ?? null : null,
  };
}

function goalkickerRowView(row, clubs, women = false) {
  if (!row) return null;
  const club = (clubs ?? []).find((item) => item.id === row.clubId) ?? { id: row.clubId, name: row.clubName };
  return {
    ...row,
    photoUrl: mediaUrl('photos', row.photoFile),
    logoUrl: mediaUrl('logos', logoFileForClub(club, clubs, { women }) || row.logoFile),
  };
}

function leadingGoalkickerBoardView(grades, clubs, settings, women = false) {
  return leadingGoalkickers(grades, clubs, settings, GOALKICKER_BOARD_SIZE)
    .map((row) => goalkickerRowView(row, clubs, women))
    .filter(Boolean);
}

function leadingGoalkickerView(grades, clubs, settings, women = false) {
  return goalkickerRowView(leadingGoalkicker(grades, clubs, settings), clubs, women);
}

function findAwardPlayer(playerId, grades, clubs, women = false) {
  const id = String(playerId || '').trim();
  if (!id) return null;
  const clubsById = new Map((clubs ?? []).map((club) => [String(club.id), club]));
  const clubCounts = new Map();
  let latest = null;
  let photoFile = null;
  let number = '';
  let position = '';
  for (const grade of grades ?? []) {
    const gradeWomen = women || isWomenGrade(grade);
    for (const round of grade.rounds ?? []) {
      for (const game of round.games ?? []) {
        const player = (game.players ?? []).find((item) => String(item.id) === id);
        if (!player) continue;
        const club = clubsById.get(String(player.clubId || '')) ?? null;
        const rawName = player.clubName || club?.name || '';
        const key = canonicalClubKey(rawName) || String(player.clubId || rawName);
        if (key) {
          const current = clubCounts.get(key) ?? {
            n: 0,
            id: player.clubId || club?.id || null,
            name: rawName,
            women: gradeWomen,
          };
          current.n += 1;
          if (player.clubId) current.id = player.clubId || club?.id || current.id;
          if (rawName) current.name = rawName;
          current.women = current.women || gradeWomen;
          clubCounts.set(key, current);
        }
        if (player.photoFile) photoFile = player.photoFile;
        if (player.number) number = player.number;
        if (player.position) position = player.position;
        latest = { player, club, women: gradeWomen };
      }
    }
  }
  if (!latest) return null;
  const home = [...clubCounts.values()].reduce((best, item) => (!best || item.n > best.n ? item : best), null);
  const club =
    clubsById.get(String(home?.id || latest.player.clubId || '')) ||
    latest.club ||
    { id: home?.id || latest.player.clubId, name: home?.name || latest.player.clubName };
  const clubName = presentClubName(home?.name || latest.player.clubName || club?.name || '');
  const womenLogo = home?.women || latest.women || women;
  return {
    id: latest.player.id,
    name: playerName(latest.player),
    firstName: latest.player.firstName || '',
    lastName: latest.player.lastName || '',
    number: number || latest.player.number || '',
    clubId: club?.id || home?.id || latest.player.clubId || null,
    clubName,
    themeClubName: clubName,
    position,
    photoUrl: mediaUrl('photos', photoFile || latest.player.photoFile),
    logoUrl: mediaUrl(
      'logos',
      logoFileForClub(club, clubs, { women: womenLogo }) || club?.logoFile
    ),
  };
}

function awardWinnerFrom(meta, roster, grades, clubs, women = false) {
  const playerId = String(meta?.playerId || '').trim();
  const fromGames = playerId ? findAwardPlayer(playerId, grades, clubs, women) : null;
  if (fromGames) return fromGames;
  const player = playerId
    ? (roster ?? []).find((row) => String(row.id) === playerId)
    : null;
  if (player) {
    const clubName = presentClubName(player.clubName);
    return {
      id: player.id,
      name: playerName(player) !== 'Private Player' ? playerName(player) : player.name,
      clubName,
      clubId: player.clubId,
      number: player.number || '',
      photoUrl: player.photoUrl ?? mediaUrl('photos', player.photoFile),
      logoUrl:
        player.logoUrl ??
        mediaUrl('logos', logoFileForClub(player, clubs, { women }) || player.logoFile),
      themeClubName: presentClubName(player.themeClubName || player.clubName),
    };
  }
  const name = String(meta?.detail || '').trim();
  if (!name) return null;
  return {
    name,
    clubName: '',
    photoUrl: null,
    logoUrl: null,
  };
}

function cueView(store, grades, clubs, settings, women = false, roster = []) {
  const queue = normalizePresentationQueue(store.presentation?.queue);
  const queueItem = queue[store.presentation?.queueIndex ?? 0];
  const id =
    store.audienceView === 'cue'
      ? store.cueKey || queueItem?.id || queueItem?.type
      : store.cueKey || queueItem?.id;
  const extras = normalizeNightExtras(store.nightExtras);
  const meta = runsheetCue(id, extras);
  const board = leadingGoalkickerBoardView(grades, clubs, settings, women);
  const winner = board[0] ?? leadingGoalkickerView(grades, clubs, settings, women);
  if (!meta) {
    return {
      id: id || null,
      title: 'Run sheet',
      detail: '',
      cue: '',
      kind: 'cue',
      step: 0,
      revealed: true,
      board,
      winner,
    };
  }
  const goalkicker = isGoalkickerCue(meta);
  const award = isAwardCue(meta);
  const step = goalkicker || award ? clampCueStep(store.cueStep) : 0;
  const revealed = !(goalkicker || award) || step >= 1;
  const awardWinner = award
    ? awardWinnerFrom(meta, roster, store.grades ?? grades, clubs, women)
    : null;
  return {
    id: meta.id,
    title: meta.title,
    detail:
      goalkicker && step >= 2
        ? 'Top 5'
        : goalkicker && revealed && winner
          ? `${winner.name} · ${winner.goals} ${winner.goals === 1 ? 'goal' : 'goals'}`
          : award && !revealed
            ? ''
            : awardWinner?.name || meta.detail,
    cue: meta.cue,
    kind: meta.kind,
    step,
    revealed,
    board: goalkicker ? board : [],
    winner: goalkicker && revealed ? winner : award && revealed ? awardWinner : null,
  };
}

export function applyPresentationCursor(full, store) {
  const slides = full.presentation?.slides ?? [];
  const slideIndex = Math.min(store.presentation?.slideIndex ?? 0, Math.max(0, slides.length - 1));
  const audienceView = normalizeAudienceView(store.audienceView);
  const queue = normalizePresentationQueue(store.presentation?.queue);
  const queueItem = queue[store.presentation?.queueIndex ?? 0];
  const totyStep = clampTotyStep(store.totyStep);
  const totyBeat = totyBeatAt(totyStep);
  const members = full.lifeMembers?.members ?? [];
  const lifeStep = clampLifeMemberStep(store.lifeMemberStep, members.length);
  const lifeBeats = lifeMemberBeats(members.length);
  const lifeBeat = lifeBeats[lifeStep] ?? lifeBeats[0];
  const runCurrent =
    runsheetIdForQueueItem(queueItem, slides[slideIndex]?.gradeId) ||
    (audienceView === 'splash'
      ? 'splash'
      : audienceView === 'cue'
        ? store.cueKey || queueItem?.id || 'cue'
        : audienceView === 'toty'
          ? 'toty'
          : audienceView === 'lifemembers'
            ? 'lifemembers'
            : full.presentation?.gradeId ?? null);

  return {
    ...full,
    audienceView,
    presentation: {
      ...full.presentation,
      slideIndex,
      current: slides[slideIndex] ?? null,
      runCurrent,
    },
    toty: full.toty
      ? {
          ...full.toty,
          step: totyStep,
          beat: totyBeat
            ? {
                type: totyBeat.type,
                lineLabel: totyBeat.lineLabel,
                short: totyBeat.short ?? null,
                reveal: totyBeat.reveal ?? 0,
                revealStep: totyBeat.revealStep ?? 0,
                spots: totyBeat.spots ?? null,
              }
            : null,
        }
      : full.toty,
    lifeMembers: full.lifeMembers
      ? {
          ...full.lifeMembers,
          step: lifeStep,
          beat: lifeBeat ? { type: lifeBeat.type, index: lifeBeat.index ?? null } : null,
          current: lifeBeat?.type === 'member' ? members[lifeBeat.index] ?? null : null,
        }
      : full.lifeMembers,
    cue: (() => {
      const extras = full.nightExtras ?? normalizeNightExtras(store.nightExtras);
      const meta = runsheetCue(store.cueKey || queueItem?.id, extras);
      const board = full.leadingGoalkickerBoard ?? full.cue?.board ?? [];
      const winner = board[0] ?? full.leadingGoalkicker ?? full.cue?.winner ?? null;
      if (!meta) return full.cue;
      const goalkicker = isGoalkickerCue(meta);
      const award = isAwardCue(meta);
      const step = goalkicker || award ? clampCueStep(store.cueStep) : 0;
      const revealed = !(goalkicker || award) || step >= 1;
      const awardWinner = award
        ? awardWinnerFrom(
            meta,
            full.roster,
            store.grades ?? full.grades,
            full.clubs,
            normalizeCompetition(store.competition) === 'wwfl'
          )
        : null;
      return {
        id: meta.id,
        title: meta.title,
        detail:
          goalkicker && step >= 2
            ? 'Top 5'
            : goalkicker && revealed && winner
              ? `${winner.name} · ${winner.goals} ${winner.goals === 1 ? 'goal' : 'goals'}`
              : award && !revealed
                ? ''
                : awardWinner?.name || meta.detail,
        cue: meta.cue,
        kind: meta.kind,
        step,
        revealed,
        board: goalkicker ? board : [],
        winner: goalkicker && revealed ? winner : award && revealed ? awardWinner : null,
      };
    })(),
  };
}

function sponsorViews(store) {
  return (store.sponsors ?? []).map((sponsor) => ({
    ...sponsor,
    imageUrl: mediaUrl('sponsors', sponsor.imageFile),
  }));
}

function revealedBoardFromSlide(slide) {
  if (!slide || slide.type === 'title') return [];
  return Array.isArray(slide.board) ? slide.board : [];
}

function summarizeDeck(deck) {
  const rounds = roundNumbersFromSlides(deck.slides);
  return {
    id: deck.id,
    name: deck.name,
    medalTitle: deck.medalTitle,
    slideCount: deck.slides.length,
    roundCount: rounds.length,
    firstRound: rounds[0] ?? null,
    lastRound: rounds[rounds.length - 1] ?? null,
  };
}

function clubsForGrade(clubs, grade) {
  const women = isWomenGrade(grade);
  return (clubs ?? []).map((club) => {
    const logoFile = logoFileForClub(club, clubs, { women });
    return { ...club, logoFile, logoUrl: mediaUrl('logos', logoFile) };
  });
}

function gradeBoardsView(store, clubs, settings, currentSlide, grades) {
  const all = sortGrades(grades ?? []).map((grade) => {
    const gradeClubs = clubsForGrade(clubs, grade);
    return {
      id: grade.id,
      name: overlayGradeName(grade, settings),
      medalTitle: overlayMedalTitle(grade, settings),
      board: boardView(tallyGrade(grade, gradeClubs, null, settings)),
    };
  });
  if (store.scoreboard?.leaderboardScope === 'grade') {
    const id = String(store.scoreboard?.gradeId || '');
    const one = all.filter((item) => String(item.id) === id);
    return one.length ? one : all.slice(0, 1);
  }
  if (store.scoreboard?.leaderboardScope === 'current') {
    const id =
      currentSlide?.gradeId ||
      store.scoreboard?.gradeId ||
      store.presentation?.gradeId ||
      store.activeGradeId;
    const one = all.filter((item) => item.id === id);
    const target = one.length ? one : all.slice(0, 1);
    return target.map((item) =>
      !currentSlide || String(currentSlide.gradeId) === String(item.id)
        ? { ...item, board: revealedBoardFromSlide(currentSlide) }
        : { ...item, board: [] }
    );
  }
  return all;
}

function scoreboardView(store, clubs, settings, sponsors, currentSlide, grades, boardGrades) {
  const list = grades ?? [];
  const gradeId = store.scoreboard?.gradeId || store.activeGradeId;
  const grade = list.find((item) => item.id === gradeId) ?? list[0] ?? null;
  if (!grade) return null;
  const topN = settings.leaderboardSize;
  const liveTopN = settings.liveVoteCount || 6;
  const gradeClubs = clubsForGrade(clubs, grade);
  const tally = tallyGrade(grade, gradeClubs, null, settings);
  const page = `${grade.id}:${store.scoreboard?.roundId || 'all'}`;
  return {
    gradeId: grade.id,
    gradeName: overlayGradeName(grade, settings),
    medalTitle: overlayMedalTitle(grade, settings),
    season: grade.season || store.season,
    topN,
    liveTopN,
    top8: boardView(tally.slice(0, liveTopN)),
    board: boardView(tally),
    grades: gradeBoardsView(store, clubs, settings, currentSlide, boardGrades ?? list),
    sponsors: pickSponsorsForPage(sponsors, `scoreboard:${page}`),
    leaderboardSponsors: pickSponsorsForPage(sponsors, `leaderboard:${page}`),
  };
}

function playerView(player) {
  return {
    ...player,
    name: playerName(player),
    photoUrl: mediaUrl('photos', player.photoFile),
  };
}

function boardView(rows) {
  return (rows ?? []).map((row) => ({
    ...row,
    clubName: presentClubName(row.clubName),
    photoUrl: mediaUrl('photos', row.photoFile),
    logoUrl: mediaUrl('logos', row.logoFile),
  }));
}

function roundNumbersFromSlides(slides) {
  const seen = [];
  for (const slide of slides ?? []) {
    const n = roundNumberFromName(slide.roundName);
    if (n == null || seen.includes(n)) continue;
    seen.push(n);
  }
  return seen;
}

function slideUsesWomenVotes(slide) {
  if (!slide || slide.type !== 'votes') return false;
  if (slide.women === true || slide.competition === 'wwfl') return true;
  if ((slide.voteScale ?? []).includes(4)) return true;
  if ((slide.picks ?? []).some((pick) => Number(pick.points) === 4)) return true;
  return /women|leverington|\bwwfl\b/i.test(
    `${slide.medalTitle || ''} ${slide.gradeName || ''} ${slide.homeName || ''} ${slide.awayName || ''}`
  );
}

function forceWomenVoteScale(slide, competition) {
  if (!slide || slide.type !== 'votes') return slide;
  const wwfl = normalizeCompetition(competition) === 'wwfl' || slide.competition === 'wwfl';
  const women = wwfl || slideUsesWomenVotes(slide);
  return {
    ...slide,
    women,
    competition: wwfl ? 'wwfl' : slide.competition || competition || null,
    voteScale: women ? [...WOMEN_VOTE_SCALE] : [...(slide.voteScale?.length ? slide.voteScale : MEN_VOTE_SCALE)],
  };
}

function decorateSlides(rawSlides, sponsors, competition) {
  return (rawSlides ?? []).map((slide) => ({
    ...forceWomenVoteScale(slide, competition),
    sponsors: pickSponsorsForPage(
      sponsors,
      [slide.gradeId, slide.roundId || slide.roundName || slide.type].join(':')
    ),
    photoUrl: mediaUrl('photos', slide.photoFile || slide.winner?.photoFile),
    logoUrl: mediaUrl('logos', slide.logoFile || slide.winner?.logoFile),
    homeLogoUrl: mediaUrl('logos', slide.homeLogoFile),
    awayLogoUrl: mediaUrl('logos', slide.awayLogoFile),
    imageUrl: mediaUrl('sponsors', slide.imageFile),
    winner: slide.winner
      ? {
          ...slide.winner,
          clubName: presentClubName(slide.winner.clubName),
          homeClubName: presentClubName(slide.winner.homeClubName),
          photoUrl: mediaUrl('photos', slide.winner.photoFile),
          logoUrl: mediaUrl('logos', slide.winner.logoFile),
        }
      : null,
    runnerUp: slide.runnerUp
      ? {
          ...slide.runnerUp,
          clubName: presentClubName(slide.runnerUp.clubName),
          photoUrl: mediaUrl('photos', slide.runnerUp.photoFile),
          logoUrl: mediaUrl('logos', slide.runnerUp.logoFile),
        }
      : null,
    homeName: presentClubName(slide.homeName),
    awayName: presentClubName(slide.awayName),
    clubName: presentClubName(slide.clubName),
    ...(slide.forfeit || slide.forfeitLine
      ? forfeitDetails({
          ...slide,
          homeName: presentClubName(slide.homeName),
          awayName: presentClubName(slide.awayName),
        })
      : {}),
    board: boardView(slide.board),
    games: (slide.games ?? []).map((game) => {
      const named = {
        ...game,
        homeName: presentClubName(game.homeName),
        awayName: presentClubName(game.awayName),
      };
      return {
        ...named,
        ...forfeitDetails(named),
        ...scoreFields(named),
        homeLogoUrl: mediaUrl('logos', game.homeLogoFile),
        awayLogoUrl: mediaUrl('logos', game.awayLogoFile),
      };
    }),
    picks: (slide.picks ?? []).map((pick) => ({
      ...pick,
      clubName: presentClubName(pick.clubName),
      clubLabel: presentClubName(pick.clubLabel || pick.clubName),
      photoUrl: mediaUrl('photos', pick.photoFile),
      logoUrl: mediaUrl('logos', pick.logoFile),
    })),
  }));
}

export function decorateState(store, paths) {
  const settings = mergeSettings(store.settings);
  const womenComp = normalizeCompetition(store.competition) === 'wwfl';
  const rawClubs = store.clubs ?? [];
  const clubs = rawClubs.map((club) => {
    const logoFile = logoFileForClub(club, rawClubs, { women: womenComp });
    return {
      ...club,
      logoFile,
      logoUrl: mediaUrl('logos', logoFile),
    };
  });

  const allGrades = sortGrades(store.grades ?? []).map((grade) => {
    const gradeClubs = clubsForGrade(rawClubs, grade);
    return {
      ...grade,
      name: overlayGradeName(grade, settings),
      medalTitle: overlayMedalTitle(grade, settings),
      progress: gradeProgress(grade, settings),
      leaderboard: tallyGrade(grade, gradeClubs, null, settings).map((row) => ({
        ...row,
        clubName: presentClubName(row.clubName),
        photoUrl: mediaUrl('photos', row.photoFile),
        logoUrl: mediaUrl('logos', row.logoFile),
      })),
      rounds: (grade.rounds ?? []).filter((round) => includeRound(round, settings)).map((round) => ({
        ...round,
        games: round.games.map((game) => {
          const named = {
            ...game,
            homeName: presentClubName(game.homeName),
            awayName: presentClubName(game.awayName),
          };
          return {
            ...named,
            ...forfeitDetails(named),
            ...scoreFields(named),
            homeLogoUrl: mediaUrl('logos', gradeClubs.find((club) => club.id === game.homeId)?.logoFile),
            awayLogoUrl: mediaUrl('logos', gradeClubs.find((club) => club.id === game.awayId)?.logoFile),
            players: (game.players ?? []).map((player) => ({
              ...playerView(player),
              clubName: presentClubName(player.clubName),
              clubLabel: presentClubName(clubLabelForVote(grade, player.id, player.clubName)),
            })),
          };
        }),
      })),
    };
  });
  const grades = gradesForCompetition(allGrades, store.competition);

  const activeGrade = grades.find((grade) => grade.id === store.activeGradeId) ?? grades[0] ?? null;
  const sponsors = sponsorViews(store);
  const starts =
    store.presentation?.starts &&
    typeof store.presentation.starts === 'object' &&
    !Array.isArray(store.presentation.starts)
      ? store.presentation.starts
      : {};
  const deckFor = (grade) => ({
    id: grade.id,
    name: grade.name,
    medalTitle: grade.medalTitle,
    slides: decorateSlides(
      buildSlides(grade, clubsForGrade(rawClubs, grade), store.sponsors, settings, {
        competition: store.competition,
      }),
      sponsors,
      store.competition
    ),
  });
  const allDecks = allGrades.map(deckFor);
  const decks = allDecks.filter((deck) => grades.some((grade) => grade.id === deck.id));
  const knownIds = new Set(allDecks.map((deck) => deck.id));
  const queue = normalizePresentationQueue(store.presentation?.queue);
  const queueItem = queue[store.presentation?.queueIndex ?? 0];
  const queueGradeIds = queueItem?.type === 'preso'
    ? (queueItem.gradeIds ?? []).map((id) => String(id)).filter((id) => knownIds.has(id))
    : [];
  const presentationGrade =
    allGrades.find((grade) => grade.id === (queueGradeIds[0] || store.presentation?.gradeId || store.activeGradeId)) ??
    activeGrade;
  const presoSlidesFor = (gradeId) => {
    const grade = allGrades.find((item) => item.id === gradeId);
    if (!grade) return [];
    return decorateSlides(
      buildSlides(grade, clubsForGrade(rawClubs, grade), store.sponsors, settings, {
        fromRound: starts[gradeId],
        competition: store.competition,
      }),
      sponsors,
      store.competition
    );
  };
  const slides = slidesFromStartRound(presoSlidesFor(presentationGrade?.id), starts[presentationGrade?.id]);

  const slideIndex = Math.min(store.presentation?.slideIndex ?? 0, Math.max(0, slides.length - 1));
  const currentSlide = slides[slideIndex] ?? null;
  const roster = decorateRoster(
    collectRoster(
      grades.map((grade) => {
        const source = (store.grades ?? []).find((item) => String(item.id) === String(grade.id));
        return source ? { ...source, id: grade.id, name: grade.name } : grade;
      }),
      clubs
    )
  );

  return {
    season: store.season,
    lastSyncedAt: store.lastSyncedAt,
    competition: womenComp ? 'wwfl' : 'wfl',
    activeGradeId: activeGrade?.id ?? null,
    selectedGameId: store.selectedGameId,
    grades,
    gradeRoster: (store.grades ?? []).map((grade) => ({
      id: String(grade.id),
      women: isWomenGrade(grade),
    })),
    clubs,
    leagueClubs: splashLeagueClubs(clubs, paths.logos),
    sponsors,
    audienceView: normalizeAudienceView(store.audienceView),
    presentation: {
      gradeId: presentationGrade?.id ?? null,
      gradeIds: presentationGrade?.id ? [presentationGrade.id] : [],
      slideIndex,
      runCurrent:
        runsheetIdForQueueItem(
          queueItem,
          slides[slideIndex]?.gradeId
        ) ||
        (store.audienceView === 'splash'
          ? 'splash'
          : store.audienceView === 'cue'
            ? store.cueKey || queueItem?.id || 'cue'
            : store.audienceView === 'toty'
              ? 'toty'
              : store.audienceView === 'lifemembers'
                ? 'lifemembers'
                : presentationGrade?.id ?? null),
      slides,
      current: currentSlide,
      decks: decks.map(summarizeDeck),
      allDecks: allDecks.map(summarizeDeck),
    },
    scoreboard: scoreboardView(store, clubs, settings, sponsors, currentSlide, grades),
    roster,
    toty: totyView(store, roster, grades),
    lifeMembers: lifeMembersView(store, roster, clubs),
    splash: splashView(store, grades, clubs, settings, paths.logos),
    cue: cueView(store, grades, clubs, settings, womenComp, roster),
    nightExtras: normalizeNightExtras(store.nightExtras),
    leadingGoalkickerBoard: leadingGoalkickerBoardView(grades, clubs, settings, womenComp),
    leadingGoalkicker: leadingGoalkickerView(grades, clubs, settings, womenComp),
    crowd: crowdViewWithLogos(settings, clubs, womenComp),
    settings,
    sync: store.sync,
    wflLogoUrl: existsSync(join(paths.logos, 'wfl-logo.svg'))
      ? mediaUrl('logos', 'wfl-logo.svg')
      : null,
    dataPath: paths.root,
  };
}

export function audienceState(store, paths) {
  return audienceFromState(decorateState(store, paths));
}

export function audienceFromState(full) {
  const view = normalizeAudienceView(full.audienceView);
  const slides = full.presentation?.slides ?? [];
  const slideIndex = full.presentation?.slideIndex ?? 0;
  const base = {
    season: full.season,
    competition: full.competition,
    wflLogoUrl: full.wflLogoUrl,
    audienceView: view,
    settings: full.settings,
    sponsors: full.sponsors,
  };
  if (view === 'leaderboard' || view === 'scoreboard') {
    return { ...base, scoreboard: full.scoreboard };
  }
  if (view === 'toty') {
    return {
      ...base,
      toty: {
        gradeName: full.toty?.gradeName,
        filled: full.toty?.filled,
        total: full.toty?.total,
        picks: full.toty?.picks,
        step: full.toty?.step ?? 0,
        totalSteps: full.toty?.totalSteps ?? 0,
        beat: full.toty?.beat ?? null,
        sponsor: full.toty?.sponsor ?? null,
      },
    };
  }
  if (view === 'lifemembers') {
    return { ...base, lifeMembers: full.lifeMembers };
  }
  if (view === 'splash') {
    return { ...base, splash: full.splash };
  }
  if (view === 'cue') {
    return { ...base, cue: full.cue };
  }
  if (view === 'crowd') {
    return { ...base, crowd: full.crowd };
  }
  const current = forceWomenVoteScale(
    full.presentation?.current ?? slides[slideIndex] ?? null,
    full.competition
  );
  return {
    ...base,
    presentation: {
      slideIndex,
      current,
      runCurrent: full.presentation?.runCurrent ?? null,
      peek: slides.slice(slideIndex + 1, slideIndex + 3).map((slide) => forceWomenVoteScale(slide, full.competition)),
    },
  };
}
