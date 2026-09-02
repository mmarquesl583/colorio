import { useState } from 'react';
import Logo from '../components/Logo.tsx';
import { LOBBY_THEMES, MIN_PLAYERS, MAX_PLAYERS, MIN_ROUNDS, MAX_ROUNDS, PLAYER_PALETTE } from '@shared/gameData';
import { AI_QUESTIONS } from '@shared/aiQuestions';
import { avatarSmallSrc } from '@shared/avatarIcons';
import { accountAvatar, useSession } from '../auth.ts';
import type { Privacy, RoomConfig } from '@shared/types';

// Only themes with a real curated question bank make sense in "Frase da
// IA" — the rest would just fall back to the generic, unrelated phrase.
const AI_ELIGIBLE_IDS = new Set(Object.keys(AI_QUESTIONS));

// One UI choice that maps onto the two orthogonal server fields
// (phraseMode/gameMode) — 'race' always implies phraseMode:'ai' under the
// hood (the server's usesAiQuestions() already treats them the same way
// for question sourcing), so the picker doesn't need a 4th combination.
type ModeChoice = 'players' | 'ai' | 'race';

interface Props {
  playerName: string;
  connecting: boolean;
  error: string | null;
  onBack: () => void;
  onCreate: (config: RoomConfig) => void;
}

