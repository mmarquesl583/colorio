import { useEffect, useState } from 'react';
import { fetchAdmin, postAdmin, AdminApiError } from '../../adminApi.ts';
import { TITLE_CATALOG, titleNameFor } from '@shared/titleCatalog';
import { AVATAR_ICONS } from '@shared/avatarIcons';

interface UserDetail {
  id: string; name: string; email: string | null; avatarId: string | null; titleId: string | null; isAdmin: boolean;
  createdAt: string; lastLoginAt: string | null;
  stats: { games_played: number; games_won: number; games_lost: number; games_drawn: number; total_perfects: number; best_score: number; correct_answers: number; wrong_answers: number; total_playtime_seconds: number; level: number; xp: number; best_combo: number; current_day_streak: number } | null;
  modeStats: { mode_id: string; games_played: number; wins: number; perfects: number; best_score: number }[];
  friendsCount: number; titleIds: string[]; avatarIds: string[];
  achievements: { achievement_id: string; unlocked_at: string }[];
  recentMatches: { matchId: string; playedAt: string; modeId: string; themeIds: string[]; result: string; score: number; perfects: number; durationSeconds: number; correctAnswers: number; wrongAnswers: number }[];
}

export default function AdminUserDetail({ userId, onBack, onOpenMatch }: { userId: string; onBack: () => void; onOpenMatch: (id: string) => void }) {
  const [data, setData] = useState<UserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [titleDraft, setTitleDraft] = useState('');
  const [avatarDraft, setAvatarDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    setData(null);
    fetchAdmin<UserDetail>(`users/${userId}`).then((d) => {
      setData(d);
      setNameDraft(d.name);
      setTitleDraft(d.titleId ?? '');
      setAvatarDraft(d.avatarId ?? '');
    }).catch((e) => setError(e instanceof AdminApiError ? e.message : 'Erro'));
  };
  useEffect(load, [userId]);

  const save = async () => {
    setSaving(true);
    try {
      await postAdmin(`users/${userId}/edit`, { displayName: nameDraft, titleId: titleDraft, avatarId: avatarDraft });
      setEditing(false);
      load();
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <button onClick={onBack} className="corio-admin-back">‹ Voltar pra Usuários</button>
      {error && <div className="corio-admin-error">{error}</div>}
      {!error && !data && <div className="corio-admin-loading">Carregando…</div>}
      {data && (
        <>
          <div className="corio-admin-card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(139,92,246,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, flex: 'none' }}>
                {data.avatarId ? <img src={`/images/avatars/${data.avatarId}-sm.webp`} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : data.name[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {data.name}
                  {data.isAdmin && <span className="corio-admin-pill corio-admin-pill-purple">ADMIN</span>}
                </div>
                <div style={{ fontSize: 11, color: '#FFC93C', fontWeight: 700 }}>{titleNameFor(data.titleId)}</div>
                <div style={{ fontSize: 10, color: 'rgba(244,242,248,0.45)', marginTop: 2 }}>{data.email} · cadastro em {new Date(data.createdAt).toLocaleDateString('pt-BR')} · último acesso {data.lastLoginAt ? new Date(data.lastLoginAt).toLocaleDateString('pt-BR') : '—'}</div>
              </div>
              {!editing && (
                <button onClick={() => setEditing(true)} className="corio-admin-btn-ghost" style={{ flex: 'none' }}>✏️ Editar</button>
              )}
            </div>

            {editing && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: 'rgba(244,242,248,0.5)', marginBottom: 4 }}>NOME DE EXIBIÇÃO</div>
                  <input
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value.slice(0, 24))}
                    className="corio-admin-search"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: 'rgba(244,242,248,0.5)', marginBottom: 4 }}>TÍTULO EQUIPADO</div>
                    <select value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} className="corio-admin-period" style={{ width: '100%' }}>
                      <option value="">— Novato das Cores (padrão) —</option>
                      {TITLE_CATALOG.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: 'rgba(244,242,248,0.5)', marginBottom: 4 }}>ÍCONE EQUIPADO</div>
                    <select value={avatarDraft} onChange={(e) => setAvatarDraft(e.target.value)} className="corio-admin-period" style={{ width: '100%' }}>
                      <option value="">— Inicial do nome (padrão) —</option>
                      {AVATAR_ICONS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setEditing(false)} disabled={saving} className="corio-admin-btn-ghost">Cancelar</button>
                  <button onClick={save} disabled={saving} className="corio-admin-btn">{saving ? 'Salvando…' : 'Salvar'}</button>
                </div>
                <div style={{ fontSize: 9, color: 'rgba(244,242,248,0.4)' }}>Título/ícone são aplicados direto, mesmo que o jogador não tenha desbloqueado — é uma ação administrativa.</div>
              </div>
            )}
          </div>

          <div className="corio-admin-kpis">
            <Kpi label="Nível" value={data.stats?.level ?? 1} />
            <Kpi label="XP" value={(data.stats?.xp ?? 0).toLocaleString('pt-BR')} />
            <Kpi label="Streak atual" value={data.stats?.current_day_streak ?? 0} />
            <Kpi label="Melhor combo" value={`x${data.stats?.best_combo ?? 0}`} />
            <Kpi label="Partidas" value={data.stats?.games_played ?? 0} />
            <Kpi label="Vitórias" value={data.stats?.games_won ?? 0} />
            <Kpi label="Derrotas" value={data.stats?.games_lost ?? 0} />
            <Kpi label="Perfeitos" value={data.stats?.total_perfects ?? 0} />
            <Kpi label="Melhor pontuação" value={(data.stats?.best_score ?? 0).toLocaleString('pt-BR')} />
            <Kpi label="Precisão" value={data.stats && (data.stats.correct_answers + data.stats.wrong_answers) > 0 ? `${Math.round((data.stats.correct_answers / (data.stats.correct_answers + data.stats.wrong_answers)) * 100)}%` : '—'} />
            <Kpi label="Tempo total" value={`${Math.round((data.stats?.total_playtime_seconds ?? 0) / 60)}min`} />
            <Kpi label="Amigos" value={data.friendsCount} />
            <Kpi label="Títulos" value={data.titleIds.length} />
            <Kpi label="Avatares" value={data.avatarIds.length} />
            <Kpi label="Conquistas" value={data.achievements.length} />
          </div>

          {data.modeStats.length > 0 && (
            <div className="corio-admin-card" style={{ marginBottom: 20 }}>
              <div className="corio-admin-card-title">Por modo</div>
              <div className="corio-admin-table-wrap">
                <table className="corio-admin-table">
                  <thead><tr><th>Modo</th><th>Partidas</th><th>Vitórias</th><th>Perfeitos</th><th>Melhor pontuação</th></tr></thead>
                  <tbody>
                    {data.modeStats.map((m) => (
                      <tr key={m.mode_id}><td>{m.mode_id}</td><td>{m.games_played}</td><td>{m.wins}</td><td>{m.perfects}</td><td>{m.best_score.toLocaleString('pt-BR')}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="corio-admin-card">
            <div className="corio-admin-card-title">Histórico de partidas</div>
            {data.recentMatches.length === 0 ? <div className="corio-admin-empty">Nenhuma partida ainda.</div> : (
              <div className="corio-admin-table-wrap">
                <table className="corio-admin-table">
                  <thead><tr><th>Data</th><th>Modo</th><th>Categorias</th><th>Resultado</th><th>Pontuação</th><th>Perfeitos</th><th>Duração</th></tr></thead>
                  <tbody>
                    {data.recentMatches.map((m) => (
                      <tr key={m.matchId} className="is-clickable" onClick={() => onOpenMatch(m.matchId)}>
                        <td>{new Date(m.playedAt).toLocaleString('pt-BR')}</td>
                        <td>{m.modeId}</td>
                        <td>{m.themeIds.join(', ')}</td>
                        <td><span className={`corio-admin-pill ${m.result === 'won' ? 'corio-admin-pill-green' : m.result === 'drawn' ? 'corio-admin-pill-yellow' : 'corio-admin-pill-gray'}`}>{m.result === 'won' ? 'Venceu' : m.result === 'drawn' ? 'Empate' : 'Perdeu'}</span></td>
                        <td>{m.score.toLocaleString('pt-BR')}</td>
                        <td>{m.perfects}</td>
                        <td>{Math.round(m.durationSeconds / 60)}min</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
