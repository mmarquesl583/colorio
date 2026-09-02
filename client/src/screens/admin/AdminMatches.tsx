import { useEffect, useState } from 'react';
import { fetchAdmin, exportCsv, AdminApiError } from '../../adminApi.ts';

interface MatchRow {
  matchId: string; playedAt: string; modeId: string; themeIds: string[]; playerCount: number;
  winnerScore: number; durationSeconds: number; roomCode: string;
}

export default function AdminMatches({ period, onOpenMatch }: { period: string; onOpenMatch: (id: string) => void }) {
  const [data, setData] = useState<{ kpis: { total: number; today: number; avgPlayers: number; avgDurationSeconds: number }; matches: MatchRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    fetchAdmin<{ kpis: { total: number; today: number; avgPlayers: number; avgDurationSeconds: number }; matches: MatchRow[] }>('matches', { period, limit: '100' }).then(setData).catch((e) => setError(e instanceof AdminApiError ? e.message : 'Erro'));
  }, [period]);

  if (error) return <div className="corio-admin-error">{error}</div>;
  if (!data) return <div className="corio-admin-loading">Carregando…</div>;

  return (
    <div>
      <div className="corio-admin-kpis">
        <Kpi label="Partidas totais" value={data.kpis.total} />
        <Kpi label="Partidas hoje" value={data.kpis.today} />
        <Kpi label="Jogadores médios" value={data.kpis.avgPlayers} />
        <Kpi label="Duração média" value={`${Math.round(data.kpis.avgDurationSeconds / 60)}min`} />
      </div>
      <div className="corio-admin-toolbar">
        {data.matches.length > 0 && <button onClick={() => exportCsv('partidas.csv', data.matches)} className="corio-admin-btn-ghost">⬇ Exportar CSV</button>}
      </div>
      {data.matches.length === 0 ? <div className="corio-admin-empty">Nenhuma partida no período.</div> : (
        <div className="corio-admin-table-wrap">
          <table className="corio-admin-table">
            <thead><tr><th>Data</th><th>Sala</th><th>Modo</th><th>Categorias</th><th>Jogadores</th><th>Maior pontuação</th><th>Duração</th></tr></thead>
            <tbody>
              {data.matches.map((m) => (
                <tr key={m.matchId} className="is-clickable" onClick={() => onOpenMatch(m.matchId)}>
                  <td>{new Date(m.playedAt).toLocaleString('pt-BR')}</td>
                  <td style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800 }}>{m.roomCode}</td>
                  <td>{m.modeId}</td>
                  <td>{m.themeIds.join(', ')}</td>
                  <td>{m.playerCount}</td>
                  <td>{m.winnerScore.toLocaleString('pt-BR')}</td>
                  <td>{Math.round(m.durationSeconds / 60)}min</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="corio-admin-kpi">
      <div className="corio-admin-kpi-label">{label}</div>
      <div className="corio-admin-kpi-value">{value}</div>
    </div>
  );
}
