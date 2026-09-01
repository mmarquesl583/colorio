import { useState } from 'react';
import Logo from '../components/Logo.tsx';
import { LOBBY_THEMES } from '@shared/gameData';
import { AI_QUESTIONS } from '@shared/aiQuestions';
import { avatarSmallSrc } from '@shared/avatarIcons';
import { titleNameFor } from '@shared/titleCatalog';
import type { RoomConnection } from '../ws.ts';

const AI_ELIGIBLE_IDS = new Set(Object.keys(AI_QUESTIONS));
type ModeChoice = 'players' | 'ai' | 'race';

export default function WaitingScreen({ conn }: { conn: RoomConnection }) {
  const s = conn.state!;
  const [copyLabel, setCopyLabel] = useState('🔗 Compartilhar');
  const [editingConfig, setEditingConfig] = useState(false);
  const isHost = s.you.isHost;
  const slots = Array.from({ length: s.config.numPlayers }, (_, i) => s.players[i] ?? null);

  const copyLink = () => {
    navigator.clipboard?.writeText(s.code).catch(() => {});
    setCopyLabel('✓ Copiado!');
    setTimeout(() => setCopyLabel('🔗 Compartilhar'), 1500);
  };

  const chooseMode = (mode: ModeChoice) => {
    const needsAiThemes = mode === 'ai' || mode === 'race';
    const nextThemes = needsAiThemes ? s.config.selectedThemes.filter((id) => AI_ELIGIBLE_IDS.has(id)) : s.config.selectedThemes;
    conn.send({
      type: 'update_config',
      config: {
        phraseMode: mode === 'players' ? 'players' : 'ai',
        gameMode: mode === 'race' ? 'race' : 'classic',
        selectedThemes: nextThemes,
      },
    });
  };
  const toggleTheme = (id: string) => {
    const has = s.config.selectedThemes.includes(id);
    const next = has ? s.config.selectedThemes.filter((x) => x !== id) : [...s.config.selectedThemes, id];
    conn.send({ type: 'update_config', config: { selectedThemes: next } });
  };
  const currentModeChoice: ModeChoice = s.config.gameMode === 'race' ? 'race' : s.config.phraseMode === 'ai' ? 'ai' : 'players';
  const visibleThemes = (s.config.phraseMode === 'ai' || s.config.gameMode === 'race') ? LOBBY_THEMES.filter((t) => AI_ELIGIBLE_IDS.has(t.id)) : LOBBY_THEMES;

  return (
    <div className="corio-wide" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '8px 16px 12px', gap: 8, animation: 'corio-rise .4s ease' }}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ width: 28 }} />
        <Logo size={17} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div onClick={conn.leaveRoom} className="corio-tap" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 999, padding: '5px 9px', fontSize: 9, fontWeight: 700, color: '#FCA5A5' }}>↩ SAIR</div>
          <div className="corio-you-chip">
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${s.you.color}33`, border: `1.5px solid ${s.you.color}`, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', overflow: 'hidden' }}>
              {s.you.avatarId ? <img src={avatarSmallSrc(s.you.avatarId)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : s.you.initial}
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 700 }}>Você</div>
          </div>
        </div>
      </div>

      <div style={{ flex: 'none', position: 'relative' }}>
        <span className="corio-sparkle" style={{ left: -14, top: -8, fontSize: 12, animation: 'corio-twinkle 1.8s ease-in-out infinite' }}>✦</span>
        <div className="corio-title" style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 14.5, color: '#C4B5FD' }}>SALA CRIADA!</div>
        <div className="corio-subtitle" style={{ fontSize: 9.5, color: 'rgba(244,242,248,0.5)' }}>Convide seus amigos e comece a diversão.</div>
      </div>

      <div className="corio-card" style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8, background: '#12121a', border: '1px solid rgba(139,92,246,0.35)', borderRadius: 13, padding: '8px 10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="corio-eyebrow" style={{ fontSize: 7, fontWeight: 700, letterSpacing: 0.6, color: 'rgba(244,242,248,0.4)' }}>CÓDIGO DA SALA</div>
          <div className="corio-value-lg" style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 17, letterSpacing: 2 }}>{s.code}</div>
        </div>
        <button onClick={copyLink} className="corio-tap" style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, background: '#8B5CF6', color: '#fff', fontWeight: 700, fontSize: 10, padding: '8px 12px', borderRadius: 10, whiteSpace: 'nowrap' }}>{copyLabel}</button>
      </div>

      <div className="corio-card corio-noscroll" style={{ flex: editingConfig ? 1 : 'none', minHeight: 0, background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 13, padding: '8px 10px', display: 'flex', flexDirection: 'column', overflowY: editingConfig ? 'auto' : undefined }}>
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div className="corio-eyebrow" style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.6, color: 'rgba(244,242,248,0.6)' }}>⚙️ CONFIGURAÇÕES DA SALA</div>
          {isHost && (
            <div onClick={() => setEditingConfig((v) => !v)} className="corio-tap" style={{ cursor: 'pointer', fontSize: 8.5, fontWeight: 700, color: '#A78BFA', background: 'rgba(139,92,246,0.15)', padding: '3px 8px', borderRadius: 999 }}>
              {editingConfig ? '✓ Concluir' : '✏️ Editar'}
            </div>
          )}
        </div>

        {!editingConfig && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <ConfigChip label="👥 Jogadores" value={String(s.config.numPlayers)} />
            <ConfigChip label="⏱ Rodadas" value={String(s.config.numRounds)} />
            <ConfigChip label="🎮 Modo de jogo" value={currentModeChoice === 'race' ? 'Corrida contra o Tempo' : currentModeChoice === 'ai' ? 'Frase da IA' : 'Frase dos jogadores'} valueColor="#C4B5FD" span2 />
            <ConfigChip label="🎨 Temas" value={`${s.config.selectedThemes.length} selecionados`} valueColor="#4ADE80" span2 />
          </div>
        )}

        {editingConfig && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <ConfigChip label="👥 Jogadores" value={String(s.config.numPlayers)} />
              <ConfigChip label="⏱ Rodadas" value={String(s.config.numRounds)} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div onClick={() => chooseMode('players')} className="corio-tap corio-card" style={modeCardStyle(currentModeChoice === 'players', 'rgba(139,92,246,0.15)', '#8B5CF6')}>
                {currentModeChoice === 'players' && <div style={checkDotStyle('#8B5CF6')}>✓</div>}
                <div style={{ fontSize: 16 }}>✏️</div>
                <div className="corio-card-title" style={{ fontSize: 10, fontWeight: 700, marginTop: 3 }}>Frase dos jogadores</div>
              </div>
              <div onClick={() => chooseMode('ai')} className="corio-tap corio-card" style={modeCardStyle(currentModeChoice === 'ai', 'rgba(41,231,255,0.12)', '#29E7FF')}>
                {currentModeChoice === 'ai' && <div style={checkDotStyle('#29E7FF', '#04222b')}>✓</div>}
                <div style={{ fontSize: 16 }}>🤖</div>
                <div className="corio-card-title" style={{ fontSize: 10, fontWeight: 700, marginTop: 3 }}>Frase da IA</div>
              </div>
              <div onClick={() => chooseMode('race')} className="corio-tap corio-card" style={modeCardStyle(currentModeChoice === 'race', 'rgba(255,201,60,0.14)', '#FFC93C')}>
                {currentModeChoice === 'race' && <div style={checkDotStyle('#FFC93C', '#1a1024')}>✓</div>}
                <div style={{ fontSize: 16 }}>⏱️</div>
                <div className="corio-card-title" style={{ fontSize: 10, fontWeight: 700, marginTop: 3 }}>Corrida contra o Tempo</div>
              </div>
            </div>
            <div className="corio-eyebrow" style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: 0.6, color: 'rgba(244,242,248,0.45)' }}>TEMAS</div>
            <div className="corio-theme-grid" style={{ gap: 7 }}>
              {visibleThemes.map((t) => {
                const on = s.config.selectedThemes.includes(t.id);
                return (
                  <div
                    key={t.id}
                    onClick={() => toggleTheme(t.id)}
                    className="corio-tap corio-card corio-theme-card"
                    style={{
                      cursor: 'pointer', position: 'relative', borderRadius: 12, padding: '7px 7px', textAlign: 'center',
                      background: on ? `linear-gradient(160deg,${t.color}33,${t.color}11)` : 'rgba(255,255,255,0.03)',
                      border: `1.5px solid ${on ? t.color : 'rgba(255,255,255,0.08)'}`,
                      display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 7,
                    }}
                  >
                    {on && <div style={{ position: 'absolute', top: 5, right: 5, width: 14, height: 14, borderRadius: '50%', background: t.color, color: '#fff', fontSize: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</div>}
                    <div className="corio-icon-box" style={{ width: 26, height: 26, borderRadius: 8, background: `${t.color}2e`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flex: 'none' }}>{t.icon}</div>
                    <div className="corio-card-title" style={{ fontSize: 9.5, fontWeight: 700 }}>{t.name}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {!editingConfig && (
        <div className="corio-card" style={{ flex: 1, minHeight: 0, background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '9px 10px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div className="corio-eyebrow" style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.6, color: 'rgba(244,242,248,0.6)' }}>JOGADORES</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#A78BFA', fontFamily: "'Space Grotesk',sans-serif" }}>{s.players.length}/{s.config.numPlayers}</div>
          </div>
          <div className="corio-noscroll corio-player-grid" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {slots.map((p, i) => p ? (
              <div key={p.id} className="corio-card" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', flex: 'none' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${p.color}33`, border: `1.5px solid ${p.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flex: 'none', overflow: 'hidden' }}>
                  {p.avatarId ? <img src={avatarSmallSrc(p.avatarId)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : p.initial}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div className="corio-card-title" style={{ fontSize: 11, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.id === s.you.id ? 'Você' : p.name}</div>
                    {p.isHost && <div style={{ fontSize: 6.5, fontWeight: 700, color: '#C4B5FD', background: 'rgba(139,92,246,0.2)', padding: '2px 5px', borderRadius: 999 }}>ANFITRIÃO</div>}
                  </div>
                  <div style={{ fontSize: 8, fontWeight: 700, color: '#FFC93C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titleNameFor(p.titleId)}</div>
                  <div className="corio-card-sub" style={{ fontSize: 8.5, fontWeight: 600, color: p.connected ? '#4ADE80' : '#FCA5A5' }}>{p.connected ? 'Pronto para jogar!' : 'Reconectando…'}</div>
                </div>
                <div style={{ fontSize: 13, flex: 'none' }}>{p.connected ? '✅' : '🔄'}</div>
              </div>
            ) : (
              <div key={'empty' + i} className="corio-card" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 10, background: 'transparent', flex: 'none' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', border: '1.5px dashed rgba(255,255,255,0.2)', flex: 'none' }} />
                <div className="corio-card-sub" style={{ flex: 1, minWidth: 0, fontSize: 11, color: 'rgba(244,242,248,0.35)' }}>Aguardando jogador...</div>
                <div style={{ fontSize: 13, flex: 'none' }}>➕</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!editingConfig && (
        <div className="corio-card" style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 10, background: 'linear-gradient(90deg,rgba(139,92,246,0.15),rgba(255,201,60,0.1))', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 14, padding: '10px 12px' }}>
          <div style={{ fontSize: 18, animation: 'corio-breathe 2.2s ease-in-out infinite' }}>🏆</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="corio-card-title" style={{ fontSize: 11, fontWeight: 800 }}>{isHost ? 'O jogo vai começar!' : 'Aguardando o anfitrião...'}</div>
            <div className="corio-card-sub" style={{ fontSize: 8, color: 'rgba(244,242,248,0.5)' }}>{isHost ? 'Quando todos estiverem prontos.' : 'Ele decide a hora de começar.'}</div>
          </div>
          {isHost && (() => {
            const minPlayers = (s.config.phraseMode === 'ai' || s.config.gameMode === 'race') ? 1 : 2;
            const canStart = s.players.length >= minPlayers;
            return (
            <button
              onClick={() => conn.send({ type: 'start_match' })}
              disabled={!canStart}
              className="corio-tap corio-btn-lg"
              style={{ all: 'unset', cursor: canStart ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(90deg,#8B5CF6,#FFC93C)', color: '#1a1024', fontWeight: 800, fontSize: 11, padding: '10px 14px', borderRadius: 11, whiteSpace: 'nowrap', opacity: canStart ? 1 : 0.5 }}
            >▶ COMEÇAR</button>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function ConfigChip({ label, value, valueColor, span2 }: { label: string; value: string; valueColor?: string; span2?: boolean }) {
  return (
    <div style={{ gridColumn: span2 ? 'span 2' : undefined, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '5px 8px' }}>
      <div className="corio-card-sub" style={{ fontSize: 8.5, fontWeight: 700, color: 'rgba(244,242,248,0.55)' }}>{label}</div>
      <div className="corio-card-title" style={{ fontSize: valueColor ? 9.5 : 11, fontWeight: valueColor ? 700 : 800, fontFamily: valueColor ? undefined : "'Space Grotesk',sans-serif", color: valueColor }}>{value}</div>
    </div>
  );
}

function modeCardStyle(on: boolean, bg: string, border: string): React.CSSProperties {
  return { cursor: 'pointer', flex: 1, minWidth: 0, borderRadius: 11, padding: '9px 8px', textAlign: 'center', background: on ? bg : 'rgba(255,255,255,0.03)', border: `1px solid ${on ? border : 'rgba(255,255,255,0.08)'}`, position: 'relative' };
}
function checkDotStyle(bg: string, color = '#fff'): React.CSSProperties {
  return { position: 'absolute', top: 5, right: 5, width: 14, height: 14, borderRadius: '50%', background: bg, color, fontSize: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' };
}
