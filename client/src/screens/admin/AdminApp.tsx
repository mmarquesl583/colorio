import { useEffect, useState } from 'react';
import { fetchAdmin, AdminApiError } from '../../adminApi.ts';
import AdminDashboard from './AdminDashboard.tsx';
import AdminUsers from './AdminUsers.tsx';
import AdminUserDetail from './AdminUserDetail.tsx';
import AdminMatches from './AdminMatches.tsx';
import AdminMatchDetail from './AdminMatchDetail.tsx';
import AdminRooms from './AdminRooms.tsx';
import AdminQuestions from './AdminQuestions.tsx';
import AdminQuestionDetail from './AdminQuestionDetail.tsx';
import AdminCategories from './AdminCategories.tsx';
import AdminModes from './AdminModes.tsx';
import AdminTitles from './AdminTitles.tsx';
import AdminAvatars from './AdminAvatars.tsx';
import AdminAchievements from './AdminAchievements.tsx';
import AdminReports from './AdminReports.tsx';
import AdminRetention from './AdminRetention.tsx';
import AdminGuesses from './AdminGuesses.tsx';
import AdminSettings from './AdminSettings.tsx';

export type AdminSection =
  | 'dashboard' | 'users' | 'matches' | 'rooms' | 'reports'
  | 'questions' | 'categories' | 'titles' | 'avatars' | 'achievements'
  | 'stats' | 'retention' | 'guesses' | 'settings';

const NAV: { group: string; items: { id: AdminSection; label: string; icon: string }[] }[] = [
  { group: 'OPERAÇÃO', items: [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'users', label: 'Usuários', icon: '👤' },
    { id: 'matches', label: 'Partidas', icon: '🎮' },
    { id: 'rooms', label: 'Salas', icon: '🚪' },
    { id: 'reports', label: 'Denúncias', icon: '🚩' },
  ] },
  { group: 'CONTEÚDO', items: [
    { id: 'questions', label: 'Perguntas', icon: '❓' },
    { id: 'categories', label: 'Categorias', icon: '🎨' },
    { id: 'titles', label: 'Títulos', icon: '🏅' },
    { id: 'avatars', label: 'Avatares', icon: '🖼️' },
    { id: 'achievements', label: 'Conquistas', icon: '🏆' },
  ] },
  { group: 'ANÁLISE', items: [
    { id: 'stats', label: 'Modos de jogo', icon: '📈' },
    { id: 'retention', label: 'Retenção', icon: '🔁' },
    { id: 'guesses', label: 'Análise de palpites', icon: '🎯' },
  ] },
  { group: 'CONFIGURAÇÕES', items: [
    { id: 'settings', label: 'Configurações', icon: '⚙️' },
  ] },
];

export default function AdminApp({ onBack }: { onBack: () => void }) {
  const [access, setAccess] = useState<'checking' | 'ok' | 'denied'>('checking');
  const [section, setSection] = useState<AdminSection>('dashboard');
  const [drill, setDrill] = useState<{ type: 'user' | 'match' | 'question'; id: string } | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [period, setPeriod] = useState('30d');

  useEffect(() => {
    fetchAdmin('check').then(() => setAccess('ok')).catch(() => setAccess('denied'));
  }, []);

  const goTo = (s: AdminSection) => { setSection(s); setDrill(null); setNavOpen(false); };

  if (access === 'checking') {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(244,242,248,0.6)', fontSize: 12, fontWeight: 700 }}>
        Verificando acesso…
      </div>
    );
  }
  if (access === 'denied') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 32 }}>🔒</div>
        <div style={{ fontSize: 14, fontWeight: 800 }}>Acesso restrito</div>
        <div style={{ fontSize: 11, color: 'rgba(244,242,248,0.55)', maxWidth: 280 }}>Essa área é só para administradores.</div>
        <button onClick={onBack} className="corio-tap" style={{ all: 'unset', cursor: 'pointer', marginTop: 8, padding: '10px 20px', borderRadius: 12, background: 'linear-gradient(90deg,#8B5CF6,#6D28D9)', color: '#fff', fontWeight: 700, fontSize: 12 }}>
            Voltar
        </button>
      </div>
    );
  }

  const activeLabel = NAV.flatMap((g) => g.items).find((i) => i.id === section)?.label ?? '';

  return (
    <div className="corio-admin" style={{ flex: 1, minHeight: 0, display: 'flex' }}>
      <aside className={`corio-admin-sidebar ${navOpen ? 'is-open' : ''}`}>
        <div className="corio-admin-brand">
          <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800 }}>
            <span style={{ background: 'linear-gradient(90deg,#EC4899,#8B5CF6,#29E7FF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>COLOR.IO</span>
            {' '}<span style={{ color: '#FFC93C' }}>ADMIN</span>
          </span>
        </div>
        <nav style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {NAV.map((g) => (
            <div key={g.group} style={{ marginBottom: 14 }}>
              <div className="corio-admin-nav-group">{g.group}</div>
              {g.items.map((item) => (
                <button key={item.id} onClick={() => goTo(item.id)} className={`corio-admin-nav-item ${section === item.id ? 'is-active' : ''}`}>
                  <span>{item.icon}</span>{item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <button onClick={onBack} className="corio-admin-nav-item" style={{ marginTop: 'auto' }}>
          <span>↩</span>Sair do admin
        </button>
      </aside>

      <div className="corio-admin-main">
        <header className="corio-admin-topbar">
          <button className="corio-admin-burger" onClick={() => setNavOpen((v) => !v)} aria-label="Menu">☰</button>
          <div className="corio-admin-title">{activeLabel}</div>
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className="corio-admin-period">
            <option value="today">Hoje</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="90d">Últimos 90 dias</option>
            <option value="all">Todo o período</option>
          </select>
        </header>

        <div className="corio-admin-content">
          {section === 'dashboard' && <AdminDashboard period={period} />}
          {section === 'users' && !drill && <AdminUsers onOpenUser={(id) => setDrill({ type: 'user', id })} />}
          {drill?.type === 'user' && <AdminUserDetail userId={drill.id} onBack={() => setDrill(null)} onOpenMatch={(id) => setDrill({ type: 'match', id })} />}
          {section === 'matches' && !drill && <AdminMatches period={period} onOpenMatch={(id) => setDrill({ type: 'match', id })} />}
          {drill?.type === 'match' && <AdminMatchDetail matchId={drill.id} onBack={() => setDrill(null)} />}
          {section === 'rooms' && <AdminRooms />}
          {section === 'reports' && <AdminReports />}
          {section === 'questions' && !drill && <AdminQuestions onOpenQuestion={(id) => setDrill({ type: 'question', id })} />}
          {drill?.type === 'question' && <AdminQuestionDetail questionKey={drill.id} onBack={() => setDrill(null)} />}
          {section === 'categories' && <AdminCategories period={period} />}
          {section === 'titles' && <AdminTitles />}
          {section === 'avatars' && <AdminAvatars />}
          {section === 'achievements' && <AdminAchievements />}
          {section === 'stats' && <AdminModes period={period} />}
          {section === 'retention' && <AdminRetention />}
          {section === 'guesses' && <AdminGuesses period={period} />}
          {section === 'settings' && <AdminSettings />}
        </div>
      </div>
    </div>
  );
}
