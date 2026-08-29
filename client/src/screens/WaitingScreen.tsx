import { useState } from 'react';
import Logo from '../components/Logo.tsx';
import type { RoomConnection } from '../ws.ts';

export default function WaitingScreen({ conn }: { conn: RoomConnection }) {
  const s = conn.state!;
  const [copyLabel, setCopyLabel] = useState('🔗 Compartilhar');
  const isHost = s.you.isHost;
  const slots = Array.from({ length: s.config.numPlayers }, (_, i) => s.players[i] ?? null);

  const copyLink = () => {
    navigator.clipboard?.writeText(s.code).catch(() => {});
    setCopyLabel('✓ Copiado!');
    setTimeout(() => setCopyLabel('🔗 Compartilhar'), 1500);
  };

  return (
    <div className="corio-wide" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '8px 16px 12px', gap: 8 }}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ width: 28 }} />
        <Logo size={17} />
        <div onClick={conn.leaveRoom} className="corio-tap" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 999, padding: '5px 9px', fontSize: 9, fontWeight: 700, color: '#FCA5A5' }}>↩ SAIR</div>
      </div>

      <div style={{ flex: 'none' }}>
        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 14.5, color: '#C4B5FD' }}>SALA CRIADA!</div>
        <div style={{ fontSize: 9.5, color: 'rgba(244,242,248,0.5)' }}>Convide seus amigos e comece a diversão.</div>
      </div>

      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8, background: '#12121a', border: '1px solid rgba(139,92,246,0.35)', borderRadius: 13, padding: '8px 10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: 0.6, color: 'rgba(244,242,248,0.4)' }}>CÓDIGO DA SALA</div>
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 17, letterSpacing: 2 }}>{s.code}</div>
        </div>
        <button onClick={copyLink} className="corio-tap" style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, background: '#8B5CF6', color: '#fff', fontWeight: 700, fontSize: 10, padding: '8px 12px', borderRadius: 10, whiteSpace: 'nowrap' }}>{copyLabel}</button>
      </div>

      <div style={{ flex: 'none', background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 13, padding: '8px 10px' }}>
        <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.6, color: 'rgba(244,242,248,0.6)', marginBottom: 6 }}>⚙️ CONFIGURAÇÕES DA SALA</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <ConfigChip label="👥 Jogadores" value={String(s.config.numPlayers)} />
          <ConfigChip label="⏱ Rodadas" value={String(s.config.numRounds)} />
          <ConfigChip label="💬 Modo de frase" value={s.config.phraseMode === 'ai' ? 'Frase da IA' : 'Frase dos jogadores'} valueColor="#C4B5FD" span2 />
          <ConfigChip label="🎨 Temas" value={`${s.config.selectedThemes.length} selecionados`} valueColor="#4ADE80" span2 />
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '9px 10px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.6, color: 'rgba(244,242,248,0.6)' }}>JOGADORES</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#A78BFA', fontFamily: "'Space Grotesk',sans-serif" }}>{s.players.length}/{s.config.numPlayers}</div>
        </div>
        <div className="corio-noscroll corio-player-grid" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {slots.map((p, i) => p ? (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', flex: 'none' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${p.color}33`, border: `1.5px solid ${p.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flex: 'none' }}>{p.initial}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.id === s.you.id ? 'Você' : p.name}</div>
                  {p.isHost && <div style={{ fontSize: 6.5, fontWeight: 700, color: '#C4B5FD', background: 'rgba(139,92,246,0.2)', padding: '2px 5px', borderRadius: 999 }}>ANFITRIÃO</div>}
                </div>
                <div style={{ fontSize: 8.5, fontWeight: 600, color: '#4ADE80' }}>Pronto para jogar!</div>
              </div>
              <div style={{ fontSize: 13, flex: 'none' }}>✅</div>
            </div>
          ) : (
            <div key={'empty' + i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 10, background: 'transparent', flex: 'none' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', border: '1.5px dashed rgba(255,255,255,0.2)', flex: 'none' }} />
              <div style={{ flex: 1, minWidth: 0, fontSize: 11, color: 'rgba(244,242,248,0.35)' }}>Aguardando jogador...</div>
              <div style={{ fontSize: 13, flex: 'none' }}>➕</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 10, background: 'linear-gradient(90deg,rgba(139,92,246,0.15),rgba(255,201,60,0.1))', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 14, padding: '10px 12px' }}>
        <div style={{ fontSize: 18, animation: 'corio-breathe 2.2s ease-in-out infinite' }}>🏆</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 800 }}>{isHost ? 'O jogo vai começar!' : 'Aguardando o anfitrião...'}</div>
          <div style={{ fontSize: 8, color: 'rgba(244,242,248,0.5)' }}>{isHost ? 'Quando todos estiverem prontos.' : 'Ele decide a hora de começar.'}</div>
        </div>
        {isHost && (
          <button
            onClick={() => conn.send({ type: 'start_match' })}
            disabled={s.players.length < 2}
            className="corio-tap"
            style={{ all: 'unset', cursor: s.players.length < 2 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(90deg,#8B5CF6,#FFC93C)', color: '#1a1024', fontWeight: 800, fontSize: 11, padding: '10px 14px', borderRadius: 11, whiteSpace: 'nowrap', opacity: s.players.length < 2 ? 0.5 : 1 }}
          >▶ COMEÇAR</button>
        )}
      </div>
    </div>
  );
}

function ConfigChip({ label, value, valueColor, span2 }: { label: string; value: string; valueColor?: string; span2?: boolean }) {
  return (
    <div style={{ gridColumn: span2 ? 'span 2' : undefined, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '5px 8px' }}>
      <div style={{ fontSize: 8.5, fontWeight: 700, color: 'rgba(244,242,248,0.55)' }}>{label}</div>
      <div style={{ fontSize: valueColor ? 9.5 : 11, fontWeight: valueColor ? 700 : 800, fontFamily: valueColor ? undefined : "'Space Grotesk',sans-serif", color: valueColor }}>{value}</div>
    </div>
  );
}
