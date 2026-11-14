import {
  forfeitDetails,
  homeAndAwayRoundNumber,
  includeRound,
  isForfeitGame,
  isWomenGrade,
  leagueGradeFrom,
  mergeSettings,
  totyGradeFrom,
  voteKeyForPoints,
  voteScaleForGrade,
} from './constants.js';
import {
  displayRoundTitle,
  formatSpecialtyName,
  roundSpecialtyName,
  specialtyPresentation,
} from './specialty.js';
import { scoreFields } from './score.js';

function specialtySlideFields(round, game = null, settings = null) {
  const specialtyName = formatSpecialtyName(
    normalizeGameAlias(game) || roundSpecialtyName(round)
  );
  return {
    ...specialtyPresentation(settings, specialtyName, round?.specialtyPinFile || null),
    roundTitle: displayRoundTitle(round),
  };
}

function normalizeGameAlias(game) {
  return formatSpecialtyName(game?.alias || '');
}

export function playerName(player) {
  const first = String(player?.firstName ?? '').trim();
  const last = String(player?.lastName ?? '').trim();
  const combined = `${first} ${last}`.trim();
  if (combined) return combined;
  const named = String(player?.name ?? '').trim();
  if (named && named !== 'Private Player') return named;
  return 'Private Player';
}

export function findPlayerInGame(game, playerId) {
  return (game?.players ?? []).find((player) => player.id === playerId) ?? null;
}

export function findPlayerInGrade(grade, playerId) {
  for (const round of grade?.rounds ?? []) {
    for (const game of round.games ?? []) {
      const player = findPlayerInGame(game, playerId);
      if (player) return { player, game, round };
    }
  }
  return null;
}

export function homeClubForPlayer(grade, playerId) {
  const counts = new Map();
  for (const round of grade?.rounds ?? []) {
    for (const game of round.games ?? []) {
      const player = findPlayerInGame(game, playerId);
      if (!player?.clubName) continue;
      const key = player.clubId || player.clubName;
      const current = counts.get(key) ?? { id: player.clubId, name: player.clubName, n: 0 };
      current.n += 1;
      counts.set(key, current);
    }
  }
  let best = null;
  for (const entry of counts.values()) {
    if (!best || entry.n > best.n) best = entry;
  }
  return best;
}

export function clubLabelForVote(grade, playerId, voteClubName) {
  const homeName = homeClubForPlayer(grade, playerId)?.name || '';
  const voteName = String(voteClubName || '').trim();
  if (homeName && voteName && homeName !== voteName) return `${homeName} / ${voteName}`;
  return voteName || homeName;
}

export function votesComplete(votes, scale) {
  const keys = (scale ?? [3, 2, 1]).map(voteKeyForPoints);
  return keys.every((key) => votes?.[key]);
}

export function gameVoteStatus(game, scale) {
  if (!game?.votes) return 'empty';
  const keys = (scale ?? [3, 2, 1]).map(voteKeyForPoints);
  const filled = keys.filter((key) => game.votes[key]);
  if (filled.length === keys.length) return 'done';
  if (filled.length) return 'partial';
  return 'empty';
}

