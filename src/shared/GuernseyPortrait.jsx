import { useEffect, useRef } from 'react';
import guernseyUrl from './wfl-guernsey.png';
import './guernsey-portrait.css';

function findNeck(data, w, h) {
  const widths = new Array(h);
  for (let y = 0; y < h; y += 1) {
    let left = -1;
    let right = -1;
    const row = y * w * 4;
    for (let x = 0; x < w; x += 1) {
      if (data[row + x * 4 + 3] > 28) {
        if (left < 0) left = x;
        right = x;
      }
    }
    widths[y] = left < 0 ? 0 : right - left + 1;
  }
  let headW = 0;
  let headY = 0;
  const headLimit = Math.floor(h * 0.48);
  for (let y = Math.floor(h * 0.08); y < headLimit; y += 1) {
    if (widths[y] > headW) {
      headW = widths[y];
      headY = y;
    }
  }
  let neckY = Math.floor(h * 0.46);
  let neckW = widths[headY] || 1;
  let seenDip = false;
  const scanLimit = Math.floor(h * 0.72);
  for (let y = headY + 2; y < scanLimit; y += 1) {
    if (widths[y] > 0 && widths[y] <= neckW) {
      neckW = widths[y];
      neckY = y;
      seenDip = true;
    }
    if (seenDip && widths[y] > neckW * 1.18 && y > neckY + 4) break;
  }
  return neckY;
}

async function loadBitmap(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('image');
  return createImageBitmap(await response.blob());
}

function paint(canvas, face, jersey) {
  const wrap = canvas.parentElement;
  const rect = wrap.getBoundingClientRect();
  const w = Math.max(2, Math.round(rect.width));
  const h = Math.max(2, Math.round(rect.height));
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const scale = Math.max(w / face.width, h / face.height);
  const dw = face.width * scale;
  const dh = face.height * scale;
  ctx.drawImage(face, (w - dw) / 2, (h - dh) * 0.08, dw, dh);
  const neck = findNeck(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height) / dpr;
  const jw = w * 1.06;
  const jh = jw * (jersey.height / jersey.width);
  ctx.drawImage(jersey, (w - jw) / 2, neck - jh * 0.055, jw, jh);
}

export function GuernseyPortrait({ src, alt = '', className = '' }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    let cancel = false;
    let face;
    let jersey;
    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas || !face || !jersey || cancel) return;
      if (canvas.parentElement.getBoundingClientRect().width < 2) return;
      try {
        paint(canvas, face, jersey);
      } catch {
        /* keep the last frame if a photo cannot be read */
      }
    };
    (async () => {
      try {
        const [nextFace, nextJersey] = await Promise.all([loadBitmap(src), loadBitmap(guernseyUrl)]);
        if (cancel) {
          nextFace.close?.();
          nextJersey.close?.();
          return;
        }
        face = nextFace;
        jersey = nextJersey;
        draw();
      } catch {
        /* leave the frame empty rather than a broken photo */
      }
    })();
    const ro = new ResizeObserver(draw);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => {
      cancel = true;
      ro.disconnect();
      face?.close?.();
      jersey?.close?.();
    };
  }, [src]);

  return (
    <span ref={wrapRef} className={`guernsey-portrait${className ? ` ${className}` : ''}`}>
      <canvas ref={canvasRef} role="img" aria-label={alt} />
    </span>
  );
}
