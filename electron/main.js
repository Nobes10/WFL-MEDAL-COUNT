import {
  app,
  BrowserWindow,
  clipboard,
  ipcMain,
  protocol,
  net,
  screen,
  dialog,
  shell,
} from 'electron';
import { randomUUID } from 'crypto';
import { copyFileSync, existsSync, readdirSync, unlinkSync, writeFileSync } from 'fs';
import { basename, extname, join } from 'path';
import { printDocument } from './print.js';
import { fileURLToPath, pathToFileURL } from 'url';
import { applyPlayerVote, createEmptyStore, emptyTotyPicks, emptyVotes, isForfeitGame, mergeSettings, uniqueVotes, TOTY_POSITIONS, TOTY_POSITION_IDS, leagueGradeFrom, totyGradeFrom, clampTotyStep, clampLifeMemberStep, clampCueStep, GOALKICKER_LAST_STEP, AWARD_LAST_STEP, normalizeLifeMembers, normalizeNightExtra, normalizeNightExtras, TOTY_BEATS, lifeMemberBeats, buildPresentationQueue, normalizePresentationQueue, logoFileForClub, isWflMemberClub, WFL_MEMBER_CLUB_ID, WFL_MEMBER_CLUB_NAME, WFL_LOGO_FILE, normalizeCompetition, gradesForCompetition, isGoalkickerCue, isAwardCue, voteScaleForGrade, voteKeyForPoints, LEAGUE_CLUB_NAMES, canonicalClubKey, displayLeagueClubName } from './constants.js';
import { playerName } from './tally.js';
import { ensureStoreDirs, installClubLogoOverrides, loadStore, saveStore, storePaths } from './store.js';
import { syncSeason, refreshFixtureScores, ensureWebsiteClubLogos, applyClubLogoFiles } from './sync.js';
import { applyPresentationCursor, audienceFromState, decorateState } from './view.js';
import { broadcastObs, startObsServer } from './obs.js';
import { startCrowdServer } from './crowdServer.js';
import { enableDirectorFunnel } from './tailscale.js';
import {
  approveAllPhotos,
  approvePhoto,
  artFilePath,
  clearCustomArt,
  denyPhoto,
  importCrowdFiles,
  lanAddresses,
  makePhotoCode,
  photoPath,
  photosRoot,
  setCustomArtFromPath,
} from './crowdPhotos.js';
import {
  applySpecialtyRoundOverrides,
  formatSpecialtyName,
  mergeSpecialtyAssets,
  migrateRoundSpecialtyPins,
  normalizeSpecialtyColors,
  specialtyAssetKey,
} from './specialty.js';
import { extractSpecialtyColors } from './specialtyColors.js';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'medal',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const isDev = Boolean(process.env.ELECTRON_DEV);
let mainWindow = null;
let audienceWindow = null;
let obsPage = null;
let crowdPage = null;
let crowdShareBase = '';
let funnelUrl = '';
let funnelRetryTimer = null;
let funnelState = { status: '', message: '', url: null, busy: false };
let store = null;
let paths = null;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.exit(0);
} else {
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

function totyStorageGradeId(requested) {
  const grades = store?.grades ?? [];
  const wanted = String(requested || '');
  if (wanted && grades.some((grade) => String(grade.id) === wanted)) return wanted;
  const pool = gradesForCompetition(grades, store?.competition);
  return String(totyGradeFrom(pool)?.id || totyGradeFrom(grades)?.id || '');
}

function dataPath(kind, fileName) {
  if (kind === 'photos') return join(paths.photos, fileName);
  if (kind === 'logos') return join(paths.logos, fileName);
  if (kind === 'sponsors') return join(paths.sponsors, fileName);
  if (kind === 'specialty') return join(paths.specialty, fileName);
  return null;
}

function ensureScoreboard() {
  if (!store.scoreboard) {
    store.scoreboard = { gradeId: null, roundId: null, sponsorIds: [], leaderboardScope: 'all' };
  }
  if (!Array.isArray(store.scoreboard.sponsorIds)) store.scoreboard.sponsorIds = [];
}

function currentPresentationGradeId() {
  const queue = normalizePresentationQueue(store.presentation?.queue);
  const item = queue[store.presentation?.queueIndex ?? 0];
  if (item?.type === 'leaderboard' && item.gradeId) return String(item.gradeId);
  if (item?.type === 'preso' && item.gradeIds?.[0]) return String(item.gradeIds[0]);
  return store.presentation?.gradeId || store.activeGradeId || store.scoreboard?.gradeId || null;
}

function stopScoreboardLive() {}

function currentSettings() {
  return mergeSettings(store?.settings);
}

function audienceWantsFullscreen() {
  return currentSettings().audienceFullscreen !== false;
}

function applyAudienceWindowSettings() {
  if (!audienceWindow || audienceWindow.isDestroyed()) return;
  const settings = currentSettings();
  audienceWindow.setAlwaysOnTop(Boolean(settings.audienceAlwaysOnTop));
  audienceWindow.setFullScreen(settings.audienceFullscreen !== false);
}

function crowdClubNames() {
  const wwfl = normalizeCompetition(store?.competition) === 'wwfl';
  if (!wwfl) return [...LEAGUE_CLUB_NAMES];
  const found = new Map();
  for (const grade of gradesForCompetition(store?.grades, 'wwfl')) {
    for (const round of grade.rounds ?? []) {
      for (const game of round.games ?? []) {
        for (const raw of [game.homeName, game.awayName]) {
          const key = canonicalClubKey(raw);
          if (!key || key === 'CENTRAL WHYALLA' || key === 'HOME' || key === 'AWAY') continue;
          const label = displayLeagueClubName(raw);
          if (!label) continue;
          found.set(key, label);
        }
      }
    }
  }
  if (found.size) return [...found.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  return LEAGUE_CLUB_NAMES.filter((name) => canonicalClubKey(name) !== 'CENTRAL WHYALLA');
}

function crowdVenues() {
  const wwfl = normalizeCompetition(store?.competition) === 'wwfl';
  const clubs = store?.clubs ?? [];
  return crowdClubNames().map((name) => {
    const file =
      logoFileForClub({ name }, clubs, { women: wwfl }) ||
      logoFileForClub({ name }, clubs, { women: false });
    return {
      name,
      logo: file ? `/club-logo/${encodeURIComponent(file)}` : '',
    };
  });
}

function crowdShareInfo() {
  const port = crowdPage?.port;
  const bases = [];
  if (funnelUrl) bases.push(funnelUrl);
  if (port) {
    for (const ip of lanAddresses()) bases.push(`http://${ip}:${port}`);
    bases.push(`http://127.0.0.1:${port}`);
  }
  const unique = [...new Set(bases)];
  const base = unique.includes(crowdShareBase) ? crowdShareBase : unique[0] || '';
  return {
    port: port ?? null,
    shareBases: unique,
    shareBase: base,
    shareUrl: base ? `${base}/` : '',
    anywhereReady: Boolean(funnelUrl),
    anywhereBusy: Boolean(funnelState.busy),
    anywhereNote: funnelState.message || '',
  };
}

function withWindowState(state) {
  return {
    ...state,
    audienceOpen: Boolean(audienceWindow && !audienceWindow.isDestroyed()),
    obsUrl: obsPage?.url ?? null,
    crowd: {
      ...(state.crowd ?? {}),
      ...crowdShareInfo(),
    },
  };
}

function presentingToObs() {
  return currentSettings().presentTarget === 'obs';
}

function ensurePresentOutput() {
  if (presentingToObs()) return;
  if (!audienceWindow || audienceWindow.isDestroyed()) createAudienceWindow();
}

let persistTimer = null;
let decoratedCache = null;
let lastSlideCount = 0;

function persist({ keepDecorate = false } = {}) {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (!keepDecorate) decoratedCache = null;
  saveStore(paths, store);
}
function persistSoon() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persist({ keepDecorate: true });
  }, 500);
}

