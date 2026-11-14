import { BrowserWindow } from 'electron';
import {
  normalizeSpecialtyName,
  playHqShortId,
  roundSpecialtyName,
} from './specialty.js';

export {
  displayRoundTitle,
  formatSpecialtyName,
  normalizeSpecialtyName,
  playHqShortId,
  roundSpecialtyName,
  specialtyThemeFromName,
} from './specialty.js';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function collectPlayHqSampleUrl(grades) {
  for (const grade of grades ?? []) {
    for (const round of grade.rounds ?? []) {
      for (const game of round.games ?? []) {
        const url = String(game.url || '').trim();
        if (/playhq\.com\/.+\/game-centre\//i.test(url)) return url;
      }
    }
  }
  return '';
}

function collectRoundIds(grades) {
  const ids = new Set();
  for (const grade of grades ?? []) {
    for (const round of grade.rounds ?? []) {
      const full = String(round.id || '').trim();
      const short = playHqShortId(full);
      if (full) ids.add(full);
      if (short) ids.add(short);
    }
  }
  return [...ids];
}

async function loadPlayHqWindow(url) {
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 900,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      images: false,
    },
  });
  try {
    await win.loadURL(url || 'https://www.playhq.com/afl/org/whyalla-football-league/822ecb01', {
      httpReferrer: 'https://www.playhq.com/',
    });
    for (let i = 0; i < 24; i += 1) {
      const ready = await win.webContents.executeJavaScript(
        `Boolean(document.body && document.body.innerText && document.body.innerText.length > 80)`,
        true
      );
      if (ready) break;
      await wait(250);
    }
    await wait(500);
    return win;
  } catch (error) {
    if (!win.isDestroyed()) win.destroy();
    throw error;
  }
}

async function gradeFixtureUrlFromGameCentre(win) {
  return win.webContents.executeJavaScript(
    `(() => {
      const link = [...document.querySelectorAll('a')].find((a) => /\\/R\\d+\\b/i.test(a.getAttribute('href') || ''));
      if (!link) return '';
      try {
        const url = new URL(link.href);
        url.pathname = url.pathname.replace(/\\/R\\d+\\/?$/i, '');
        return url.toString();
      } catch {
        return '';
      }
    })()`,
    true
  );
}

async function extractAliasesFromFixturePage(win) {
  return win.webContents.executeJavaScript(
    `(() => {
      function fiber(el) {
        const key = Object.keys(el || {}).find((k) => k.startsWith('__reactFiber'));
        return key ? el[key] : null;
      }
      const labelEl = [...document.querySelectorAll('span')].find((el) => {
        const text = (el.textContent || '').trim();
        return text && text === text.toUpperCase() && text.length > 3 && text.length < 70 &&
          /ROUND|CUP|SHIELD|TWILIGHT|WELLNESS|INDIGENOUS|MENTAL|SAFETY|PINK|SOCKS|CABBAN|BEATON/i.test(text);
      });
      const start = fiber(labelEl) || fiber(document.querySelector('main')) || fiber(document.body);
      let node = start;
      for (let depth = 0; node && depth < 60; depth += 1, node = node.return) {
        const props = node.memoizedProps || node.pendingProps;
        if (!props || typeof props !== 'object') continue;
        const keys = Object.keys(props);
        if (!keys.length || !keys.every((k) => /^\\d+$/.test(k))) continue;
        const out = [];
        for (const key of keys) {
          let raw = '';
          try { raw = JSON.stringify(props[key]); } catch { continue; }
          if (!raw.includes('DiscoverGame') && !raw.includes('alias')) continue;
          const roundNames = [...raw.matchAll(/"roundName":"([^"]+)"/g)].map((m) => m[1]);
          const aliases = [...raw.matchAll(/"alias":"([^"]+)"/g)].map((m) => m[1]);
          const ids = [...raw.matchAll(/"__typename":"DiscoverGame","id":"([^"]+)"/g)].map((m) => m[1]);
          if (!ids.length && !aliases.length) continue;
          out.push({
            roundName: roundNames[0] || '',
            aliases: [...new Set(aliases.filter(Boolean))],
            gameIds: [...new Set(ids.map((id) => String(id).toLowerCase()))],
          });
        }
        if (out.length) return out;
      }
      // Fallback: read visible specialty chips next to round headings from the DOM text flow
      const text = document.body?.innerText || '';
      const lines = text.split(/\\n+/).map((line) => line.trim()).filter(Boolean);
      const fallback = [];
      for (let i = 0; i < lines.length; i += 1) {
        const round = lines[i].match(/^(Round\\s+\\d+)$/i);
        if (!round) continue;
        const window = lines.slice(i, i + 16).join(' | ');
        const alias = window.match(
          /\\b((?:WELLNESS SISTERS|INDIGENOUS|MENTAL HEALTH MATTERS|THINK ROAD SAFETY|PINK SOCKS) ROUND|BEATON\\s*\\/?\\s*DEMPSEY SHIELD|CABBAN\\/HUISH CUP|TWILIGHT)\\b/i
        );
        if (alias) fallback.push({ roundName: round[1], aliases: [alias[1]], gameIds: [] });
      }
      return fallback;
    })()`,
    true
  );
}

