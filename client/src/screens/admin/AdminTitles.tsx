import { useEffect, useState } from 'react';
import { fetchAdmin, exportCsv, AdminApiError } from '../../adminApi.ts';

interface TitleRow {
  id: string; name: string; description: string; category: string; free: boolean;
  holders: number; pctOfPlayers: number; active: boolean;
}

export default function AdminTitles() {
  const [data, setData] = useState<{ titles: TitleRow[]; mostUnlocked: TitleRow[]; rarest: TitleRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdmin<{ titles: TitleRow[]; mostUnlocked: TitleRow[]; rarest: TitleRow[] }>('titles').then(setData).catch((e) => setError(e instanceof AdminApiError ? e.message : 'Erro'));
  }, []);

  if (error) return <div className="corio-admin-error">{error}</div>;
  if (!data) return <div className="corio-admin-loading">Carregando…</div>;

  return (
    <div>
      <div className="corio-admin-grid" style={{ marginBottom: 20 }}>
        <div className="corio-admin-card">
          <div className="corio-admin-card-title">Mais desbloqueados</div>
          <RankList rows={data.mostUnlocked} accent="#4ADE80" />
        </div>
        <div className="corio-admin-card">
          <div className="corio-admin-card-title">Mais raros</div>
          <RankList rows={data.rarest} accent="#FFC93C" />
        </div>
      </div>

      <div className="corio-admin-card">
        <div className="corio-admin-toolbar" style={{ padding: 0, marginBottom: 12 }}>
          <div className="corio-admin-card-title" style={{ margin: 0 }}>Todos os títulos</div>
          {data.titles.length > 0 && <button onClick={() => exportCsv('titulos.csv', data.titles)} className="corio-admin-btn-ghost" style={{ marginLeft: 'auto' }}>⬇ Exportar CSV</button>}
        </div>
        <div className="corio-admin-table-wrap">
          <table className="corio-admin-table">
            <thead><tr><th>Título</th><th>Categoria</th><th>Tipo</th><th>Detentores</th><th>% dos jogadores</th></tr></thead>
            <tbody>
              {data.titles.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 700 }}>{t.name}<div style={{ fontSize: 10, color: 'rgba(244,242,248,0.45)', fontWeight: 400 }}>{t.description}</div></td>
                  <td>{t.category}</td>
                  <td><span className={`corio-admin-pill ${t.free ? 'corio-admin-pill-gray' : 'corio-admin-pill-purple'}`}>{t.free ? 'Padrão' : 'Conquista'}</span></td>
                  <td>{t.holders}</td>
                  <td>{t.pctOfPlayers}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RankList({ rows }: { rows: TitleRow[]; accent: string }) {
  if (rows.length === 0) return <div className="corio-admin-empty">Sem dado suficiente ainda.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((t) => (
        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
          <span style={{ flex: 1, fontWeight: 700 }}>{t.name}</span>
          <span style={{ color: 'rgba(244,242,248,0.55)', fontWeight: 800, fontFamily: "'Space Grotesk',sans-serif" }}>{t.holders}</span>
        </div>
      ))}
    </div>
  );
}
