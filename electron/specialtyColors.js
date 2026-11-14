import { nativeImage } from 'electron';
import { normalizeSpecialtyColors } from './specialty.js';

function clampByte(value) {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((n) => clampByte(n).toString(16).padStart(2, '0')).join('')}`;
}

function colorDistance(a, b) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function darkenRgb(color, factor) {
  return {
    r: clampByte(color.r * factor),
    g: clampByte(color.g * factor),
    b: clampByte(color.b * factor),
  };
}

function saturation(color) {
  const max = Math.max(color.r, color.g, color.b);
  const min = Math.min(color.r, color.g, color.b);
  if (max === 0) return 0;
  return (max - min) / max;
}

/** Pull accent + background colours from a specialty pin image. */
export function extractSpecialtyColors(filePath) {
  try {
    const image = nativeImage.createFromPath(filePath);
    if (!image || image.isEmpty()) return null;
    const size = image.getSize();
    const width = Math.max(1, Math.min(48, size.width || 48));
    const height = Math.max(1, Math.min(48, size.height || 48));
    const sample = image.resize({ width, height, quality: 'better' });
    const bitmap = sample.toBitmap();
    const buckets = new Map();

    for (let i = 0; i + 3 < bitmap.length; i += 4) {
      const blue = bitmap[i];
      const green = bitmap[i + 1];
      const red = bitmap[i + 2];
      const alpha = bitmap[i + 3];
      if (alpha < 140) continue;
      const max = Math.max(red, green, blue);
      const min = Math.min(red, green, blue);
      if (max < 36 || min > 230) continue;
      if (max - min < 24) continue;
      const key = `${red >> 4},${green >> 4},${blue >> 4}`;
      const entry = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 };
      entry.r += red;
      entry.g += green;
      entry.b += blue;
      entry.n += 1;
      buckets.set(key, entry);
    }

    const ranked = [...buckets.values()]
      .map((entry) => {
        const color = {
          r: Math.round(entry.r / entry.n),
          g: Math.round(entry.g / entry.n),
          b: Math.round(entry.b / entry.n),
          n: entry.n,
        };
        return { ...color, sat: saturation(color), score: entry.n * (0.55 + saturation(color)) };
      })
      .sort((left, right) => right.score - left.score);

    const primary = ranked[0] || { r: 232, g: 121, b: 168 };
    const secondary =
      ranked.find((color) => colorDistance(color, primary) > 48) || darkenRgb(primary, 0.55);
    // Base stage fill follows the predominant colour, not the secondary accent.
    const background = darkenRgb(primary, 0.16);

    return normalizeSpecialtyColors({
      a: rgbToHex(primary.r, primary.g, primary.b),
      b: rgbToHex(secondary.r, secondary.g, secondary.b),
      bg: rgbToHex(background.r, background.g, background.b),
    });
  } catch {
    return null;
  }
}
