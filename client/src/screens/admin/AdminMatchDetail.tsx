import { useEffect, useState } from 'react';
import { fetchAdmin, AdminApiError } from '../../adminApi.ts';

interface MatchDetail {
  matchId: string; roomCode: string; playedAt: string; modeId: string; themeIds: string[]; durationSeconds: number;
  participants: { userId: string; name: string; result: string; score: number; perfects: number; correctAnswers: number; wrongAnswers: number }[];
  rounds: { userId: string; name: string; themeId: string; questionId: number | null; phrase: string; secretHex: string; guessHex: string; deltaE: number; score: number; badge: string; responseMs: number | null; createdAt: string }[];
}

export default function AdminMatchDetail({ matchId, onBack }: { matchId: string; onBack: () => void }) {
  const [data, setData] = useState<MatchDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    fetchAdmin<MatchDetail>(`matches/${matchId}`).then(setData).catch((e) => setError(e instanceof AdminApiError ? e.message : 'Erro'));
  }, [matchId]);

  return (
    <div>
      <button onClick={onBack} className="corio-admin-back">‹ Voltar</button>
      {error && <div className="corio-admin-error">{error}</div>}
      {!error && !data && <div className="corio-admin-loading">Carregando…</div>}
      {data && (
        <>
          <div className="corio-admin-card" style={{ marginBottom: 20 }}>
            <div className="corio-admin-card-title">Sala {data.roomCode} · {new Date(data.playedAt).toLocaleString('pt-BR')}</div>
            <div style={{ fontSize: 11, color: 'rgba(244,242,248,0.6)' }}>Modo {data.modeId} · {data.themeIds.join(', ')} · {Math.round(data.durationSeconds / 60)}min</div>
          </div>

          <div className="corio-admin-card" style={{ marginBottom: 20 }}>
            <div className="corio-admin-card-title">Participantes</div>
            <div className="corio-admin-table-wrap">
              <table className="corio-admin-table">
                <thead><tr><th>Jogador</th><th>Resultado</th><th>Pontuação final</th><th>Perfeitos</th><th>Acertos</th><th>Erros</th></tr></thead>
                <tbody>
                  {data.participants.map((p) => (
                    <tr key={p.userId}>
                      <td style={{ fontWeight: 700 }}>{p.name}</td>
                      <td><span className={`corio-admin-pill ${p.result === 'won' ? 'corio-admin-pill-green' : p.result === 'drawn' ? 'corio-admin-pill-yellow' : 'corio-admin-pill-gray'}`}>{p.result === 'won' ? 'Venceu' : p.result === 'drawn' ? 'Empate' : 'Perdeu'}</span></td>
                      <td>{p.score.toLocaleString('pt-BR')}</td>
                      <td>{p.perfects}</td>
                      <td>{p.correctAnswers}</td>
                      <td>{p.wrongAnswers}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="corio-admin-card">
            <div className="corio-admin-card-title">Rodadas ({data.rounds.length} palpite{data.rounds.length === 1 ? '' : 's'})</div>
            {data.rounds.length === 0 ? (
              <div className="corio-admin-empty">Sem detalhe de rodada — essa partida foi antes do rastreamento por palpite existir.</div>
            ) : (
              <div className="corio-admin-table-wrap">
                <table className="corio-admin-table">
                  <thead><tr><th>Jogador</th><th>Frase</th><th>Cor certa</th><th>Palpite</th><th>ΔE</th><th>Pontuação</th><th>Classificação</th><th>Tempo</th></tr></thead>
                  <tbody>
                    {data.rounds.map((r, i) => (
                      <tr key={i}>
                        <td>{r.name}</td>
                        <td style={{ whiteSpace: 'normal', maxWidth: 240 }}>{r.phrase}</td>
                        <td><Swatch hex={r.secretHex} /></td>
                        <td><Swatch hex={r.guessHex} /></td>
                        <td>{r.deltaE.toFixed(1)}</td>
                        <td>{r.score}</td>
                        <td><span className="corio-admin-pill corio-admin-pill-purple">{r.badge}</span></td>
                        <td>{r.responseMs !== null ? `${(r.responseMs / 1000).toFixed(1)}s` : 'timeout'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Swatch({ hex }: { hex: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 14, height: 14, borderRadius: 4, background: hex, border: '1px solid rgba(255,255,255,0.25)', flex: 'none' }} />
      {hex}
    </span>
  );
}