export function tallyGrade(grade, clubs = [], throughRoundId = null, settings = {}, options = {}) {
  const totals = new Map();
  const untilGameId = options.untilGameId ?? null;
  const reveal = options.reveal;
  let stop = false;

  for (const round of grade?.rounds ?? []) {
    if (stop) break;
    if (!includeRound(round, settings)) continue;
    for (const game of round.games ?? []) {
      const isUntil = untilGameId && game.id === untilGameId;
      if (isForfeitGame(game)) {
        if (isUntil) {
          stop = true;
          break;
        }
        continue;
      }
      const scale = voteScaleForGrade(grade);
      const votes = scale
        .map((points) => [points, game.votes?.[voteKeyForPoints(points)]])
        .filter(([points]) => {
        if (!isUntil) return true;
        return typeof reveal === 'number' && points >= reveal;
      });
      for (const [points, playerId] of votes) {
        if (!playerId) continue;
        const player = findPlayerInGame(game, playerId);
        if (!player) continue;
        const existing = totals.get(playerId) ?? {
          id: playerId,
          name: playerName(player),
          clubId: player.clubId,
          clubName: player.clubName,
          number: player.number,
          photoFile: player.photoFile,
          votes: 0,
          fours: 0,
          threes: 0,
          twos: 0,
          ones: 0,
          games: 0,
          voteClubs: new Set(),
        };
        existing.votes += points;
        existing.games += 1;
        if (points === 4) existing.fours += 1;
        if (points === 3) existing.threes += 1;
        if (points === 2) existing.twos += 1;
        if (points === 1) existing.ones += 1;
        if (player.photoFile) existing.photoFile = player.photoFile;
        if (player.clubName) existing.voteClubs.add(player.clubName);
        totals.set(playerId, existing);
      }
      if (isUntil) {
        stop = true;
        break;
      }
    }
    if (!untilGameId && throughRoundId && round.id === throughRoundId) break;
  }

  const clubById = new Map((clubs ?? []).map((club) => [club.id, club]));
  return [...totals.values()]
    .map((row) => {
      const home = homeClubForPlayer(grade, row.id);
      const extras = [...(row.voteClubs ?? [])].filter((name) => name && name !== home?.name);
      const clubName = extras.length
        ? [home?.name, ...extras].filter(Boolean).join(' / ')
        : home?.name || row.clubName;
      return {
        id: row.id,
        name: row.name,
        clubId: home?.id || row.clubId,
        clubName,
        number: row.number,
        photoFile: row.photoFile,
        votes: row.votes,
        fours: row.fours,
        threes: row.threes,
        twos: row.twos,
        ones: row.ones,
        games: row.games,
        logoFile: clubById.get(home?.id || row.clubId)?.logoFile ?? null,
      };
    })
    .sort((a, b) => {
      if (b.votes !== a.votes) return b.votes - a.votes;
      if ((b.fours ?? 0) !== (a.fours ?? 0)) return (b.fours ?? 0) - (a.fours ?? 0);
      if (b.threes !== a.threes) return b.threes - a.threes;
      if (b.twos !== a.twos) return b.twos - a.twos;
      return a.name.localeCompare(b.name);
    });
}

function liveBoard(grade, clubs, settings, gameId, reveal, topN) {
  return tallyGrade(grade, clubs, null, settings, { untilGameId: gameId, reveal }).slice(0, topN);
}

export function playerCampaign(grade, playerId, settings = {}) {
  let gamesPlayed = 0;
  let goals = 0;
  let behinds = 0;
  let homeGames = 0;
  let awayGames = 0;
  let captainRole = null;
  let position = null;
  let firstPoll = null;
  let lastPoll = null;
  let bestHaul = 0;
  let gamesVoted = 0;
  let homeClubName = homeClubForPlayer(grade, playerId)?.name ?? null;

  for (const round of grade?.rounds ?? []) {
    if (!includeRound(round, settings)) continue;
    for (const game of round.games ?? []) {
      if (isForfeitGame(game)) continue;
      const player = findPlayerInGame(game, playerId);
      if (player) {
        gamesPlayed += 1;
        goals += Number(player.goals) || 0;
        behinds += Number(player.behinds) || 0;
        if (player.clubId === game.homeId) homeGames += 1;
        else if (player.clubId === game.awayId) awayGames += 1;
        if (player.captainRole) captainRole = player.captainRole;
        if (player.position) position = player.position;
      }
      const haul =
        (game.votes?.four === playerId ? 4 : 0) +
        (game.votes?.three === playerId ? 3 : 0) +
        (game.votes?.two === playerId ? 2 : 0) +
        (game.votes?.one === playerId ? 1 : 0);
      if (!haul) continue;
      gamesVoted += 1;
      if (haul > bestHaul) bestHaul = haul;
      if (!firstPoll) firstPoll = round.name;
      lastPoll = round.name;
    }
  }

  return {
    gamesPlayed,
    gamesVoted,
    goals,
    behinds,
    homeGames,
    awayGames,
    captainRole,
    position,
    firstPoll,
    lastPoll,
    bestHaul,
    homeClubName,
  };
}

function enrichWinner(row, grade, settings, runnerUp) {
  const extra = playerCampaign(grade, row.id, settings);
  const gamesPlayed = extra.gamesPlayed || 0;
  return {
    ...row,
    ...extra,
    themeClubName: extra.homeClubName || row.clubName,
    pollPercent: gamesPlayed
      ? Math.round((row.votes / (gamesPlayed * Math.max(...voteScaleForGrade(grade)))) * 1000) / 10
      : null,
    avgVotes: gamesPlayed ? (row.votes / gamesPlayed).toFixed(2) : null,
    margin: runnerUp ? row.votes - runnerUp.votes : null,
  };
}

