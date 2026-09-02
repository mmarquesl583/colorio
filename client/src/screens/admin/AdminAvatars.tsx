import { useEffect, useState } from 'react';
import { fetchAdmin, exportCsv, AdminApiError } from '../../adminApi.ts';

interface AvatarRow {
  id: string; name: string; rarity: string; free: boolean;
  inUseCount: number; inUsePct: number; unlockedCount: number;
}

const RARITY_LABELS: Record<string, string> = { comum: 'Comum', raro: 'Raro', epico: 'Épico', lendario: 'Lendário', unico: 'Único' };

export default function AdminAvatars() {
  const [data, setData] = useState<{ avatars: AvatarRow[]; mostUsed: AvatarRow[]; leastUsed: AvatarRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdmin<{ avatars: AvatarRow[]; mostUsed: AvatarRow[]; leastUsed: AvatarRow[] }>('avatars').then(setData).catch((e) => setError(e instanceof AdminApiError ? e.message : 'Erro'));
  }, []);

  if (error) return <div className="corio-admin-error">{error}</div>;
  if (!data) return <div className="corio-admin-loading">Carregando…</div>;

  return (
    <div>
      <div className="corio-admin-grid" style={{ marginBottom: 20 }}>
        <div className="corio-admin-card">
          <div className="corio-admin-card-title">Mais usados</div>
          <RankList rows={data.mostUsed} />
        </div>
        <div className="corio-admin-card">
          <div className="corio-admin-card-title">Menos usados</div>
          <RankList rows={data.leastUsed} />
        </div>
      </div>

      <div className="corio-admin-card">
        <div className="corio-admin-toolbar" style={{ padding: 0, marginBottom: 12 }}>
          <div className="corio-admin-card-title" style={{ margin: 0 }}>Todos os avatares</div>
          {data.avatars.length > 0 && <button onClick={() => exportCsv('avatares.csv', data.avatars)} className="corio-admin-btn-ghost" style={{ marginLeft: 'auto' }}>⬇ Exportar CSV</button>}
        </div>
        <div className="corio-admin-table-wrap">
          <table className="corio-admin-table">
            <thead><tr><th>Avatar</th><th>Raridade</th><th>Tipo</th><th>Em uso agora</th><th>% em uso</th><th>Desbloqueado por</th></tr></thead>
            <tbody>
              {data.avatars.map((a) => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 700 }}>{a.name}</td>
                  <td>{RARITY_LABELS[a.rarity] ?? a.rarity}</td>
                  <td><span className={`corio-admin-pill ${a.free ? 'corio-admin-pill-gray' : 'corio-admin-pill-purple'}`}>{a.free ? 'Padrão' : 'Conquista'}</span></td>
                  <td>{a.inUseCount}</td>
                  <td>{a.inUsePct}%</td>
                  <td>{a.unlockedCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RankList({ rows }: { rows: AvatarRow[] }) {
  if (rows.length === 0) return <div className="corio-admin-empty">Sem dado suficiente ainda.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((a) => (
        <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
          <span style={{ flex: 1, fontWeight: 700 }}>{a.name}</span>
          <span style={{ color: 'rgba(244,242,248,0.55)', fontWeight: 800, fontFamily: "'Space Grotesk',sans-serif" }}>{a.inUseCount}</span>
        </div>
      ))}
    </div>
  );
}
