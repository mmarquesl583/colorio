import { useEffect, useState } from 'react';
import { fetchAdmin, exportCsv, AdminApiError } from '../../adminApi.ts';

interface UserRow {
  id: string; name: string; avatarId: string | null; createdAt: string; lastLoginAt: string | null;
  gamesPlayed: number; gamesWon: number; accuracyPct: number | null; bestScore: number;
  totalPlaytimeSeconds: number; friendsCount: number; titlesCount: number; lastPlayDate: string | null;
}

const FILTERS = [
  { id: 'todos', label: 'Todos' }, { id: 'online', label: 'Online' }, { id: 'novos', label: 'Novos' },
  { id: 'mais-ativos', label: 'Mais ativos' }, { id: 'mais-vitorias', label: 'Mais vitórias' }, { id: 'inativos', label: 'Inativos' },
];

export default function AdminUsers({ onOpenUser }: { onOpenUser: (id: string) => void }) {
  const [rows, setRows] = useState<UserRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('todos');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(null);
    const t = setTimeout(() => {
      fetchAdmin<{ total: number; users: UserRow[] }>('users', { filter, search: search || undefined, limit: '100' })
        .then((d) => { setRows(d.users); setTotal(d.total); })
        .catch((e) => setError(e instanceof AdminApiError ? e.message : 'Erro'));
    }, 300);
    return () => clearTimeout(t);
  }, [filter, search]);

  if (error) return <div className="corio-admin-error">{error}</div>;

  return (
    <div>
      <div className="corio-admin-toolbar">
        <input className="corio-admin-search" placeholder="Buscar por nome…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {FILTERS.map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)} className={f.id === filter ? 'corio-admin-btn' : 'corio-admin-btn-ghost'}>{f.label}</button>
        ))}
        {rows && rows.length > 0 && (
          <button onClick={() => exportCsv('usuarios.csv', rows)} className="corio-admin-btn-ghost" style={{ marginLeft: 'auto' }}>⬇ Exportar CSV</button>
        )}
      </div>

      {!rows ? <div className="corio-admin-loading">Carregando…</div> : rows.length === 0 ? <div className="corio-admin-empty">Nenhum usuário encontrado.</div> : (
        <div className="corio-admin-table-wrap">
          <table className="corio-admin-table">
            <thead>
              <tr><th>Nome</th><th>Cadastro</th><th>Último acesso</th><th>Partidas</th><th>Vitórias</th><th>Precisão</th><th>Melhor pontuação</th><th>Amigos</th><th>Títulos</th></tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="is-clickable" onClick={() => onOpenUser(u.id)}>
                  <td style={{ fontWeight: 700 }}>{u.name}</td>
                  <td>{new Date(u.createdAt).toLocaleDateString('pt-BR')}</td>
                  <td>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('pt-BR') : '—'}</td>
                  <td>{u.gamesPlayed}</td>
                  <td>{u.gamesWon}</td>
                  <td>{u.accuracyPct !== null ? `${u.accuracyPct}%` : '—'}</td>
                  <td>{u.bestScore.toLocaleString('pt-BR')}</td>
                  <td>{u.friendsCount}</td>
                  <td>{u.titlesCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows && <div style={{ fontSize: 10.5, color: 'rgba(244,242,248,0.4)', marginTop: 8 }}>{rows.length} de {total} usuário(s)</div>}
    </div>
  );
}
