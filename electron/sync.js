import { copyFileSync, existsSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  CLUB_LOGO_BASE,
  MATCHDAY_BASE,
  PHOTO_BASE,
  WIDGET_USER_ID,
  WFL_LOGO_URL,
  clubLogoFileName,
  emptyVotes,
  displayNameForGrade,
  medalTitleForGrade,
  sortGrades,
  canonicalClubKey,
  wordpressClubLogoUrl,
  overrideLogoFileForClub,
  clubLogoSourceUrl,
  siteLogoFileName,
  looksLikeWomenClub,
  looksLikeWomenGradeMeta,
  mensGradeIndexesFrom,
  womenGradeIndexesFrom,
  WORDPRESS_CLUB_LOGOS,
  EXTRA_CLUB_LOGOS,
  venueDisplayName,
} from './constants.js';
import { fetchJson, fetchBuffer, mapPool } from './http.js';
import { applyFixtureScores } from './score.js';

function forfeitFields(home, away) {
  const homeOutcome = home?.outcome ?? null;
  const awayOutcome = away?.outcome ?? null;
  const forfeit = [homeOutcome, awayOutcome].some((value) => String(value || '').includes('FORFEIT'));
  return {
    homeOutcome,
    awayOutcome,
    forfeit,
    forfeitWinnerId: homeOutcome === 'WON_BY_FORFEIT' ? home?.id ?? null : awayOutcome === 'WON_BY_FORFEIT' ? away?.id ?? null : null,
    forfeitLoserId: homeOutcome === 'LOST_BY_FORFEIT' ? home?.id ?? null : awayOutcome === 'LOST_BY_FORFEIT' ? away?.id ?? null : null,
  };
}

function goalsOf(appearance) {
  const six = appearance.scoreSubTotal?.find((stat) => stat.type === '6_POINT_SCORE')?.value;
  return typeof six === 'number' ? six / 6 : 0;
}

function behindsOf(appearance) {
  const one = appearance.scoreSubTotal?.find((stat) => stat.type === '1_POINT_SCORE')?.value;
  return typeof one === 'number' ? one : 0;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asList(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value);
  return [];
}

function isSheetPlayer(appearance) {
  const role = String(appearance?.roleType || appearance?.role || '');
  if (/coach|manager|staff|official|trainer|volunteer/i.test(role)) return false;
  if (/player/i.test(role)) return true;
  return Boolean(appearance?.firstName || appearance?.lastName || appearance?.playerNumber);
}

function keepManualPlayers(incoming, existing) {
  const manual = (existing ?? []).filter((player) => player?.manual);
  if (!manual.length) return incoming ?? [];
  const seen = new Set((incoming ?? []).map((player) => String(player.id)));
  return [...(incoming ?? []), ...manual.filter((player) => !seen.has(String(player.id)))];
}

function sheetStillMissing(game) {
  const published = (game?.players ?? []).filter((player) => !player?.manual);
  if (published.length) return false;
  if (game?.forfeit) return false;
  if (!game?.homeId || !game?.awayId) return false;
  if (game.homeName === 'Home' || game.awayName === 'Away') return false;
  return true;
}

function playersFromSummary(data, clubsById, prev) {
  return asList(data?.appearances)
    .filter(isSheetPlayer)
    .map((appearance) => {
      const club = clubsById.get(appearance.teamID);
      return {
        id: appearance.id,
        firstName: appearance.firstName,
        lastName: appearance.lastName,
        number: appearance.playerNumber ? String(appearance.playerNumber) : '',
        clubId: appearance.teamID,
        clubName: club?.name ?? '',
        captainRole: appearance.captainRole,
        position: appearance.positionName || appearance.playerPosition || appearance.position || null,
        goals: goalsOf(appearance),
        behinds: behindsOf(appearance),
        photoFile: previousPlayerPhoto(prev, appearance.id),
      };
    })
    .sort((a, b) => Number(a.number || 999) - Number(b.number || 999));
}

async function fetchSheetPlayers(game, clubsById, prev, attempts = 3) {
  let lastError = 'Team sheet not published yet';
  const tries = Math.max(1, attempts);
  for (let attempt = 0; attempt < tries; attempt += 1) {
    try {
      const match = await fetchJson(`${MATCHDAY_BASE}/get_match_data.php?id=${game.id}`);
      const maId = match?.matchData?.maId;
      if (!maId) {
        lastError = 'Match centre has no id yet';
      } else {
        const summary = await fetchJson(
          `${MATCHDAY_BASE}/get_match_summary_data.php?matchId=${maId}&userid=${WIDGET_USER_ID}&playHqId=${game.id}`
        );
        const players = playersFromSummary(summary?.matchSummary?.data, clubsById, prev);
        if (players.length) return players;
        if (game.forfeit || !game.homeId || !game.awayId) return [];
        lastError = 'Team sheet not published yet';
      }
    } catch (error) {
      lastError = String(error.message ?? error);
    }
    if (attempt < tries - 1) await wait(600 * (attempt + 1));
  }
  throw new Error(lastError);
}