export function gradeProgress(grade, settings = {}) {
  const games = (grade?.rounds ?? [])
    .filter((round) => includeRound(round, settings))
    .flatMap((round) => round.games ?? []);
  const eligible = games.filter((game) => {
    if (isForfeitGame(game)) return false;
    return (game.players?.length ?? 0) > 0 || game.status === 'FINAL';
  });
  const done = eligible.filter((game) => gameVoteStatus(game, voteScaleForGrade(grade)) === 'done').length;
  return { done, total: eligible.length };
}

export function votePicksForGame(game, clubs = [], grade = null, competition) {
  const scale = [...voteScaleForGrade(grade, competition)];
  if (game?.votes?.four && !scale.includes(4)) scale.unshift(4);
  return scale
    .map((points) => {
      const key = voteKeyForPoints(points);
      const playerId = game.votes?.[key];
      if (!playerId) return null;
      const player = findPlayerInGame(game, playerId);
      if (!player) return null;
      return {
        points,
        playerId,
        name: playerName(player),
        number: player.number,
        clubId: player.clubId,
        clubName: player.clubName,
        clubLabel: grade ? clubLabelForVote(grade, player.id, player.clubName) : player.clubName,
        themeClubName: player.clubName,
        photoFile: player.photoFile,
        logoFile: clubs.find((club) => club.id === player.clubId)?.logoFile ?? null,
      };
    })
    .filter(Boolean);
}

function gameScoreFields(game) {
  return {
    homeScore: game.homeScore,
    awayScore: game.awayScore,
    homeGoals: game.homeGoals ?? null,
    homeBehinds: game.homeBehinds ?? null,
    awayGoals: game.awayGoals ?? null,
    awayBehinds: game.awayBehinds ?? null,
    ...scoreFields(game),
  };
}

function forfeitSlideFields(game) {
  return forfeitDetails(game);
}

export function buildSlides(grade, clubs = [], _sponsors = [], settings = {}, options = {}) {
  if (!grade) return [];
  const s = mergeSettings(settings);
  const topN = s.leaderboardSize;
  const liveN = s.liveVoteCount || 6;
  const fromRaw = Number(options.fromRound);
  const fromRound = Number.isFinite(fromRaw) && fromRaw > 1 ? Math.floor(fromRaw) : null;
  const slides = [];
  if (s.showTitleSlide) {
    slides.push({
      type: 'title',
      gradeId: grade.id,
      gradeName: grade.name,
      medalTitle: grade.medalTitle,
      season: grade.season,
    });
  }

  let previousRoundId = null;

  for (const round of grade.rounds ?? []) {
    if (!includeRound(round, s)) continue;
    const roundNo = homeAndAwayRoundNumber(round.name);
    if (fromRound && roundNo != null && roundNo < fromRound) {
      previousRoundId = round.id;
      continue;
    }
    const playable = (round.games ?? []).filter((game) => {
      if (isForfeitGame(game)) return true;
      return Boolean(game.votes?.four || game.votes?.three || game.votes?.two || game.votes?.one);
    });
    const isStartRound = Boolean(fromRound && roundNo === fromRound);
    if (!playable.length && !isStartRound) continue;

    if (s.showRoundScoreboard) {
      slides.push({
        type: 'round',
        gradeId: grade.id,
        roundId: round.id,
        roundName: round.name,
        ...specialtySlideFields(round, null, s),
        medalTitle: grade.medalTitle,
        season: grade.season,
        topN,
        games: (round.games ?? []).map((game) => ({
          id: game.id,
          status: game.status,
          alias: normalizeGameAlias(game) || null,
          homeName: game.homeName,
          awayName: game.awayName,
          venueName: game.venueName || '',
          ...gameScoreFields(game),
          homeLogoFile: clubs.find((club) => club.id === game.homeId)?.logoFile,
          awayLogoFile: clubs.find((club) => club.id === game.awayId)?.logoFile,
          ...forfeitSlideFields(game),
        })),
        liveTopN: liveN,
        board: previousRoundId ? tallyGrade(grade, clubs, previousRoundId, s).slice(0, liveN) : [],
      });
    }

    for (const game of playable) {
      if (isForfeitGame(game)) {
        if (!s.showForfeitSlides) continue;
        slides.push({
          type: 'match',
          gradeId: grade.id,
          roundId: round.id,
          roundName: round.name,
          ...specialtySlideFields(round, game, s),
          gameId: game.id,
          medalTitle: grade.medalTitle,
          season: grade.season,
          topN,
          liveTopN: liveN,
          board: liveBoard(grade, clubs, s, game.id, null, liveN),
          homeName: game.homeName,
          awayName: game.awayName,
          venueName: game.venueName || '',
          ...gameScoreFields(game),
          homeLogoFile: clubs.find((club) => club.id === game.homeId)?.logoFile,
          awayLogoFile: clubs.find((club) => club.id === game.awayId)?.logoFile,
          ...forfeitSlideFields(game),
        });
        continue;
      }

      const picks = votePicksForGame(game, clubs, grade, options.competition);
      if (!picks.length) continue;
      const scale = [...voteScaleForGrade(grade, options.competition)];
      const votesSlide = {
        type: 'votes',
        gradeId: grade.id,
        roundId: round.id,
        roundName: round.name,
        ...specialtySlideFields(round, game, s),
        gameId: game.id,
        gradeName: grade.name,
        medalTitle: grade.medalTitle,
        season: grade.season,
        showMatchScore: s.showMatchScoreOnVotes,
        topN,
        liveTopN: liveN,
        homeName: game.homeName,
        awayName: game.awayName,
        venueName: game.venueName || '',
        ...gameScoreFields(game),
        homeLogoFile: clubs.find((club) => club.id === game.homeId)?.logoFile,
        awayLogoFile: clubs.find((club) => club.id === game.awayId)?.logoFile,
        picks,
        women: isWomenGrade(grade) || scale.length > 3,
        competition: options.competition || null,
        voteScale: scale,
      };
      if (s.showVoteHoldSlide) {
        slides.push({
          ...votesSlide,
          reveal: null,
          board: liveBoard(grade, clubs, s, game.id, null, liveN),
        });
      }
      for (const pick of picks) {
        slides.push({
          ...votesSlide,
          reveal: pick.points,
          board: liveBoard(grade, clubs, s, game.id, pick.points, liveN),
        });
      }
    }

    if (s.showLeaderboardAfterRound) {
      const through = displayRoundTitle(round) || round.name;
      slides.push({
        type: 'leaderboard',
        gradeId: grade.id,
        roundId: round.id,
        roundName: round.name,
        ...specialtySlideFields(round, null, s),
        medalTitle: grade.medalTitle,
        throughRound: through,
        topN,
        board: tallyGrade(grade, clubs, round.id, s).slice(0, topN),
      });
    }
    previousRoundId = round.id;
  }

  const board = tallyGrade(grade, clubs, null, s);
  if (s.showWinnerSlide && board.length) {
    slides.push({
      type: 'winner',
      gradeId: grade.id,
      medalTitle: grade.medalTitle,
      season: grade.season,
      topN,
      board: board.slice(0, topN),
      winner: enrichWinner(board[0], grade, s, board[1] ?? null),
      runnerUp: board[1] ?? null,
    });
  }

  return slides;
}

