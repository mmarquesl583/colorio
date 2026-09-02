import { useEffect, useState } from 'react';
import { fetchAdmin, postAdmin, exportCsv, AdminApiError } from '../../adminApi.ts';

interface AchievementRow {
  id: string; name: string; description: string; criteriaType: string; criteriaValue: number;
  createdAt: string; holders: number; active: boolean; pctOfPlayers: number;
}

export default function AdminAchievements() {
  const [data, setData] = useState<{ achievements: AchievementRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    fetchAdmin<{ achievements: AchievementRow[] }>('achievements').then(setData).catch((e) => setError(e instanceof AdminApiError ? e.message : 'Erro'));
  };
  useEffect(load, []);

  const toggle = async (id: string, active: boolean) => {
    setBusyId(id);
    try { await postAdmin(`achievements/${id}/toggle`, { active: String(active) }); load(); }
    catch (e) { setError(e instanceof AdminApiError ? e.message : 'Erro'); }
    finally { setBusyId(null); }
  };

  if (error) return <div className="corio-admin-error">{error}</div>;
  if (!data) return <div className="corio-admin-loading">Carregando…</div>;

  return (
    <div>
      <div className="corio-admin-toolbar">
        {data.achievements.length > 0 && <button onClick={() => exportCsv('conquistas.csv', data.achievements)} className="corio-admin-btn-ghost" style={{ marginLeft: 'auto' }}>⬇ Exportar CSV</button>}
      </div>
      <div className="corio-admin-table-wrap">
        <table className="corio-admin-table">
          <thead><tr><th>Conquista</th><th>Critério</th><th>Detentores</th><th>% dos jogadores</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {data.achievements.map((a) => (
              <tr key={a.id}>
                <td style={{ fontWeight: 700 }}>{a.name}<div style={{ fontSize: 10, color: 'rgba(244,242,248,0.45)', fontWeight: 400 }}>{a.description}</div></td>
                <td style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 10.5 }}>{a.criteriaType} ≥ {a.criteriaValue}</td>
                <td>{a.holders}</td>
                <td>{a.pctOfPlayers}%</td>
                <td><span className={`corio-admin-pill ${a.active ? 'corio-admin-pill-green' : 'corio-admin-pill-gray'}`}>{a.active ? 'Ativa' : 'Desativada'}</span></td>
                <td>
                  <button disabled={busyId === a.id} onClick={() => toggle(a.id, !a.active)} className="corio-admin-btn-ghost">
                    {a.active ? 'Desativar' : 'Ativar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
