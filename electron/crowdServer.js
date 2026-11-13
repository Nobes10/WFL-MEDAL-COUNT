import { createServer } from 'http';
import { existsSync, readFileSync } from 'fs';
import { extname } from 'path';
import {
  approvedPhotos,
  artFilePath,
  mergeCrowdSettings,
  photoPath,
  saveCrowdPhoto,
} from './crowdPhotos.js';

const PORTS = [4788, 4789, 4790, 4791, 4792];
const TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function sendFile(res, filePath) {
  if (!filePath || !existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  const type = TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(readFileSync(filePath));
}

function sendHtml(res, html) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(html);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 18 * 1024 * 1024) {
        reject(new Error('Too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(new Error('Bad JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sendPage({ venues, leagueName, shortName, hasLogo }) {
  const clubs = (venues ?? []).map((item) =>
    typeof item === 'string' ? { name: item, logo: '' } : { name: item?.name || '', logo: item?.logo || '' }
  ).filter((item) => item.name);
  const clubButtons = clubs
    .map(
      (club) =>
        `<button type="button" class="club-opt" data-club="${esc(club.name)}" data-logo="${esc(club.logo)}">${
          club.logo ? `<img src="${esc(club.logo)}" alt="">` : '<i></i>'
        }<span>${esc(club.name)}</span></button>`
    )
    .join('');
  const short = esc(shortName || 'WFL');
  const league = esc(leagueName || 'Whyalla Football League');
  const markSize = (shortName || 'WFL').length > 3 ? '13px' : '18px';
  const brandMark = hasLogo && shortName !== 'WWFL'
    ? '<img src="/brand" alt="" />'
    : `<div class="mark" style="font-size:${markSize}">${short}</div>`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="theme-color" content="#07090d" />
  <title>${short} — Send a photo</title>
  <style>
    :root { color-scheme: dark; --red:#d60a0a; --gold:#e3b341; --ink:#e6edf3; --muted:#9eb0c4; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0; width: 100%; height: 100%;
      height: 100dvh; height: 100svh;
      background: #07090d; color: var(--ink);
    }
    body {
      display: flex; flex-direction: column;
      overflow: hidden;
      font-family: "Segoe UI", system-ui, sans-serif;
      background:
        radial-gradient(circle at top right, rgba(214,10,10,.28), transparent 42%),
        radial-gradient(circle at 12% 88%, rgba(227,179,65,.16), transparent 36%),
        radial-gradient(circle at bottom right, rgba(12,113,195,.18), transparent 40%),
        #07090d;
      background-attachment: fixed;
    }
    main {
      width: 100%;
      flex: 1 1 auto;
      min-height: 0;
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: auto;
      padding: max(20px, env(safe-area-inset-top)) 18px max(20px, env(safe-area-inset-bottom));
    }
    .brand { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px; flex: none; }
    .brand img, .mark {
      width: 92px; height: 92px; object-fit: contain; filter: drop-shadow(0 10px 24px rgba(0,0,0,.45));
    }
    .mark {
      display: grid; place-content: center; border-radius: 50%;
      background: radial-gradient(circle at 32% 28%, #fff1b0, var(--gold) 46%, #8a6a1c 78%);
      color: #1a1408; font-weight: 800; letter-spacing: .08em; font-size: 18px;
    }
    .brand p {
      margin: 0; letter-spacing: .22em; text-transform: uppercase; color: var(--gold);
      font-size: 11px; font-weight: 700;
    }
    h1 {
      margin: 0; font-size: clamp(28px, 8vw, 38px); line-height: .95;
      font-weight: 800; letter-spacing: -.03em;
    }
    h1 span { display: block; color: var(--gold); }
    .fill { flex: 1 1 0; min-height: 12px; }
    .card {
      flex: 1 1 0;
      display: flex;
      flex-direction: column;
      margin-top: 16px; padding: 18px;
      min-height: 0;
      background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02));
      border: 1px solid rgba(227,179,65,.28);
      border-radius: 22px;
      box-shadow: 0 18px 40px rgba(0,0,0,.28);
    }
    .field { display: flex; flex-direction: column; gap: 8px; margin: 0 0 14px; }
    .field span {
      font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); font-weight: 700;
    }
    input {
      font: inherit; color: var(--ink); background: #0d1117;
      border: 1px solid #30363d; border-radius: 14px; padding: 14px 16px; min-height: 52px;
    }
    input:focus { outline: 2px solid var(--gold); border-color: transparent; }
    .club-toggle {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      width: 100%; min-height: 54px; padding: 10px 16px 10px 10px;
      border-radius: 16px; border: 1px solid rgba(227,179,65,.38);
      background: linear-gradient(180deg, #1b2230, #0d1117);
      color: var(--muted); font: inherit; font-weight: 700; text-align: left;
    }
    .club-toggle.picked { color: var(--gold); border-color: var(--gold); }
    .club-toggle-main { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .club-mark, .club-opt img, .club-opt i {
      width: 36px; height: 36px; object-fit: contain; flex: none;
      background: #0d1117; border-radius: 10px;
    }
    .club-opt i { display: block; border: 1px dashed #30363d; }
    .club-toggle svg { width: 18px; height: 18px; flex: none; }
    .club-pop {
      position: fixed; inset: 0; z-index: 50;
      display: flex; align-items: flex-end; justify-content: center;
    }
    .club-pop[hidden] { display: none; }
    .club-scrim { position: absolute; inset: 0; border: 0; background: rgba(0,0,0,.62); }
    .club-sheet {
      position: relative; width: min(440px, 100%);
      max-height: min(82vh, 740px); overflow: auto;
      background:
        radial-gradient(circle at top right, rgba(214,10,10,.18), transparent 42%),
        #12161d;
      border: 1px solid rgba(227,179,65,.35);
      border-radius: 24px 24px 0 0;
      padding: 14px 14px max(18px, env(safe-area-inset-bottom));
      box-shadow: 0 -18px 40px rgba(0,0,0,.4);
    }
    .club-sheet header {
      display: flex; align-items: center; justify-content: space-between;
      gap: 12px; margin: 2px 6px 12px;
    }
    .club-sheet h2 { margin: 0; font-size: 18px; }
    .club-sheet .x {
      width: 40px; height: 40px; border: 0; border-radius: 12px;
      background: #1b2230; color: var(--ink); font-size: 22px;
    }
    .club-list { display: grid; gap: 8px; }
    .club-opt {
      display: flex; align-items: center; gap: 14px;
      min-height: 64px; padding: 10px 14px; border-radius: 16px;
      border: 1px solid #30363d; background: #0d1117; color: var(--ink);
      font: inherit; font-weight: 700; text-align: left;
    }
    .club-opt img, .club-opt i { width: 48px; height: 48px; }
    .club-opt.on {
      border-color: var(--gold);
      background: linear-gradient(90deg, rgba(227,179,65,.2), rgba(227,179,65,.04));
      color: var(--gold);
      box-shadow: inset 3px 0 0 var(--gold);
    }
    @media (min-width: 540px) {
      .club-pop { align-items: center; }
      .club-sheet { border-radius: 22px; }
    }
    .actions { display: grid; gap: 10px; margin-top: 0; }
    .cta {
      display: grid; place-items: center; min-height: 58px; padding: 16px 16px;
      border-radius: 16px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase;
      text-decoration: none; color: #fff; background: linear-gradient(180deg, #ff2a2a, var(--red) 55%, #9a0707);
      box-shadow: 0 10px 22px rgba(214,10,10,.35);
    }
    .cta.ghost {
      color: var(--ink); background: #161b22; box-shadow: none;
      border: 1px solid rgba(255,255,255,.12);
    }
    .file { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
    .note { min-height: 1.4em; margin: 14px 0 0; text-align: center; font-weight: 700; }
    .ok { color: #3fb950; }
    .err { color: #ff7b72; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 16px; }
    .grid img {
      width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 12px;
      border: 1px solid rgba(227,179,65,.45);
    }
  </style>
</head>
<body>
  <main>
    <header class="brand">
      ${brandMark}
      <p>${short}</p>
      <h1>Send a photo<span>${league}</span></h1>
    </header>
    <section class="card">
      <label class="field">Your name<input id="name" autocomplete="name" placeholder="Optional" /></label>
      <div class="field">
        <span>Club</span>
        <button type="button" class="club-toggle" id="clubToggle" aria-haspopup="dialog">
          <span class="club-toggle-main">
            <img id="clubMark" class="club-mark" alt="" hidden />
            <span id="clubLabel">Choose your club</span>
          </span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <input type="hidden" id="venue" />
      </div>
      <input id="camera" class="file" type="file" accept="image/*" capture="environment" />
      <input id="gallery" class="file" type="file" accept="image/*" multiple />
      <div class="fill" aria-hidden="true"></div>
      <div class="actions">
        <label class="cta" for="camera">Take a photo</label>
        <label class="cta ghost" for="gallery">Choose from phone</label>
      </div>
      <p class="note" id="note"></p>
      <div class="grid" id="grid"></div>
    </section>
  </main>
  <div class="club-pop" id="clubPop" hidden>
    <button class="club-scrim" id="clubScrim" type="button" aria-label="Close"></button>
    <div class="club-sheet" role="dialog" aria-label="Choose your club">
      <header>
        <h2>Your club</h2>
        <button class="x" id="clubClose" type="button" aria-label="Close">×</button>
      </header>
      <div class="club-list" id="clubMenu">
        <button type="button" class="club-opt" data-club="" data-logo=""><i></i><span>Skip</span></button>
        ${clubButtons}
      </div>
    </div>
  </div>
  <script>
    const CLUBS = ${JSON.stringify(clubs)};
    const MAX_EDGE = 1600;
    const JPEG_QUALITY = 0.82;
    const nameEl = document.getElementById('name');
    const venueEl = document.getElementById('venue');
    const clubToggle = document.getElementById('clubToggle');
    const clubPop = document.getElementById('clubPop');
    const clubMenu = document.getElementById('clubMenu');
    const clubLabel = document.getElementById('clubLabel');
    const clubMark = document.getElementById('clubMark');
    const noteEl = document.getElementById('note');
    const gridEl = document.getElementById('grid');
    nameEl.value = localStorage.getItem('wfl-crowd-name') || '';
    function closePop() {
      clubPop.hidden = true;
      document.body.style.overflow = '';
    }
    function openPop() {
      clubPop.hidden = false;
      document.body.style.overflow = 'hidden';
    }
    function setClub(name, close) {
      const club = CLUBS.find((item) => item.name === name);
      const value = club ? club.name : '';
      const logo = club?.logo || '';
      venueEl.value = value;
      clubLabel.textContent = value || 'Choose your club';
      clubToggle.classList.toggle('picked', Boolean(value));
      if (logo) {
        clubMark.src = logo;
        clubMark.hidden = false;
      } else {
        clubMark.removeAttribute('src');
        clubMark.hidden = true;
      }
      clubMenu.querySelectorAll('.club-opt').forEach((btn) => {
        btn.classList.toggle('on', (btn.getAttribute('data-club') || '') === value);
      });
      if (close !== false) closePop();
    }
    clubToggle.addEventListener('click', openPop);
    document.getElementById('clubScrim').addEventListener('click', closePop);
    document.getElementById('clubClose').addEventListener('click', closePop);
    clubMenu.addEventListener('click', (event) => {
      const btn = event.target.closest('.club-opt');
      if (btn) setClub(btn.getAttribute('data-club') || '');
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !clubPop.hidden) closePop();
    });
    setClub(localStorage.getItem('wfl-crowd-venue') || '', false);
    function note(text, cls) { noteEl.className = 'note ' + (cls || ''); noteEl.textContent = text || ''; }
    function draw(source, width, height) {
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(source, 0, 0, width, height);
      return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    }
    function sizeOf(w, h) {
      const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
      return [Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale))];
    }
    async function shrink(file) {
      try {
        if (typeof createImageBitmap === 'function') {
          let bitmap;
          try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
          catch { bitmap = await createImageBitmap(file); }
          const [width, height] = sizeOf(bitmap.width, bitmap.height);
          const out = draw(bitmap, width, height);
          bitmap.close();
          return out;
        }
      } catch {}
      const dataUrl = await new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          try {
            const [width, height] = sizeOf(img.naturalWidth || img.width, img.naturalHeight || img.height);
            resolve(draw(img, width, height));
          } catch (err) { reject(err); }
          URL.revokeObjectURL(url);
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that photo')); };
        img.src = url;
      });
      return dataUrl;
    }
    async function sendFiles(files) {
      const from = nameEl.value.trim() || 'Someone';
      const venue = venueEl.value.trim();
      localStorage.setItem('wfl-crowd-name', nameEl.value.trim());
      localStorage.setItem('wfl-crowd-venue', venue);
      for (const file of files) {
        try {
          note('Sending…');
          const dataUrl = await shrink(file);
          const res = await fetch('/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ from, venue, dataUrl, id: String(Date.now()) + Math.random().toString(36).slice(2, 6) })
          });
          const body = await res.json();
          if (!res.ok || !body.ok) throw new Error(body.error || 'Could not send');
          const img = document.createElement('img');
          img.src = dataUrl;
          gridEl.prepend(img);
          note('Sent — thanks!', 'ok');
        } catch (err) {
          note(err.message || 'Could not send', 'err');
        }
      }
    }
    function hook(id) {
      const el = document.getElementById(id);
      el.addEventListener('change', async () => {
        const files = [...(el.files || [])];
        el.value = '';
        if (files.length) await sendFiles(files);
      });
    }
    hook('camera');
    hook('gallery');
  </script>
</body>
</html>`;
}

export function startCrowdServer({ getSettings, getVenues, getLeagueName, getShortName, getLogoPath, getClubLogoPath, onSaved }) {
  const sent = new Map();

  const handler = async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const path = decodeURIComponent(url.pathname);
    const settings = mergeCrowdSettings(getSettings());

    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (path === '/' || path === '/send') {
      const logoPath = getLogoPath?.();
      sendHtml(
        res,
        sendPage({
          venues: getVenues(),
          leagueName: getLeagueName(),
          shortName: getShortName?.() || 'WFL',
          hasLogo: Boolean(logoPath && existsSync(logoPath)),
        })
      );
      return;
    }

    if (path === '/brand') {
      sendFile(res, getLogoPath?.());
      return;
    }
    const clubLogo = path.match(/^\/club-logo\/([^/]+)$/);
    if (clubLogo) {
      sendFile(res, getClubLogoPath?.(decodeURIComponent(clubLogo[1])));
      return;
    }

    if (path === '/upload' && req.method === 'POST') {
      try {
        const body = await readJson(req);
        const from = String(body.from || '').trim() || 'Someone';
        const forwarded = String(req.headers['x-forwarded-for'] || '')
          .split(',')[0]
          .trim();
        const ip = forwarded || String(req.socket?.remoteAddress || 'local');
        const key = `${ip}|${from.toLowerCase()}`;
        const used = sent.get(key) || 0;
        if (used >= settings.crowdMaxPerSender) {
          res.writeHead(429, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'That is plenty for now, thanks' }));
          return;
        }
        const saved = saveCrowdPhoto({
          id: body.id || `${Date.now()}`,
          from,
          venue: body.venue,
          dataUrl: body.dataUrl,
        });
        sent.set(key, used + 1);
        onSaved?.(saved);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, file: saved.file }));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: error.message || 'Could not save' }));
      }
      return;
    }

    const approved = path.match(/^\/approved\/([^/]+)$/);
    if (approved) {
      sendFile(res, photoPath('approved', approved[1]));
      return;
    }
    const waiting = path.match(/^\/waiting\/([^/]+)$/);
    if (waiting) {
      sendFile(res, photoPath('waiting', waiting[1]));
      return;
    }
    if (path === '/art') {
      sendFile(res, artFilePath(settings));
      return;
    }
    if (path === '/wall-settings') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(
        JSON.stringify({
          ok: true,
          holdMs: settings.crowdHoldMs,
          fadeMs: settings.crowdFadeMs,
          pollMs: settings.crowdPollMs,
          maxPerSender: settings.crowdMaxPerSender,
          customArt: Boolean(artFilePath(settings)),
          artVersion: settings.crowdArtVersion,
          photos: approvedPhotos(),
        })
      );
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  };

  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      void handler(req, res);
    });
    const tryPort = (index) => {
      if (index >= PORTS.length) {
        reject(new Error('No local port free for crowd photos'));
        return;
      }
      const port = PORTS[index];
      const onError = (error) => {
        if (error?.code === 'EADDRINUSE') tryPort(index + 1);
        else reject(error);
      };
      server.once('error', onError);
      server.listen(port, '0.0.0.0', () => {
        server.off('error', onError);
        resolve({
          port,
          close: () =>
            new Promise((done) => {
              server.close(() => done());
            }),
        });
      });
    };
    tryPort(0);
  });
}
