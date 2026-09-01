import Logo from '../components/Logo.tsx';
import { avatarSmallSrc } from '@shared/avatarIcons';
import { titleNameFor } from '@shared/titleCatalog';
import type { RoomConnection } from '../ws.ts';

export default function MatchEndScreen({ conn }: { conn: RoomConnection }) {
  const s = conn.state!;
  const winner = s.matchWinner;
  const isHost = s.you.isHost;
  const ranked = [...s.players].sort((a, b) => b.score - a.score);

  const reasonLabel = winner?.reason === 'perfect'
    ? 'conseguiu 5 acertos perfeitos'
    : winner?.reason === 'rounds'
      ? 'terminou com mais pontos'
      : 'chegou a 10.000 pontos';
  const winnerIds = new Set(winner?.winners.map((w) => w.playerId) ?? []);
  const isDraw = Boolean(winner?.isDraw);

  return (
    <div className="corio-wide corio-noscroll" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '8px 16px 12px', gap: 8, overflowY: 'auto', animation: 'corio-rise .4s ease' }}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ width: 28 }} />
        <Logo size={17} />
        <div onClick={conn.leaveRoom} className="corio-tap" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 999, padding: '5px 9px', fontSize: 9, fontWeight: 700, color: '#FCA5A5' }}>↩ SAIR</div>
      </div>

      <div className="corio-card" style={{ flex: 'none', textAlign: 'center', background: 'linear-gradient(135deg,rgba(139,92,246,0.18),rgba(255,201,60,0.12))', border: '1px solid rgba(255,201,60,0.35)', borderRadius: 16, padding: '20px 14px', position: 'relative' }}>
        <div style={{ fontSize: 30, animation: 'corio-breathe 2s ease-in-out infinite' }}>{isDraw ? '🤝' : '🏆'}</div>
        <div className="corio-title" style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 17, marginTop: 6 }}>
          {isDraw ? 'EMPATE!' : winnerIds.has(s.you.id) ? 'VOCÊ VENCEU!' : `${winner?.name ?? '—'} VENCEU!`}
        </div>
        <div className="corio-subtitle" style={{ fontSize: 11, color: 'rgba(244,242,248,0.6)', marginTop: 3 }}>
          {!winner ? 'Partida encerrada' : isDraw
            ? `${winner.winners.map((w) => w.name).join(' e ')} empataram com ${winner.score.toLocaleString('pt-BR')} pontos`
            : `${winner.name} ${reasonLabel} — ${winner.score.toLocaleString('pt-BR')} pontos`}
        </div>
      </div>

      <div className="corio-card" style={{ flex: 1, minHeight: 0, background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '9px 10px', display: 'flex', flexDirection: 'column' }}>
        <div className="corio-eyebrow" style={{ flex: 'none', fontSize: 9, fontWeight: 700, letterSpacing: 0.6, color: 'rgba(244,242,248,0.6)', marginBottom: 6 }}>PLACAR FINAL</div>
        <div className="corio-noscroll corio-player-grid" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {ranked.map((p, i) => {
            const isWinner = winnerIds.has(p.id);
            return (
              <div key={p.id} className="corio-card" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 10, background: isWinner ? 'rgba(255,201,60,0.1)' : 'rgba(255,255,255,0.03)', border: isWinner ? '1px solid rgba(255,201,60,0.35)' : undefined, flex: 'none' }}>
                <div style={{ width: 18, textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'rgba(244,242,248,0.45)', flex: 'none' }}>{i + 1}</div>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${p.color}33`, border: `1.5px solid ${p.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flex: 'none', overflow: 'hidden' }}>
                  {p.avatarId ? <img src={avatarSmallSrc(p.avatarId)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : p.initial}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="corio-card-title" style={{ fontSize: 11, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.id === s.you.id ? 'Você' : p.name}</div>
                  <div style={{ fontSize: 8, fontWeight: 700, color: '#FFC93C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titleNameFor(p.titleId)}</div>
                </div>
                {isWinner && <div style={{ fontSize: 13, flex: 'none' }}>{isDraw ? '🤝' : '🏆'}</div>}
                <div style={{ fontSize: 13, fontWeight: 800, fontFamily: "'Space Grotesk',sans-serif", flex: 'none' }}>{p.score.toLocaleString('pt-BR')}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="corio-card" style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 10, background: 'linear-gradient(90deg,rgba(139,92,246,0.15),rgba(255,201,60,0.1))', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 14, padding: '10px 12px' }}>
        <div style={{ fontSize: 18 }}>🔄</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="corio-card-title" style={{ fontSize: 11, fontWeight: 800 }}>{isHost ? 'Jogar de novo?' : 'Aguardando o anfitrião...'}</div>
          <div className="corio-card-sub" style={{ fontSize: 8, color: 'rgba(244,242,248,0.5)' }}>{isHost ? 'Reinicia com os mesmos jogadores, pontos zerados.' : 'Ele decide quando reiniciar a partida.'}</div>
        </div>
        {isHost ? (
          <button
            onClick={() => conn.send({ type: 'restart_match' })}
            className="corio-tap corio-btn-lg"
            style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(90deg,#8B5CF6,#FFC93C)', color: '#1a1024', fontWeight: 800, fontSize: 11, padding: '10px 14px', borderRadius: 11, whiteSpace: 'nowrap' }}
          >🔄 Jogar novamente</button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#8B5CF6', animation: 'corio-pulse 1.2s infinite' }} />
          </div>
        )}
      </div>
    </div>
  );
}