function currentDecorated() {
  if (!decoratedCache) decoratedCache = decorateState(store, paths);
  return applyPresentationCursor(decoratedCache, store);
}

function presentationCursorPatch(full) {
  return {
    audienceView: full.audienceView,
    presentation: {
      slideIndex: full.presentation?.slideIndex ?? 0,
      current: full.presentation?.current ?? null,
      runCurrent: full.presentation?.runCurrent ?? null,
    },
    toty: {
      step: full.toty?.step ?? 0,
      beat: full.toty?.beat ?? null,
      totalSteps: full.toty?.totalSteps ?? 0,
    },
    lifeMembers: {
      step: full.lifeMembers?.step ?? 0,
      beat: full.lifeMembers?.beat ?? null,
      current: full.lifeMembers?.current ?? null,
      totalSteps: full.lifeMembers?.totalSteps ?? 0,
    },
    cue: full.cue
      ? {
          id: full.cue.id ?? null,
          title: full.cue.title ?? '',
          detail: full.cue.detail ?? '',
          kind: full.cue.kind ?? 'cue',
          step: full.cue.step ?? 0,
          revealed: Boolean(full.cue.revealed),
          board: full.cue.board ?? [],
          winner: full.cue.winner ?? null,
        }
      : full.cue,
    ...(full.audienceView === 'leaderboard'
      ? {
          scoreboard: {
            gradeId: full.scoreboard?.gradeId ?? null,
            gradeName: full.scoreboard?.gradeName ?? '',
            medalTitle: full.scoreboard?.medalTitle ?? '',
            leaderboardScope: full.scoreboard?.leaderboardScope ?? 'all',
          },
        }
      : {}),
  };
}

function emitState({ cheap = false } = {}) {
  if (!cheap || !decoratedCache) {
    decoratedCache = decorateState(store, paths);
  }
  const full = applyPresentationCursor(decoratedCache, store);
  lastSlideCount = full.presentation?.slides?.length ?? 0;
  const audience = audienceFromState(full);
  audienceWindow?.webContents.send('audience-update', audience);
  broadcastObs(audience);
  if (cheap) {
    const patch = presentationCursorPatch(full);
    mainWindow?.webContents.send('state-cursor', patch);
    return patch;
  }
  const control = withWindowState(full);
  mainWindow?.webContents.send('state-update', control);
  return control;
}

function stopFunnelRetry() {
  if (!funnelRetryTimer) return;
  clearInterval(funnelRetryTimer);
  funnelRetryTimer = null;
}

let funnelSetupRunning = false;

async function setupCrowdAnywhere(port, { openLinks = true } = {}) {
  if (!port || funnelSetupRunning) return funnelState;
  funnelSetupRunning = true;
  funnelState = {
    status: 'starting',
    message: 'Setting up access from anywhere…',
    url: null,
    busy: true,
  };
  emitState();
  try {
    const result = await enableDirectorFunnel(port);
    if (openLinks && result.enableUrl) {
      try {
        await shell.openExternal(result.enableUrl);
      } catch {
        /* ignore */
      }
    }
    if (openLinks && result.installUrl && result.status === 'missing') {
      try {
        await shell.openExternal(result.installUrl);
      } catch {
        /* ignore */
      }
    }
    if (result.url) {
      funnelUrl = String(result.url).replace(/\/$/, '');
      crowdShareBase = funnelUrl;
      funnelState = {
        status: 'ready',
        message: result.message || 'Works from anywhere, on any phone.',
        url: funnelUrl,
        busy: false,
      };
      stopFunnelRetry();
    } else {
      funnelState = {
        status: result.status || 'failed',
        message: result.message || 'Could not turn on anywhere access.',
        url: null,
        busy: false,
        installUrl: result.installUrl,
        enableUrl: result.enableUrl,
        adminUrl: result.adminUrl,
      };
      if (result.status !== 'missing' && !funnelRetryTimer) {
        let attempts = 0;
        funnelRetryTimer = setInterval(() => {
          if (funnelUrl || funnelSetupRunning) return;
          attempts += 1;
          if (attempts > 36) {
            stopFunnelRetry();
            return;
          }
          void setupCrowdAnywhere(port, { openLinks: false });
        }, 8000);
      }
    }
    emitState();
    return funnelState;
  } finally {
    funnelSetupRunning = false;
  }
}

function presoSlideCount() {
  if (decoratedCache) return decoratedCache.presentation?.slides?.length ?? 0;
  if (lastSlideCount > 0) return lastSlideCount;
  return presoSlides().length;
}

function lifeMemberMaxStep() {
  return Math.max(0, lifeMemberBeats(normalizeLifeMembers(store.lifeMembers).length).length - 1);
}

function presoSlides() {
  if (!decoratedCache) decoratedCache = decorateState(store, paths);
  return decoratedCache.presentation.slides ?? [];
}

function activateQueueItem(index, { atEnd = false } = {}) {
  if (!store.presentation || typeof store.presentation !== 'object') store.presentation = {};
  const queue = normalizePresentationQueue(store.presentation.queue);
  store.presentation.queue = queue;
  if (!queue.length) return false;
  const nextIndex = Math.min(Math.max(0, Number(index) || 0), queue.length - 1);
  store.presentation.queueIndex = nextIndex;
  const item = queue[nextIndex];
  stopScoreboardLive();
  if (item.type === 'splash') {
    store.audienceView = 'splash';
    return true;
  }
  if (item.type === 'cue') {
    store.audienceView = 'cue';
    store.cueKey = item.id;
    store.cueStep = atEnd
      ? isGoalkickerCue({ id: item.id })
        ? GOALKICKER_LAST_STEP
        : isAwardCue({ id: item.id })
          ? AWARD_LAST_STEP
          : 0
      : 0;
    return true;
  }
  if (item.type === 'toty') {
    store.audienceView = 'toty';
    store.totyStep = atEnd ? TOTY_BEATS.length - 1 : 0;
    return true;
  }
  if (item.type === 'lifemembers') {
    store.audienceView = 'lifemembers';
    store.lifeMemberStep = atEnd ? lifeMemberMaxStep() : 0;
    return true;
  }
  if (item.type === 'leaderboard') {
    ensureScoreboard();
    store.audienceView = 'leaderboard';
    store.scoreboard.gradeId = item.gradeId;
    store.scoreboard.leaderboardScope = 'grade';
    decoratedCache = null;
    return true;
  }
  store.audienceView = 'presentation';
  store.presentation.starts = item.starts ?? {};
  store.presentation.gradeIds = null;
  store.presentation.gradeId = item.gradeIds[0] ?? null;
  decoratedCache = null;
  const slides = presoSlides();
  store.presentation.slideIndex = atEnd ? Math.max(0, slides.length - 1) : 0;
  return true;
}

function stepRunsheet(amount) {
  const queue = normalizePresentationQueue(store.presentation?.queue);
  store.presentation.queue = queue;
  if (!queue.length) return false;
  const index = Math.min(Math.max(0, store.presentation.queueIndex ?? 0), queue.length - 1);
  if (amount > 0 && index < queue.length - 1) return activateQueueItem(index + 1, { atEnd: false });
  if (amount < 0 && index > 0) return activateQueueItem(index - 1, { atEnd: true });
  return false;
}

function syncQueueToView(view) {
  const queue = normalizePresentationQueue(store.presentation?.queue);
  store.presentation.queue = queue;
  const index = queue.findIndex((item) => {
    if (view === 'splash') return item.type === 'splash';
    if (view === 'cue') return item.type === 'cue' && item.id === store.cueKey;
    if (view === 'toty') return item.type === 'toty';
    if (view === 'lifemembers') return item.type === 'lifemembers';
    return item.type === 'preso';
  });
  if (index >= 0) store.presentation.queueIndex = index;
}

