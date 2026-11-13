import { app } from 'electron';
import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'fs';
import { extname, join } from 'path';
import { networkInterfaces } from 'os';

const WAITING = 'waiting';
const APPROVED = 'approved';
const DENIED = 'denied';
const ART_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

export const CROWD_DEFAULTS = {
  holdMs: 6000,
  fadeMs: 900,
  pollMs: 5000,
  maxPerSender: 30,
  photoCode: '',
  artFile: null,
  artVersion: 0,
};

function clamp(n, min, max, fallback) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.round(v)));
}

function label(value, fallback) {
  const clean = String(value || '')
    .replace(/[^a-z0-9 -]/gi, '')
    .trim()
    .slice(0, 30);
  return clean || fallback;
}

export function makePhotoCode() {
  let code = '';
  while (code.length < 8) code += Math.random().toString(36).slice(2);
  return code.slice(0, 8);
}

export function normalizePhotoCode(input) {
  return String(input || '')
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 8)
    .toLowerCase();
}

export function safeName(id, from, venue) {
  const clean = String(id || '')
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 24);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${stamp}_${label(from, 'someone')}_${label(venue, '-')}_${clean || 'pic'}.jpg`;
}

export function describeFile(file) {
  const parts = String(file)
    .replace(/\.jpg$/i, '')
    .split('_');
  const venue = parts.length > 3 ? parts[2] : '';
  return { from: parts[1] || 'Someone', venue: venue === '-' ? '' : venue };
}

export function photosRoot() {
  const dir = join(app.getPath('pictures'), 'WFL Medal Count Photos');
  mkdirSync(dir, { recursive: true });
  return dir;
}

function bucket(which) {
  const dir = join(photosRoot(), which);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function readBucket(which) {
  const dir = bucket(which);
  return readdirSync(dir)
    .filter((file) => /\.(jpe?g|png|webp)$/i.test(file))
    .map((file) => ({
      file,
      ...describeFile(file),
      at: statSync(join(dir, file)).mtimeMs,
    }))
    .sort((a, b) => a.at - b.at);
}

export function photoPath(which, file) {
  const name = String(file || '').replace(/[/\\]/g, '');
  if (!name) return null;
  const full = join(bucket(which), name);
  return existsSync(full) ? full : null;
}

export function waitingPhotos() {
  return readBucket(WAITING);
}

export function approvedPhotos() {
  return readBucket(APPROVED);
}

export function saveCrowdPhoto({ id, from, venue, dataUrl }) {
  const match = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!match) throw new Error('That was not a picture');
  const bytes = Buffer.from(match[1], 'base64');
  if (!bytes.length || bytes.length > 16 * 1024 * 1024) throw new Error('Wrong size');
  const file = safeName(id, from, venue);
  writeFileSync(join(bucket(WAITING), file), bytes);
  return { file, from: String(from || 'Someone').trim() || 'Someone', venue: String(venue || '').trim(), at: Date.now() };
}

export function importCrowdFiles(files, { from = 'Desk', venue = '' } = {}) {
  const added = [];
  for (const src of files ?? []) {
    const ext = extname(src).toLowerCase();
    if (!ART_EXTS.has(ext) && ext !== '.jpeg') continue;
    if (!existsSync(src)) continue;
    const file = safeName(`imp${Date.now()}${added.length}`, from, venue).replace(/\.jpg$/i, ext === '.png' ? '.png' : ext === '.webp' ? '.webp' : '.jpg');
    copyFileSync(src, join(bucket(WAITING), file));
    added.push({ file, from, venue, at: Date.now() });
  }
  return added;
}

function move(file, from, to) {
  const name = String(file || '').replace(/[/\\]/g, '');
  const source = join(bucket(from), name);
  if (!existsSync(source)) return false;
  renameSync(source, join(bucket(to), name));
  return true;
}

export function approvePhoto(file) {
  return move(file, WAITING, APPROVED);
}

export function denyPhoto(file) {
  return move(file, WAITING, DENIED);
}

export function approveAllPhotos() {
  let count = 0;
  for (const photo of waitingPhotos()) {
    if (approvePhoto(photo.file)) count += 1;
  }
  return count;
}

export function artDir() {
  const dir = join(app.getPath('userData'), 'wfl-medal-count');
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function artFilePath(settings) {
  const name = settings?.crowdArtFile ? String(settings.crowdArtFile) : '';
  if (!name) return null;
  const full = join(artDir(), name);
  return existsSync(full) ? full : null;
}

export function setCustomArtFromPath(sourcePath) {
  const src = String(sourcePath || '');
  const ext = extname(src).toLowerCase();
  if (!ART_EXTS.has(ext)) throw new Error('Choose a PNG, JPG or WebP image');
  if (!existsSync(src)) throw new Error('That file is gone');
  const destName = `crowd-lower-art${ext === '.jpeg' ? '.jpg' : ext}`;
  const dest = join(artDir(), destName);
  for (const name of readdirSync(artDir())) {
    if (!/^crowd-lower-art\./i.test(name)) continue;
    try {
      unlinkSync(join(artDir(), name));
    } catch {
      /* ignore */
    }
  }
  copyFileSync(src, dest);
  return { artFile: destName, artVersion: Date.now() };
}

export function clearCustomArt(settings) {
  const current = artFilePath(settings);
  if (current) {
    try {
      unlinkSync(current);
    } catch {
      /* ignore */
    }
  }
  return { artFile: null, artVersion: 0 };
}

export function lanAddresses() {
  const scored = [];
  for (const [name, entries] of Object.entries(networkInterfaces())) {
    for (const net of entries || []) {
      if (net.family !== 'IPv4' && net.family !== 4) continue;
      if (net.internal) continue;
      if (String(net.address).startsWith('169.254.')) continue;
      let score = 0;
      if (/^192\.168\./.test(net.address)) score += 3;
      else if (/^10\./.test(net.address)) score += 2;
      else if (/^172\.(1[6-9]|2\d|3[01])\./.test(net.address)) score += 2;
      if (/virtual|vmware|vbox|loopback|bluetooth|wsl|hyper-v/i.test(name)) score -= 5;
      scored.push({ address: net.address, score });
    }
  }
  return scored.sort((a, b) => b.score - a.score).map((entry) => entry.address);
}

export function crowdPhotoUrl(which, file) {
  return `medal://crowd/${which}/${encodeURIComponent(file)}`;
}

