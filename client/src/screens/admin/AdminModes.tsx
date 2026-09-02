import { useEffect, useState } from 'react';
import { fetchAdmin, AdminApiError } from '../../adminApi.ts';
import { BarChart } from '../../components/admin/Charts.tsx';

interface ModeRow {
  modeId: string; label: string; matches: number; participants: number;
  avgDurationSeconds: number; avgScore: number; accuracyPct: number | null;
}

export default function AdminModes({ period }: { period: string }) {
  const [data, setData] = useState<{ modes: ModeRow[]; note: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    fetchAdmin<{ modes: ModeRow[]; note: string }>('modes', { period }).then(setData).catch((e) => setError(e instanceof AdminApiError ? e.message : 'Erro'));
  }, [period]);

  if (error) return <div className="corio-admin-error">{error}</div>;
  if (!data) return <div className="corio-admin-loading">Carregando…</div>;

  return (
    <div>
      <div className="corio-admin-grid" style={{ marginBottom: 20 }}>
        <div className="corio-admin-card">
          <div className="corio-admin-card-title">Partidas por modo</div>
          <BarChart data={data.modes.map((m) => ({ label: m.label, count: m.matches }))} color="#8B5CF6" />
        </div>
        <div className="corio-admin-card">
          <div className="corio-admin-card-title">Pontuação média por modo</div>
          <BarChart data={data.modes.map((m) => ({ label: m.label, count: m.avgScore }))} color="#FFC93C" />
        </div>
      </div>

      <div className="corio-admin-card" style={{ marginBottom: 12 }}>
        <div className="corio-admin-table-wrap">
          <table className="corio-admin-table">
            <thead><tr><th>Modo</th><th>Partidas</th><th>Participantes</th><th>Duração média</th><th>Pontuação média</th><th>Precisão</th></tr></thead>
            <tbody>
              {data.modes.map((m) => (
                <tr key={m.modeId}>
                  <td style={{ fontWeight: 700 }}>{m.label}</td>
                  <td>{m.matches}</td>
                  <td>{m.participants}</td>
                  <td>{Math.round(m.avgDurationSeconds / 60)}min</td>
                  <td>{m.avgScore.toLocaleString('pt-BR')}</td>
                  <td>{m.accuracyPct !== null ? `${m.accuracyPct}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ fontSize: 10.5, color: 'rgba(244,242,248,0.45)' }}>{data.note}</div>
    </div>
  );
}