async function fetchAliasesByRoundGraphql(win, roundIds) {
  if (!roundIds.length) return [];
  return win.webContents.executeJavaScript(
    `(async () => {
      const ids = ${JSON.stringify(roundIds)};
      const rows = [];
      for (const roundID of ids) {
        try {
          const res = await fetch('https://api.playhq.com/graphql', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-phq-tenant': 'afl',
              'x-phq-project': 'websites',
            },
            body: JSON.stringify({
              query: 'query($roundID: ID!) { discoverFixtureByRound(roundID: $roundID) { games { id alias } } }',
              variables: { roundID },
            }),
          });
          const json = await res.json();
          const games = json?.data?.discoverFixtureByRound?.games || [];
          const aliases = games.map((g) => g?.alias).filter(Boolean);
          const gameIds = games.map((g) => String(g?.id || '').toLowerCase()).filter(Boolean);
          if (aliases.length || gameIds.length) {
            rows.push({ roundID, aliases: [...new Set(aliases)], gameIds: [...new Set(gameIds)] });
          }
        } catch {
          /* try next round */
        }
      }
      return rows;
    })()`,
    true
  );
}

function canOverwriteSpecialty(round) {
  return round?.specialtySource !== 'manual';
}

function applyAliasMap(grades, aliasByGameId, specialtyByRoundName) {
  let applied = 0;
  for (const grade of grades ?? []) {
    for (const round of grade.rounds ?? []) {
      const fromName = specialtyByRoundName.get(String(round.name || '').toLowerCase()) || '';
      if (fromName && canOverwriteSpecialty(round) && round.specialtyName !== fromName) {
        round.specialtyName = fromName;
        round.specialtySource = 'playhq';
        applied += 1;
      }
      for (const game of round.games ?? []) {
        const shortId = playHqShortId(game.url) || playHqShortId(game.id);
        const alias =
          (shortId && aliasByGameId.get(shortId)) ||
          fromName ||
          (canOverwriteSpecialty(round) ? '' : normalizeSpecialtyName(game.alias));
        if (!alias) continue;
        if (game.alias !== alias && (canOverwriteSpecialty(round) || !game.alias)) {
          game.alias = alias;
          applied += 1;
        }
      }
      if (!round.specialtyName) {
        const derived = roundSpecialtyName(round);
        if (derived) {
          round.specialtyName = derived;
          round.specialtySource = 'playhq';
          applied += 1;
        }
      } else if (canOverwriteSpecialty(round)) {
        for (const game of round.games ?? []) {
          if (!game.alias) {
            game.alias = round.specialtyName;
            applied += 1;
          }
        }
      }
    }
  }
  return applied;
}

