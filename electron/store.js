import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { clampLifeMemberStep, clampTotyStep, CLUB_LOGO_OVERRIDES, WOMEN_CLUB_LOGO_OVERRIDES, createEmptyStore, mergeSettings, normalizeAudienceView, normalizeLifeMembers, normalizePresentationQueue, normalizeToty } from './constants.js';

export function storePaths(userData) {
  const root = join(userData, 'wfl-medal-count');
  return {
    root,
    dataFile: join(root, 'data.json'),
    photos: join(root, 'photos'),
    logos: join(root, 'logos'),
    sponsors: join(root, 'sponsors'),
  };
}

export function ensureStoreDirs(paths) {
  mkdirSync(paths.root, { recursive: true });
  mkdirSync(paths.photos, { recursive: true });
  mkdirSync(paths.logos, { recursive: true });
  mkdirSync(paths.sponsors, { recursive: true });
}

export function installClubLogoOverrides(paths, sourceDir) {
  ensureStoreDirs(paths);
  if (!sourceDir || !existsSync(sourceDir)) return;
  for (const fileName of [...new Set([...Object.values(CLUB_LOGO_OVERRIDES), ...Object.values(WOMEN_CLUB_LOGO_OVERRIDES)])]) {
    const src = join(sourceDir, fileName);
    if (!existsSync(src)) continue;
    copyFileSync(src, join(paths.logos, fileName));
  }
}

export function loadStore(paths) {
  ensureStoreDirs(paths);
  if (!existsSync(paths.dataFile)) {
    return createEmptyStore();
  }
  try {
    const parsed = JSON.parse(readFileSync(paths.dataFile, 'utf8'));
    const empty = createEmptyStore();
    return {
      ...empty,
      ...parsed,
      grades: (parsed.grades ?? []).map((grade) => ({
        ...grade,
        women:
          grade?.women === true ||
          /women/i.test(`${grade?.sourceName || ''} ${grade?.name || ''}`) ||
          Number(grade?.gradeGroup) === 2,
      })),
      sync: empty.sync,
      audienceView: normalizeAudienceView(parsed.audienceView),
      scoreboard: {
        ...empty.scoreboard,
        ...(parsed.scoreboard ?? {}),
        sponsorIds: Array.isArray(parsed.scoreboard?.sponsorIds) ? parsed.scoreboard.sponsorIds.slice(-2) : [],
        leaderboardScope: parsed.scoreboard?.leaderboardScope === 'current' ? 'current' : 'all',
      },
      presentation: {
        ...empty.presentation,
        ...(parsed.presentation ?? {}),
        starts:
          parsed.presentation?.starts &&
          typeof parsed.presentation.starts === 'object' &&
          !Array.isArray(parsed.presentation.starts)
            ? parsed.presentation.starts
            : {},
        gradeIds: Array.isArray(parsed.presentation?.gradeIds)
          ? parsed.presentation.gradeIds.map(String)
          : null,
        queue: normalizePresentationQueue(parsed.presentation?.queue),
        queueIndex: Math.max(0, Number(parsed.presentation?.queueIndex) || 0),
      },
      settings: mergeSettings(parsed.settings),
      competition: parsed.competition === 'wwfl' ? 'wwfl' : 'wfl',
      teamOfTheYear: normalizeToty(parsed.teamOfTheYear),
      totyStep: clampTotyStep(parsed.totyStep),
      lifeMembers: normalizeLifeMembers(parsed.lifeMembers),
      lifeMemberStep: clampLifeMemberStep(parsed.lifeMemberStep, normalizeLifeMembers(parsed.lifeMembers).length),
    };
  } catch {
    return createEmptyStore();
  }
}

export function saveStore(paths, store) {
  ensureStoreDirs(paths);
  const { sync, ...rest } = store;
  writeFileSync(paths.dataFile, JSON.stringify(rest, null, 2), 'utf8');
}

export function mediaUrl(kind, fileName) {
  if (!fileName) return null;
  return `medal://${kind}/${encodeURIComponent(fileName)}`;
}
