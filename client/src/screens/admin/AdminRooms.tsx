import { useEffect, useState } from 'react';
import { fetchAdmin, AdminApiError } from '../../adminApi.ts';

interface LiveData {
  playersOnline: number; activeRooms: number; matchesInProgress: number;
  topCategory: string | null; topMode: string | null;
  rooms: { code: string; hostName: string | null; screen: string; privacy: string; modeId: string; playerCount: number; roundNumber: number | null; numRounds: number; maxScore: number; themeName: string | null; createdAt: string }[];
}

const SCREEN_LABELS: Record<string, string> = { lobby: 'Na sala de espera', playing: 'Em andamento', reveal: 'Revelação', finished: 'Finalizada' };

export default function AdminRooms() {
  const [data, setData] = useState<LiveData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const poll = () => fetchAdmin<LiveData>('live').then((d) => { if (!cancelled) setData(d); }).catch((e) => setError(e instanceof AdminApiError ? e.message : 'Erro'));
    poll();
    const id = setInterval(poll, 6000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (error) return <div className="corio-admin-error">{error}</div>;
  if (!data) return <div className="corio-admin-loading">Carregando…</div>;

  return (
    <div>
      <div className="corio-admin-kpis">
        <Kpi label="Salas ativas agora" value={data.activeRooms} accent="#29E7FF" />
        <Kpi label="Jogadores online" value={data.playersOnline} accent="#4ADE80" />
        <Kpi label="Partidas rolando" value={data.matchesInProgress} accent="#FFC93C" />
      </div>

      <div className="corio-admin-card">
        <div className="corio-admin-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ADE80', display: 'inline-block', animation: 'corio-pulse 1.4s infinite' }} />
          Salas ao vivo
        </div>
        {data.rooms.length === 0 ? <div className="corio-admin-empty">Nenhuma sala ativa neste momento.</div> : (
          <div className="corio-admin-table-wrap">
            <table className="corio-admin-table">
              <thead><tr><th>Código</th><th>Anfitrião</th><th>Privacidade</th><th>Status</th><th>Modo</th><th>Tema atual</th><th>Jogadores</th><th>Rodada</th><th>Pontuação máx.</th><th>Criada</th></tr></thead>
              <tbody>
                {data.rooms.map((r) => (
                  <tr key={r.code}>
                    <td style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800 }}>{r.code}</td>
                    <td>{r.hostName ?? '—'}</td>
                    <td><span className="corio-admin-pill corio-admin-pill-gray">{r.privacy === 'private' ? 'Privada' : 'Pública'}</span></td>
                    <td><span className={`corio-admin-pill ${r.screen === 'playing' ? 'corio-admin-pill-green' : 'corio-admin-pill-yellow'}`}>{SCREEN_LABELS[r.screen] ?? r.screen}</span></td>
                    <td>{r.modeId}</td>
                    <td>{r.themeName ?? '—'}</td>
                    <td>{r.playerCount}</td>
                    <td>{r.roundNumber ? `${r.roundNumber}/${r.numRounds}` : '—'}</td>
                    <td>{r.maxScore.toLocaleString('pt-BR')}</td>
                    <td>{new Date(r.createdAt).toLocaleTimeString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="corio-admin-kpi">
      <div className="corio-admin-kpi-label">{label}</div>
      <div className="corio-admin-kpi-value" style={{ color: accent }}>{value}</div>
    </div>
  );
}
