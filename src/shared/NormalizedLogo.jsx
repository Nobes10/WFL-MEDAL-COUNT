import { useEffect, useState } from 'react';

function cropLogoToSquare(img, pad = 0.08) {
  const naturalW = img.naturalWidth || img.width;
  const naturalH = img.naturalHeight || img.height;
  if (!naturalW || !naturalH) return null;
  const maxSide = 256;
  const down = Math.min(1, maxSide / Math.max(naturalW, naturalH));
  const w = Math.max(1, Math.round(naturalW * down));
  const h = Math.max(1, Math.round(naturalH * down));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const sample = (x, y) => {
    const i = (Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  };
  let br = 0;
  let bg = 0;
  let bb = 0;
  let ba = 0;
  let n = 0;
  for (const [x, y] of [
    [1, 1],
    [w - 2, 1],
    [1, h - 2],
    [w - 2, h - 2],
  ]) {
    const [r, g, b, a] = sample(x, y);
    br += r;
    bg += g;
    bb += b;
    ba += a;
    n += 1;
  }
  const bgColor = { r: br / n, g: bg / n, b: bb / n, a: ba / n };
  const dist = (r, g, b, cr, cg, cb) => Math.abs(r - cr) + Math.abs(g - cg) + Math.abs(b - cb);
  let spread = 0;
  const cornerPx = [
    [1, 1],
    [w - 2, 1],
    [1, h - 2],
    [w - 2, h - 2],
  ].map(([x, y]) => sample(x, y));
  for (let i = 0; i < cornerPx.length; i += 1) {
    for (let j = i + 1; j < cornerPx.length; j += 1) {
      spread = Math.max(spread, dist(cornerPx[i][0], cornerPx[i][1], cornerPx[i][2], cornerPx[j][0], cornerPx[j][1], cornerPx[j][2]));
    }
  }
  const isMargin = (r, g, b, a) => {
    if (a < 18) return true;
    if (spread > 90 || bgColor.a < 40) return false;
    return dist(r, g, b, bgColor.r, bgColor.g, bgColor.b) < 36;
  };
  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (seen[i]) return;
    const p = i * 4;
    if (!isMargin(data[p], data[p + 1], data[p + 2], data[p + 3])) return;
    seen[i] = 1;
    stack.push(x, y);
  };
  for (let x = 0; x < w; x += 1) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y += 1) {
    push(0, y);
    push(w - 1, y);
  }
  while (stack.length) {
    const y = stack.pop();
    const x = stack.pop();
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  let found = false;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (seen[y * w + x]) continue;
      found = true;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (!found) return null;
  const inset = 4;
  minX = Math.max(0, minX - inset);
  minY = Math.max(0, minY - inset);
  maxX = Math.min(w - 1, maxX + inset);
  maxY = Math.min(h - 1, maxY + inset);
  const inner = 1 - pad * 2;
  const sx = (minX / w) * naturalW;
  const sy = (minY / h) * naturalH;
  const sw = ((maxX - minX + 1) / w) * naturalW;
  const sh = ((maxY - minY + 1) / h) * naturalH;
  const outSize = Math.min(512, Math.max(256, Math.round(Math.max(sw, sh) / inner)));
  const out = document.createElement('canvas');
  out.width = outSize;
  out.height = outSize;
  const draw = out.getContext('2d');
  if (!draw) return null;
  const box = outSize * inner;
  const scale = Math.min(box / sw, box / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  draw.drawImage(img, sx, sy, sw, sh, (outSize - dw) / 2, (outSize - dh) / 2, dw, dh);
  return out.toDataURL('image/png');
}

export function NormalizedLogo({ src, alt = '', pad = 0.08, className, crop = true }) {
  const [url, setUrl] = useState(src);
  useEffect(() => {
    setUrl(src);
  }, [src]);
  return (
    <img
      src={url}
      alt={alt}
      className={className}
      crossOrigin={url === src ? 'anonymous' : undefined}
      onLoad={(event) => {
        if (url !== src || !crop) return;
        try {
          const cropped = cropLogoToSquare(event.currentTarget, pad);
          if (cropped) setUrl(cropped);
        } catch {
          /* keep original if canvas is blocked */
        }
      }}
    />
  );
}