async function downloadFile(url, destPath, { overwrite = false } = {}) {
  if (!overwrite && existsSync(destPath)) return true;
  try {
    const bytes = await fetchBuffer(url);
    if (!bytes) return false;
    const tmp = `${destPath}.part`;
    writeFileSync(tmp, bytes);
    if (existsSync(destPath)) {
      try {
        unlinkSync(destPath);
      } catch {
        /* replace below */
      }
    }
    copyFileSync(tmp, destPath);
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
    return existsSync(destPath);
  } catch {
    return false;
  }
}

export async function ensureWebsiteClubLogos(paths) {
  const entries = Object.entries({ ...WORDPRESS_CLUB_LOGOS, ...EXTRA_CLUB_LOGOS });
  for (const [key, url] of entries) {
    const fileName = siteLogoFileName(key);
    if (!fileName || !url) continue;
    await downloadFile(url, join(paths.logos, fileName));
  }
}

export function applyClubLogoFiles(clubs, paths) {
  for (const club of clubs ?? []) {
    const women = looksLikeWomenClub(club.name);
    const override = overrideLogoFileForClub(club.name, women);
    if (override && existsSync(join(paths.logos, override))) {
      club.logoFile = override;
      continue;
    }
    const site = siteLogoFileName(club.name);
    if (site && existsSync(join(paths.logos, site))) {
      club.logoFile = site;
    }
  }
  return clubs;
}

async function ensureClubLogo(club, paths) {
  const women = looksLikeWomenClub(club.name);
  const override = overrideLogoFileForClub(club.name, women);
  if (override && existsSync(join(paths.logos, override))) {
    club.logoFile = override;
    return;
  }
  const siteName = siteLogoFileName(club.name);
  const source = clubLogoSourceUrl(club.name) || wordpressClubLogoUrl(club.name);
  if (siteName && source) {
    const dest = join(paths.logos, siteName);
    if (await downloadFile(source, dest, { overwrite: true })) {
      club.logoFile = siteName;
      return;
    }
    if (existsSync(dest)) {
      club.logoFile = siteName;
      return;
    }
  }
  const fileName = `${club.id}.png`;
  const dest = join(paths.logos, fileName);
  const key = canonicalClubKey(club.name);
  const sources = [
    source,
    key ? `${CLUB_LOGO_BASE}/${clubLogoFileName(key)}.png` : null,
    `${CLUB_LOGO_BASE}/${clubLogoFileName(club.name)}.png`,
  ].filter(Boolean);
  for (const url of sources) {
    if (await downloadFile(url, dest, { overwrite: looksLikeWomenClub(club.name) })) {
      club.logoFile = fileName;
      return;
    }
  }
  if (existsSync(dest)) {
    club.logoFile = fileName;
  }
}

async function ensurePlayerPhoto(player, paths) {
  const fileName = `${player.id}.webp`;
  const dest = join(paths.photos, fileName);
  if (existsSync(dest)) {
    player.photoFile = fileName;
    return;
  }
  const ok = await downloadFile(`${PHOTO_BASE}/${player.id}.webp`, dest);
  if (ok) player.photoFile = fileName;
}

async function ensureWflLogo(paths) {
  const dest = join(paths.logos, 'wfl-logo.svg');
  if (!existsSync(dest)) {
    await downloadFile(WFL_LOGO_URL, dest);
  }
}

function keepVotes(previousGame) {
  return previousGame?.votes ? { ...emptyVotes(), ...previousGame.votes } : emptyVotes();
}

function previousPlayerPhoto(previousGame, playerId) {
  return previousGame?.players?.find((player) => player.id === playerId)?.photoFile ?? null;
}