export function leadingGoalkickers(grades, clubs = [], settings = {}, limit = 5) {
  const pool = grades ?? [];
  const grade = leagueGradeFrom(pool) ?? totyGradeFrom(pool) ?? pool[0] ?? null;
  if (!grade) return [];

  const totals = new Map();
  const clubById = new Map((clubs ?? []).map((club) => [club.id, club]));
  const size = Math.max(1, Math.round(Number(limit) || 5));

  for (const round of grade.rounds ?? []) {
    if (!includeRound(round, settings)) continue;
    for (const game of round.games ?? []) {
      if (isForfeitGame(game)) continue;
      for (const player of game.players ?? []) {
        const id = String(player?.id || '');
        if (!id) continue;
        const existing = totals.get(id) ?? {
          id,
          name: playerName(player),
          clubId: player.clubId,
          clubName: player.clubName,
          number: player.number,
          photoFile: player.photoFile,
          goals: 0,
          games: 0,
        };
        existing.goals += Number(player.goals) || 0;
        existing.games += 1;
        if (player.photoFile) existing.photoFile = player.photoFile;
        if (player.number) existing.number = player.number;
        totals.set(id, existing);
      }
    }
  }

  return [...totals.values()]
    .filter((row) => row.goals > 0)
    .sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name))
    .slice(0, size)
    .map((row) => {
      const home = homeClubForPlayer(grade, row.id);
      const club = clubById.get(home?.id || row.clubId);
      return {
        ...row,
        clubId: home?.id || row.clubId,
        clubName: home?.name || row.clubName,
        logoFile: club?.logoFile ?? null,
        gradeName: grade.medalTitle || grade.name,
      };
    });
}

export function leadingGoalkicker(grades, clubs = [], settings = {}) {
  return leadingGoalkickers(grades, clubs, settings, 1)[0] ?? null;
}
