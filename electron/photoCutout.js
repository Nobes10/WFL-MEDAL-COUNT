import { existsSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
import { dirname, join } from 'path';
import { pathToFileURL } from 'url';
import sharp from 'sharp';

let removeBackgroundFn = null;
let imglyPublicPathCache = null;

const requireFromHere = createRequire(import.meta.url);

/** Prefer real disk paths — Electron packs models under app.asar.unpacked. */
function toUnpackedPath(filePath) {
  return String(filePath || '').replace(/app\.asar(?!\.unpacked)/g, 'app.asar.unpacked');
}

/**
 * @imgly defaults publicPath to cwd/node_modules/… which is missing in the
 * GitHub installer. Point at the packaged dist folder that holds resources.json.
 */
function resolveImglyPublicPath() {
  if (imglyPublicPathCache) return imglyPublicPathCache;

  const candidates = [];
  try {
    const entry = requireFromHere.resolve('@imgly/background-removal-node');
    candidates.push(dirname(entry));
  } catch {
    /* ignore — try resourcesPath / cwd next */
  }
  if (process.resourcesPath) {
    candidates.push(
      join(
        process.resourcesPath,
        'app.asar.unpacked',
        'node_modules',
        '@imgly',
        'background-removal-node',
        'dist'
      )
    );
  }
  candidates.push(
    join(process.cwd(), 'node_modules', '@imgly', 'background-removal-node', 'dist')
  );

  for (const raw of candidates) {
    if (!raw) continue;
    for (const dir of [toUnpackedPath(raw), raw]) {
      if (existsSync(join(dir, 'resources.json'))) {
        const url = pathToFileURL(dir).href;
        imglyPublicPathCache = url.endsWith('/') ? url : `${url}/`;
        return imglyPublicPathCache;
      }
    }
  }

  throw new Error(
    'Background-removal models not found. Reinstall the app or run from the project with node_modules installed.'
  );
}

async function getRemoveBackground() {
  if (removeBackgroundFn) return removeBackgroundFn;
  const mod = await import('@imgly/background-removal-node');
  removeBackgroundFn = mod.removeBackground;
  return removeBackgroundFn;
}

/**
 * Brick-wall RED spill only.
 * Never treat yellow/gold as fringe — team sashes (e.g. WWFC) and logos use those colours.
 */
function isBrickRedFringe(r, g, b) {
  // Neon / pure brick red
  if (r >= 120 && g <= 55 && b <= 55 && r >= g + 55 && r >= b + 55) return true;
  // Terracotta brick (still clearly red-dominant, not gold sash)
  if (r >= 150 && g <= 85 && b <= 50 && r >= g + 55 && r >= b + 80 && g >= b) return true;
  return false;
}

function clearPixel(buf, i) {
  buf[i] = 0;
  buf[i + 1] = 0;
  buf[i + 2] = 0;
  buf[i + 3] = 0;
}

/** Transparent pixels reachable from the image border (exterior matte only). */
function exteriorAlphaMask(data, width, height) {
  const exterior = new Uint8Array(width * height);
  const stack = [];

  const tryPush = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (exterior[idx]) return;
    if (data[idx * 4 + 3] >= 40) return;
    exterior[idx] = 1;
    stack.push(idx);
  };

  for (let x = 0; x < width; x += 1) {
    tryPush(x, 0);
    tryPush(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    tryPush(0, y);
    tryPush(width - 1, y);
  }

  while (stack.length) {
    const idx = stack.pop();
    const x = idx % width;
    const y = (idx / width) | 0;
    tryPush(x - 1, y);
    tryPush(x + 1, y);
    tryPush(x, y - 1);
    tryPush(x, y + 1);
  }

  return exterior;
}

function nearExterior(exterior, width, height, x, y, radius) {
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) return true;
      if (exterior[ny * width + nx]) return true;
    }
  }
  return false;
}

/**
 * Remove small neon-red brick blobs that only sit on the outer silhouette.
 * Does not touch yellow/gold jersey colours.
 */
