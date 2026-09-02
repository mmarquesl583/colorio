import { useEffect, useState } from 'react';
import { fetchAdmin, exportCsv, AdminApiError } from '../../adminApi.ts';
import { LOBBY_THEMES } from '@shared/gameData';

interface ReportRow {
  id: number; user_id: string | null; room_code: string; theme_id: string;
  question_id: number | null; phrase: string; created_at: string;
}

const THEME_NAMES = new Map(LOBBY_THEMES.map((t) => [t.id, t.name]));

export default function AdminReports() {
  const [data, setData] = useState<{ reports: ReportRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdmin<{ reports: ReportRow[] }>('reports').then(setData).catch((e) => setError(e instanceof AdminApiError ? e.message : 'Erro'));
  }, []);

  if (error) return <div className="corio-admin-error">{error}</div>;
  if (!data) return <div className="corio-admin-loading">Carregando…</div>;

  return (
    <div>
      <div className="corio-admin-card" style={{ marginBottom: 16, fontSize: 11.5, color: 'rgba(244,242,248,0.6)', lineHeight: 1.6 }}>
        Essas são denúncias de <strong>pergunta com problema</strong> (jogador reporta uma frase/pergunta da IA que pareceu errada ou confusa),
        enviadas pelo botão de reportar já existente no jogo. Denúncia de <strong>jogador contra jogador</strong> ainda não existe como
        funcionalidade — fica pra uma próxima etapa, já que exige uma tela nova dentro do jogo, não só no admin.
      </div>

      <div className="corio-admin-toolbar">
        {data.reports.length > 0 && <button onClick={() => exportCsv('denuncias.csv', data.reports)} className="corio-admin-btn-ghost" style={{ marginLeft: 'auto' }}>⬇ Exportar CSV</button>}
      </div>

      {data.reports.length === 0 ? <div className="corio-admin-empty">Nenhuma denúncia registrada.</div> : (
        <div className="corio-admin-table-wrap">
          <table className="corio-admin-table">
            <thead><tr><th>Data</th><th>Sala</th><th>Categoria</th><th>Pergunta reportada</th></tr></thead>
            <tbody>
              {data.reports.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.created_at).toLocaleString('pt-BR')}</td>
                  <td style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800 }}>{r.room_code}</td>
                  <td>{THEME_NAMES.get(r.theme_id) ?? r.theme_id}</td>
                  <td style={{ whiteSpace: 'normal', maxWidth: 400 }}>{r.phrase}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
