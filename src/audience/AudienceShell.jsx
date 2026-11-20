import { useLayoutEffect } from 'react';

export const AUDIENCE_DESIGN_W = 1920;
export const AUDIENCE_DESIGN_H = 1080;

function readViewportSize() {
  const vv = window.visualViewport;
  const width = Math.max(1, Math.round(vv?.width ?? window.innerWidth));
  const height = Math.max(1, Math.round(vv?.height ?? window.innerHeight));
  return { width, height };
}

function applyAudienceScale() {
  const { width, height } = readViewportSize();
  const scale = Math.min(width / AUDIENCE_DESIGN_W, height / AUDIENCE_DESIGN_H);
  const root = document.documentElement;
  root.style.setProperty('--audience-scale', String(scale));
  root.style.setProperty('--audience-vw', `${width}px`);
  root.style.setProperty('--audience-vh', `${height}px`);
  root.dataset.audienceWidth = String(width);
  root.dataset.audienceHeight = String(height);
  root.dataset.audienceScale = scale.toFixed(4);
  root.dataset.audienceAspect =
    Math.abs(width / height - AUDIENCE_DESIGN_W / AUDIENCE_DESIGN_H) < 0.02
      ? 'match'
      : width / height > AUDIENCE_DESIGN_W / AUDIENCE_DESIGN_H
        ? 'wide'
        : 'tall';
}

/** Fixed 1920×1080 stage, scaled to fit the real display / OBS browser source. */
export function AudienceShell({ children }) {
  useLayoutEffect(() => {
    applyAudienceScale();
    const onResize = () => applyAudienceScale();
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('scroll', onResize);
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(onResize) : null;
    ro?.observe(document.documentElement);
    screen?.orientation?.addEventListener?.('change', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('scroll', onResize);
      screen?.orientation?.removeEventListener?.('change', onResize);
      ro?.disconnect();
    };
  }, []);

  return (
    <div className="audience-viewport">
      <div className="audience-stage">{children}</div>
    </div>
  );
}
