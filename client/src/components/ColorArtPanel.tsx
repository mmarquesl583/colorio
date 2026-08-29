import { PLAYER_PALETTE } from '@shared/gameData';

interface Swatch { top: string; left: string; size: number; rotate: number; delay: number; }

const LAYOUT: Swatch[] = [
  { top: '8%', left: '12%', size: 92, rotate: -8, delay: 0 },
  { top: '6%', left: '58%', size: 64, rotate: 12, delay: 0.6 },
  { top: '20%', left: '78%', size: 110, rotate: -4, delay: 1.2 },
  { top: '34%', left: '30%', size: 54, rotate: 18, delay: 0.3 },
  { top: '30%', left: '6%', size: 70, rotate: -14, delay: 1.6 },
  { top: '48%', left: '62%', size: 88, rotate: 6, delay: 0.9 },
  { top: '58%', left: '14%', size: 118, rotate: -10, delay: 1.9 },
  { top: '66%', left: '46%', size: 60, rotate: 16, delay: 0.2 },
  { top: '72%', left: '78%', size: 76, rotate: -6, delay: 1.1 },
  { top: '84%', left: '24%', size: 66, rotate: 10, delay: 1.5 },
  { top: '88%', left: '62%', size: 96, rotate: -12, delay: 0.5 },
  { top: '4%', left: '36%', size: 40, rotate: 22, delay: 2.1 },
];

export default function ColorArtPanel() {
  return (
    <div style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
      <div style={{ position: 'absolute', width: '60%', height: '60%', top: '10%', left: '20%', background: 'radial-gradient(circle, rgba(139,92,246,0.35), transparent 70%)', filter: 'blur(40px)' }} />
      <div style={{ position: 'absolute', width: '50%', height: '50%', bottom: '5%', right: '5%', background: 'radial-gradient(circle, rgba(41,231,255,0.25), transparent 70%)', filter: 'blur(40px)' }} />
      {LAYOUT.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'absolute', top: s.top, left: s.left, width: s.size, height: s.size,
            borderRadius: s.size * 0.28, background: PLAYER_PALETTE[i % PLAYER_PALETTE.length],
            opacity: 0.9, transform: `rotate(${s.rotate}deg)`,
            boxShadow: `0 20px 50px -12px ${PLAYER_PALETTE[i % PLAYER_PALETTE.length]}66`,
            animation: `corio-breathe ${5 + (i % 4)}s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
