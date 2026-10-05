import { useLayoutEffect, useRef } from 'react';
import { TOTY_REVEAL_LINES, totyRevealedIds } from '../../electron/constants.js';
import './toty-pitch.css';

const BOX_STRETCH = 1.1;

function shrinkToBox(node, box, minPx) {
  if (!node || !box) return;
  const limit = box.clientWidth;
  if (limit <= 0) return;
  let size = parseFloat(getComputedStyle(node).fontSize);
  if (!Number.isFinite(size)) return;
  const tooWide = () => node.scrollWidth > limit + 1;
  if (tooWide()) {
    node.style.letterSpacing = '0';
    size = Math.max(minPx, size * (limit / node.scrollWidth) * 0.96);
    node.style.fontSize = `${size}px`;
  }
  let guard = 24;
  while (tooWide() && size > minPx && guard--) {
    size = Math.max(minPx, size - 0.25);
    node.style.fontSize = `${size}px`;
  }
}

function fitTexts(root) {
  const names = root.querySelector('.toty-names');
  if (!names) return;
  shrinkToBox(names.querySelector('strong'), names, 8);
  shrinkToBox(names.querySelector('small'), names, 7);
  shrinkToBox(names.querySelector('em'), names, 8);
}

function fitSpot(spot) {
  const names = spot.querySelector('.toty-names');
  const name = names?.querySelector('strong');
  const club = names?.querySelector('small');
  spot.style.width = '';
  spot.style.maxWidth = '';
  spot.style.gridTemplateColumns = '';
  if (names) {
    names.style.minWidth = '';
    names.style.overflow = '';
  }
  if (name) {
    name.style.fontSize = '';
    name.style.letterSpacing = '';
    name.style.whiteSpace = 'nowrap';
  }
  if (club) {
    club.style.fontSize = '';
    club.style.letterSpacing = '';
    club.style.whiteSpace = 'nowrap';
  }

  const base = spot.getBoundingClientRect().width;
  if (!base) return;
  const cap = base * BOX_STRETCH;

  if (names) {
    names.style.minWidth = 'max-content';
    names.style.overflow = 'visible';
  }
  spot.style.gridTemplateColumns = 'auto max-content';
  spot.style.maxWidth = 'none';
  spot.style.width = 'max-content';
  const needed = spot.getBoundingClientRect().width;
  if (names) {
    names.style.minWidth = '';
    names.style.overflow = '';
  }
  spot.style.gridTemplateColumns = '';
  spot.style.maxWidth = `${cap}px`;
  spot.style.width = `${Math.min(Math.max(base, needed), cap)}px`;

  fitTexts(spot);
}

export const TOTY_FIELD_SPOTS = [
  { id: 'fp-l', label: 'FP', name: 'Forward pocket', x: 18, y: 20 },
  { id: 'ff', label: 'FF', name: 'Full forward', x: 50, y: 9 },
  { id: 'fp-r', label: 'FP', name: 'Forward pocket', x: 82, y: 20 },
  { id: 'hff-l', label: 'HF', name: 'Half-forward flank', x: 15, y: 36 },
  { id: 'chf', label: 'CHF', name: 'Centre half-forward', x: 50, y: 32 },
  { id: 'hff-r', label: 'HF', name: 'Half-forward flank', x: 85, y: 36 },
  { id: 'w-l', label: 'W', name: 'Wing', x: 10, y: 50 },
  { id: 'c', label: 'C', name: 'Centre', x: 50, y: 50 },
  { id: 'w-r', label: 'W', name: 'Wing', x: 90, y: 50 },
  { id: 'hbf-l', label: 'HB', name: 'Half-back flank', x: 15, y: 64 },
  { id: 'chb', label: 'CHB', name: 'Centre half-back', x: 50, y: 68 },
  { id: 'hbf-r', label: 'HB', name: 'Half-back flank', x: 85, y: 64 },
  { id: 'bp-l', label: 'BP', name: 'Back pocket', x: 18, y: 80 },
  { id: 'fb', label: 'FB', name: 'Full back', x: 50, y: 91 },
  { id: 'bp-r', label: 'BP', name: 'Back pocket', x: 82, y: 80 },
];

export const TOTY_FOLLOWER_SPOTS = [
  { id: 'ruck', label: 'R', name: 'Ruck' },
  { id: 'rr', label: 'RR', name: 'Ruck rover' },
  { id: 'rov', label: 'ROV', name: 'Rover' },
];

export const TOTY_BENCH_SPOTS = [
  { id: 'int-1', label: 'INT', name: 'Interchange 1' },
  { id: 'int-2', label: 'INT', name: 'Interchange 2' },
  { id: 'int-3', label: 'INT', name: 'Interchange 3' },
  { id: 'int-4', label: 'INT', name: 'Interchange 4' },
];

