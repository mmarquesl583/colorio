import { useEffect, useState } from 'react';
import { fetchAdmin, AdminApiError } from '../../adminApi.ts';
import { BarChart, LineChart } from '../../components/admin/Charts.tsx';

interface DashboardData {
  kpis: {
    totalUsers: number; activeToday: number; newToday: number; matchesToday: number;
    avgMatchDurationSeconds: number; avgAccuracyPct: number | null; totalMatches: number;
  };
  charts: {
    usersByDay: { date: string; count: number }[];
    matchesByDay: { date: string; count: number }[];
    matchesByMode: { label: string; count: number }[];
    matchesByCategory: { label: string; count: number }[];
    busiestHours: { hour: number; count: number }[];
  };
}

interface LiveData {
  playersOnline: number; activeRooms: number; matchesInProgress: number;
  topCategory: string | null; topMode: string | null;
  rooms: { code: string; hostName: string | null; screen: string; modeId: string; playerCount: number; roundNumber: number | null; numRounds: number; themeName: string | null }[];
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}min ${s}s`;
}

export default function AdminDashboard({ period }: { period: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [live, setLive] = useState<LiveData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    fetchAdmin<DashboardData>('dashboard', { period }).then(setData).catch((e) => setError(e instanceof AdminApiError ? e.message : 'Erro'));
  }, [period]);

  useEffect(() => {
    let cancelled = false;
    const poll = () => fetchAdmin<LiveData>('live').then((d) => { if (!cancelled) setLive(d); }).catch(() => {});
    poll();
    const id = setInterval(poll, 8000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (error) return <div className="corio-admin-error">{error}</div>;
  if (!data) return <div className="corio-admin-loading">Carregando…</div>;

  const k = data.kpis;
  return (
    <div>
      <div className="corio-admin-kpis">
        <Kpi label="Usuários cadastrados" value={k.totalUsers} />
        <Kpi label="Ativos hoje" value={k.activeToday} />
        <Kpi label="Novos hoje" value={k.newToday} />
        <Kpi label="Partidas hoje" value={k.matchesToday} />
        <Kpi label="Duração média/partida" value={fmtDuration(k.avgMatchDurationSeconds)} />
        <Kpi label="Taxa média de acerto" value={k.avgAccuracyPct !== null ? `${k.avgAccuracyPct}%` : '—'} />
      </div>

      <div className="corio-admin-card" style={{ marginBottom: 20, background: 'linear-gradient(135deg,rgba(139,92,246,0.14),rgba(41,231,255,0.08))', border: '1px solid rgba(139,92,246,0.3)' }}>
        <div className="corio-admin-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ADE80', display: 'inline-block', animation: 'corio-pulse 1.4s infinite' }} />
          COLOR.IO LIVE
        </div>
        {live ? (
          <div className="corio-admin-kpis" style={{ marginBottom: 0 }}>
            <Kpi label="Jogadores online" value={live.playersOnline} accent="#4ADE80" />
            <Kpi label="Salas ativas" value={live.activeRooms} accent="#29E7FF" />
            <Kpi label="Partidas rolando" value={live.matchesInProgress} accent="#FFC93C" />
            <Kpi label="Categoria mais jogada agora" value={live.topCategory ?? '—'} small />
            <Kpi label="Modo mais jogado agora" value={live.topMode ?? '—'} small />
          </div>
        ) : <div className="corio-admin-loading">Conectando…</div>}
      </div>

      <div className="corio-admin-grid">
        <div className="corio-admin-card">
          <div className="corio-admin-card-title">Novos usuários por dia</div>
          <LineChart data={data.charts.usersByDay} color="#29E7FF" />
        </div>
        <div className="corio-admin-card">
          <div className="corio-admin-card-title">Partidas por dia</div>
          <LineChart data={data.charts.matchesByDay} color="#8B5CF6" />
        </div>
        <div className="corio-admin-card">
          <div className="corio-admin-card-title">Partidas por modo</div>
          <BarChart data={data.charts.matchesByMode} color="#FFC93C" />
        </div>
        <div className="corio-admin-card">
          <div className="corio-admin-card-title">Partidas por categoria (top 10)</div>
          <BarChart data={data.charts.matchesByCategory} color="#FF5C8A" />
        </div>
        <div className="corio-admin-card" style={{ gridColumn: '1 / -1' }}>
          <div className="corio-admin-card-title">Horários de maior movimento (UTC)</div>
          <BarChart data={data.charts.busiestHours.map((h) => ({ label: String(h.hour), count: h.count }))} color="#4ADE80" formatLabel={(l) => `${l}h`} />
        </div>
      </div>

      {live && live.rooms.length > 0 && (
        <div className="corio-admin-card">
          <div className="corio-admin-card-title">Salas ao vivo agora</div>
          <div className="corio-admin-table-wrap">
            <table className="corio-admin-table">
              <thead><tr><th>Código</th><th>Anfitrião</th><th>Status</th><th>Modo</th><th>Jogadores</th><th>Rodada</th></tr></thead>
              <tbody>
                {live.rooms.slice(0, 15).map((r) => (
                  <tr key={r.code}>
                    <td style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800 }}>{r.code}</td>
                    <td>{r.hostName ?? '—'}</td>
                    <td><span className={`corio-admin-pill ${r.screen === 'playing' ? 'corio-admin-pill-green' : 'corio-admin-pill-yellow'}`}>{r.screen === 'playing' ? 'Em andamento' : 'Aguardando'}</span></td>
                    <td>{r.modeId}</td>
                    <td>{r.playerCount}</td>
                    <td>{r.roundNumber ? `${r.roundNumber}/${r.numRounds}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, accent, small }: { label: string; value: string | number; accent?: string; small?: boolean }) {
  return (
    <div className="corio-admin-kpi">
      <div className="corio-admin-kpi-label">{label}</div>
      <div className="corio-admin-kpi-value" style={{ color: accent, fontSize: small ? 15 : undefined }}>{value}</div>
    </div>
  );
}