export async function syncSeason(store, paths, onProgress, gradeIndexes = null) {
  const previousGames = new Map();
  for (const grade of store.grades ?? []) {
    for (const round of grade.rounds ?? []) {
      for (const game of round.games ?? []) {
        previousGames.set(`${grade.id}:${game.id}`, game);
      }
    }
  }

  const grades = [];
  const clubsById = new Map((store.clubs ?? []).map((club) => [club.id, { ...club }]));
  let work = [];

  onProgress?.('Loading fixtures…');
  const firstFixture = await fetchJson(
    `${MATCHDAY_BASE}/get_widget_fixture_data.php?id=${WIDGET_USER_ID}&grade=0&getLogos=true&season=0`
  );
  const discovered = [
    ...mensGradeIndexesFrom(firstFixture?.grades),
    ...womenGradeIndexesFrom(firstFixture?.grades),
  ];
  const indexes =
    Array.isArray(gradeIndexes) && gradeIndexes.length
      ? gradeIndexes
      : discovered.length
        ? discovered
        : mensGradeIndexesFrom(firstFixture?.grades);

  for (const gradeIndex of indexes) {
    onProgress?.(`Loading fixtures (grade ${gradeIndex + 1})…`);
    const fixture =
      gradeIndex === 0
        ? firstFixture
        : await fetchJson(
            `${MATCHDAY_BASE}/get_widget_fixture_data.php?id=${WIDGET_USER_ID}&grade=${gradeIndex}&getLogos=true&season=0`
          );
    const gradeMeta = fixture.grades?.[gradeIndex];
    if (!gradeMeta) continue;
    const season = String(gradeMeta.season ?? store.season ?? new Date().getFullYear());
    const selected = fixture.selectedFixtureData ?? {};
    const surfaces = new Map((selected.playingSurfaces ?? []).map((item) => [String(item.id), item]));
    for (const club of selected.teams ?? fixture.teams ?? []) {
      if (!clubsById.has(club.id)) {
        clubsById.set(club.id, {
          id: club.id,
          name: club.name,
          logoFile: null,
        });
      } else {
        clubsById.get(club.id).name = club.name;
      }
    }

    const rounds = [];
    for (const round of selected.rounds ?? []) {
      rounds.push({
        id: round.id,
        name: round.name,
        abbreviatedName: round.abbreviatedName,
        isFinal: Boolean(round.isFinalRound),
        games: (round.games ?? []).map((game) => {
          const home = (game.teams ?? []).find((team) => team.isHomeTeam);
          const away = (game.teams ?? []).find((team) => !team.isHomeTeam);
          const prev = previousGames.get(`${gradeIndex}:${game.id}`);
          const surfaceId = String(game.schedule?.[0]?.playingSurfaceId ?? '');
          const venueName = venueDisplayName(surfaces.get(surfaceId)) || prev?.venueName || '';
          return {
            id: game.id,
            status: game.status,
            date: game.schedule?.[0]?.dateTime ?? null,
            homeId: home?.id ?? null,
            awayId: away?.id ?? null,
            homeName: clubsById.get(home?.id)?.name ?? 'Home',
            awayName: clubsById.get(away?.id)?.name ?? 'Away',
            venueName,
            ...applyFixtureScores({}, game, home?.id, away?.id),
            ...forfeitFields(home, away),
            players: prev?.players ?? [],
            votes: keepVotes(prev),
          };
        }),
      });
    }

    const gameCount = rounds.reduce((n, round) => n + (round.games?.length || 0), 0);
    if (looksLikeWomenGradeMeta(gradeMeta) && gameCount === 0) continue;

    grades.push({
      id: String(gradeIndex),
      sourceName: gradeMeta.gradeName,
      name: displayNameForGrade(gradeMeta.gradeName, String(gradeIndex)),
      medalTitle: medalTitleForGrade(gradeMeta.gradeName, String(gradeIndex)),
      season,
      women: looksLikeWomenGradeMeta(gradeMeta),
      gradeGroup: gradeMeta.gradeGroup ?? null,
      rounds,
    });

    for (const round of rounds) {
      for (const game of round.games) {
        if (game.status === 'UPCOMING' && game.players.length) continue;
        work.push({ gradeId: String(gradeIndex), game });
      }
    }
  }

  await ensureWflLogo(paths);
  await ensureWebsiteClubLogos(paths);
  const clubs = [...clubsById.values()].sort((a, b) => {
    const aName = String(a.name || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, ' ');
    const bName = String(b.name || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, ' ');
    const aExact = canonicalClubKey(a.name) === aName ? 0 : 1;
    const bExact = canonicalClubKey(b.name) === bName ? 0 : 1;
    return aExact - bExact;
  });
  for (const club of clubs) {
    await ensureClubLogo(club, paths);
  }
  applyClubLogoFiles(clubs, paths);

  async function pullSheet(gradeId, game, attempts = 1) {
    const prev = previousGames.get(`${gradeId}:${game.id}`);
    try {
      const players = await fetchSheetPlayers(game, clubsById, prev, attempts);
      if (players.length) {
        game.players = keepManualPlayers(players, game.players);
        delete game.syncError;
        await mapPool(game.players, 4, (player) => ensurePlayerPhoto(player, paths));
        return;
      }
      if ((prev?.players ?? []).length) return;
      if (sheetStillMissing(game)) game.syncError = 'Team sheet not published yet';
    } catch (error) {
      if ((prev?.players ?? []).length) return;
      game.syncError = String(error.message ?? error);
    }
  }

  let done = 0;
  await mapPool(work, 3, async ({ gradeId, game }) => {
    done += 1;
    onProgress?.(`Team sheets ${done} of ${work.length}`, done, work.length);
    await pullSheet(gradeId, game);
  });

  const missed = [];
  for (const grade of grades) {
    for (const round of grade.rounds ?? []) {
      for (const game of round.games ?? []) {
        if (sheetStillMissing(game)) missed.push({ gradeId: grade.id, game });
      }
    }
  }
  if (missed.length) {
    let retried = 0;
    await mapPool(missed, 2, async ({ gradeId, game }) => {
      retried += 1;
      onProgress?.(`Retrying team sheets ${retried} of ${missed.length}`, retried, missed.length);
      await pullSheet(gradeId, game, 3);
    });
  }

  store.grades = sortGrades(grades);
  store.clubs = [...clubsById.values()];
  store.season = grades[0]?.season ?? store.season;
  if (!store.activeGradeId || !grades.some((grade) => grade.id === store.activeGradeId)) {
    store.activeGradeId = grades[0]?.id ?? null;
  }
  const stillThere = grades.some((grade) =>
    grade.rounds.some((round) => round.games.some((game) => game.id === store.selectedGameId))
  );
  if (!stillThere) {
    store.selectedGameId = grades[0]?.rounds?.[0]?.games?.[0]?.id ?? null;
  }
  store.lastSyncedAt = new Date().toISOString();
  return store;
}

