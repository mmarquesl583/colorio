import type { CSSProperties } from 'react';

// The illustrated home-hero mark: a chunky "C" ring built from 8 glossy,
// dark-outlined color wedges (game-piece style), plus the big "color.io"
// wordmark below it. Kept separate from Logo.tsx, which is the small plain
// wordmark used in every other screen's header — this one is only for the
// Home hero and is sized much larger.

const WEDGE_COLORS = ['#FF5C5C', '#FF5C8A', '#8B5CF6', '#3B82F6', '#29E7FF', '#4ADE80', '#FFC93C', '#FB923C'];
const GAP_START = 55; // degrees clockwise from 12 o'clock — the "mouth" of the C
const GAP_END = 125;
const WEDGE_INSET = 1.4; // small dark gap rendered between adjacent wedges

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutSegmentPath(cx: number, cy: number, rOuter: number, rInner: number, startDeg: number, endDeg: number) {
  const large = endDeg - startDeg > 180 ? 1 : 0;
  const p1 = polar(cx, cy, rOuter, startDeg);
  const p2 = polar(cx, cy, rOuter, endDeg);
  const p3 = polar(cx, cy, rInner, endDeg);
  const p4 = polar(cx, cy, rInner, startDeg);
  return [
    `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    `L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

function lighten(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) + amount);
  const g = Math.min(255, ((n >> 8) & 255) + amount);
  const b = Math.min(255, (n & 255) + amount);
  return `rgb(${r},${g},${b})`;
}

const CX = 120, CY = 120, R_OUTER = 108, R_INNER = 56;
const sweep = 360 - (GAP_END - GAP_START);
const step = sweep / WEDGE_COLORS.length;

const wedges = WEDGE_COLORS.map((color, i) => {
  const start = GAP_END + step * i + WEDGE_INSET;
  const end = GAP_END + step * (i + 1) - WEDGE_INSET;
  return { color, d: donutSegmentPath(CX, CY, R_OUTER, R_INNER, start, end), id: `corio-wedge-${i}` };
});

export default function ColorWheelLogo({ width = 200 }: { width?: number }) {
  return (
    <svg width={width} height={width} viewBox="0 0 240 240" style={{ display: 'block', filter: 'drop-shadow(0 10px 18px rgba(0,0,0,0.45))' }}>
      <defs>
        {wedges.map((w) => (
          <radialGradient key={w.id} id={w.id} cx="32%" cy="28%" r="85%">
            <stop offset="0%" stopColor={lighten(w.color, 70)} />
            <stop offset="55%" stopColor={w.color} />
            <stop offset="100%" stopColor={w.color} />
          </radialGradient>
        ))}
      </defs>
      <g transform="translate(0 0)">
        {wedges.map((w) => (
          <path key={w.id} d={w.d} fill={`url(#${w.id})`} stroke="#1B0B33" strokeWidth={7} strokeLinejoin="round" />
        ))}
      </g>
    </svg>
  );
}

export function ColorIoWordmark({ size = 44 }: { size?: number }) {
  const base: CSSProperties = {
    fontFamily: "'Space Grotesk',sans-serif",
    fontWeight: 800,
    fontSize: size,
    letterSpacing: -0.5,
    WebkitTextStroke: `${Math.max(2, size * 0.055)}px #1B0B33`,
    filter: 'drop-shadow(0 6px 0 rgba(0,0,0,0.35))',
  };
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center' }}>
      <span style={{ ...base, color: '#FFFFFF' }}>color</span>
      <span style={{ ...base, background: 'linear-gradient(90deg,#FF5C8A,#C084FC)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>.io</span>
    </div>
  );
}