function removeExteriorRedIslands(buf, width, height, maxSize = 600) {
  const exterior = exteriorAlphaMask(buf, width, height);
  const seen = new Uint8Array(width * height);
  const out = Buffer.from(buf);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const start = y * width + x;
      if (seen[start]) continue;
      const i0 = start * 4;
      if (out[i0 + 3] < 40 || !isBrickRedFringe(out[i0], out[i0 + 1], out[i0 + 2])) {
        seen[start] = 1;
        continue;
      }

      const stack = [start];
      const component = [];
      let touchesExterior = nearExterior(exterior, width, height, x, y, 2);
      seen[start] = 1;

      while (stack.length) {
        const idx = stack.pop();
        component.push(idx);
        const cx = idx % width;
        const cy = (idx / width) | 0;
        if (nearExterior(exterior, width, height, cx, cy, 2)) touchesExterior = true;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (!dx && !dy) continue;
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const nidx = ny * width + nx;
            if (seen[nidx]) continue;
            const ni = nidx * 4;
            if (out[ni + 3] < 40 || !isBrickRedFringe(out[ni], out[ni + 1], out[ni + 2])) {
              seen[nidx] = 1;
              continue;
            }
            seen[nidx] = 1;
            stack.push(nidx);
          }
        }
      }

      if (touchesExterior && component.length <= maxSize) {
        for (const idx of component) clearPixel(out, idx * 4);
      }
    }
  }

  return out;
}

/** Tighten the matte and strip red brick halo — leave yellow/gold jersey colour alone. */
export async function cleanCutoutBuffer(inputBuffer) {
  const { data, info } = await sharp(inputBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  let out = Buffer.from(data);

  // Drop near-invisible coverage and zero RGB on clear pixels.
  for (let i = 0; i < out.length; i += 4) {
    if (out[i + 3] < 36) clearPixel(out, i);
  }

  // Peel red brick fringe on the outer silhouette only (never walk through jersey colours).
  for (let pass = 0; pass < 3; pass += 1) {
    const exterior = exteriorAlphaMask(out, width, height);
    const next = Buffer.from(out);
    const radius = pass === 0 ? 2 : 3;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4;
        const a = out[i + 3];
        if (a === 0) continue;
        if (!nearExterior(exterior, width, height, x, y, radius)) continue;

        const r = out[i];
        const g = out[i + 1];
        const b = out[i + 2];

        if (isBrickRedFringe(r, g, b)) {
          clearPixel(next, i);
          continue;
        }

        // Harden weak exterior matte so leftover halo can't show.
        if (a < 140) clearPixel(next, i);
        else if (a < 220) next[i + 3] = 255;
      }
    }
    out = next;
  }

  out = removeExteriorRedIslands(out, width, height, 800);

  // Light soft-edge erode beside transparent neighbours (alpha only — no colour kills).
  {
    const eroded = Buffer.from(out);
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const i = (y * width + x) * 4;
        const a = out[i + 3];
        if (a === 0 || a >= 250) continue;

        let minA = a;
        let clearNear = false;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (!dx && !dy) continue;
            const na = out[((y + dy) * width + (x + dx)) * 4 + 3];
            if (na < minA) minA = na;
            if (na < 40) clearNear = true;
          }
        }

        if (clearNear && isBrickRedFringe(out[i], out[i + 1], out[i + 2])) {
          clearPixel(eroded, i);
          continue;
        }

        if (clearNear && minA < a) {
          const nextA = Math.round(a * 0.5 + minA * 0.5);
          if (nextA < 40) clearPixel(eroded, i);
          else eroded[i + 3] = nextA;
        }
      }
    }
    out = eroded;
  }

  for (let i = 0; i < out.length; i += 4) {
    if (out[i + 3] === 0) {
      out[i] = 0;
      out[i + 1] = 0;
      out[i + 2] = 0;
    }
  }

  return sharp(out, { raw: { width, height, channels: 4 } })
    .webp({ quality: 92, alphaQuality: 100 })
    .toBuffer();
}

/** Cut the subject out of a photo. Writes a transparent WebP like MatchDay portraits. */
export async function cutOutPlayerPhoto(sourcePath, destPath) {
  const removeBackground = await getRemoveBackground();
  const src = String(sourcePath || '');
  if (!src || !existsSync(src)) {
    throw new Error(`Photo file not found: ${src || '(empty path)'}`);
  }
  const blob = await removeBackground(pathToFileURL(src), {
    model: 'medium',
    publicPath: resolveImglyPublicPath(),
    // Main-process Electron: workers lose the packaged model path.
    proxyToWorker: false,
    output: { format: 'image/png', quality: 1 },
  });
  const raw = Buffer.from(await blob.arrayBuffer());
  if (!raw.length) throw new Error('Background removal returned an empty image');
  const cleaned = await cleanCutoutBuffer(raw);
  writeFileSync(destPath, cleaned);
  return destPath;
}