export async function refreshFixtureScores(store, gradeId = null, paths = null) {
  const indexes = gradeId == null || gradeId === ''
    ? (store.grades ?? []).map((item) => Number(item.id)).filter((index) => Number.isInteger(index))
    : [Number(gradeId)].filter((index) => Number.isInteger(index));
  for (const gradeIndex of indexes) {
    const fixture = await fetchJson(
      `${MATCHDAY_BASE}/get_widget_fixture_data.php?id=${WIDGET_USER_ID}&grade=${gradeIndex}&getLogos=true&season=0`
    );
    const grade = (store.grades ?? []).find((item) => item.id === String(gradeIndex));
    if (!grade) continue;
    const surfaces = new Map(
      (fixture.selectedFixtureData?.playingSurfaces ?? []).map((item) => [String(item.id), item])
    );
    const gamesById = new Map();
    for (const round of grade.rounds ?? []) {
      for (const game of round.games ?? []) gamesById.set(game.id, game);
    }
    for (const round of fixture.selectedFixtureData?.rounds ?? []) {
      for (const game of round.games ?? []) {
        const existing = gamesById.get(game.id);
        if (!existing) continue;
        const home = (game.teams ?? []).find((team) => team.isHomeTeam);
        const away = (game.teams ?? []).find((team) => !team.isHomeTeam);
        existing.status = game.status;
        const surfaceId = String(game.schedule?.[0]?.playingSurfaceId ?? '');
        const venueName = venueDisplayName(surfaces.get(surfaceId));
        if (venueName) existing.venueName = venueName;
        applyFixtureScores(existing, game, home?.id, away?.id);
        Object.assign(existing, forfeitFields(home, away));
      }
    }
    const clubsById = new Map((store.clubs ?? []).map((club) => [club.id, club]));
    const missing = [];
    for (const round of grade.rounds ?? []) {
      for (const game of round.games ?? []) {
        if (sheetStillMissing(game)) missing.push(game);
      }
    }
    for (const game of missing) {
      try {
        const players = await fetchSheetPlayers(game, clubsById, game, 2);
        if (!players.length) continue;
        game.players = keepManualPlayers(players, game.players);
        delete game.syncError;
        if (paths) await mapPool(game.players, 4, (player) => ensurePlayerPhoto(player, paths));
      } catch (error) {
        game.syncError = String(error.message ?? error);
      }
    }
  }
  return store;
}
