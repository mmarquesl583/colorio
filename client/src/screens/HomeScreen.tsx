import { useState } from 'react';

interface Props {
  connecting: boolean;
  error: string | null;
  onClearError: () => void;
  onStartCreate: (name: string) => void;
  onJoin: (name: string, code: string) => void;
}

const IMG = '/images/home';
const NAME_KEY = 'colorio.playerName';
const NAME_MAX = 24;

function loadSavedName(): string {
  try { return localStorage.getItem(NAME_KEY) ?? ''; } catch { return ''; }
}
function saveName(v: string) {
  try { localStorage.setItem(NAME_KEY, v); } catch { /* ignore */ }
}

interface Doodle { src: string; pos: React.CSSProperties; width: number; rot: number; duration: number; delay: number; }

// Kept clear of the hero logo's own bounding box (roughly the box centered
// in the top ~80% of the content column) so nothing sits behind its opaque
// artwork and reads as "cut off" — see GUIA.md if repositioning these.
const DOODLES: Doodle[] = [
  { src: 'doodle-crown.webp', pos: { top: '1.5%', left: '3%' }, width: 110, rot: -10, duration: 6, delay: 0 },
  { src: 'doodle-star-big.webp', pos: { top: '17%', left: '2%' }, width: 74, rot: -8, duration: 7, delay: .4 },
  { src: 'doodle-speech-bubble.webp', pos: { top: '3%', right: '2%' }, width: 128, rot: 6, duration: 6.5, delay: .2 },
  { src: 'doodle-pencil.webp', pos: { top: '44%', left: '-2%' }, width: 100, rot: -20, duration: 7.5, delay: .6 },
  { src: 'doodle-lightning.webp', pos: { top: '25%', right: '4%' }, width: 54, rot: 10, duration: 6.2, delay: .3 },
  { src: 'doodle-sparkle-yellow.webp', pos: { top: '54%', right: '5%' }, width: 50, rot: 4, duration: 5, delay: .1 },
  { src: 'doodle-sparkle-white.webp', pos: { top: '13%', left: '30%' }, width: 34, rot: -6, duration: 5.4, delay: .5 },
  { src: 'doodle-cursor-click.webp', pos: { bottom: '6%', right: '4%' }, width: 56, rot: -12, duration: 6.8, delay: .7 },
];

export default function HomeScreen({ connecting, error, onClearError, onStartCreate }: Props) {
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState(loadSavedName);

  const nameOk = name.trim().length > 0;

  const chooseMode = (m: 'create' | 'join') => { setMode(m); onClearError(); };
  const updateName = (v: string) => { setName(v); saveName(v); };

  return (
    <div className="corio-home-v2">
      <div className="corio-home-v2-decor">
        {DOODLES.map((d, i) => (
          <img
            key={i}
            src={`${IMG}/${d.src}`}
            alt=""
            className="corio-home-v2-doodle"
            style={{
              ...d.pos,
              animationDuration: `${d.duration}s`,
              animationDelay: `${d.delay}s`,
              '--corio-float-rot': `${d.rot}deg`,
              '--corio-doodle-w': `${d.width}px`,
            } as React.CSSProperties}
          />
        ))}
      </div>

      <div className="corio-noscroll corio-home-v2-content">
        <div className="corio-home-v2-hero">
          <img src={`${IMG}/logo-full.webp`} alt="color.io" className="corio-home-v2-logo-full" />

          <div className="corio-home-v2-tagline" style={{ marginTop: 8, marginBottom: 12 }}>
            Adivinhe a cor,<br />ganhe pontos, <mark>se divirta.</mark>
          </div>
        </div>

        <div className="corio-home-v2-form">
          <button
            onClick={() => chooseMode('create')}
            className={`corio-home-v2-btn corio-home-v2-btn-primary ${mode === 'create' ? 'is-active' : 'corio-home-v2-btn-inactive'}`}
          >
            <img src={`${IMG}/doodle-rocket.webp`} alt="" />
            Criar sala
          </button>
          <button
            onClick={() => chooseMode('join')}
            className={`corio-home-v2-btn corio-home-v2-btn-secondary ${mode === 'join' ? 'is-active' : 'corio-home-v2-btn-inactive'}`}
          >
            <img src={`${IMG}/doodle-key.webp`} alt="" />
            Procurar salas
          </button>

          <div className="corio-home-v2-input-wrap">
            <svg className="corio-home-v2-input-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" /></svg>
            <input
              value={name}
              onChange={(e) => updateName(e.target.value)}
              maxLength={NAME_MAX}
              placeholder="Seu nome"
              className="corio-home-v2-input"
            />
            <svg className="corio-home-v2-input-scribble" width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 11 L6 3 M8 11 L13 3 M15 11 L19 5" /></svg>
          </div>

          {error && (
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#fff', background: 'rgba(239,68,68,0.35)', border: '2px solid #EF4444', borderRadius: 12, padding: '9px 12px' }}>{error}</div>
          )}

          <button
            onClick={() => onStartCreate(name.trim())}
            disabled={connecting || !nameOk}
            className="corio-home-v2-btn corio-home-v2-continue"
            style={{ opacity: connecting || !nameOk ? 0.55 : 1 }}
          >
            {connecting ? 'Conectando…' : 'Continuar →'}
          </button>
        </div>
      </div>
    </div>
  );
}
