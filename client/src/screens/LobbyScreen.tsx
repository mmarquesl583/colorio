import { useState } from 'react';
import Logo from '../components/Logo.tsx';
import { LOBBY_THEMES, MIN_PLAYERS, MAX_PLAYERS, MIN_ROUNDS, MAX_ROUNDS } from '@shared/gameData';
import type { PhraseMode, Privacy, RoomConfig } from '@shared/types';

interface Props {
  connecting: boolean;
  error: string | null;
  onBack: () => void;
  onCreate: (config: RoomConfig) => void;
}

export default function LobbyScreen({ connecting, error, onBack, onCreate }: Props) {
  const [numPlayers, setNumPlayers] = useState(5);
  const [numRounds, setNumRounds] = useState(5);
  const [phraseMode, setPhraseMode] = useState<PhraseMode>('players');
  const [privacy, setPrivacy] = useState<Privacy>('public');
  const [selectedThemes, setSelectedThemes] = useState<string[]>(LOBBY_THEMES.map((t) => t.id));

  const toggleTheme = (id: string) => {
    setSelectedThemes((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const create = () => {
    onCreate({ numPlayers, numRounds, phraseMode, privacy, selectedThemes });
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '8px 16px 12px', gap: 6 }}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div onClick={onBack} className="corio-tap" style={{ cursor: 'pointer', width: 28, height: 28, borderRadius: 9, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>‹</div>
        <Logo />
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#8B5CF6,#29E7FF)', flex: 'none' }} />
      </div>

      <div style={{ flex: 'none', textAlign: 'center', marginTop: 2 }}>
        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 16, letterSpacing: 0.3 }}>CONFIGURAR SALA</div>
        <div style={{ fontSize: 9.5, color: 'rgba(244,242,248,0.5)', marginTop: 1 }}>Defina as regras e comece a diversão!</div>
      </div>

      <div style={{ flex: 'none', display: 'flex', gap: 8, background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '9px 10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: 0.6, color: 'rgba(244,242,248,0.45)' }}>JOGADORES</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
            <button onClick={() => setNumPlayers((v) => Math.max(MIN_PLAYERS, v - 1))} className="corio-tap" style={stepperBtn('rgba(255,255,255,0.08)', '#fff')}>−</button>
            <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 15, flex: 1, textAlign: 'center' }}>{numPlayers}</div>
            <button onClick={() => setNumPlayers((v) => Math.min(MAX_PLAYERS, v + 1))} className="corio-tap" style={stepperBtn('#8B5CF6', '#fff')}>+</button>
          </div>
        </div>
        <div style={{ width: 1, background: 'rgba(255,255,255,0.08)', flex: 'none' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: 0.6, color: 'rgba(244,242,248,0.45)' }}>RODADAS</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
            <button onClick={() => setNumRounds((v) => Math.max(MIN_ROUNDS, v - 1))} className="corio-tap" style={stepperBtn('rgba(255,255,255,0.08)', '#fff')}>−</button>
            <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 15, flex: 1, textAlign: 'center' }}>{numRounds}</div>
            <button onClick={() => setNumRounds((v) => Math.min(MAX_ROUNDS, v + 1))} className="corio-tap" style={stepperBtn('#29E7FF', '#04222b')}>+</button>
          </div>
        </div>
        <div style={{ width: 1, background: 'rgba(255,255,255,0.08)', flex: 'none' }} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 1 }}>
          <div style={{ fontSize: 15 }}>🏆</div>
          <div style={{ fontSize: 7.5, color: 'rgba(244,242,248,0.5)', lineHeight: 1.25 }}>Vence quem tiver <span style={{ color: '#FFC93C', fontWeight: 700 }}>mais pontos</span></div>
        </div>
      </div>

      <div style={{ flex: 'none', background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '9px 10px' }}>
        <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.6, color: 'rgba(244,242,248,0.6)' }}>MODO DE FRASE</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <div onClick={() => setPhraseMode('players')} className="corio-tap" style={modeCardStyle(phraseMode === 'players', 'rgba(139,92,246,0.15)', '#8B5CF6')}>
            {phraseMode === 'players' && <div style={checkDotStyle('#8B5CF6')}>✓</div>}
            <div style={{ fontSize: 16 }}>✏️</div>
            <div style={{ fontSize: 10, fontWeight: 700, marginTop: 3 }}>Frase dos jogadores</div>
            <div style={{ fontSize: 7.5, color: 'rgba(244,242,248,0.45)', marginTop: 2, lineHeight: 1.25 }}>Cada jogador escreve a frase</div>
          </div>
          <div onClick={() => setPhraseMode('ai')} className="corio-tap" style={modeCardStyle(phraseMode === 'ai', 'rgba(41,231,255,0.12)', '#29E7FF')}>
            {phraseMode === 'ai' && <div style={checkDotStyle('#29E7FF', '#04222b')}>✓</div>}
            <div style={{ fontSize: 16 }}>🤖</div>
            <div style={{ fontSize: 10, fontWeight: 700, marginTop: 3 }}>Frase da IA</div>
            <div style={{ fontSize: 7.5, color: 'rgba(244,242,248,0.45)', marginTop: 2, lineHeight: 1.25 }}>A IA cria frases desafiadoras</div>
          </div>
        </div>
      </div>

      <div style={{ flex: 'none', background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '9px 10px' }}>
        <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.6, color: 'rgba(244,242,248,0.6)' }}>TEMAS</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gridTemplateRows: 'repeat(3,1fr)', gap: 8, marginTop: 8 }}>
          {LOBBY_THEMES.map((t) => {
            const on = selectedThemes.includes(t.id);
            return (
              <div
                key={t.id}
                onClick={() => toggleTheme(t.id)}
                className="corio-tap"
                style={{
                  cursor: 'pointer', position: 'relative', borderRadius: 12, padding: '8px 8px', textAlign: 'center',
                  background: on ? `linear-gradient(160deg,${t.color}33,${t.color}11)` : 'rgba(255,255,255,0.03)',
                  border: `1.5px solid ${on ? t.color : 'rgba(255,255,255,0.08)'}`,
                  display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 8,
                }}
              >
                {on && <div style={{ position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: '50%', background: t.color, color: '#fff', fontSize: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</div>}
                <div style={{ width: 30, height: 30, borderRadius: 9, background: `${t.color}2e`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flex: 'none' }}>{t.icon}</div>
                <div style={{ fontSize: 10.5, fontWeight: 700 }}>{t.name}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 'none', display: 'flex', gap: 8 }}>
        <div onClick={() => setPrivacy('public')} className="corio-tap" style={privacyCardStyle(privacy === 'public')}>
          <div style={{ fontSize: 13 }}>🌐</div>
          <div style={{ minWidth: 0, flex: 1 }}><div style={{ fontSize: 10, fontWeight: 700 }}>Pública</div><div style={{ fontSize: 7, color: 'rgba(244,242,248,0.45)' }}>Qualquer um entra</div></div>
          {privacy === 'public' && <div style={smallCheckStyle}>✓</div>}
        </div>
        <div onClick={() => setPrivacy('private')} className="corio-tap" style={privacyCardStyle(privacy === 'private')}>
          <div style={{ fontSize: 13 }}>🔒</div>
          <div style={{ minWidth: 0, flex: 1 }}><div style={{ fontSize: 10, fontWeight: 700 }}>Privada</div><div style={{ fontSize: 7, color: 'rgba(244,242,248,0.45)' }}>Só com código</div></div>
          {privacy === 'private' && <div style={smallCheckStyle}>✓</div>}
        </div>
      </div>

      {error && (
        <div style={{ fontSize: 10.5, color: '#FCA5A5', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '6px 10px', textAlign: 'center' }}>{error}</div>
      )}

      <button
        onClick={create}
        disabled={connecting}
        className="corio-tap"
        style={{ all: 'unset', cursor: 'pointer', flex: 'none', boxSizing: 'border-box', width: '100%', textAlign: 'center', background: 'linear-gradient(90deg,#8B5CF6,#6D28D9)', color: '#fff', fontWeight: 800, fontSize: 13, padding: 12, borderRadius: 13, opacity: connecting ? 0.6 : 1 }}
      >{connecting ? 'Criando…' : '🚀 CRIAR SALA'}</button>
    </div>
  );
}

function stepperBtn(bg: string, color: string): React.CSSProperties {
  return { all: 'unset', cursor: 'pointer', width: 20, height: 20, borderRadius: '50%', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 };
}
function modeCardStyle(on: boolean, bg: string, border: string): React.CSSProperties {
  return { cursor: 'pointer', flex: 1, minWidth: 0, borderRadius: 11, padding: '9px 8px', textAlign: 'center', background: on ? bg : 'rgba(255,255,255,0.03)', border: `1px solid ${on ? border : 'rgba(255,255,255,0.08)'}`, position: 'relative' };
}
function checkDotStyle(bg: string, color = '#fff'): React.CSSProperties {
  return { position: 'absolute', top: 5, right: 5, width: 14, height: 14, borderRadius: '50%', background: bg, color, fontSize: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' };
}
function privacyCardStyle(on: boolean): React.CSSProperties {
  return { cursor: 'pointer', flex: 1, background: on ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${on ? '#22C55E' : 'rgba(255,255,255,0.08)'}`, borderRadius: 12, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 7 };
}
const smallCheckStyle: React.CSSProperties = { width: 13, height: 13, borderRadius: '50%', background: '#22C55E', color: '#04220f', fontSize: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' };