function lerp(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function quadAt(p0, p1, p2, t) {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

function quadSegment(p0, p1, p2, t0, t1) {
  const start = quadAt(p0, p1, p2, t0);
  const end = quadAt(p0, p1, p2, t1);
  const rightCtrl = lerp(p1, p2, t0);
  const s = (t1 - t0) / (1 - t0);
  const ctrl = lerp(start, rightCtrl, s);
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} Q ${ctrl.x.toFixed(2)} ${ctrl.y.toFixed(2)} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

function ArcWithFifties({ p0, p1, p2, color }) {
  const left = quadAt(p0, p1, p2, 0.16);
  const right = quadAt(p0, p1, p2, 0.84);
  return (
    <g>
      <path d={quadSegment(p0, p1, p2, 0, 0.09)} fill="none" stroke={color} strokeWidth="1.2" />
      <path d={quadSegment(p0, p1, p2, 0.23, 0.77)} fill="none" stroke={color} strokeWidth="1.2" />
      <path d={quadSegment(p0, p1, p2, 0.91, 1)} fill="none" stroke={color} strokeWidth="1.2" />
      <text x={left.x} y={left.y} className="afl-50" fill={color} textAnchor="middle" dominantBaseline="middle">
        50
      </text>
      <text x={right.x} y={right.y} className="afl-50" fill={color} textAnchor="middle" dominantBaseline="middle">
        50
      </text>
    </g>
  );
}

function GoalPosts({ y, up }) {
  return (
    <g fill="#f4f4f4" stroke="#d0d0d0" strokeWidth="0.15">
      <rect x="42.8" y={up ? y - 7 : y} width="1.15" height="7" rx="0.2" />
      <rect x="47.15" y={up ? y - 10 : y} width="1.4" height="10" rx="0.2" />
      <rect x="51.45" y={up ? y - 10 : y} width="1.4" height="10" rx="0.2" />
      <rect x="56.05" y={up ? y - 7 : y} width="1.15" height="7" rx="0.2" />
    </g>
  );
}

function FieldMarkings() {
  return (
    <svg className="afl-lines" viewBox="0 0 100 132" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <clipPath id="afl-oval">
          <ellipse cx="50" cy="66" rx="47.2" ry="55.2" />
        </clipPath>
        <pattern id="afl-mow" width="100" height="7.2" patternUnits="userSpaceOnUse">
          <rect width="100" height="3.6" fill="#3db54a" />
          <rect y="3.6" width="100" height="3.6" fill="#2c9a3b" />
        </pattern>
      </defs>
      <ellipse cx="50" cy="66" rx="47.2" ry="55.2" fill="url(#afl-mow)" />
      <g clipPath="url(#afl-oval)" fill="none">
        <rect x="45" y="10.9" width="10" height="6.6" stroke="#fff" strokeWidth="0.7" />
        <rect x="32.8" y="49.4" width="34.4" height="33.2" stroke="#fff" strokeWidth="0.75" />
        <circle cx="50" cy="66" r="8.2" stroke="#fff" strokeWidth="0.85" />
        <line x1="41.8" y1="66" x2="58.2" y2="66" stroke="#fff" strokeWidth="0.85" />
        <rect x="45" y="114.5" width="10" height="6.6" stroke="#fff" strokeWidth="0.7" />
      </g>
      <g clipPath="url(#afl-oval)">
        <ArcWithFifties p0={{ x: 13, y: 27 }} p1={{ x: 50, y: 44.3 }} p2={{ x: 87, y: 27 }} color="#2f6fe4" />
        <ArcWithFifties p0={{ x: 13, y: 105 }} p1={{ x: 50, y: 87.7 }} p2={{ x: 87, y: 105 }} color="#e11d2e" />
      </g>
      <ellipse cx="50" cy="66" rx="47.2" ry="55.2" fill="none" stroke="#fff" strokeWidth="1.45" />
      <GoalPosts y={10.8} up />
      <GoalPosts y={121.2} up={false} />
    </svg>
  );
}

function nameParts(player) {
  const first = String(player?.firstName || '').trim();
  const last = String(player?.lastName || '').trim();
  if (first || last) return { first: first || last, last: first ? last : '' };
  const parts = String(player?.name || '').trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] || '', last: parts.slice(1).join(' ') };
}

