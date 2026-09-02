import { useEffect, useState } from 'react';
import { fetchAdmin, AdminApiError } from '../../adminApi.ts';
import { BarChart, PrecisionBars } from '../../components/admin/Charts.tsx';
import { LOBBY_THEMES } from '@shared/gameData';

interface GuessesData {
  totalGuesses: number; avgDeltaE: number | null;
  precisionBreakdown: { label: string; count: number; pct: number }[];
  hueDistribution: { hueStart: number; count: number }[];
}

const MODES = [
  { id: '', label: 'Todos os modos' }, { id: 'players', label: 'Frase dos jogadores' },
  { id: 'ai', label: 'Frase da IA' }, { id: 'race', label: 'Corrida contra o Tempo' },
];

export default function AdminGuesses({ period }: { period: string }) {
  const [data, setData] = useState<GuessesData | null>(null);
  const [theme, setTheme] = useState('');
  const [mode, setMode] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    fetchAdmin<GuessesData>('guesses', { period, theme: theme || undefined, mode: mode || undefined })
      .then(setData).catch((e) => setError(e instanceof AdminApiError ? e.message : 'Erro'));
  }, [period, theme, mode]);

  if (error) return <div className="corio-admin-error">{error}</div>;

  return (
    <div>
      <div className="corio-admin-toolbar">
        <select value={theme} onChange={(e) => setTheme(e.target.value)} className="corio-admin-period">
          <option value="">Todas as categorias</option>
          {LOBBY_THEMES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select value={mode} onChange={(e) => setMode(e.target.value)} className="corio-admin-period">
          {MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </div>

      {!data ? <div className="corio-admin-loading">Carregando…</div> : data.totalGuesses === 0 ? (
        <div className="corio-admin-empty">Sem palpites registrados nesse filtro ainda — os dados aparecem aqui à medida que partidas forem jogadas.</div>
      ) : (
        <>
          <div className="corio-admin-kpis">
            <Kpi label="Total de palpites" value={data.totalGuesses} />
            <Kpi label="ΔE médio" value={data.avgDeltaE ?? '—'} />
          </div>
          <div className="corio-admin-grid">
            <div className="corio-admin-card">
              <div className="corio-admin-card-title">Distribuição de precisão</div>
              <PrecisionBars tiers={data.precisionBreakdown} />
            </div>
            <div className="corio-admin-card">
              <div className="corio-admin-card-title">Faixas de matiz mais escolhidas (palpites)</div>
              <BarChart data={data.hueDistribution.map((h) => ({ label: `${h.hueStart}°`, count: h.count }))} color="#EC4899" />
            </div>
          </div>
        </>
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