export default function LobbyScreen({ playerName, connecting, error, onBack, onCreate }: Props) {
  const { session } = useSession();
  const avatarId = accountAvatar(session);
  const [numPlayers, setNumPlayers] = useState(5);
  const [numRounds, setNumRounds] = useState(5);
  const [modeChoice, setModeChoice] = useState<ModeChoice>('players');
  const [privacy, setPrivacy] = useState<Privacy>('public');
  const [selectedThemes, setSelectedThemes] = useState<string[]>(LOBBY_THEMES.map((t) => t.id));

  const toggleTheme = (id: string) => {
    setSelectedThemes((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const needsAiThemes = modeChoice === 'ai' || modeChoice === 'race';
  const visibleThemes = needsAiThemes ? LOBBY_THEMES.filter((t) => AI_ELIGIBLE_IDS.has(t.id)) : LOBBY_THEMES;
  const chooseMode = (mode: ModeChoice) => {
    setModeChoice(mode);
    if (mode === 'ai' || mode === 'race') setSelectedThemes((s) => s.filter((id) => AI_ELIGIBLE_IDS.has(id)));
  };

  const create = () => {
    onCreate({
      numPlayers, numRounds, privacy, selectedThemes,
      phraseMode: modeChoice === 'players' ? 'players' : 'ai',
      gameMode: modeChoice === 'race' ? 'race' : 'classic',
    });
  };

  return (
    <div className="corio-wide corio-noscroll" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'safe center', padding: '8px 16px 12px', gap: 6, overflowY: 'auto', animation: 'corio-rise .4s ease' }}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div onClick={onBack} className="corio-tap corio-back-btn" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, width: 28, height: 28, borderRadius: 9, background: 'rgba(255,255,255,0.06)', justifyContent: 'center', fontSize: 13 }}>
          <span>‹</span>
          <span className="corio-back-label">VOLTAR</span>
        </div>
        <Logo />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: PLAYER_PALETTE[0], color: '#050507', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', overflow: 'hidden' }}>
            {avatarId ? <img src={avatarSmallSrc(avatarId)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (playerName.trim()[0] || 'J').toUpperCase()}
          </div>
          <div className="corio-you-name" style={{ fontSize: 12.5, fontWeight: 700 }}>{playerName || 'Você'}</div>
        </div>
      </div>

      <div style={{ flex: 'none', textAlign: 'center', marginTop: 2, position: 'relative' }}>
        <span className="corio-sparkle" style={{ left: '18%', top: -6, fontSize: 14, animation: 'corio-twinkle 1.8s ease-in-out infinite' }}>✦</span>
        <span className="corio-sparkle" style={{ right: '18%', top: 2, fontSize: 10, animation: 'corio-twinkle 1.8s ease-in-out infinite .5s' }}>✦</span>
        <div className="corio-title" style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 16, letterSpacing: 0.3 }}>CONFIGURAR SALA</div>
        <div className="corio-subtitle" style={{ fontSize: 9.5, color: 'rgba(244,242,248,0.5)', marginTop: 1 }}>Defina as regras e comece a diversão!</div>
      </div>

      <div className="corio-card" style={{ flex: 'none', display: 'flex', gap: 8, background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '9px 10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="corio-eyebrow" style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: 0.6, color: 'rgba(244,242,248,0.45)' }}>JOGADORES</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
            <button onClick={() => setNumPlayers((v) => Math.max(MIN_PLAYERS, v - 1))} className="corio-tap" style={stepperBtn('rgba(255,255,255,0.08)', '#fff')}>−</button>
            <div className="corio-value-lg" style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 15, flex: 1, textAlign: 'center' }}>{numPlayers}</div>
            <button onClick={() => setNumPlayers((v) => Math.min(MAX_PLAYERS, v + 1))} className="corio-tap" style={stepperBtn('#8B5CF6', '#fff')}>+</button>
          </div>
        </div>
        <div style={{ width: 1, background: 'rgba(255,255,255,0.08)', flex: 'none' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="corio-eyebrow" style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: 0.6, color: 'rgba(244,242,248,0.45)' }}>RODADAS</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
            <button onClick={() => setNumRounds((v) => Math.max(MIN_ROUNDS, v - 1))} className="corio-tap" style={stepperBtn('rgba(255,255,255,0.08)', '#fff')}>−</button>
            <div className="corio-value-lg" style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 15, flex: 1, textAlign: 'center' }}>{numRounds}</div>
            <button onClick={() => setNumRounds((v) => Math.min(MAX_ROUNDS, v + 1))} className="corio-tap" style={stepperBtn('#29E7FF', '#04222b')}>+</button>
          </div>
        </div>
        <div style={{ width: 1, background: 'rgba(255,255,255,0.08)', flex: 'none' }} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 1 }}>
          <div style={{ fontSize: 15 }}>🏆</div>
          <div className="corio-card-sub" style={{ fontSize: 7.5, color: 'rgba(244,242,248,0.5)', lineHeight: 1.25 }}>Vence quem tiver <span style={{ color: '#FFC93C', fontWeight: 700 }}>mais pontos</span></div>
        </div>
      </div>

      <div className="corio-card" style={{ flex: 'none', background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '9px 10px' }}>
        <div className="corio-eyebrow" style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.6, color: 'rgba(244,242,248,0.6)' }}>MODO DE JOGO</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <div onClick={() => chooseMode('players')} className="corio-tap corio-card" style={modeCardStyle(modeChoice === 'players', 'rgba(139,92,246,0.15)', '#8B5CF6')}>
            {modeChoice === 'players' && <div style={checkDotStyle('#8B5CF6')}>✓</div>}
            <div style={{ fontSize: 16 }}>✏️</div>
            <div className="corio-card-title" style={{ fontSize: 10, fontWeight: 700, marginTop: 3 }}>Frase dos jogadores</div>
            <div className="corio-card-sub" style={{ fontSize: 7.5, color: 'rgba(244,242,248,0.45)', marginTop: 2, lineHeight: 1.25 }}>Cada jogador escreve a frase</div>
          </div>
          <div onClick={() => chooseMode('ai')} className="corio-tap corio-card" style={modeCardStyle(modeChoice === 'ai', 'rgba(41,231,255,0.12)', '#29E7FF')}>
            {modeChoice === 'ai' && <div style={checkDotStyle('#29E7FF', '#04222b')}>✓</div>}
            <div style={{ fontSize: 16 }}>🤖</div>
            <div className="corio-card-title" style={{ fontSize: 10, fontWeight: 700, marginTop: 3 }}>Frase da IA</div>
            <div className="corio-card-sub" style={{ fontSize: 7.5, color: 'rgba(244,242,248,0.45)', marginTop: 2, lineHeight: 1.25 }}>A IA cria frases desafiadoras</div>
          </div>
          <div onClick={() => chooseMode('race')} className="corio-tap corio-card" style={modeCardStyle(modeChoice === 'race', 'rgba(255,201,60,0.14)', '#FFC93C')}>
            {modeChoice === 'race' && <div style={checkDotStyle('#FFC93C', '#1a1024')}>✓</div>}
            <div style={{ fontSize: 16 }}>⏱️</div>
            <div className="corio-card-title" style={{ fontSize: 10, fontWeight: 700, marginTop: 3 }}>Corrida contra o Tempo</div>
            <div className="corio-card-sub" style={{ fontSize: 7.5, color: 'rgba(244,242,248,0.45)', marginTop: 2, lineHeight: 1.25 }}>12s por rodada — quanto mais rápido, mais pontos</div>
          </div>
        </div>
      </div>

      <div className="corio-card" style={{ flex: 'none', background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '9px 10px' }}>
        <div className="corio-eyebrow" style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.6, color: 'rgba(244,242,248,0.6)' }}>TEMAS</div>
        <div className="corio-theme-grid" style={{ gap: 8, marginTop: 8 }}>
          {visibleThemes.map((t) => {
            const on = selectedThemes.includes(t.id);
            return (
              <div
                key={t.id}
                onClick={() => toggleTheme(t.id)}
                className="corio-tap corio-card corio-theme-card"
                style={{
                  cursor: 'pointer', position: 'relative', borderRadius: 12, padding: '6px 7px', textAlign: 'center',
                  background: on ? `linear-gradient(160deg,${t.color}33,${t.color}11)` : 'rgba(255,255,255,0.03)',
                  border: `1.5px solid ${on ? t.color : 'rgba(255,255,255,0.08)'}`,
                  display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 7,
                }}
              >
                {on && <div style={{ position: 'absolute', top: 5, right: 5, width: 14, height: 14, borderRadius: '50%', background: t.color, color: '#fff', fontSize: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</div>}
                <div className="corio-icon-box" style={{ width: 24, height: 24, borderRadius: 8, background: `${t.color}2e`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flex: 'none' }}>{t.icon}</div>
                <div className="corio-card-title" style={{ fontSize: 9.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 'none', display: 'flex', gap: 8 }}>
        <div onClick={() => setPrivacy('public')} className="corio-tap corio-card" style={privacyCardStyle(privacy === 'public')}>
          <div style={{ fontSize: 13 }}>🌐</div>
          <div style={{ minWidth: 0, flex: 1 }}><div className="corio-card-title" style={{ fontSize: 10, fontWeight: 700 }}>Pública</div><div className="corio-card-sub" style={{ fontSize: 7, color: 'rgba(244,242,248,0.45)' }}>Qualquer um entra</div></div>
          {privacy === 'public' && <div style={smallCheckStyle}>✓</div>}
        </div>
        <div onClick={() => setPrivacy('private')} className="corio-tap corio-card" style={privacyCardStyle(privacy === 'private')}>
          <div style={{ fontSize: 13 }}>🔒</div>
          <div style={{ minWidth: 0, flex: 1 }}><div className="corio-card-title" style={{ fontSize: 10, fontWeight: 700 }}>Privada</div><div className="corio-card-sub" style={{ fontSize: 7, color: 'rgba(244,242,248,0.45)' }}>Só com código</div></div>
          {privacy === 'private' && <div style={smallCheckStyle}>✓</div>}
        </div>
      </div>

      {error && (
        <div style={{ fontSize: 10.5, color: '#FCA5A5', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '6px 10px', textAlign: 'center' }}>{error}</div>
      )}

      <button
        onClick={create}
        disabled={connecting}
        className="corio-tap corio-btn-lg"
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