function PlayerCard({ player, pos, showRole }) {
  const { first, last } = nameParts(player);
  const photo = player?.photoUrl;
  const logo = player?.logoUrl;
  const useLogo = Boolean(player && !photo && logo);
  return (
    <>
      <span className={`toty-frame${useLogo ? ' is-logo' : ''}`}>
        {photo ? (
          <img src={photo} alt="" />
        ) : useLogo ? (
          <img src={logo} alt="" />
        ) : (
          <i>{pos.label}</i>
        )}
        <span className="toty-tab">
          {logo ? <img src={logo} alt="" /> : <b>W</b>}
        </span>
      </span>
      <span className="toty-names">
        {showRole ? <em>{pos.name}</em> : null}
        {player ? (
          <>
            <strong>
              {first}
              {last ? (
                <>
                  <br />
                  {last}
                </>
              ) : null}
            </strong>
            <small>{player.clubName}</small>
          </>
        ) : (
          <strong>{showRole ? pos.name : pos.label}</strong>
        )}
      </span>
    </>
  );
}

function FieldSpot({ pos, player, onPick, justIn }) {
  const className = `toty-spot${player ? ' filled' : ''}${justIn ? ' just-in' : ''}`;
  const style = { left: `${pos.x}%`, top: `${pos.y}%` };
  const body = <PlayerCard player={player} pos={pos} />;
  if (onPick) {
    return (
      <button type="button" className={className} style={style} onClick={() => onPick(pos)} title={pos.name}>
        {body}
      </button>
    );
  }
  return (
    <div className={className} style={style}>
      {body}
    </div>
  );
}

function SideSlot({ pos, player, onPick, justIn }) {
  const className = `toty-side-slot${player ? ' filled' : ''}${justIn ? ' just-in' : ''}`;
  const body = <PlayerCard player={player} pos={pos} showRole />;
  if (onPick) {
    return (
      <button type="button" className={className} onClick={() => onPick(pos)} title={pos.name}>
        {body}
      </button>
    );
  }
  return <div className={className}>{body}</div>;
}

export function TotyPitch({ picks = {}, onPick, children, revealStep }) {
  const pitchRef = useRef(null);
  const presenting = Number.isFinite(revealStep);
  const revealed = presenting ? new Set(totyRevealedIds(revealStep)) : null;
  const currentSpots =
    presenting && revealStep > 0 ? new Set(TOTY_REVEAL_LINES[revealStep - 1]?.spots ?? []) : null;
  const showSpot = (id) => !revealed || revealed.has(id);
  const showSection = (spots) => !revealed || spots.some((pos) => revealed.has(pos.id));

  useLayoutEffect(() => {
    const root = pitchRef.current;
    if (!root) return undefined;
    let raf = 0;
    let fitting = false;
    const run = () => {
      if (fitting) return;
      fitting = true;
      root.querySelectorAll('.toty-spot, .toty-side-slot').forEach((el) => {
        if (el.classList.contains('toty-spot')) fitSpot(el);
        else fitTexts(el);
      });
      fitting = false;
    };
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(run);
    };
    run();
    const ro = new ResizeObserver(schedule);
    const field = root.querySelector('.afl-field-wrap') || root;
    ro.observe(field);
    ro.observe(root);
    const onLoad = (event) => {
      if (event.target?.tagName === 'IMG') schedule();
    };
    root.addEventListener('load', onLoad, true);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      root.removeEventListener('load', onLoad, true);
    };
  }, [picks, revealStep]);

  return (
    <div className="toty-pitch" ref={pitchRef}>
      <div className="afl-field-wrap">
        <div className="afl-field">
          <FieldMarkings />
          {TOTY_FIELD_SPOTS.filter((pos) => showSpot(pos.id)).map((pos) => (
            <FieldSpot
              key={pos.id}
              pos={pos}
              player={picks[pos.id]}
              onPick={onPick}
              justIn={Boolean(currentSpots?.has(pos.id))}
            />
          ))}
        </div>
      </div>
      <aside className="toty-side">
        {showSection(TOTY_FOLLOWER_SPOTS) ? (
          <section>
            <h3>Ruck & rovers</h3>
            {TOTY_FOLLOWER_SPOTS.filter((pos) => showSpot(pos.id)).map((pos) => (
              <SideSlot
                key={pos.id}
                pos={pos}
                player={picks[pos.id]}
                onPick={onPick}
                justIn={Boolean(currentSpots?.has(pos.id))}
              />
            ))}
          </section>
        ) : null}
        {showSection(TOTY_BENCH_SPOTS) ? (
          <section>
            <h3>Interchange</h3>
            {TOTY_BENCH_SPOTS.filter((pos) => showSpot(pos.id)).map((pos) => (
              <SideSlot
                key={pos.id}
                pos={pos}
                player={picks[pos.id]}
                onPick={onPick}
                justIn={Boolean(currentSpots?.has(pos.id))}
              />
            ))}
          </section>
        ) : null}
        {children}
      </aside>
    </div>
  );
}
