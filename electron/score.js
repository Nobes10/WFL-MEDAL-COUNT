import { forfeitDetails, isForfeitGame } from './constants.js';

function statValue(game, teamId, type) {
  const stats = game?.match?.teams?.find((team) => team.id === teamId)?.outcome?.statistics ?? [];
  const value = stats.find((stat) => stat.type === type)?.value;
  return typeof value === 'number' ? value : null;
}

export function readTeamScore(game, teamId) {
  return {
    total: statValue(game, teamId, 'TOTAL_SCORE'),
    goals: statValue(game, teamId, 'TOTAL_GOALS'),
    behinds: statValue(game, teamId, 'TOTAL_BEHINDS'),
  };
}

export function applyFixtureScores(target, fixtureGame, homeId, awayId) {
  const home = readTeamScore(fixtureGame, homeId);
  const away = readTeamScore(fixtureGame, awayId);
  target.homeScore = home.total;
  target.homeGoals = home.goals;
  target.homeBehinds = home.behinds;
  target.awayScore = away.total;
  target.awayGoals = away.goals;
  target.awayBehinds = away.behinds;
  return target;
}

export function formatTeamScoreLine(goals, behinds, total) {
  if (goals != null && behinds != null) {
    const points = total ?? goals * 6 + behinds;
    return `${goals}.${behinds} (${points})`;
  }
  if (total != null) return String(total);
  return null;
}

export function scoreFields(game) {
  const homeScoreLine = formatTeamScoreLine(game?.homeGoals, game?.homeBehinds, game?.homeScore);
  const awayScoreLine = formatTeamScoreLine(game?.awayGoals, game?.awayBehinds, game?.awayScore);
  const scoreLine = isForfeitGame(game)
    ? forfeitDetails(game).forfeitLine || 'Forfeit'
    : homeScoreLine || awayScoreLine
      ? `${homeScoreLine ?? '—'} – ${awayScoreLine ?? '—'}`
      : '—';
  return { homeScoreLine, awayScoreLine, scoreLine };
}