export function crowdArtUrl(settings) {
  if (!artFilePath(settings)) return null;
  return `medal://crowd/art?v=${Number(settings.crowdArtVersion) || 0}`;
}

export function crowdViewFromSettings(settings) {
  const waiting = waitingPhotos().map((photo) => ({
    ...photo,
    url: crowdPhotoUrl('waiting', photo.file),
  }));
  const approved = approvedPhotos().map((photo) => ({
    ...photo,
    url: crowdPhotoUrl('approved', photo.file),
  }));
  return {
    waiting,
    approved,
    waitingCount: waiting.length,
    approvedCount: approved.length,
    photoCode: settings.crowdPhotoCode || '',
    customArt: Boolean(artFilePath(settings)),
    artUrl: crowdArtUrl(settings),
    artVersion: Number(settings.crowdArtVersion) || 0,
    holdMs: settings.crowdHoldMs,
    fadeMs: settings.crowdFadeMs,
    pollMs: settings.crowdPollMs,
    maxPerSender: settings.crowdMaxPerSender,
  };
}

export function mergeCrowdSettings(raw = {}) {
  const incoming = raw && typeof raw === 'object' ? raw : {};
  const code = normalizePhotoCode(incoming.crowdPhotoCode);
  return {
    crowdHoldMs: clamp(incoming.crowdHoldMs, 2000, 60000, CROWD_DEFAULTS.holdMs),
    crowdFadeMs: clamp(incoming.crowdFadeMs, 0, 5000, CROWD_DEFAULTS.fadeMs),
    crowdPollMs: clamp(incoming.crowdPollMs, 2000, 30000, CROWD_DEFAULTS.pollMs),
    crowdMaxPerSender: clamp(incoming.crowdMaxPerSender, 1, 200, CROWD_DEFAULTS.maxPerSender),
    crowdPhotoCode: code,
    crowdArtFile: incoming.crowdArtFile ? String(incoming.crowdArtFile) : null,
    crowdArtVersion: Number(incoming.crowdArtVersion) || 0,
  };
}
