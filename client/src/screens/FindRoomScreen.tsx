import { useEffect, useState } from 'react';
import { HTTP_BASE } from '../ws.ts';
import type { PublicRoomSummary } from '@shared/types';

const IMG = '/images/home';
type Tab = 'campanha' | 'abertas' | 'privadas';

interface Props {
  playerName: string;
  connecting: boolean;
  error: string | null;
  onBack: () => void;
  onJoin: (name: string, code: string) => void;
}

export default function FindRoomScreen({ playerName, connecting, error, onBack, onJoin }: Props) {
  const [tab, setTab] = useState<Tab>('campanha');
  const [code, setCode] = useState('');
  const [rooms, setRooms] = useState<PublicRoomSummary[] | null>(null);

  useEffect(() => {
    if (tab !== 'abertas') return;
    let cancelled = false;
    const load = () => {
      fetch(`${HTTP_BASE}/rooms`).then((r) => r.json()).then((list: PublicRoomSummary[]) => {
        if (!cancelled) setRooms(list);
      }).catch(() => { if (!cancelled) setRooms((cur) => cur ?? []); });
    };
    load();
    const id = setInterval(load, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, [tab]);

  const canSubmitCode = code.trim().length === 4;
  const submitCode = () => { if (canSubmitCode) onJoin(playerName, code.trim()); };
  const joinRoom = (roomCode: string) => { if (!connecting) onJoin(playerName, roomCode); };

  return (
    <div className="corio-wide corio-noscroll" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '10px 16px 14px', gap: 10, overflowY: 'auto', animation: 'corio-rise .4s ease' }}>
      <div style={{ flex: 'none', position: 'relative' }}>
        <img src={`${IMG}/doodle-star-big.webp`} alt="" style={{ position: 'absolute', top: -6, left: 34, width: 26, opacity: 0.85, pointerEvents: 'none' }} />
        <img src={`${IMG}/doodle-crown.webp`} alt="" style={{ position: 'absolute', top: -10, right: 2, width: 44, opacity: 0.9, pointerEvents: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={onBack}
            className="corio-tap"
            style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 13, background: '#1A0A33', border: '2.5px solid #4A2B7A', color: '#fff', fontSize: 17, boxShadow: '0 3px 0 rgba(0,0,0,0.35)' }}
          >‹</button>
          <div style={{ width: 38 }} />
        </div>

        <div style={{ textAlign: 'center', marginTop: 2 }}>
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 24 }}>
            <span style={{ color: '#fff' }}>Procurar </span>
            <span style={{ background: 'linear-gradient(90deg,#FF6B6B,#FFC93C,#4ADE80,#29E7FF,#A78BFA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>salas</span>
          </div>
          <div className="corio-subtitle" style={{ fontSize: 10.5, color: 'rgba(244,242,248,0.55)', marginTop: 2, fontWeight: 600 }}>Encontre uma sala e entre para jogar</div>
        </div>
      </div>

      <div className="corio-find-tabs" style={{ flex: 'none' }}>
        <button onClick={() => setTab('campanha')} className={`corio-find-tab ${tab === 'campanha' ? 'active' : ''}`}>Campanha</button>
        <button onClick={() => setTab('abertas')} className={`corio-find-tab ${tab === 'abertas' ? 'active' : ''}`}>Abertas</button>
        <button onClick={() => setTab('privadas')} className={`corio-find-tab ${tab === 'privadas' ? 'active' : ''}`}>Privadas</button>
      </div>

      {error && (
        <div style={{ flex: 'none', fontSize: 11, fontWeight: 700, color: '#fff', background: 'rgba(239,68,68,0.35)', border: '2px solid #EF4444', borderRadius: 12, padding: '9px 12px' }}>{error}</div>
      )}

      {tab === 'campanha' && (
        <div className="corio-card" style={{ flex: 'none', background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '26px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 38 }}>🏆</div>
          <div className="corio-card-title" style={{ fontSize: 14.5, fontWeight: 800, marginTop: 8 }}>Modo Campanha</div>
          <div className="corio-card-sub" style={{ fontSize: 11, color: 'rgba(244,242,248,0.5)', marginTop: 6, lineHeight: 1.5 }}>
            Em desenvolvimento! Em breve você vai poder jogar sozinho contra a IA, completar desafios e desbloquear títulos e fotos pro seu perfil.
          </div>
          <div style={{ marginTop: 14, display: 'inline-block', fontSize: 10, fontWeight: 800, letterSpacing: 0.5, color: '#FFC93C', background: 'rgba(255,201,60,0.12)', border: '1px solid rgba(255,201,60,0.4)', borderRadius: 999, padding: '6px 14px' }}>EM BREVE</div>
        </div>
      )}

      {tab === 'abertas' && (
        <div className="corio-noscroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rooms === null && (
            <div style={emptyStateStyle}>Procurando salas abertas...</div>
          )}
          {rooms !== null && rooms.length === 0 && (
            <div style={emptyStateStyle}>Nenhuma sala pública aberta agora. Crie a sua!</div>
          )}
          {rooms?.map((r) => (
            <button
              key={r.code}
              onClick={() => joinRoom(r.code)}
              disabled={connecting}
              className="corio-tap corio-card"
              style={{
                all: 'unset', cursor: 'pointer', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 12,
                background: '#1A0A33', border: '2px solid #4A2B7A', borderRadius: 16, padding: '12px 14px',
              }}
            >
              <div style={{ fontSize: 20, flex: 'none' }}>{r.phraseMode === 'ai' ? '🤖' : r.phraseMode === 'verbal' ? '🗣️' : '✏️'}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Sala de {r.hostName}</div>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>{r.playerCount} jogador{r.playerCount === 1 ? '' : 'es'} · {r.phraseMode === 'ai' ? 'Frase da IA' : r.phraseMode === 'verbal' ? 'Com a Galera' : 'Frase dos jogadores'}</div>
              </div>
              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 0.3, padding: '4px 8px', borderRadius: 999, flex: 'none',
                background: r.screen === 'waiting' ? 'rgba(74,222,128,0.2)' : 'rgba(255,201,60,0.2)',
                color: r.screen === 'waiting' ? '#4ADE80' : '#FFC93C',
              }}>{r.screen === 'waiting' ? 'AGUARDANDO' : 'EM ANDAMENTO'}</div>
              <div style={{ fontSize: 16, flex: 'none', color: '#29E7FF' }}>→</div>
            </button>
          ))}
        </div>
      )}

      {tab === 'privadas' && (
        <div className="corio-card" style={{ flex: 'none', background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div className="corio-card-title" style={{ fontSize: 13, fontWeight: 800 }}>🔒 Entrar com código</div>
            <div className="corio-card-sub" style={{ fontSize: 10.5, color: 'rgba(244,242,248,0.5)', marginTop: 3 }}>Peça o código de 4 caracteres pra quem criou a sala privada.</div>
          </div>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
            maxLength={4}
            placeholder="Ex: 7F92"
            className="corio-home-v2-input"
            style={{ letterSpacing: 4, fontFamily: "'Space Grotesk',sans-serif", textAlign: 'center' }}
          />
          <button
            onClick={submitCode}
            disabled={!canSubmitCode || connecting}
            className="corio-tap corio-btn-lg"
            style={{ all: 'unset', cursor: 'pointer', boxSizing: 'border-box', width: '100%', textAlign: 'center', background: 'linear-gradient(90deg,#8B5CF6,#6D28D9)', color: '#fff', fontWeight: 800, fontSize: 13.5, padding: 13, borderRadius: 13, opacity: !canSubmitCode || connecting ? 0.55 : 1 }}
          >{connecting ? 'Conectando…' : 'Entrar na sala →'}</button>
        </div>
      )}
    </div>
  );
}

const emptyStateStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)', padding: '20px 0', textAlign: 'center' };
