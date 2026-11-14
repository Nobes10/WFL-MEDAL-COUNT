export function playHqShortId(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const fromUrl = text.match(/\/game-centre\/([0-9a-f]{8})/i);
  if (fromUrl) return fromUrl[1].toLowerCase();
  const uuid = text.match(/^([0-9a-f]{8})(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);
  if (uuid) return uuid[1].toLowerCase();
  if (/^[0-9a-f]{8}$/i.test(text)) return text.toLowerCase();
  return '';
}

export function normalizeSpecialtyName(value) {
  const text = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, 80);
}

/** Pretty label for audience/control — keeps PlayHQ casing but title-cases all-caps. */
export function formatSpecialtyName(value) {
  const text = normalizeSpecialtyName(value);
  if (!text) return '';
  if (text !== text.toUpperCase()) return text;
  return text
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
    .replace(/\b(Afl|Wwfl|Wfl)\b/g, (m) => m.toUpperCase());
}

export function specialtyAssetKey(value) {
  return normalizeSpecialtyName(value).toLowerCase();
}

export function specialtyThemeFromName(value) {
  const text = normalizeSpecialtyName(value).toLowerCase();
  if (!text) return null;
  if (/pink\s*socks|wellness\s*sisters|breast\s*cancer|women'?s\s*health/.test(text)) return 'pink';
  if (/indigenous|aboriginal|first\s*nations|naidoc/.test(text)) return 'indigenous';
  if (/mental\s*health|r?uok|mind|wellbeing/.test(text)) return 'mental';
  if (/road\s*safety|think\s*road|tac\b/.test(text)) return 'safety';
  if (/twilight/.test(text)) return 'twilight';
  if (/cup|shield|trophy/.test(text)) return 'cup';
  return 'special';
}

export function roundSpecialtyName(round) {
  if (!round) return '';
  const named = normalizeSpecialtyName(round.specialtyName);
  if (named) return named;
  const counts = new Map();
  for (const game of round.games ?? []) {
    const alias = normalizeSpecialtyName(game.alias);
    if (!alias) continue;
    counts.set(alias, (counts.get(alias) || 0) + 1);
  }
  let best = '';
  let bestCount = 0;
  for (const [alias, count] of counts) {
    if (count > bestCount) {
      best = alias;
      bestCount = count;
    }
  }
  return best;
}

export function displayRoundTitle(round, { includeNumber = true } = {}) {
  const specialty = formatSpecialtyName(roundSpecialtyName(round));
  const name = String(round?.name || '').trim();
  if (specialty && includeNumber && name) return `${name} · ${specialty}`;
  if (specialty) return specialty;
  return name;
}

function clampByte(value) {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((n) => clampByte(n).toString(16).padStart(2, '0')).join('')}`;
}

function parseHexColor(value) {
  const text = String(value || '').trim();
  const match = text.match(/^#([0-9a-f]{6})$/i);
  if (!match) return null;
  const n = Number.parseInt(match[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function normalizeSpecialtyColors(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const a = parseHexColor(raw.a || raw.primary);
  const b = parseHexColor(raw.b || raw.secondary);
  const bg = parseHexColor(raw.bg || raw.background);
  if (!a || !b || !bg) return null;
  return { a: rgbToHex(a.r, a.g, a.b), b: rgbToHex(b.r, b.g, b.b), bg: rgbToHex(bg.r, bg.g, bg.b) };
}

function normalizeRoundName(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

export function mergeSpecialtyAssets(raw = {}) {
  const incoming = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const next = {};
  for (const [rawKey, value] of Object.entries(incoming)) {
    if (!value || typeof value !== 'object') continue;
    const label = formatSpecialtyName(value.label || rawKey);
    const key = specialtyAssetKey(label || rawKey);
    if (!key) continue;
    const pinFile = value.pinFile ? String(value.pinFile) : null;
    const colors = normalizeSpecialtyColors(value.colors);
    const photoColors = normalizeSpecialtyColors(value.photoColors) || colors;
    const roundName = normalizeRoundName(value.roundName) || null;
    const websiteRoundName = normalizeRoundName(value.websiteRoundName) || null;
    next[key] = {
      label: label || key,
      pinFile,
      colors,
      photoColors,
      roundName,
      websiteRoundName,
    };
  }
  return next;
}

export function resolveSpecialtyAsset(settings, specialtyName) {
  const key = specialtyAssetKey(specialtyName);
  if (!key) return null;
  const assets = mergeSpecialtyAssets(settings?.specialtyAssets);
  return assets[key] || null;
}

export function specialtyPresentation(settings, specialtyName, roundPinFile = null) {
  const label = formatSpecialtyName(specialtyName);
  if (!label) {
    return {
      specialtyName: null,
      specialtyTheme: null,
      specialtyPinFile: null,
      specialtyColors: null,
    };
  }
  const asset = resolveSpecialtyAsset(settings, label);
  const colors = asset?.colors || null;
  return {
    specialtyName: label,
    specialtyTheme: colors ? 'themed' : specialtyThemeFromName(label),
    specialtyPinFile: asset?.pinFile || roundPinFile || null,
    specialtyColors: colors,
  };
}

function isFinalsRoundLike(round) {
  if (round?.isFinal) return true;
  const name = `${round?.name ?? ''} ${round?.abbreviatedName ?? ''}`.toLowerCase();
  return /\bfinals?\b/.test(name);
}

export function listRoundNameOptions(grades, { includeFinals = true, keepNames = [] } = {}) {
  const keep = new Set(
    (keepNames ?? [])
      .map((name) => normalizeRoundName(name).toLowerCase())
      .filter(Boolean)
  );
  const seen = new Map();
  for (const grade of grades ?? []) {
    for (const round of grade.rounds ?? []) {
      const name = normalizeRoundName(round.name);
      if (!name) continue;
      if (!includeFinals && isFinalsRoundLike(round) && !keep.has(name.toLowerCase())) continue;
      const key = name.toLowerCase();
      if (!seen.has(key)) seen.set(key, name);
    }
  }
  return [...seen.values()].sort((left, right) => {
    const leftNum = Number((left.match(/\d+/) || [])[0]);
    const rightNum = Number((right.match(/\d+/) || [])[0]);
    if (Number.isFinite(leftNum) && Number.isFinite(rightNum) && leftNum !== rightNum) {
      return leftNum - rightNum;
    }
    return left.localeCompare(right);
  });
}

function mostCommonRoundName(counts) {
  let best = '';
  let bestCount = 0;
  for (const [name, count] of counts) {
    if (count > bestCount) {
      best = name;
      bestCount = count;
    }
  }
  return best;
}

/** Record where PlayHQ placed each specialty so the UI can default the round dropdown. */
export function rememberSpecialtyWebsiteRounds(grades, settings) {
  const assets = mergeSpecialtyAssets(settings?.specialtyAssets);
  const countsByKey = new Map();

  for (const grade of grades ?? []) {
    for (const round of grade.rounds ?? []) {
      if (round.specialtySource === 'manual') continue;
      const label = formatSpecialtyName(roundSpecialtyName(round));
      if (!label) continue;
      const key = specialtyAssetKey(label);
      const roundName = normalizeRoundName(round.name);
      if (!roundName) continue;
      if (!countsByKey.has(key)) countsByKey.set(key, { label, counts: new Map() });
      const entry = countsByKey.get(key);
      entry.counts.set(roundName, (entry.counts.get(roundName) || 0) + 1);
    }
  }

  let changed = false;
  for (const [key, entry] of countsByKey) {
    const websiteRoundName = mostCommonRoundName(entry.counts);
    const current = assets[key] || {
      label: entry.label,
      pinFile: null,
      colors: null,
      photoColors: null,
      roundName: null,
      websiteRoundName: null,
    };
    if (current.websiteRoundName !== websiteRoundName || current.label !== entry.label) {
      assets[key] = {
        ...current,
        label: entry.label,
        websiteRoundName,
      };
      changed = true;
    } else if (!assets[key]) {
      assets[key] = current;
      changed = true;
    }
  }

  return { assets, changed };
}

/**
 * Apply user round overrides from settings.
 * Assets with roundName set move that specialty onto matching rounds (all grades).
 * Empty roundName means keep / restore the PlayHQ website round.
 */
export function applySpecialtyRoundOverrides(grades, settings) {
  const assets = mergeSpecialtyAssets(settings?.specialtyAssets);
  let changed = false;

  for (const [key, asset] of Object.entries(assets)) {
    const label = formatSpecialtyName(asset.label || key);
    if (!label) continue;
    const overrideRound = normalizeRoundName(asset.roundName);
    const websiteRound = normalizeRoundName(asset.websiteRoundName);
    const targetRound = overrideRound || websiteRound;
    if (!targetRound) continue;
    const manual = Boolean(overrideRound);

    for (const grade of grades ?? []) {
      for (const round of grade.rounds ?? []) {
        const roundName = normalizeRoundName(round.name);
        const onTarget = roundName.toLowerCase() === targetRound.toLowerCase();
        const currentKey = specialtyAssetKey(roundSpecialtyName(round));
        const isThis = currentKey === key;

        if (onTarget) {
          if (round.specialtyName !== label || (manual && round.specialtySource !== 'manual')) {
            round.specialtyName = label;
            round.specialtySource = manual ? 'manual' : round.specialtySource || 'playhq';
            for (const game of round.games ?? []) {
              game.alias = label;
            }
            changed = true;
          } else {
            for (const game of round.games ?? []) {
              if (!game.alias) {
                game.alias = label;
                changed = true;
              }
            }
          }
          continue;
        }

        if (!isThis) continue;
        if (manual || round.specialtySource === 'manual') {
          round.specialtyName = '';
          round.specialtySource = '';
          for (const game of round.games ?? []) {
            if (specialtyAssetKey(game.alias) === key) game.alias = '';
          }
          changed = true;
        }
      }
    }
  }

  return changed;
}

export function listSpecialtyCatalog(grades, settings) {
  const assets = mergeSpecialtyAssets(settings?.specialtyAssets);
  const includeFinals = Boolean(settings?.showFinals);
  const map = new Map();

  for (const [key, asset] of Object.entries(assets)) {
    map.set(key, {
      key,
      label: asset.label || key,
      pinFile: asset.pinFile || null,
      colors: asset.colors || null,
      photoColors: asset.photoColors || null,
      roundName: asset.roundName || null,
      websiteRoundName: asset.websiteRoundName || null,
    });
  }

  for (const grade of grades ?? []) {
    for (const round of grade.rounds ?? []) {
      const label = formatSpecialtyName(roundSpecialtyName(round));
      if (!label) continue;
      const key = specialtyAssetKey(label);
      const existing = map.get(key);
      const roundName = normalizeRoundName(round.name);
      if (existing) {
        if (!existing.label) existing.label = label;
        if (!existing.websiteRoundName && round.specialtySource !== 'manual' && roundName) {
          existing.websiteRoundName = roundName;
        }
        continue;
      }
      map.set(key, {
        key,
        label,
        pinFile: null,
        colors: null,
        photoColors: null,
        roundName: null,
        websiteRoundName: round.specialtySource === 'manual' ? null : roundName,
      });
    }
  }

  return [...map.values()]
    .map((item) => {
      const effectiveRound = item.roundName || item.websiteRoundName || '';
      return {
        ...item,
        roundOptions: listRoundNameOptions(grades, {
          includeFinals,
          keepNames: effectiveRound ? [effectiveRound] : [],
        }),
        effectiveRoundName: effectiveRound,
        roundIsDefault: !item.roundName,
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label));
}

/** Move legacy per-round pin files into settings.specialtyAssets. */
export function migrateRoundSpecialtyPins(store, resolvePinPath, extractColors) {
  if (!store || typeof store !== 'object') return false;
  const assets = mergeSpecialtyAssets(store.settings?.specialtyAssets);
  let changed = false;

  for (const grade of store.grades ?? []) {
    for (const round of grade.rounds ?? []) {
      const pinFile = round.specialtyPinFile ? String(round.specialtyPinFile) : '';
      if (!pinFile) continue;
      const label = formatSpecialtyName(roundSpecialtyName(round));
      const key = specialtyAssetKey(label || pinFile);
      if (!key) continue;
      if (!assets[key]?.pinFile) {
        const fullPath = typeof resolvePinPath === 'function' ? resolvePinPath(pinFile) : null;
        const colors =
          assets[key]?.colors ||
          (fullPath && typeof extractColors === 'function' ? extractColors(fullPath) : null);
        assets[key] = {
          label: label || assets[key]?.label || key,
          pinFile,
          colors,
          photoColors: colors,
          roundName: assets[key]?.roundName || null,
          websiteRoundName: assets[key]?.websiteRoundName || normalizeRoundName(round.name) || null,
        };
        changed = true;
      }
      round.specialtyPinFile = null;
      changed = true;
    }
  }

  if (changed) {
    store.settings = {
      ...(store.settings || {}),
      specialtyAssets: assets,
    };
  }
  return changed;
}
