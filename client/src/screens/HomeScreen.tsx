import { useEffect, useState } from 'react';
import { HTTP_BASE } from '../ws.ts';
import type { PublicRoomSummary } from '@shared/types';

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
  { src: 'doodle-lightning.webp', pos: { top: '4%', right: '18%' }, width: 62, rot: 10, duration: 6.2, delay: .3 },
  { src: 'doodle-sparkle-yellow.webp', pos: { top: '54%', right: '5%' }, width: 50, rot: 4, duration: 5, delay: .1 },
  { src: 'doodle-sparkle-white.webp', pos: { top: '13%', left: '30%' }, width: 34, rot: -6, duration: 5.4, delay: .5 },
  { src: 'doodle-cursor-click.webp', pos: { bottom: '17%', right: '3%' }, width: 56, rot: -12, duration: 6.8, delay: .7 },
];

export default function HomeScreen({ connecting, error, onClearError, onStartCreate, onJoin }: Props) {
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState(loadSavedName);
  const [code, setCode] = useState('');
  const [showCodeEntry, setShowCodeEntry] = useState(false);
  const [rooms, setRooms] = useState<PublicRoomSummary[] | null>(null);

  useEffect(() => {
    if (mode !== 'join') return;
    let cancelled = false;
    const load = () => {
      fetch(`${HTTP_BASE}/rooms`).then((r) => r.json()).then((list: PublicRoomSummary[]) => {
        if (!cancelled) setRooms(list);
      }).catch(() => { if (!cancelled) setRooms((cur) => cur ?? []); });
    };
    load();
    const id = setInterval(load, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, [mode]);

  const nameOk = name.trim().length > 0;
  const canSubmitCode = nameOk && code.trim().length === 4;

  const submitCode = () => {
    if (!canSubmitCode) return;
    onJoin(name.trim(), code.trim());
  };

  const joinRoom = (roomCode: string) => {
    if (!nameOk || connecting) return;
    onJoin(name.trim(), roomCode);
  };

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

          <div className="corio-home-v2-tagline" style={{ marginTop: 14, marginBottom: 20 }}>
            Adivinhe a cor,<br />ganhe pontos, <mark>se divirta.</mark>
          </div>
        </div>

        <div className="corio-home-v2-form">
          <div className="corio-home-v2-input-wrap">
            <svg className="corio-home-v2-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" /></svg>
            <input
              value={name}
              onChange={(e) => updateName(e.target.value)}
              maxLength={NAME_MAX}
              placeholder="Seu nome"
              className="corio-home-v2-input"
            />
            <svg className="corio-home-v2-input-scribble" width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 11 L6 3 M8 11 L13 3 M15 11 L19 5" /></svg>
          </div>

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
            Entrar com código
          </button>

          {mode === 'join' && (
            <>
              {!nameOk && (
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.75)', textAlign: 'center' }}>Digite seu nome para poder entrar.</div>
              )}
              <div className="corio-noscroll" style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 7, textAlign: 'left' }}>
                {rooms === null && (
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: 'rgba(255,255,255,0.75)', padding: '10px 0', textAlign: 'center' }}>Procurando salas abertas...</div>
                )}
                {rooms !== null && rooms.length === 0 && (
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: 'rgba(255,255,255,0.75)', padding: '10px 0', textAlign: 'center' }}>Nenhuma sala pública aberta agora. Crie a sua!</div>
                )}
                {rooms?.map((r) => (
                  <button
                    key={r.code}
                    onClick={() => joinRoom(r.code)}
                    disabled={!nameOk || connecting}
                    className="corio-tap"
                    style={{
                      all: 'unset', cursor: nameOk ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 10,
                      background: '#1A0A33', border: '2px solid #4A2B7A', borderRadius: 14, padding: '10px 12px',
                      opacity: nameOk ? 1 : 0.6,
                    }}
                  >
                    <div style={{ fontSize: 17, flex: 'none' }}>{r.phraseMode === 'ai' ? '🤖' : '✏️'}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Sala de {r.hostName}</div>
                      <div style={{ fontSize: 9.5, fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>{r.playerCount}/{r.numPlayers} jogadores · {r.phraseMode === 'ai' ? 'Frase da IA' : 'Frase dos jogadores'}</div>
                    </div>
                    <div style={{
                      fontSize: 8.5, fontWeight: 700, letterSpacing: 0.3, padding: '3px 7px', borderRadius: 999, flex: 'none',
                      background: r.screen === 'waiting' ? 'rgba(74,222,128,0.2)' : 'rgba(255,201,60,0.2)',
                      color: r.screen === 'waiting' ? '#4ADE80' : '#FFC93C',
                    }}>{r.screen === 'waiting' ? 'AGUARDANDO' : 'EM ANDAMENTO'}</div>
                    <div style={{ fontSize: 14, flex: 'none', color: '#29E7FF' }}>→</div>
                  </button>
                ))}
              </div>

              {!showCodeEntry ? (
                <div onClick={() => setShowCodeEntry(true)} style={{ cursor: 'pointer', fontSize: 11, fontWeight: 700, color: '#FFC93C', textAlign: 'center', padding: '4px 0', textDecoration: 'underline' }}>Tenho um código de sala privada</div>
              ) : (
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
                  maxLength={4}
                  placeholder="Código da sala (ex: 7F92)"
                  className="corio-home-v2-input"
                  style={{ letterSpacing: 3, fontFamily: "'Space Grotesk',sans-serif", textAlign: 'center' }}
                />
              )}
            </>
          )}

          {error && (
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#fff', background: 'rgba(239,68,68,0.35)', border: '2px solid #EF4444', borderRadius: 12, padding: '9px 12px' }}>{error}</div>
          )}

          {(mode === 'create' || showCodeEntry) && (
            <button
              onClick={mode === 'create' ? () => onStartCreate(name.trim()) : submitCode}
              disabled={connecting || (mode === 'create' ? !nameOk : !canSubmitCode)}
              className="corio-home-v2-btn corio-home-v2-continue"
              style={{ opacity: connecting || (mode === 'create' ? !nameOk : !canSubmitCode) ? 0.55 : 1 }}
            >
              {connecting ? 'Conectando…' : mode === 'create' ? 'Continuar →' : 'Entrar na sala →'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
