import { useEffect, useState } from 'react';
import { fetchAdmin, exportCsv, AdminApiError } from '../../adminApi.ts';

interface CategoryRow {
  themeId: string; themeName: string; icon: string; matchesPlayed: number; players: number;
  accuracyPct: number | null; perfects: number; hasAiBank: boolean;
}

export default function AdminCategories({ period }: { period: string }) {
  const [data, setData] = useState<{ byPopularity: CategoryRow[]; byAccuracyDesc: CategoryRow[]; byAccuracyAsc: CategoryRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    fetchAdmin<{ byPopularity: CategoryRow[]; byAccuracyDesc: CategoryRow[]; byAccuracyAsc: CategoryRow[] }>('categories', { period }).then(setData).catch((e) => setError(e instanceof AdminApiError ? e.message : 'Erro'));
  }, [period]);

  if (error) return <div className="corio-admin-error">{error}</div>;
  if (!data) return <div className="corio-admin-loading">Carregando…</div>;

  return (
    <div>
      <div className="corio-admin-grid" style={{ marginBottom: 20 }}>
        <div className="corio-admin-card">
          <div className="corio-admin-card-title">Mais fáceis (maior precisão)</div>
          <RankList rows={data.byAccuracyDesc.slice(0, 5)} accent="#4ADE80" />
        </div>
        <div className="corio-admin-card">
          <div className="corio-admin-card-title">Mais difíceis (menor precisão)</div>
          <RankList rows={data.byAccuracyAsc.slice(0, 5)} accent="#FF5C8A" />
        </div>
      </div>

      <div className="corio-admin-card">
        <div className="corio-admin-toolbar" style={{ padding: 0, marginBottom: 12 }}>
          <div className="corio-admin-card-title" style={{ margin: 0 }}>Todas as categorias (por popularidade)</div>
          {data.byPopularity.length > 0 && (
            <button onClick={() => exportCsv('categorias.csv', data.byPopularity)} className="corio-admin-btn-ghost" style={{ marginLeft: 'auto' }}>⬇ Exportar CSV</button>
          )}
        </div>
        <div className="corio-admin-table-wrap">
          <table className="corio-admin-table">
            <thead><tr><th>Categoria</th><th>Partidas</th><th>Jogadores com stats</th><th>Precisão</th><th>Perfeitos</th><th>Frase da IA</th></tr></thead>
            <tbody>
              {data.byPopularity.map((c) => (
                <tr key={c.themeId}>
                  <td>{c.icon} {c.themeName}</td>
                  <td>{c.matchesPlayed}</td>
                  <td>{c.players}</td>
                  <td>{c.accuracyPct !== null ? `${c.accuracyPct}%` : '—'}</td>
                  <td>{c.perfects}</td>
                  <td>{c.hasAiBank ? 'Sim' : 'Não'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RankList({ rows, accent }: { rows: CategoryRow[]; accent: string }) {
  if (rows.length === 0) return <div className="corio-admin-empty">Sem dado suficiente ainda.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((c) => (
        <div key={c.themeId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
          <span style={{ flex: 1, fontWeight: 700 }}>{c.icon} {c.themeName}</span>
          <span style={{ color: accent, fontWeight: 800, fontFamily: "'Space Grotesk',sans-serif" }}>{c.accuracyPct}%</span>
        </div>
      ))}
    </div>
  );
}
