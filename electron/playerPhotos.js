import { copyFileSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { basename, extname, join } from 'path';
import { canonicalClubKey, displayLeagueClubName } from './constants.js';
import { playerName } from './tally.js';

function displayClubName(rawName) {
  const raw = String(rawName || '').trim();
  if (!raw) return 'Unknown club';
  const named = displayLeagueClubName(raw);
  if (named) return named;
  const key = canonicalClubKey(raw);
  if (!key) return raw;
  return key
    .toLowerCase()
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp']);

export function normalizePlayerNameKey(name) {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/,/g, ' ')
    .replace(/[_-]+/g, ' ')
    .replace(/^\d+\s+/, '')
    .replace(/[‘’´`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function compactNameKey(name) {
  return normalizePlayerNameKey(name).replace(/[^a-z0-9]+/g, '');
}

export function localPhotoMarker(paths, playerId) {
  return join(paths.photos, `${playerId}.local`);
}

export function markLocalPlayerPhoto(paths, playerId) {
  writeFileSync(localPhotoMarker(paths, playerId), 'local\n', 'utf8');
}

export function clearLocalPlayerPhotoMarker(paths, playerId) {
  const marker = localPhotoMarker(paths, playerId);
  if (!existsSync(marker)) return;
  try {
    unlinkSync(marker);
  } catch {
    /* ignore */
  }
}

export function isLocalPlayerPhoto(paths, playerId) {
  return existsSync(localPhotoMarker(paths, playerId));
}

function isPlayerPhotoName(id, name) {
  if (!name.startsWith(`${id}.`)) return false;
  if (name === `${id}.local`) return false;
  if (/\.src\./i.test(name)) return false;
  return /\.(jpe?g|png|webp|gif)$/i.test(name);
}

export function findExistingPlayerPhoto(paths, playerId) {
  const id = String(playerId || '');
  if (!id || !paths?.photos) return null;
  const preferred = [`${id}.webp`, `${id}.jpg`, `${id}.jpeg`, `${id}.png`, `${id}.gif`];
  for (const name of preferred) {
    if (existsSync(join(paths.photos, name))) return name;
  }
  try {
    return readdirSync(paths.photos).find((name) => isPlayerPhotoName(id, name)) || null;
  } catch {
    return null;
  }
}

export function findImportedSourcePhoto(paths, playerId) {
  const id = String(playerId || '');
  if (!id || !paths?.photos) return null;
  try {
    const hit = readdirSync(paths.photos).find((name) => name.startsWith(`${id}.src.`) && /\.(jpe?g|png|webp|gif)$/i.test(name));
    return hit ? join(paths.photos, hit) : null;
  } catch {
    return null;
  }
}

export function hasWebsitePlayerPhoto(paths, playerId) {
  const id = String(playerId || '');
  if (!id || !paths?.photos) return false;
  return existsSync(join(paths.photos, `${id}.webp`)) && !isLocalPlayerPhoto(paths, id);
}

/** Prefer MatchDay/website `.webp` over a PC import whenever both could apply. */
export function resolvePlayerPhoto(paths, playerId, fallbackFile = null) {
  const id = String(playerId || '');
  if (!id || !paths?.photos) {
    return { photoFile: fallbackFile || null, photoImported: false };
  }
  const imported = isLocalPlayerPhoto(paths, id);
  if (!imported && existsSync(join(paths.photos, `${id}.webp`))) {
    return { photoFile: `${id}.webp`, photoImported: false };
  }
  const existing = findExistingPlayerPhoto(paths, id);
  if (existing) return { photoFile: existing, photoImported: imported };
  if (fallbackFile && existsSync(join(paths.photos, String(fallbackFile)))) {
    return { photoFile: String(fallbackFile), photoImported: imported };
  }
  return { photoFile: null, photoImported: false };
}

function collectPlayers(store) {
  const byId = new Map();
  for (const grade of store?.grades ?? []) {
    for (const round of grade.rounds ?? []) {
      for (const game of round.games ?? []) {
        for (const player of game.players ?? []) {
          if (!player?.id) continue;
          const id = String(player.id);
          if (!byId.has(id)) byId.set(id, player);
        }
      }
    }
  }
  return [...byId.values()];
}

function nameKeysForPlayer(player) {
  const full = playerName(player) || `${player.firstName || ''} ${player.lastName || ''}`.trim();
  const keys = new Set();
  const normal = normalizePlayerNameKey(full);
  if (normal) keys.add(normal);
  const compact = compactNameKey(full);
  if (compact) keys.add(compact);
  const first = normalizePlayerNameKey(player.firstName);
  const last = normalizePlayerNameKey(player.lastName);
  if (first && last) {
    keys.add(`${first} ${last}`);
    keys.add(`${last} ${first}`);
    keys.add(compactNameKey(`${first} ${last}`));
    keys.add(compactNameKey(`${last} ${first}`));
  }
  return [...keys].filter(Boolean);
}

function buildPlayerIndex(players) {
  const byKey = new Map();
  for (const player of players) {
    for (const key of nameKeysForPlayer(player)) {
      const list = byKey.get(key) || [];
      list.push(player);
      byKey.set(key, list);
    }
  }
  return byKey;
}

function keysForFilename(fileName) {
  const base = basename(fileName, extname(fileName));
  const normal = normalizePlayerNameKey(base);
  const keys = [];
  if (normal) keys.push(normal);
  const compact = compactNameKey(base);
  if (compact) keys.push(compact);
  const tokens = normal.split(' ').filter(Boolean);
  if (tokens.length >= 2) {
    const swapped = `${tokens[tokens.length - 1]} ${tokens.slice(0, -1).join(' ')}`;
    keys.push(normalizePlayerNameKey(swapped));
    keys.push(compactNameKey(swapped));
  }
  return [...new Set(keys.filter(Boolean))];
}

function matchPlayer(byKey, fileName) {
  for (const key of keysForFilename(fileName)) {
    const hits = byKey.get(key);
    if (hits?.length === 1) return hits[0];
  }
  return null;
}

function removePlayerPhotoFiles(paths, playerId, keepFile = null) {
  const prefix = `${playerId}.`;
  for (const name of readdirSync(paths.photos)) {
    if (name === `${playerId}.local`) continue;
    if (/\.src\./i.test(name)) continue;
    if (!String(name).startsWith(prefix)) continue;
    if (keepFile && name === keepFile) continue;
    try {
      unlinkSync(join(paths.photos, name));
    } catch {
      /* ignore */
    }
  }
}

export function applyImportedPhotoToPlayers(store, playerId, photoFile) {
  let count = 0;
  for (const grade of store?.grades ?? []) {
    for (const round of grade.rounds ?? []) {
      for (const game of round.games ?? []) {
        for (const player of game.players ?? []) {
          if (String(player.id) !== String(playerId)) continue;
          player.photoFile = photoFile;
          count += 1;
        }
      }
    }
  }
  return count;
}

function roundLabel(grade, round) {
  const gradeName = String(grade?.name || '').trim();
  const roundName = String(round?.name || '').trim() || 'Round';
  if (!gradeName) return roundName;
  // Keep short when the grade is already clear from context; still include grade for multi-grade seasons.
  return `${gradeName} · ${roundName}`;
}

/** Collect club + every round a player appears in (for imported-photo Settings). */
function collectImportedPhotoMeta(store) {
  const byId = new Map();
  for (const grade of store?.grades ?? []) {
    for (const round of grade.rounds ?? []) {
      const label = roundLabel(grade, round);
      for (const game of round.games ?? []) {
        for (const player of game.players ?? []) {
          if (!player?.id) continue;
          const id = String(player.id);
          const rawClub =
            String(player.clubName || '').trim() ||
            (String(player.clubId) === String(game.awayId) ? game.awayName : game.homeName) ||
            '';
          let row = byId.get(id);
          if (!row) {
            row = {
              id,
              player,
              clubId: player.clubId ?? null,
              clubKey: canonicalClubKey(rawClub) || rawClub.toUpperCase() || 'UNKNOWN',
              clubName: displayClubName(rawClub),
              rounds: [],
              roundKeys: new Set(),
            };
            byId.set(id, row);
          }
          if ((!row.clubName || row.clubName === 'Unknown club') && rawClub) {
            row.clubKey = canonicalClubKey(rawClub) || rawClub.toUpperCase() || row.clubKey;
            row.clubName = displayClubName(rawClub);
          }
          if (row.clubId == null && player.clubId != null) row.clubId = player.clubId;
          if (label && !row.roundKeys.has(label)) {
            row.roundKeys.add(label);
            row.rounds.push(label);
          }
        }
      }
    }
  }
  return byId;
}

export function listImportedPlayerPhotos(store, paths) {
  if (!paths?.photos || !existsSync(paths.photos)) return [];
  const metaById = collectImportedPhotoMeta(store);
  const list = [];
  for (const name of readdirSync(paths.photos)) {
    if (!name.endsWith('.local')) continue;
    const id = name.slice(0, -'.local'.length);
    if (!id) continue;
    const photoFile = findExistingPlayerPhoto(paths, id);
    if (!photoFile) continue;
    const meta = metaById.get(id);
    const player = meta?.player;
    list.push({
      id,
      name: player ? playerName(player) : 'Unknown player',
      clubId: meta?.clubId ?? null,
      clubKey: meta?.clubKey || 'UNKNOWN',
      clubName: meta?.clubName || 'Unknown club',
      number: player?.number ? String(player.number) : '',
      rounds: meta?.rounds ?? [],
      photoFile,
    });
  }
  return list.sort((a, b) => {
    const club = String(a.clubName).localeCompare(String(b.clubName), undefined, { sensitivity: 'base' });
    if (club) return club;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

export function deleteImportedPlayerPhoto(store, paths, playerId) {
  const id = String(playerId || '');
  if (!id || !paths?.photos) return { ok: false, error: 'Missing player' };
  if (!isLocalPlayerPhoto(paths, id)) return { ok: false, error: 'That is not an imported photo' };
  clearLocalPlayerPhotoMarker(paths, id);
  removePlayerPhotoFiles(paths, id);
  for (const name of readdirSync(paths.photos)) {
    if (!name.startsWith(`${id}.src.`)) continue;
    try {
      unlinkSync(join(paths.photos, name));
    } catch {
      /* ignore */
    }
  }
  applyImportedPhotoToPlayers(store, id, null);
  return { ok: true, id };
}

async function saveCutoutImport(paths, playerId, sourcePath) {
  const photoFile = `${playerId}.webp`;
  const dest = join(paths.photos, photoFile);
  const src = String(sourcePath || '');
  let original = findImportedSourcePhoto(paths, playerId);
  if (!original) {
    const ext = extname(src).toLowerCase() === '.jpeg' ? '.jpg' : extname(src).toLowerCase() || '.jpg';
    original = join(paths.photos, `${playerId}.src${ext}`);
    if (!/\.src\./i.test(basename(src))) {
      copyFileSync(src, original);
    } else {
      original = src;
    }
  }
  const scratch = mkdtempSync(join(tmpdir(), 'wfl-photo-'));
  try {
    const staged = join(scratch, `src${extname(original) || '.jpg'}`);
    copyFileSync(original, staged);
    const { cutOutPlayerPhoto } = await import('./photoCutout.js');
    await cutOutPlayerPhoto(staged, dest);
  } finally {
    try {
      rmSync(scratch, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
  removePlayerPhotoFiles(paths, playerId, photoFile);
  markLocalPlayerPhoto(paths, playerId);
  return photoFile;
}

/** Re-cut PC imports from the saved original when possible; otherwise clean fringe on the cutout. */
export async function recutLocalPlayerPhotos(store, paths, onProgress) {
  const { cleanCutoutBuffer } = await import('./photoCutout.js');
  const ids = [];
  for (const name of readdirSync(paths.photos)) {
    if (!name.endsWith('.local')) continue;
    ids.push(name.slice(0, -'.local'.length));
  }
  let updated = 0;
  for (let i = 0; i < ids.length; i += 1) {
    const id = ids[i];
    onProgress?.(`Cleaning imported photos ${i + 1} of ${ids.length}`, i + 1, ids.length);
    if (hasWebsitePlayerPhoto(paths, id)) {
      clearLocalPlayerPhotoMarker(paths, id);
      continue;
    }
    const original = findImportedSourcePhoto(paths, id);
    const existing = findExistingPlayerPhoto(paths, id);
    if (!existing && !original) continue;
    try {
      if (original) {
        const photoFile = await saveCutoutImport(paths, id, original);
        applyImportedPhotoToPlayers(store, id, photoFile);
      } else {
        const current = join(paths.photos, existing);
        const cleaned = await cleanCutoutBuffer(readFileSync(current));
        writeFileSync(current, cleaned);
        applyImportedPhotoToPlayers(store, id, existing);
      }
      updated += 1;
    } catch {
      /* keep previous file if cutout fails */
    }
  }
  return { updated, total: ids.length };
}

export async function importPlayerPhotoFiles(store, paths, filePaths, onProgress) {
  const sources = (filePaths ?? [])
    .map((src) => String(src || '').trim())
    .filter((src) => src && existsSync(src) && IMAGE_EXTS.has(extname(src).toLowerCase()));
  if (!sources.length) {
    return { ok: false, error: 'Choose one or more photo files (jpg, png, webp, gif).' };
  }

  const players = collectPlayers(store);
  if (!players.length) {
    return { ok: false, error: 'Sync fixtures first so players are loaded, then import photos.' };
  }

  const byKey = buildPlayerIndex(players);
  let matched = 0;
  let unmatched = 0;
  let keptWebsite = 0;
  const samples = [];

  for (let i = 0; i < sources.length; i += 1) {
    const src = sources[i];
    const name = basename(src);
    onProgress?.(`Importing photos ${i + 1} of ${sources.length}`, i + 1, sources.length);
    const player = matchPlayer(byKey, name);
    if (!player) {
      unmatched += 1;
      if (samples.length < 8) samples.push(basename(name, extname(name)));
      continue;
    }
    // Never replace a MatchDay/website photo with a PC import.
    if (hasWebsitePlayerPhoto(paths, player.id)) {
      keptWebsite += 1;
      continue;
    }
    try {
      const photoFile = await saveCutoutImport(paths, player.id, src);
      applyImportedPhotoToPlayers(store, player.id, photoFile);
      matched += 1;
    } catch (error) {
      return {
        ok: false,
        error: error?.message || `Could not cut out ${name}`,
        matched,
        unmatched,
        keptWebsite,
      };
    }
  }

  if (!matched) {
    if (keptWebsite && !unmatched) {
      return {
        ok: false,
        error: `Those files match players who already have website photos (${keptWebsite}). Website photos are kept.`,
      };
    }
    return {
      ok: false,
      error: `No filenames matched players${samples.length ? ` (e.g. ${samples.join(', ')})` : ''}. Name files like "First Last.jpg".`,
    };
  }

  return { ok: true, matched, unmatched, keptWebsite, samples };
}

export async function importPlayerPhotoForPlayer(store, paths, playerId, sourcePath) {
  const id = String(playerId || '');
  const src = String(sourcePath || '').trim();
  if (!id) return { ok: false, error: 'Choose a player.' };
  if (!src || !existsSync(src)) return { ok: false, error: 'Choose a photo file.' };
  if (!IMAGE_EXTS.has(extname(src).toLowerCase())) {
    return { ok: false, error: 'Use a jpg, png, webp or gif photo.' };
  }
  const players = collectPlayers(store);
  const player = players.find((item) => String(item.id) === id);
  if (!player) return { ok: false, error: 'That player is not in the loaded season.' };
  if (hasWebsitePlayerPhoto(paths, id)) {
    return { ok: false, error: `${playerName(player)} already has a website photo.` };
  }
  try {
    const photoFile = await saveCutoutImport(paths, id, src);
    applyImportedPhotoToPlayers(store, id, photoFile);
    return { ok: true, matched: 1, playerId: id, name: playerName(player) };
  } catch (error) {
    return { ok: false, error: error?.message || 'Could not cut out that photo.' };
  }
}

export async function importPlayerPhotosFromFolder(store, paths, sourceDir, onProgress) {
  const folder = String(sourceDir || '').trim();
  if (!folder) return { ok: false, error: 'Choose a folder of player photos.' };
  if (!existsSync(folder)) return { ok: false, error: 'That folder is gone.' };
  const files = readdirSync(folder)
    .filter((name) => IMAGE_EXTS.has(extname(name).toLowerCase()))
    .map((name) => join(folder, name));
  if (!files.length) {
    return { ok: false, error: 'No photo images found in that folder (jpg, png, webp, gif).' };
  }
  return importPlayerPhotoFiles(store, paths, files, onProgress);
}