function controlUrl() {
  return isDev ? 'http://localhost:5173/index.html' : pathToFileURL(join(__dirname, '../dist/index.html')).toString();
}

function audienceUrl() {
  const bust = `t=${Date.now()}`;
  if (isDev) return `http://localhost:5173/audience.html?${bust}`;
  return `${pathToFileURL(join(__dirname, '../dist/audience.html')).toString()}?${bust}`;
}

function windowIcon() {
  const files = [
    join(__dirname, '../build/icon.ico'),
    join(__dirname, '../build/icon.png'),
  ];
  return files.find((file) => existsSync(file));
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    backgroundColor: '#0d1117',
    title: 'WFL Medal Count',
    icon: windowIcon(),
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadURL(controlUrl());
  mainWindow.once('ready-to-show', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.show();
  });
  mainWindow.on('close', () => {
    closeAudience();
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function audienceDisplay() {
  const displays = screen.getAllDisplays();
  const current = screen.getDisplayMatching(mainWindow?.getBounds() ?? { x: 0, y: 0, width: 1, height: 1 });
  return displays.find((display) => display.id !== current.id) ?? current;
}

function createAudienceWindow() {
  if (audienceWindow && !audienceWindow.isDestroyed()) {
    audienceWindow.focus();
    return;
  }
  const display = audienceDisplay();
  const { x, y, width, height } = display.bounds;
  const settings = currentSettings();
  audienceWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    fullscreen: audienceWantsFullscreen(),
    backgroundColor: '#07090d',
    title: 'WFL Medal Count — Audience',
    autoHideMenuBar: true,
    icon: windowIcon(),
    alwaysOnTop: Boolean(settings.audienceAlwaysOnTop),
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  audienceWindow.loadURL(audienceUrl());
  audienceWindow.on('closed', () => {
    audienceWindow = null;
    stopScoreboardLive();
    emitState();
  });
  audienceWindow.webContents.on('did-finish-load', () => {
    audienceWindow.webContents.send('audience-update', audienceFromState(currentDecorated()));
  });
  applyAudienceWindowSettings();
}

function closeAudience() {
  stopScoreboardLive();
  if (audienceWindow && !audienceWindow.isDestroyed()) {
    audienceWindow.close();
  }
  audienceWindow = null;
}

function findGame(gameId) {
  for (const grade of store.grades) {
    for (const round of grade.rounds) {
      const game = round.games.find((item) => item.id === gameId);
      if (game) return { grade, round, game };
    }
  }
  return null;
}

app.whenReady().then(() => {
  if (!gotLock) return;
  app.setAppUserModelId('au.com.whyallafootball.medal-count');
  paths = storePaths(app.getPath('userData'));
  ensureStoreDirs(paths);
  installClubLogoOverrides(paths, join(__dirname, 'club-logos'));
  store = loadStore(paths);
  store.grades = (store.grades ?? []).filter((grade) => String(grade.id) !== 'women');
  if (
    migrateRoundSpecialtyPins(
      store,
      (pinFile) => join(paths.specialty, pinFile),
      extractSpecialtyColors
    )
  ) {
    store.settings = mergeSettings(store.settings);
    persist();
  }
  if (applySpecialtyRoundOverrides(store.grades, mergeSettings(store.settings))) {
    persist();
  }
  try {
    applyClubLogoFiles(store.clubs, paths);
  } catch {
    /* keep launching even if a logo file is missing */
  }

  protocol.handle('medal', async (request) => {
    const url = new URL(request.url);
    let filePath = null;
    if (url.hostname === 'crowd') {
      const rest = decodeURIComponent(url.pathname.replace(/^\//, ''));
      if (rest === 'art' || rest.startsWith('art')) {
        filePath = artFilePath(currentSettings());
      } else {
        const slash = rest.indexOf('/');
        const which = slash >= 0 ? rest.slice(0, slash) : rest;
        const file = slash >= 0 ? rest.slice(slash + 1) : '';
        filePath = photoPath(which, file);
      }
    } else {
      const fileName = decodeURIComponent(url.pathname.replace(/^\//, ''));
      filePath = dataPath(url.hostname, fileName);
    }
    if (!filePath || !existsSync(filePath)) {
      return new Response('Not found', { status: 404 });
    }
    const response = await net.fetch(pathToFileURL(filePath).toString());
    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
    headers.set('Cache-Control', 'no-store');
    return new Response(response.body, { status: response.status, headers });
  });

  if (!currentSettings().crowdPhotoCode) {
    store.settings = mergeSettings({
      ...currentSettings(),
      crowdPhotoCode: makePhotoCode(),
    });
    persist();
  }

  ipcMain.handle('get-state', () => withWindowState(currentDecorated()));
  ipcMain.handle('get-audience-state', () => audienceFromState(currentDecorated()));

  ipcMain.handle('sync-season', async () => {
    if (store.sync.running) return decorateState(store, paths);
    store.sync = { running: true, message: 'Starting…', current: 0, total: 0 };
    emitState();
    try {
      await syncSeason(store, paths, (message, current = 0, total = 0) => {
        store.sync = { running: true, message, current, total };
        emitState();
      });
      store.sync = { running: false, message: 'Up to date', current: 0, total: 0 };
      persist();
    } catch (error) {
      store.sync = {
        running: false,
        message: `Sync failed: ${error.message ?? error}`,
        current: 0,
        total: 0,
      };
    }
    return emitState();
  });

  ipcMain.handle('set-active-grade', (_event, gradeId) => {
    store.activeGradeId = String(gradeId);
    const grade = store.grades.find((item) => item.id === store.activeGradeId);
    const found = findGame(store.selectedGameId);
    if (!found || found.grade.id !== store.activeGradeId) {
      store.selectedGameId = grade?.rounds?.[0]?.games?.[0]?.id ?? null;
    }
    ensureScoreboard();
    store.scoreboard.gradeId = store.activeGradeId;
    store.scoreboard.roundId = null;
    persist();
    return emitState();
  });

  ipcMain.handle('select-game', (_event, gameId) => {
    store.selectedGameId = gameId;
    persist();
    return emitState();
  });

  ipcMain.handle('add-specialty-asset', (_event, specialtyName, roundName) => {
    const label = formatSpecialtyName(specialtyName);
    const key = specialtyAssetKey(label);
    if (!key) return decorateState(store, paths);
    const assets = mergeSpecialtyAssets(store.settings?.specialtyAssets);
    const nextRound = String(roundName ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);
    const prev = assets[key] || {
      label,
      pinFile: null,
      colors: null,
      photoColors: null,
      roundName: null,
      websiteRoundName: null,
    };
    const website = String(prev.websiteRoundName || '').trim();
    const useWebsite =
      Boolean(website) && (!nextRound || nextRound.toLowerCase() === website.toLowerCase());
    assets[key] = {
      ...prev,
      label,
      roundName: useWebsite ? null : nextRound || prev.roundName || null,
    };
    store.settings = mergeSettings({
      ...store.settings,
      specialtyAssets: assets,
    });
    applySpecialtyRoundOverrides(store.grades, store.settings);
    persist();
    return emitState();
  });

  ipcMain.handle('remove-specialty-asset', (_event, specialtyName) => {
    const label = formatSpecialtyName(specialtyName);
    const key = specialtyAssetKey(label);
    if (!key) return decorateState(store, paths);
    const assets = mergeSpecialtyAssets(store.settings?.specialtyAssets);
    const prev = assets[key];
    if (!prev) return decorateState(store, paths);
    if (prev.pinFile) {
      const file = join(paths.specialty, prev.pinFile);
      if (existsSync(file)) {
        try {
          unlinkSync(file);
        } catch {
          /* keep going */
        }
      }
    }
    delete assets[key];
    store.settings = mergeSettings({
      ...store.settings,
      specialtyAssets: assets,
    });
    for (const grade of store.grades ?? []) {
      for (const round of grade.rounds ?? []) {
        if (specialtyAssetKey(round.specialtyName) !== key) continue;
        if (round.specialtySource !== 'manual' && prev.websiteRoundName) continue;
        round.specialtyName = '';
        round.specialtySource = '';
        for (const game of round.games ?? []) {
          if (specialtyAssetKey(game.alias) === key) game.alias = '';
        }
      }
    }
    applySpecialtyRoundOverrides(store.grades, store.settings);
    persist();
    return emitState();
  });

  ipcMain.handle('set-specialty-asset-pin', async (_event, specialtyName) => {
    const label = formatSpecialtyName(specialtyName);
    const key = specialtyAssetKey(label);
    if (!key) return decorateState(store, paths);
    const picked = await dialog.showOpenDialog(mainWindow, {
      title: `Specialty pin · ${label}`,
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
    });
    if (picked.canceled || !picked.filePaths?.[0]) return decorateState(store, paths);
    const file = picked.filePaths[0];
    const imageFile = `${key.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'specialty'}-${randomUUID()}${extname(file) || '.png'}`;
    ensureStoreDirs(paths);
    const assets = mergeSpecialtyAssets(store.settings?.specialtyAssets);
    const prevFile = assets[key]?.pinFile;
    if (prevFile) {
      const prev = join(paths.specialty, prevFile);
      if (existsSync(prev)) {
        try {
          unlinkSync(prev);
        } catch {
          /* keep going */
        }
      }
    }
    const dest = join(paths.specialty, imageFile);
    copyFileSync(file, dest);
    const colors = extractSpecialtyColors(dest);
    const prev = assets[key] || {};
    assets[key] = {
      label,
      pinFile: imageFile,
      colors,
      photoColors: colors,
      roundName: prev.roundName || null,
      websiteRoundName: prev.websiteRoundName || null,
    };
    store.settings = mergeSettings({
      ...store.settings,
      specialtyAssets: assets,
    });
    persist();
    return emitState();
  });

  ipcMain.handle('clear-specialty-asset-pin', (_event, specialtyName) => {
    const label = formatSpecialtyName(specialtyName);
    const key = specialtyAssetKey(label);
    if (!key) return decorateState(store, paths);
    const assets = mergeSpecialtyAssets(store.settings?.specialtyAssets);
    const prevFile = assets[key]?.pinFile;
    if (prevFile) {
      const prev = join(paths.specialty, prevFile);
      if (existsSync(prev)) {
        try {
          unlinkSync(prev);
        } catch {
          /* keep going */
        }
      }
    }
    if (assets[key]) {
      assets[key] = {
        ...assets[key],
        label: assets[key].label || label,
        pinFile: null,
      };
    }
    store.settings = mergeSettings({
      ...store.settings,
      specialtyAssets: assets,
    });
    persist();
    return emitState();
  });

  ipcMain.handle('set-specialty-asset-colors', (_event, specialtyName, colors) => {
    const label = formatSpecialtyName(specialtyName);
    const key = specialtyAssetKey(label);
    if (!key) return decorateState(store, paths);
    const nextColors = normalizeSpecialtyColors(colors);
    if (!nextColors) return decorateState(store, paths);
    const assets = mergeSpecialtyAssets(store.settings?.specialtyAssets);
    const prev = assets[key] || {
      label,
      pinFile: null,
      colors: null,
      photoColors: null,
      roundName: null,
      websiteRoundName: null,
    };
    assets[key] = {
      ...prev,
      label: prev.label || label,
      colors: nextColors,
    };
    store.settings = mergeSettings({
      ...store.settings,
      specialtyAssets: assets,
    });
    persist();
    return emitState();
  });

  ipcMain.handle('reset-specialty-asset-colors', (_event, specialtyName) => {
    const label = formatSpecialtyName(specialtyName);
    const key = specialtyAssetKey(label);
    if (!key) return decorateState(store, paths);
    const assets = mergeSpecialtyAssets(store.settings?.specialtyAssets);
    const prev = assets[key];
    if (!prev) return decorateState(store, paths);
    const fromPhoto = normalizeSpecialtyColors(prev.photoColors);
    if (!fromPhoto) return decorateState(store, paths);
    assets[key] = {
      ...prev,
      colors: fromPhoto,
    };
    store.settings = mergeSettings({
      ...store.settings,
      specialtyAssets: assets,
    });
    persist();
    return emitState();
  });

  ipcMain.handle('set-specialty-asset-round', (_event, specialtyName, roundName) => {
    const label = formatSpecialtyName(specialtyName);
    const key = specialtyAssetKey(label);
    if (!key) return decorateState(store, paths);
    const assets = mergeSpecialtyAssets(store.settings?.specialtyAssets);
    const prev = assets[key] || {
      label,
      pinFile: null,
      colors: null,
      photoColors: null,
      roundName: null,
      websiteRoundName: null,
    };
    const nextRound = String(roundName ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);
    const website = String(prev.websiteRoundName || '').trim();
    const useDefault = !nextRound || (website && nextRound.toLowerCase() === website.toLowerCase());
    assets[key] = {
      ...prev,
      label: prev.label || label,
      roundName: useDefault ? null : nextRound,
    };
    store.settings = mergeSettings({
      ...store.settings,
      specialtyAssets: assets,
    });
    applySpecialtyRoundOverrides(store.grades, store.settings);
    persist();
    return emitState();
  });

  ipcMain.handle('set-votes', (_event, gameId, votes) => {
    const found = findGame(gameId);
    if (!found || isForfeitGame(found.game)) return decorateState(store, paths);
    found.game.votes = uniqueVotes({
      ...emptyVotes(),
      ...found.game.votes,
      ...votes,
    }, voteScaleForGrade(found.grade));
    persist();
    return emitState();
  });

  ipcMain.handle('assign-vote', (_event, gameId, playerId) => {
    const found = findGame(gameId);
    if (!found || isForfeitGame(found.game)) return decorateState(store, paths);
    found.game.votes = applyPlayerVote(found.game.votes, playerId, voteScaleForGrade(found.grade));
    persist();
    return emitState();
  });

  ipcMain.handle('add-game-player', (_event, gameId, payload) => {
    const found = findGame(gameId);
    if (!found || isForfeitGame(found.game)) return emitState();
    const name = String(payload?.name || '').replace(/\s+/g, ' ').trim();
    if (!name) return emitState();
    const number = String(payload?.number || '').trim();
    const away = String(payload?.clubId || '') === String(found.game.awayId);
    const clubId = away ? found.game.awayId : found.game.homeId;
    const clubName = away ? found.game.awayName : found.game.homeName;
    const parts = name.split(' ');
    const player = {
      id: `manual-${randomUUID()}`,
      firstName: parts.length > 1 ? parts.slice(0, -1).join(' ') : name,
      lastName: parts.length > 1 ? parts[parts.length - 1] : '',
      number,
      clubId,
      clubName,
      manual: true,
      captainRole: null,
      position: null,
      goals: 0,
      behinds: 0,
      photoFile: null,
    };
    const players = Array.isArray(found.game.players) ? found.game.players : [];
    const already = players.some((item) => {
      const existing = `${item.firstName || ''} ${item.lastName || ''}`.replace(/\s+/g, ' ').trim().toLowerCase();
      return existing === name.toLowerCase() && String(item.clubId || '') === String(clubId || '');
    });
    if (!already) {
      players.push(player);
      players.sort((a, b) => Number(a.number || 999) - Number(b.number || 999));
      found.game.players = players;
      persist();
    }
    return emitState();
  });

  ipcMain.handle('clear-votes', (_event, gameId) => {
    const found = findGame(gameId);
    if (found) found.game.votes = emptyVotes();
    persist();
    return emitState();
  });

  ipcMain.handle('fill-random-votes', () => {
    const shuffle = (ids) => {
      const next = [...ids];
      for (let i = next.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
      }
      return next;
    };

    for (const grade of store.grades ?? []) {
      for (const round of grade.rounds ?? []) {
        for (const game of round.games ?? []) {
          if (isForfeitGame(game)) continue;
          const ids = shuffle([...new Set((game.players ?? []).map((player) => player?.id).filter(Boolean))]);
          const scale = voteScaleForGrade(grade);
          const filled = emptyVotes();
          scale.forEach((points, index) => {
            filled[voteKeyForPoints(points)] = ids[index] ?? null;
          });
          game.votes = uniqueVotes(filled, scale);
        }
      }
    }

    const league = leagueGradeFrom(store.grades);
    const roster = [];
    const seen = new Set();
    for (const grade of league ? [league] : store.grades ?? []) {
      for (const round of grade.rounds ?? []) {
        for (const game of round.games ?? []) {
          for (const player of game.players ?? []) {
            if (!player?.id || seen.has(player.id)) continue;
            seen.add(player.id);
            roster.push(player.id);
          }
        }
      }
    }
    const picks = emptyTotyPicks();
    const chosen = shuffle(roster);
    TOTY_POSITIONS.forEach((pos, index) => {
      picks[pos.id] = chosen[index] ?? null;
    });
    if (!store.teamOfTheYear || typeof store.teamOfTheYear !== 'object') store.teamOfTheYear = {};
    if (league?.id) store.teamOfTheYear[String(league.id)] = picks;
    store.totyStep = 0;

    persist();
    return emitState();
  });

  ipcMain.handle('add-sponsor', async () => {
    const picked = await dialog.showOpenDialog(mainWindow, {
      title: 'Add sponsor image',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'] }],
    });
    if (picked.canceled) return decorateState(store, paths);
    for (const file of picked.filePaths) {
      const id = randomUUID();
      const imageFile = `${id}${extname(file) || '.png'}`;
      copyFileSync(file, join(paths.sponsors, imageFile));
      store.sponsors.push({
        id,
        name: basename(file, extname(file)),
        imageFile,
      });
    }
    persist();
    return emitState();
  });

  ipcMain.handle('rename-sponsor', (_event, sponsorId, name) => {
    const sponsor = store.sponsors.find((item) => item.id === sponsorId);
    if (sponsor) sponsor.name = String(name ?? '').trim();
    persist();
    return emitState();
  });

  ipcMain.handle('remove-sponsor', (_event, sponsorId) => {
    store.sponsors = store.sponsors.filter((item) => item.id !== sponsorId);
    if (store.totySponsorId === String(sponsorId)) store.totySponsorId = null;
    persist();
    return emitState();
  });

  ipcMain.handle('move-sponsor', (_event, sponsorId, direction) => {
    const index = store.sponsors.findIndex((item) => item.id === sponsorId);
    if (index < 0) return decorateState(store, paths);
    const next = index + (direction < 0 ? -1 : 1);
    if (next < 0 || next >= store.sponsors.length) return decorateState(store, paths);
    const [item] = store.sponsors.splice(index, 1);
    store.sponsors.splice(next, 0, item);
    persist();
    return emitState();
  });

  ipcMain.handle('toggle-audience', () => {
    if (audienceWindow && !audienceWindow.isDestroyed()) closeAudience();
    else {
      createAudienceWindow();
    }
    return emitState();
  });

  ipcMain.handle('set-present-target', (_event, target) => {
    store.settings = mergeSettings({
      ...store.settings,
      presentTarget: target === 'obs' ? 'obs' : 'display',
    });
    if (store.settings.presentTarget === 'obs') closeAudience();
    else if (!audienceWindow || audienceWindow.isDestroyed()) createAudienceWindow();
    persist();
    return emitState();
  });

  ipcMain.handle('copy-text', (_event, text) => {
    clipboard.writeText(String(text || ''));
    return true;
  });

  ipcMain.handle('scoreboard-set-round', (_event, roundId) => {
    ensureScoreboard();
    store.scoreboard.gradeId = store.activeGradeId;
    store.scoreboard.roundId = roundId ?? null;
    persist();
    return emitState();
  });

  ipcMain.handle('scoreboard-toggle-sponsor', (_event, sponsorId) => {
    ensureScoreboard();
    const id = String(sponsorId);
    const current = store.scoreboard.sponsorIds.filter(Boolean);
    if (current.includes(id)) {
      store.scoreboard.sponsorIds = current.filter((item) => item !== id);
    } else {
      store.scoreboard.sponsorIds = [...current, id].slice(-2);
    }
    persist();
    return emitState();
  });

  ipcMain.handle('show-scoreboard', () => {
    ensureScoreboard();
    store.audienceView = 'scoreboard';
    store.scoreboard.gradeId = store.scoreboard.gradeId || store.activeGradeId;
    persist();
    if (!audienceWindow || audienceWindow.isDestroyed()) ensurePresentOutput();
    return emitState();
  });

  ipcMain.handle('show-leaderboard', (_event, scope) => {
    ensureScoreboard();
    store.audienceView = 'leaderboard';
    const currentGrade = currentPresentationGradeId();
    if (currentGrade) store.scoreboard.gradeId = currentGrade;
    else store.scoreboard.gradeId = store.scoreboard.gradeId || store.activeGradeId;
    store.scoreboard.leaderboardScope = scope === 'current' ? 'current' : 'all';
    persist();
    if (!audienceWindow || audienceWindow.isDestroyed()) ensurePresentOutput();
    return emitState();
  });

  ipcMain.handle('show-splash', () => {
    store.audienceView = 'splash';
    syncQueueToView('splash');
    stopScoreboardLive();
    persist();
    if (!audienceWindow || audienceWindow.isDestroyed()) ensurePresentOutput();
    return emitState();
  });

  ipcMain.handle('show-crowd', () => {
    store.audienceView = 'crowd';
    stopScoreboardLive();
    persist();
    if (!audienceWindow || audienceWindow.isDestroyed()) ensurePresentOutput();
    return emitState();
  });

  ipcMain.handle('set-crowd-share-base', (_event, base) => {
    crowdShareBase = String(base || '');
    return emitState();
  });

  ipcMain.handle('approve-crowd-photo', (_event, file) => {
    approvePhoto(file);
    return emitState();
  });

  ipcMain.handle('deny-crowd-photo', (_event, file) => {
    denyPhoto(file);
    return emitState();
  });

  ipcMain.handle('approve-all-crowd-photos', () => {
    approveAllPhotos();
    return emitState();
  });

  ipcMain.handle('import-crowd-photos', async () => {
    const picked = await dialog.showOpenDialog(mainWindow, {
      title: 'Add crowd photos',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Photos', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
    });
    if (!picked.canceled && picked.filePaths?.length) {
      importCrowdFiles(picked.filePaths, { from: 'Desk', venue: '' });
    }
    return emitState();
  });

  ipcMain.handle('pick-crowd-art', async () => {
    const picked = await dialog.showOpenDialog(mainWindow, {
      title: 'Lower third image',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    });
    if (!picked.canceled && picked.filePaths?.[0]) {
      const next = setCustomArtFromPath(picked.filePaths[0]);
      store.settings = mergeSettings({
        ...currentSettings(),
        crowdArtFile: next.artFile,
        crowdArtVersion: next.artVersion,
      });
      persist();
    }
    return emitState();
  });

  ipcMain.handle('clear-crowd-art', () => {
    const next = clearCustomArt(currentSettings());
    store.settings = mergeSettings({
      ...currentSettings(),
      crowdArtFile: next.artFile,
      crowdArtVersion: next.artVersion,
    });
    persist();
    return emitState();
  });

  ipcMain.handle('open-crowd-folder', () => {
    shell.openPath(photosRoot());
    return true;
  });

  ipcMain.handle('reset-crowd-photo-code', () => {
    store.settings = mergeSettings({
      ...currentSettings(),
      crowdPhotoCode: makePhotoCode(),
    });
    persist();
    return emitState();
  });

  ipcMain.handle('enable-crowd-anywhere', async () => {
    await setupCrowdAnywhere(crowdPage?.port);
    return emitState();
  });

  ipcMain.handle('show-toty', (_event, restart) => {
    store.audienceView = 'toty';
    if (restart) store.totyStep = 0;
    syncQueueToView('toty');
    stopScoreboardLive();
    persist();
    if (!audienceWindow || audienceWindow.isDestroyed()) ensurePresentOutput();
    return emitState();
  });

  ipcMain.handle('show-life-members', (_event, restart) => {
    store.audienceView = 'lifemembers';
    if (restart) store.lifeMemberStep = 0;
    syncQueueToView('lifemembers');
    stopScoreboardLive();
    persist();
    if (!audienceWindow || audienceWindow.isDestroyed()) ensurePresentOutput();
    return emitState();
  });

  ipcMain.handle('set-toty-sponsor', (_event, sponsorId) => {
    const id = sponsorId ? String(sponsorId) : '';
    const exists = (store.sponsors ?? []).some((item) => String(item.id) === id);
    store.totySponsorId = exists ? id : null;
    persist();
    return emitState();
  });

  ipcMain.handle('add-night-extra', (_event, payload) => {
    const extras = normalizeNightExtras(store.nightExtras);
    const kind = payload?.kind === 'award' || String(payload?.id || '').startsWith('award-') ? 'award' : 'cue';
    const prefix = kind === 'award' ? 'award-' : 'cue-';
    const requested = String(payload?.id || '').trim();
    const extra = normalizeNightExtra({
      id: requested.startsWith(prefix) ? requested : `${prefix}${randomUUID().slice(0, 8)}`,
      title: payload?.title || (kind === 'award' ? 'Award' : 'Guest Speaker'),
      detail: payload?.detail || '',
      cue: payload?.cue || payload?.detail || '',
      kind,
      playerId: payload?.playerId || null,
    }, extras.length);
    if (extra) extras.push(extra);
    store.nightExtras = extras;
    persist();
    return emitState();
  });

  ipcMain.handle('update-night-extra', (_event, extraId, patch) => {
    const id = String(extraId || '');
    const extras = normalizeNightExtras(store.nightExtras);
    store.nightExtras = extras.map((item) => {
      if (item.id !== id) return item;
      return normalizeNightExtra({ ...item, ...(patch && typeof patch === 'object' ? patch : {}), id }, 0) || item;
    });
    persistSoon();
    return emitState();
  });

  ipcMain.handle('remove-night-extra', (_event, extraId) => {
    const id = String(extraId || '');
    store.nightExtras = normalizeNightExtras(store.nightExtras).filter((item) => item.id !== id);
    if (store.cueKey === id) store.cueKey = store.nightExtras[0]?.id ?? null;
    persist();
    return emitState();
  });

  ipcMain.handle('show-presentation', () => {
    store.audienceView = 'presentation';
    syncQueueToView('presentation');
    stopScoreboardLive();
    persist();
    if (!audienceWindow || audienceWindow.isDestroyed()) ensurePresentOutput();
    return emitState();
  });

  ipcMain.handle('presentation-set-grade', (_event, gradeId) => {
    store.presentation.gradeId = String(gradeId);
    store.presentation.gradeIds = null;
    store.presentation.starts = {};
    store.presentation.slideIndex = 0;
    persist();
    return emitState();
  });

  ipcMain.handle('presentation-start', (_event, payload) => {
    const rawStarts = payload?.starts && typeof payload.starts === 'object' ? payload.starts : {};
    const items = Array.isArray(payload?.items)
      ? payload.items
      : (Array.isArray(payload?.gradeIds) ? payload.gradeIds : payload?.gradeId ? [payload.gradeId] : []).map((id) => ({
          type: 'grade',
          id,
          start: rawStarts[id],
        }));
    const queue = buildPresentationQueue(items, store.grades);
    if (!store.presentation || typeof store.presentation !== 'object') store.presentation = {};
    store.presentation.queue = queue;
    store.presentation.queueIndex = 0;
    if (queue.length) activateQueueItem(0);
    else {
      store.audienceView = 'presentation';
      stopScoreboardLive();
    }
    persist();
    if (!audienceWindow || audienceWindow.isDestroyed()) ensurePresentOutput();
    return emitState();
  });

  ipcMain.handle('presentation-goto', (_event, slideIndex) => {
    store.presentation.slideIndex = Math.max(0, Number(slideIndex) || 0);
    persistSoon();
    return emitState({ cheap: Boolean(decoratedCache) });
  });

  ipcMain.handle('presentation-step', (_event, delta) => {
    const amount = Number(delta || 0);
    if (!amount) return emitState({ cheap: Boolean(decoratedCache) });

    if (store.audienceView === 'splash') {
      if (!stepRunsheet(amount)) store.audienceView = 'splash';
      persistSoon();
      return emitState({ cheap: Boolean(decoratedCache) });
    }

    if (store.audienceView === 'cue') {
      const queue = normalizePresentationQueue(store.presentation?.queue);
      const index = Math.min(Math.max(0, store.presentation.queueIndex ?? 0), Math.max(0, queue.length - 1));
      const cueId = store.cueKey || queue[index]?.id;
      if (isGoalkickerCue({ id: cueId }) || isAwardCue({ id: cueId })) {
        const last = isGoalkickerCue({ id: cueId }) ? GOALKICKER_LAST_STEP : AWARD_LAST_STEP;
        const step = clampCueStep(store.cueStep);
        if (amount > 0 && step < last) {
          store.cueStep = step + 1;
          persistSoon();
          return emitState({ cheap: Boolean(decoratedCache) });
        }
        if (amount < 0 && step > 0) {
          store.cueStep = step - 1;
          persistSoon();
          return emitState({ cheap: Boolean(decoratedCache) });
        }
      }
      if (!stepRunsheet(amount)) store.audienceView = 'cue';
      persistSoon();
      return emitState({ cheap: Boolean(decoratedCache) });
    }

    if (store.audienceView === 'leaderboard') {
      stepRunsheet(amount);
      persistSoon();
      return emitState({ cheap: Boolean(decoratedCache) });
    }

    if (store.audienceView === 'toty') {
      const next = (store.totyStep ?? 0) + amount;
      if (next > TOTY_BEATS.length - 1) {
        if (!stepRunsheet(1)) store.totyStep = TOTY_BEATS.length - 1;
      } else if (next < 0) {
        if (!stepRunsheet(-1)) store.totyStep = 0;
      } else {
        store.totyStep = clampTotyStep(next);
      }
      persistSoon();
      return emitState({ cheap: Boolean(decoratedCache) });
    }

    if (store.audienceView === 'lifemembers') {
      const count = normalizeLifeMembers(store.lifeMembers).length;
      const max = clampLifeMemberStep(999, count);
      const next = (store.lifeMemberStep ?? 0) + amount;
      if (next > max) {
        if (!stepRunsheet(1)) store.lifeMemberStep = max;
      } else if (next < 0) {
        if (!stepRunsheet(-1)) store.lifeMemberStep = 0;
      } else {
        store.lifeMemberStep = clampLifeMemberStep(next, count);
      }
      persistSoon();
      return emitState({ cheap: Boolean(decoratedCache) });
    }

    const slidesLen = presoSlideCount();
    const next = (store.presentation.slideIndex ?? 0) + amount;
    if (next >= slidesLen) {
      if (!stepRunsheet(1)) store.presentation.slideIndex = Math.max(0, slidesLen - 1);
    } else if (next < 0) {
      if (!stepRunsheet(-1)) store.presentation.slideIndex = 0;
    } else {
      store.presentation.slideIndex = next;
    }
    persistSoon();
    return emitState({ cheap: Boolean(decoratedCache) });
  });

  ipcMain.handle('open-data-folder', () => {
    shell.openPath(paths.root);
  });

  ipcMain.handle('save-print-pdf', async (_event, payload) => {
    if (!mainWindow || mainWindow.isDestroyed()) return { saved: false };
    const fileName = typeof payload === 'string' ? payload : payload?.fileName;
    const html = typeof payload === 'object' && payload ? payload.html : '';
    if (!html) return { saved: false, error: 'Nothing to save.' };
    const safeName = String(fileName || 'WFL-Announcer.pdf').replace(/[<>:"/\\|?*]+/g, '-');
    const desktopName = safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`;
    const filePath = join(app.getPath('desktop'), desktopName);

    const tempPath = join(app.getPath('temp'), 'wfl-announcer-print.html');
    writeFileSync(tempPath, printDocument(html), 'utf8');
    const printWindow = new BrowserWindow({
      show: false,
      width: 794,
      height: 1123,
      x: -2400,
      y: -2400,
      backgroundColor: '#ffffff',
      frame: false,
      skipTaskbar: true,
      paintWhenInitiallyHidden: true,
      autoHideMenuBar: true,
      webPreferences: {
        preload: join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    try {
      await printWindow.loadFile(tempPath);
      await printWindow.webContents.executeJavaScript(`
        Promise.all([...document.images].map((image) => {
          if (image.complete) return true;
          return new Promise((resolve) => {
            image.addEventListener('load', () => resolve(true), { once: true });
            image.addEventListener('error', () => resolve(true), { once: true });
          });
        }))
      `);
      printWindow.showInactive();
      await new Promise((resolve) => setTimeout(resolve, 200));
      const pdf = await printWindow.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        landscape: false,
        margins: {
          marginType: 'custom',
          top: 0.2,
          bottom: 0.2,
          left: 0.2,
          right: 0.2,
        },
      });
      const header = Buffer.isBuffer(pdf) ? pdf.subarray(0, 5).toString('ascii') : '';
      if (!pdf?.length || !header.startsWith('%PDF')) {
        return { saved: false, error: 'The PDF could not be created.' };
      }
      writeFileSync(filePath, pdf);
      const opened = await shell.openPath(filePath);
      if (opened) shell.showItemInFolder(filePath);
      return { saved: true, path: filePath };
    } catch (error) {
      return { saved: false, error: error.message ?? String(error) };
    } finally {
      if (!printWindow.isDestroyed()) printWindow.destroy();
      try {
        unlinkSync(tempPath);
      } catch {
        /* temp file can stay */
      }
    }
  });

  ipcMain.handle('set-toty-player', (_event, gradeId, positionId, playerId) => {
    const id = totyStorageGradeId(gradeId);
    const pos = String(positionId || '');
    if (!id || !TOTY_POSITION_IDS.has(pos)) return emitState();
    if (!store.teamOfTheYear || typeof store.teamOfTheYear !== 'object') store.teamOfTheYear = {};
    if (!store.teamOfTheYear[id] || typeof store.teamOfTheYear[id] !== 'object') store.teamOfTheYear[id] = {};
    const picks = store.teamOfTheYear[id];
    const pid = playerId ? String(playerId) : null;
    if (pid) {
      for (const [key, value] of Object.entries(picks)) {
        if (value === pid) picks[key] = null;
      }
    }
    picks[pos] = pid;
    persist();
    return emitState();
  });

  function findStoredPlayer(playerId) {
    const id = String(playerId || '');
    if (!id) return null;
    for (const grade of store.grades ?? []) {
      for (const round of grade.rounds ?? []) {
        for (const game of round.games ?? []) {
          const player = (game.players ?? []).find((item) => String(item.id) === id);
          if (player) {
            const club = (store.clubs ?? []).find((item) => String(item.id) === String(player.clubId));
            return { player, club };
          }
        }
      }
    }
    return null;
  }

  ipcMain.handle('add-life-member', (_event, playerId) => {
    const found = findStoredPlayer(playerId);
    if (!found) return emitState();
    store.lifeMembers = normalizeLifeMembers(store.lifeMembers);
    if (store.lifeMembers.some((item) => item.playerId === String(playerId))) return emitState();
    const { player, club } = found;
    store.lifeMembers.push({
      id: randomUUID(),
      playerId: String(player.id),
      name: playerName(player),
      firstName: player.firstName || '',
      lastName: player.lastName || '',
      clubId: player.clubId || club?.id || null,
      clubName: player.clubName || club?.name || '',
      photoFile: player.photoFile ?? null,
      logoFile: club?.logoFile ?? null,
      year: store.season,
      note: '',
    });
    persist();
    return emitState();
  });

  ipcMain.handle('add-life-member-custom', (_event, payload) => {
    const name = String(payload?.name || '').trim();
    if (!name) return emitState();
    const wflMember = isWflMemberClub(payload?.clubId) || isWflMemberClub(payload?.clubName);
    const club = wflMember
      ? null
      : (store.clubs ?? []).find((item) => String(item.id) === String(payload?.clubId || ''));
    store.lifeMembers = normalizeLifeMembers(store.lifeMembers);
    store.lifeMembers.push({
      id: randomUUID(),
      playerId: null,
      name,
      firstName: String(payload?.firstName || '').trim(),
      lastName: String(payload?.lastName || '').trim(),
      clubId: wflMember ? WFL_MEMBER_CLUB_ID : club?.id ?? null,
      clubName: wflMember ? WFL_MEMBER_CLUB_NAME : club?.name || String(payload?.clubName || '').trim(),
      photoFile: null,
      logoFile: wflMember ? WFL_LOGO_FILE : logoFileForClub(club, store.clubs) ?? club?.logoFile ?? null,
      year: String(payload?.year || store.season || '').trim(),
      note: String(payload?.note || '').trim(),
    });
    persist();
    return emitState();
  });

  function removeCustomLifeMemberPhoto(memberId) {
    const prefix = `lm-${memberId}.`;
    for (const name of readdirSync(paths.photos)) {
      if (!String(name).startsWith(prefix)) continue;
      try {
        unlinkSync(join(paths.photos, name));
      } catch {
        /* ignore missing photo */
      }
    }
  }

  ipcMain.handle('set-life-member-photo', async (_event, memberId) => {
    store.lifeMembers = normalizeLifeMembers(store.lifeMembers);
    const member = store.lifeMembers.find((item) => item.id === String(memberId));
    if (!member) return emitState();
    const picked = await dialog.showOpenDialog(mainWindow, {
      title: 'Add life member photo',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
    });
    if (picked.canceled || !picked.filePaths[0]) return emitState();
    const file = picked.filePaths[0];
    const ext = (extname(file) || '.jpg').toLowerCase();
    const photoFile = `lm-${member.id}${ext}`;
    removeCustomLifeMemberPhoto(member.id);
    copyFileSync(file, join(paths.photos, photoFile));
    member.photoFile = photoFile;
    persist();
    return emitState();
  });

  ipcMain.handle('clear-life-member-photo', (_event, memberId) => {
    store.lifeMembers = normalizeLifeMembers(store.lifeMembers);
    const member = store.lifeMembers.find((item) => item.id === String(memberId));
    if (!member) return emitState();
    removeCustomLifeMemberPhoto(member.id);
    member.photoFile = null;
    persist();
    return emitState();
  });

  ipcMain.handle('update-life-member', (_event, memberId, patch) => {
    store.lifeMembers = normalizeLifeMembers(store.lifeMembers);
    const member = store.lifeMembers.find((item) => item.id === String(memberId));
    if (!member || !patch || typeof patch !== 'object') return emitState();
    if ('note' in patch) member.note = String(patch.note || '').trim();
    if ('year' in patch) member.year = String(patch.year || '').trim();
    if ('name' in patch) {
      const name = String(patch.name || '').trim();
      if (name) member.name = name;
    }
    persist();
    return emitState();
  });

  ipcMain.handle('remove-life-member', (_event, memberId) => {
    removeCustomLifeMemberPhoto(memberId);
    store.lifeMembers = normalizeLifeMembers(store.lifeMembers).filter((item) => item.id !== String(memberId));
    store.lifeMemberStep = clampLifeMemberStep(store.lifeMemberStep, store.lifeMembers.length);
    persist();
    return emitState();
  });

  ipcMain.handle('move-life-member', (_event, memberId, direction) => {
    store.lifeMembers = normalizeLifeMembers(store.lifeMembers);
    const index = store.lifeMembers.findIndex((item) => item.id === String(memberId));
    if (index < 0) return emitState();
    const next = index + (direction < 0 ? -1 : 1);
    if (next < 0 || next >= store.lifeMembers.length) return emitState();
    const [item] = store.lifeMembers.splice(index, 1);
    store.lifeMembers.splice(next, 0, item);
    persist();
    return emitState();
  });

  ipcMain.handle('clear-life-members', () => {
    for (const member of normalizeLifeMembers(store.lifeMembers)) {
      removeCustomLifeMemberPhoto(member.id);
    }
    store.lifeMembers = [];
    store.lifeMemberStep = 0;
    persist();
    return emitState();
  });

  ipcMain.handle('save-night', async () => {
    try {
      const parent = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
      const options = {
        title: 'Save medal count',
        defaultPath: join(app.getPath('documents'), 'WFL-medal-count.json'),
        filters: [{ name: 'Medal count', extensions: ['json'] }],
      };
      const picked = parent ? await dialog.showSaveDialog(parent, options) : await dialog.showSaveDialog(options);
      if (picked.canceled || !picked.filePath) return { canceled: true };
      persist();
      const savedAt = new Date().toISOString();
      const votes = [];
      for (const grade of store.grades ?? []) {
        for (const round of grade.rounds ?? []) {
          for (const game of round.games ?? []) {
            votes.push({
              gradeId: grade.id,
              roundId: round.id,
              gameId: game.id,
              home: game.homeName ?? null,
              away: game.awayName ?? null,
              votes: game.votes ?? emptyVotes(),
            });
          }
        }
      }
      const snapshot = {
        savedAt,
        votes,
        teamOfTheYear: store.teamOfTheYear ?? {},
        nightExtras: normalizeNightExtras(store.nightExtras),
        lifeMembers: normalizeLifeMembers(store.lifeMembers),
      };
      writeFileSync(picked.filePath, JSON.stringify(snapshot, null, 2), 'utf8');
      return { ok: true, savedAt, file: picked.filePath };
    } catch (error) {
      return { error: error?.message || 'Save failed' };
    }
  });

  ipcMain.handle('clear-entered-data', () => {
    for (const grade of store.grades ?? []) {
      for (const round of grade.rounds ?? []) {
        for (const game of round.games ?? []) {
          game.votes = emptyVotes();
        }
      }
    }
    store.teamOfTheYear = {};
    store.totyStep = 0;
    for (const member of normalizeLifeMembers(store.lifeMembers)) {
      removeCustomLifeMemberPhoto(member.id);
    }
    store.lifeMembers = [];
    store.lifeMemberStep = 0;
    persist();
    return emitState();
  });

  ipcMain.handle('clear-toty', (_event, gradeId) => {
    const id = totyStorageGradeId(gradeId);
    if (!id) return emitState();
    if (!store.teamOfTheYear || typeof store.teamOfTheYear !== 'object') store.teamOfTheYear = {};
    store.teamOfTheYear[id] = {};
    persist();
    return emitState();
  });

  ipcMain.handle('update-settings', (_event, patch) => {
    const incoming = patch && typeof patch === 'object' ? patch : {};
    const current = currentSettings();
    store.settings = mergeSettings({
      ...current,
      ...incoming,
      medalTitles: incoming.medalTitles
        ? { ...current.medalTitles, ...incoming.medalTitles }
        : current.medalTitles,
      gradeLabels: incoming.gradeLabels
        ? { ...current.gradeLabels, ...incoming.gradeLabels }
        : current.gradeLabels,
    });
    persist();
    applyAudienceWindowSettings();
    return emitState();
  });

  ipcMain.handle('set-competition', (_event, value) => {
    store.competition = normalizeCompetition(value);
    const visible = gradesForCompetition(store.grades, store.competition);
    if (!visible.some((grade) => String(grade.id) === String(store.activeGradeId))) {
      store.activeGradeId = visible[0]?.id ?? null;
      store.selectedGameId = visible[0]?.rounds?.[0]?.games?.[0]?.id ?? null;
    }
    if (!visible.some((grade) => String(grade.id) === String(store.scoreboard?.gradeId))) {
      ensureScoreboard();
      store.scoreboard.gradeId = store.activeGradeId;
      store.scoreboard.roundId = null;
    }
    if (!visible.some((grade) => String(grade.id) === String(store.presentation?.gradeId))) {
      store.presentation.gradeId = store.activeGradeId;
      store.presentation.slideIndex = 0;
    }
    persistSoon();
    return emitState();
  });

  ipcMain.handle('reset-settings', () => {
    const photoCode = currentSettings().crowdPhotoCode;
    store.settings = mergeSettings({ crowdPhotoCode: photoCode });
    persist();
    applyAudienceWindowSettings();
    return emitState();
  });

  function clearDirFiles(dir) {
    if (!dir || !existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
      try {
        unlinkSync(join(dir, name));
      } catch {
        /* ignore files that are in use */
      }
    }
  }

  ipcMain.handle('reset-season', () => {
    const settings = mergeSettings(store.settings);
    const competition = normalizeCompetition(store.competition);
    store = createEmptyStore();
    store.settings = mergeSettings({
      ...settings,
      specialtyAssets: {},
    });
    store.competition = competition;
    clearDirFiles(paths.photos);
    clearDirFiles(paths.sponsors);
    clearDirFiles(paths.specialty);
    persist();
    applyAudienceWindowSettings();
    return emitState();
  });

  createMainWindow();
  startObsServer({
    distDir: join(__dirname, '../dist'),
    mediaFile: dataPath,
    getAudience: () => audienceFromState(currentDecorated()),
    getSettings: () => currentSettings(),
  })
    .then((page) => {
      obsPage = page;
      emitState();
    })
    .catch(() => {
      obsPage = null;
    });
  startCrowdServer({
    getSettings: () => currentSettings(),
    getVenues: () => crowdVenues(),
    getLeagueName: () =>
      normalizeCompetition(store?.competition) === 'wwfl'
        ? "Whyalla Women's Football League"
        : currentSettings().leagueName || 'Whyalla Football League',
    getShortName: () => (normalizeCompetition(store?.competition) === 'wwfl' ? 'WWFL' : 'WFL'),
    getLogoPath: () => join(paths.logos, 'wfl-logo.svg'),
    getClubLogoPath: (file) => {
      const name = String(file || '').replace(/[/\\]/g, '');
      if (!name) return null;
      const full = join(paths.logos, name);
      return existsSync(full) ? full : null;
    },
    onSaved: () => emitState(),
  })
    .then((page) => {
      crowdPage = page;
      emitState();
      void setupCrowdAnywhere(page.port);
    })
    .catch(() => {
      crowdPage = null;
    });
  ensureWebsiteClubLogos(paths)
    .then(() => {
      applyClubLogoFiles(store.clubs, paths);
      persist();
      emitState();
    })
    .catch(() => {});
  if (currentSettings().refreshScoresOnLaunch) {
    refreshFixtureScores(store, null, paths)
      .then(() => {
        persist();
        emitState();
      })
      .catch(() => {});
  }
});

app.on('before-quit', () => {
  persist();
  stopFunnelRetry();
  obsPage?.close?.();
  crowdPage?.close?.();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
