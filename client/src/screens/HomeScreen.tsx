import { useEffect, useState } from 'react';
import Logo from '../components/Logo.tsx';
import ColorArtPanel from '../components/ColorArtPanel.tsx';
import { HTTP_BASE } from '../ws.ts';
import type { PublicRoomSummary } from '@shared/types';

interface Props {
  connecting: boolean;
  error: string | null;
  onClearError: () => void;
  onStartCreate: (name: string) => void;
  onJoin: (name: string, code: string) => void;
}

export default function HomeScreen({ connecting, error, onClearError, onStartCreate, onJoin }: Props) {
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
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

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: '#12121a',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
    padding: '12px 14px', color: '#fff', fontSize: 14, outline: 'none',
  };

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

  return (
    <div className="corio-home-shell">
      <div className="corio-home-form" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 24px 40px', gap: 22, textAlign: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, animation: 'corio-pop .5s cubic-bezier(.22,.61,.16,1)' }}>
          <div style={{ fontSize: 34 }}>🎨</div>
          <Logo size={30} />
          <div style={{ fontSize: 12, color: 'rgba(244,242,248,0.5)' }}>Adivinhe a cor, ganhe pontos, se divirta.</div>
        </div>

        <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 10, animation: 'corio-rise .5s ease .05s backwards' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { setMode('create'); onClearError(); }}
              className="corio-tap"
              style={{
                all: 'unset', cursor: 'pointer', flex: 1, textAlign: 'center', padding: '9px 0',
                borderRadius: 11, fontSize: 12, fontWeight: 700,
                background: mode === 'create' ? 'linear-gradient(90deg,#8B5CF6,#6D28D9)' : 'rgba(255,255,255,0.05)',
                color: mode === 'create' ? '#fff' : 'rgba(244,242,248,0.55)',
              }}
            >🚀 Criar sala</button>
            <button
              onClick={() => { setMode('join'); onClearError(); }}
              className="corio-tap"
              style={{
                all: 'unset', cursor: 'pointer', flex: 1, textAlign: 'center', padding: '9px 0',
                borderRadius: 11, fontSize: 12, fontWeight: 700,
                background: mode === 'join' ? 'linear-gradient(90deg,#29E7FF,#0891B2)' : 'rgba(255,255,255,0.05)',
                color: mode === 'join' ? '#04222b' : 'rgba(244,242,248,0.55)',
              }}
            >🔑 Entrar em uma sala</button>
          </div>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            placeholder="Seu nome"
            style={inputStyle}
          />

          {mode === 'join' && (
            <>
              {!nameOk && (
                <div style={{ fontSize: 10.5, color: 'rgba(244,242,248,0.45)' }}>Digite seu nome para poder entrar.</div>
              )}
              <div className="corio-noscroll" style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}>
                {rooms === null && (
                  <div style={{ fontSize: 11, color: 'rgba(244,242,248,0.45)', padding: '10px 0' }}>Procurando salas abertas...</div>
                )}
                {rooms !== null && rooms.length === 0 && (
                  <div style={{ fontSize: 11, color: 'rgba(244,242,248,0.45)', padding: '10px 0' }}>Nenhuma sala pública aberta agora. Crie a sua!</div>
                )}
                {rooms?.map((r) => (
                  <button
                    key={r.code}
                    onClick={() => joinRoom(r.code)}
                    disabled={!nameOk || connecting}
                    className="corio-tap"
                    style={{
                      all: 'unset', cursor: nameOk ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 10,
                      background: '#12121a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '9px 12px',
                      opacity: nameOk ? 1 : 0.6,
                    }}
                  >
                    <div style={{ fontSize: 16, flex: 'none' }}>{r.phraseMode === 'ai' ? '🤖' : '✏️'}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Sala de {r.hostName}</div>
                      <div style={{ fontSize: 9.5, color: 'rgba(244,242,248,0.5)' }}>{r.playerCount}/{r.numPlayers} jogadores · {r.phraseMode === 'ai' ? 'Frase da IA' : 'Frase dos jogadores'}</div>
                    </div>
                    <div style={{
                      fontSize: 8.5, fontWeight: 700, letterSpacing: 0.3, padding: '3px 7px', borderRadius: 999, flex: 'none',
                      background: r.screen === 'waiting' ? 'rgba(74,222,128,0.15)' : 'rgba(255,201,60,0.15)',
                      color: r.screen === 'waiting' ? '#4ADE80' : '#FFC93C',
                    }}>{r.screen === 'waiting' ? 'AGUARDANDO' : 'EM ANDAMENTO'}</div>
                    <div style={{ fontSize: 13, flex: 'none', color: '#29E7FF' }}>→</div>
                  </button>
                ))}
              </div>

              {!showCodeEntry ? (
                <div onClick={() => setShowCodeEntry(true)} style={{ cursor: 'pointer', fontSize: 10.5, color: '#A78BFA', textAlign: 'center', padding: '4px 0' }}>Tenho um código de sala privada</div>
              ) : (
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
                  maxLength={4}
                  placeholder="Código da sala (ex: 7F92)"
                  style={{ ...inputStyle, letterSpacing: 2, fontFamily: "'Space Grotesk',sans-serif", textAlign: 'center' }}
                />
              )}
            </>
          )}

          {error && (
            <div style={{ fontSize: 11.5, color: '#FCA5A5', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '8px 10px' }}>{error}</div>
          )}

          {(mode === 'create' || showCodeEntry) && (
            <button
              onClick={mode === 'create' ? () => onStartCreate(name.trim()) : submitCode}
              disabled={connecting || (mode === 'create' ? !nameOk : !canSubmitCode)}
              className="corio-tap"
              style={{
                all: 'unset', cursor: 'pointer', boxSizing: 'border-box', width: '100%',
                textAlign: 'center', background: (mode === 'create' ? nameOk : canSubmitCode) ? 'linear-gradient(90deg,#8B5CF6,#6D28D9)' : 'rgba(255,255,255,0.08)',
                color: '#fff', fontWeight: 800, fontSize: 13, padding: 13, borderRadius: 13,
                opacity: connecting ? 0.6 : 1,
              }}
            >{connecting ? 'Conectando…' : mode === 'create' ? 'Continuar →' : 'Entrar na sala →'}</button>
          )}
        </div>
      </div>
      <div className="corio-home-art">
        <ColorArtPanel />
      </div>
    </div>
  );
}
