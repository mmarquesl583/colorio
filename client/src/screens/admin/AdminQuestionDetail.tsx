import { useEffect, useState } from 'react';
import { fetchAdmin, postAdmin, AdminApiError } from '../../adminApi.ts';
import { PrecisionBars } from '../../components/admin/Charts.tsx';

interface QuestionDetail {
  themeId: string; themeName: string; questionId: number; pergunta: string; dificuldade: string; secretHex: string;
  totalResponses: number;
  precisionTiers: { key: string; label: string; count: number; pct: number }[];
  avgDeltaE: number | null; medianDeltaE: number | null;
  bestGuess: { hex: string; deltaE: number } | null; worstGuess: { hex: string; deltaE: number } | null;
  avgResponseMs: number | null; veryClosePct: number | null; veryFarPct: number | null;
  guessMap: { hex: string; deltaE: number; score: number }[];
}

// ΔE (CIEDE2000) acima disso já é "o mais longe que dá pra estar" na prática —
// só usado pra normalizar o raio do mapa de palpites, não afeta pontuação.
const MAX_DELTA_E_FOR_MAP = 80;

export default function AdminQuestionDetail({ questionKey, onBack }: { questionKey: string; onBack: () => void }) {
  const [data, setData] = useState<QuestionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setData(null);
    fetchAdmin<QuestionDetail>(`questions/${questionKey}`).then(setData).catch((e) => setError(e instanceof AdminApiError ? e.message : 'Erro'));
  };

  useEffect(load, [questionKey]);

  const toggleActive = async (active: boolean) => {
    setBusy(true);
    try { await postAdmin(`questions/${questionKey}/toggle`, { active: String(active) }); load(); }
    catch (e) { setError(e instanceof AdminApiError ? e.message : 'Erro'); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <button onClick={onBack} className="corio-admin-back">‹ Voltar pra Perguntas</button>
      {error && <div className="corio-admin-error">{error}</div>}
      {!error && !data && <div className="corio-admin-loading">Carregando…</div>}
      {data && (
        <>
          <div className="corio-admin-card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: data.secretHex, border: '1px solid rgba(255,255,255,0.25)', flex: 'none' }} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>{data.pergunta}</div>
                <div style={{ fontSize: 11, color: 'rgba(244,242,248,0.55)', marginTop: 2 }}>{data.themeName} · dificuldade {data.dificuldade} · cor certa {data.secretHex}</div>
              </div>
              <button disabled={busy} onClick={() => toggleActive(false)} className="corio-admin-btn-ghost">Desativar</button>
              <button disabled={busy} onClick={() => toggleActive(true)} className="corio-admin-btn">Ativar</button>
            </div>
          </div>

          <div className="corio-admin-kpis">
            <Kpi label="Respostas" value={data.totalResponses} />
            <Kpi label="ΔE médio" value={data.avgDeltaE ?? '—'} />
            <Kpi label="ΔE mediano" value={data.medianDeltaE ?? '—'} />
            <Kpi label="Tempo médio" value={data.avgResponseMs !== null ? `${(data.avgResponseMs / 1000).toFixed(1)}s` : '—'} />
            <Kpi label="% muito perto" value={data.veryClosePct !== null ? `${data.veryClosePct}%` : '—'} accent="#4ADE80" />
            <Kpi label="% muito longe" value={data.veryFarPct !== null ? `${data.veryFarPct}%` : '—'} accent="#FF5C8A" />
          </div>

          {data.totalResponses === 0 ? (
            <div className="corio-admin-empty">Ainda sem palpites registrados pra essa pergunta — os números aparecem aqui assim que alguém jogar essa rodada.</div>
          ) : (
            <div className="corio-admin-grid">
              <div className="corio-admin-card">
                <div className="corio-admin-card-title">Classificação de precisão</div>
                <PrecisionBars tiers={data.precisionTiers} />
              </div>

              <div className="corio-admin-card">
                <div className="corio-admin-card-title">Mapa de palpites</div>
                <GuessMap secretHex={data.secretHex} points={data.guessMap} />
              </div>

              <div className="corio-admin-card" style={{ gridColumn: '1 / -1' }}>
                <div className="corio-admin-card-title">Extremos</div>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  {data.bestGuess && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 10, color: 'rgba(244,242,248,0.5)', fontWeight: 700 }}>MELHOR PALPITE</span>
                      <span style={{ width: 20, height: 20, borderRadius: 5, background: data.bestGuess.hex, border: '1px solid rgba(255,255,255,0.25)' }} />
                      <span style={{ fontSize: 11, fontWeight: 700 }}>{data.bestGuess.hex} (ΔE {data.bestGuess.deltaE.toFixed(1)})</span>
                    </div>
                  )}
                  {data.worstGuess && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 10, color: 'rgba(244,242,248,0.5)', fontWeight: 700 }}>PIOR PALPITE</span>
                      <span style={{ width: 20, height: 20, borderRadius: 5, background: data.worstGuess.hex, border: '1px solid rgba(255,255,255,0.25)' }} />
                      <span style={{ fontSize: 11, fontWeight: 700 }}>{data.worstGuess.hex} (ΔE {data.worstGuess.deltaE.toFixed(1)})</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function GuessMap({ secretHex, points }: { secretHex: string; points: { hex: string; deltaE: number }[] }) {
  const size = 100, center = size / 2, maxR = center - 6;
  // Ângulo determinístico por índice (hash simples) — não há direção real no
  // ΔE, só distância; o ângulo é puramente pra espalhar os pontos no espaço.
  const hashAngle = (i: number) => ((i * 137.508) % 360) * (Math.PI / 180);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: '100%', maxWidth: 260, display: 'block', margin: '0 auto' }}>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <circle key={f} cx={center} cy={center} r={maxR * f} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={0.5} />
      ))}
      {points.map((p, i) => {
        const r = Math.min(1, p.deltaE / MAX_DELTA_E_FOR_MAP) * maxR;
        const a = hashAngle(i);
        const x = center + Math.cos(a) * r, y = center + Math.sin(a) * r;
        return <circle key={i} cx={x} cy={y} r={2} fill={p.hex} stroke="rgba(0,0,0,0.35)" strokeWidth={0.4} opacity={0.85}><title>{`${p.hex} · ΔE ${p.deltaE.toFixed(1)}`}</title></circle>;
      })}
      <circle cx={center} cy={center} r={5} fill={secretHex} stroke="#fff" strokeWidth={1.2} />
    </svg>
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
