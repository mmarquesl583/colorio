import { useEffect, useState } from 'react';
import { avatarSmallSrc } from '@shared/avatarIcons';
import { LOBBY_THEMES } from '@shared/gameData';
import { fetchMatchParticipants, type MatchParticipant } from '../stats.ts';

const MODE_LABELS: Record<string, string> = { players: 'Frase dos jogadores', ai: 'Frase da IA', race: 'Corrida contra o Tempo', verbal: 'Com a Galera' };
const THEME_NAMES = new Map(LOBBY_THEMES.map((t) => [t.id, t.name]));

export default function MatchDetailModal({ matchId, youUserId, onClose }: { matchId: string; youUserId: string | null; onClose: () => void }) {
  const [rows, setRows] = useState<MatchParticipant[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMatchParticipants(matchId).then((r) => { if (!cancelled) setRows(r); });
    return () => { cancelled = true; };
  }, [matchId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const first = rows?.[0] ?? null;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(5,5,7,0.75)', backdropFilter: 'blur(3px)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="corio-card" style={{ width: '100%', maxWidth: 380, maxHeight: '80vh', overflowY: 'auto', background: '#12121a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div className="corio-title" style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 14 }}>Detalhe da partida</div>
          <button onClick={onClose} className="corio-tap" style={{ all: 'unset', cursor: 'pointer', width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }} aria-label="Fechar">✕</button>
        </div>

        {!rows && <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 11, fontWeight: 700, color: 'rgba(244,242,248,0.5)' }}>Carregando…</div>}
        {rows && rows.length === 0 && <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 11, fontWeight: 700, color: 'rgba(244,242,248,0.5)' }}>Não foi possível carregar essa partida.</div>}

        {rows && rows.length > 0 && first && (
          <>
            <div style={{ fontSize: 10.5, color: 'rgba(244,242,248,0.55)', marginBottom: 12 }}>
              {MODE_LABELS[first.mode_id] ?? first.mode_id} · {first.theme_ids.map((id) => THEME_NAMES.get(id) ?? id).join(', ')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {rows.map((p, i) => (
                <div key={p.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: p.user_id === youUserId ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.03)', border: p.user_id === youUserId ? '1px solid rgba(139,92,246,0.35)' : '1px solid transparent', borderRadius: 10, padding: '8px 10px' }}>
                  <div style={{ width: 16, fontSize: 10, fontWeight: 800, color: 'rgba(244,242,248,0.4)', flex: 'none', textAlign: 'center' }}>{i + 1}</div>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flex: 'none', overflow: 'hidden' }}>
                    {p.avatar_id ? <img src={avatarSmallSrc(p.avatar_id)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : p.name[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 11, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.user_id === youUserId ? 'Você' : p.name}
                  </div>
                  <div style={{ fontSize: 10, flex: 'none' }}>{p.result === 'won' ? '🏆' : p.result === 'drawn' ? '🤝' : ''}</div>
                  <div style={{ fontSize: 12, fontWeight: 800, fontFamily: "'Space Grotesk',sans-serif", flex: 'none' }}>{p.score.toLocaleString('pt-BR')}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
