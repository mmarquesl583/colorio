import { useEffect, useState } from 'react';
import { fetchAdmin, AdminApiError } from '../../adminApi.ts';

interface RetentionData {
  cohortSize: number; d1RetentionPct: number | null; d7RetentionPct: number | null; d30RetentionPct: number | null;
}

export default function AdminRetention() {
  const [data, setData] = useState<RetentionData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdmin<RetentionData>('retention').then(setData).catch((e) => setError(e instanceof AdminApiError ? e.message : 'Erro'));
  }, []);

  if (error) return <div className="corio-admin-error">{error}</div>;
  if (!data) return <div className="corio-admin-loading">Carregando…</div>;

  return (
    <div>
      <div className="corio-admin-kpis">
        <Kpi label="Tamanho da coorte" value={data.cohortSize} />
        <Kpi label="Retorno D1" value={data.d1RetentionPct !== null ? `${data.d1RetentionPct}%` : '—'} accent="#4ADE80" />
        <Kpi label="Retorno D7" value={data.d7RetentionPct !== null ? `${data.d7RetentionPct}%` : '—'} accent="#29E7FF" />
        <Kpi label="Retorno D30" value={data.d30RetentionPct !== null ? `${data.d30RetentionPct}%` : '—'} accent="#FFC93C" />
      </div>

      {data.cohortSize === 0 ? (
        <div className="corio-admin-empty">Ainda não há usuários com tempo suficiente de conta pra medir retenção.</div>
      ) : (
        <div className="corio-admin-card">
          <div className="corio-admin-card-title">Como isso é calculado</div>
          <div style={{ fontSize: 11.5, color: 'rgba(244,242,248,0.6)', lineHeight: 1.6 }}>
            A coorte considera só contas com pelo menos 1 dia desde o cadastro (`profiles.first_seen_at`).
            D1 conta quem jogou no dia seguinte ao cadastro; D7 quem voltou em algum dos 7 dias seguintes; D30 em algum dos 30 dias seguintes —
            tudo com base em `player_play_days`, que registra um dia único por jogador toda vez que ele entra numa partida.
          </div>
        </div>
      )}
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