function mergeRowsIntoMaps(rows, aliasByGameId, specialtyByRoundName, roundIdToName) {
  for (const row of rows || []) {
    const specialty = normalizeSpecialtyName(row.aliases?.[0] || '');
    if (specialty && row.roundName) {
      specialtyByRoundName.set(String(row.roundName).toLowerCase(), specialty);
    }
    if (specialty && row.roundID && roundIdToName) {
      const name = roundIdToName.get(String(row.roundID).toLowerCase());
      if (name) specialtyByRoundName.set(String(name).toLowerCase(), specialty);
    }
    for (const id of row.gameIds || []) {
      const alias = specialty || normalizeSpecialtyName(row.aliases?.[0] || '');
      if (alias) aliasByGameId.set(String(id).toLowerCase(), alias);
    }
    for (let i = 0; i < (row.aliases || []).length; i += 1) {
      const id = row.gameIds?.[i];
      const alias = normalizeSpecialtyName(row.aliases[i]);
      if (id && alias) aliasByGameId.set(String(id).toLowerCase(), alias);
    }
  }
}

/**
 * Pull PlayHQ game aliases (Pink Socks / Wellness Sisters, Indigenous, etc.)
 * automatically during sync via a hidden Chromium window.
 */
export async function enrichSpecialtyRounds(grades, onProgress) {
  const sampleUrl = collectPlayHqSampleUrl(grades);
  const roundIds = collectRoundIds(grades);
  if (!sampleUrl && !roundIds.length) {
    return { ok: false, reason: 'no-playhq-url', applied: 0 };
  }

  const roundIdToName = new Map();
  for (const grade of grades ?? []) {
    for (const round of grade.rounds ?? []) {
      const full = String(round.id || '').toLowerCase();
      const short = playHqShortId(round.id);
      if (full) roundIdToName.set(full, round.name);
      if (short) roundIdToName.set(short, round.name);
    }
  }

  onProgress?.('Loading specialty rounds from PlayHQ…');
  let win;
  try {
    win = await loadPlayHqWindow(sampleUrl);
    const aliasByGameId = new Map();
    const specialtyByRoundName = new Map();

    onProgress?.('PlayHQ specialty rounds · GraphQL…');
    const graphqlRows = await fetchAliasesByRoundGraphql(win, roundIds.slice(0, 80));
    mergeRowsIntoMaps(graphqlRows, aliasByGameId, specialtyByRoundName, roundIdToName);

    if (sampleUrl) {
      onProgress?.('PlayHQ specialty rounds · fixture page…');
      await win.loadURL(sampleUrl, { httpReferrer: 'https://www.playhq.com/' });
      await wait(600);
      const gradeUrl = await gradeFixtureUrlFromGameCentre(win);
      if (gradeUrl) {
        await win.loadURL(gradeUrl, { httpReferrer: 'https://www.playhq.com/' });
        for (let i = 0; i < 24; i += 1) {
          const ready = await win.webContents.executeJavaScript(
            `Boolean(document.body && /Round\\s+\\d+/i.test(document.body.innerText || ''))`,
            true
          );
          if (ready) break;
          await wait(300);
        }
        await wait(800);
        const pageRows = (await extractAliasesFromFixturePage(win)) || [];
        mergeRowsIntoMaps(pageRows, aliasByGameId, specialtyByRoundName, roundIdToName);
      }
    }

    const applied = applyAliasMap(grades, aliasByGameId, specialtyByRoundName);
    return {
      ok: true,
      applied,
      rounds: specialtyByRoundName.size,
      games: aliasByGameId.size,
    };
  } catch (error) {
    return { ok: false, reason: String(error?.message || error), applied: 0 };
  } finally {
    if (win && !win.isDestroyed()) win.destroy();
  }
}
