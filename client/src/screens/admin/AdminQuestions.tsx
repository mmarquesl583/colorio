import { useEffect, useState } from 'react';
import { fetchAdmin, exportCsv, AdminApiError } from '../../adminApi.ts';
import { LOBBY_THEMES } from '@shared/gameData';

interface QuestionRow {
  themeId: string; themeName: string; questionId: number; pergunta: string; dificuldade: string;
  active: boolean; responses: number; avgDeltaE: number | null; avgScore: number | null; avgResponseMs: number | null;
}

const SORTS = [
  { id: 'mais-respondidas', label: 'Mais respondidas' }, { id: 'menos-respondidas', label: 'Menos respondidas' },
  { id: 'mais-acertadas', label: 'Melhor pontuação média' }, { id: 'menos-acertadas', label: 'Pior pontuação média' },
  { id: 'maior-tempo', label: 'Maior tempo de resposta' },
];

export default function AdminQuestions({ onOpenQuestion }: { onOpenQuestion: (key: string) => void }) {
  const [data, setData] = useState<{ total: number; questions: QuestionRow[] } | null>(null);
  const [theme, setTheme] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [sort, setSort] = useState('mais-respondidas');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    fetchAdmin<{ total: number; questions: QuestionRow[] }>('questions', { theme: theme || undefined, difficulty: difficulty || undefined, sort })
      .then(setData).catch((e) => setError(e instanceof AdminApiError ? e.message : 'Erro'));
  }, [theme, difficulty, sort]);

  if (error) return <div className="corio-admin-error">{error}</div>;

  return (
    <div>
      <div className="corio-admin-toolbar">
        <select value={theme} onChange={(e) => setTheme(e.target.value)} className="corio-admin-period">
          <option value="">Todas as categorias</option>
          {LOBBY_THEMES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="corio-admin-period">
          <option value="">Todas as dificuldades</option>
          <option value="facil">Fácil</option>
          <option value="media">Média</option>
          <option value="dificil">Difícil</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="corio-admin-period">
          {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        {data && data.questions.length > 0 && (
          <button onClick={() => exportCsv('perguntas.csv', data.questions)} className="corio-admin-btn-ghost" style={{ marginLeft: 'auto' }}>⬇ Exportar CSV</button>
        )}
      </div>

      {!data ? <div className="corio-admin-loading">Carregando…</div> : data.questions.length === 0 ? <div className="corio-admin-empty">Nenhuma pergunta encontrada.</div> : (
        <>
          <div className="corio-admin-table-wrap">
            <table className="corio-admin-table">
              <thead><tr><th>Categoria</th><th>Pergunta</th><th>Dificuldade</th><th>Status</th><th>Respostas</th><th>ΔE médio</th><th>Pontuação média</th><th>Tempo médio</th></tr></thead>
              <tbody>
                {data.questions.map((q) => (
                  <tr key={`${q.themeId}:${q.questionId}`} className="is-clickable" onClick={() => onOpenQuestion(`${q.themeId}:${q.questionId}`)}>
                    <td>{q.themeName}</td>
                    <td style={{ whiteSpace: 'normal', maxWidth: 320 }}>{q.pergunta}</td>
                    <td>{q.dificuldade}</td>
                    <td><span className={`corio-admin-pill ${q.active ? 'corio-admin-pill-green' : 'corio-admin-pill-gray'}`}>{q.active ? 'Ativa' : 'Desativada'}</span></td>
                    <td>{q.responses}</td>
                    <td>{q.avgDeltaE ?? '—'}</td>
                    <td>{q.avgScore ?? '—'}</td>
                    <td>{q.avgResponseMs !== null ? `${(q.avgResponseMs / 1000).toFixed(1)}s` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 10.5, color: 'rgba(244,242,248,0.4)', marginTop: 8 }}>{data.questions.length} de {data.total} pergunta(s)</div>
        </>
      )}
    </div>
  );
}
