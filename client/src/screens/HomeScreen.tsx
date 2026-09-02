import { useEffect, useState } from 'react';
import { supabase } from '../supabase.ts';
import { accountAvatar, accountName, useSession } from '../auth.ts';
import { avatarSmallSrc } from '@shared/avatarIcons';
import { titleNameFor } from '@shared/titleCatalog';
import { xpForLevel } from '@shared/progression';
import { fetchEquippedTitle, fetchProgressionSummary, type ProgressionSummary } from '../stats.ts';
import { pushToast } from '../toast.ts';
import IdentityPickerModal from '../components/IdentityPickerModal.tsx';

const STREAK_SEEN_KEY = 'corio_last_seen_day_streak';

interface Props {
  connecting: boolean;
  error: string | null;
  onClearError: () => void;
  onStartCreate: (name: string) => void;
  onFindRooms: (name: string) => void;
  onLogin: () => void;
  onOpenProfile: () => void;
}

const IMG = '/images/home';
// The Home quick-picker doesn't fetch a per-user unlock list (that only
// matters once a non-free avatar exists — none do yet, see
// shared/avatarIcons.ts) — the full Profile screen's own picker instance
// gets the real set once it does.
const EMPTY_AVATAR_UNLOCKS = new Set<string>();
const EMPTY_TITLE_UNLOCKS = new Set<string>();

interface Doodle { src: string; pos: React.CSSProperties; width: number; rot: number; duration: number; delay: number; }

// Kept clear of the hero logo's own bounding box (roughly the box centered
// in the top ~80% of the content column) so nothing sits behind its opaque
// artwork and reads as "cut off" — see GUIA.md if repositioning these.
const DOODLES: Doodle[] = [
  { src: 'doodle-crown.webp', pos: { top: '1.5%', left: '3%' }, width: 110, rot: -10, duration: 6, delay: 0 },
  { src: 'doodle-star-big.webp', pos: { top: '17%', left: '2%' }, width: 74, rot: -8, duration: 7, delay: .4 },
  { src: 'doodle-speech-bubble.webp', pos: { top: '3%', right: '2%' }, width: 128, rot: 6, duration: 6.5, delay: .2 },
  { src: 'doodle-pencil.webp', pos: { top: '44%', left: '-2%' }, width: 100, rot: -20, duration: 7.5, delay: .6 },
  { src: 'doodle-lightning.webp', pos: { top: '25%', right: '4%' }, width: 54, rot: 10, duration: 6.2, delay: .3 },
  { src: 'doodle-sparkle-yellow.webp', pos: { top: '54%', right: '5%' }, width: 50, rot: 4, duration: 5, delay: .1 },
  { src: 'doodle-sparkle-white.webp', pos: { top: '13%', left: '30%' }, width: 34, rot: -6, duration: 5.4, delay: .5 },
  { src: 'doodle-cursor-click.webp', pos: { bottom: '6%', right: '4%' }, width: 56, rot: -12, duration: 6.8, delay: .7 },
];

export default function HomeScreen({ connecting, error, onClearError, onStartCreate, onFindRooms, onLogin, onOpenProfile }: Props) {
  const { session } = useSession();
  const [pickerMode, setPickerMode] = useState<'avatar' | 'title' | null>(null);
  const [equippedTitleId, setEquippedTitleId] = useState<string | null>(null);
  const [progression, setProgression] = useState<ProgressionSummary | null>(null);
  const loggedInName = accountName(session);
  const loggedInAvatar = accountAvatar(session);
  const nameOk = Boolean(loggedInName);
  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!userId) { setEquippedTitleId(null); setProgression(null); return; }
    let cancelled = false;
    fetchEquippedTitle(userId).then((id) => { if (!cancelled) setEquippedTitleId(id); });
    fetchProgressionSummary(userId).then((p) => {
      if (cancelled || !p) return;
      setProgression(p);
      // Streak-increased toast — no server signal for "just increased",
      // only the current value, so a local echo is the cheapest way to
      // detect the delta without a DB column that exists purely for this.
      const lastSeen = Number(localStorage.getItem(STREAK_SEEN_KEY) ?? '0');
      if (p.currentDayStreak > lastSeen && lastSeen > 0) {
        pushToast({ kind: 'streak', icon: '🔥', title: `Sequência de ${p.currentDayStreak} dias!`, subtitle: 'Continue jogando todo dia' });
      }
      localStorage.setItem(STREAK_SEEN_KEY, String(p.currentDayStreak));
    });
    return () => { cancelled = true; };
  }, [userId]);

  const titleName = titleNameFor(equippedTitleId);
  const xpIntoLevel = progression ? progression.xp - xpForLevel(progression.level) : 0;
  const xpForNext = progression ? xpForLevel(progression.level + 1) - xpForLevel(progression.level) : 1;
  const levelFillPct = progression ? Math.max(0, Math.min(100, (xpIntoLevel / xpForNext) * 100)) : 0;

  return (
    <div className="corio-home-v2">
      <div className="corio-home-v2-decor">
        {DOODLES.map((d, i) => (
          <img
            key={i}
            src={`${IMG}/${d.src}`}
            alt=""
            className="corio-home-v2-doodle"
            style={{
              ...d.pos,
              animationDuration: `${d.duration}s`,
              animationDelay: `${d.delay}s`,
              '--corio-float-rot': `${d.rot}deg`,
              '--corio-doodle-w': `${d.width}px`,
            } as React.CSSProperties}
          />
        ))}
      </div>

      <div className="corio-noscroll corio-home-v2-content">
        <div className="corio-home-v2-hero">
          <img src={`${IMG}/logo-full.webp`} alt="color.io" className="corio-home-v2-logo-full" />

          <div className="corio-home-v2-tagline" style={{ marginTop: 8, marginBottom: 12 }}>
            Adivinhe a cor,<br />ganhe pontos, <mark>se divirta.</mark>
          </div>
        </div>

        <div className="corio-home-v2-form">
          {loggedInName ? (
            <div className="corio-home-v2-identity">
              <span className="corio-home-v2-identity-info">
                <button onClick={() => setPickerMode('avatar')} className="corio-tap corio-home-v2-identity-avatar" aria-label="Trocar ícone">
                  {loggedInAvatar ? <img src={avatarSmallSrc(loggedInAvatar)} alt="" /> : loggedInName[0].toUpperCase()}
                </button>
                <span className="corio-home-v2-identity-text">
                  <button onClick={onOpenProfile} className="corio-tap corio-home-v2-identity-name" aria-label="Ver perfil">{loggedInName}</button>
                  <button onClick={() => setPickerMode('title')} className="corio-tap corio-home-v2-identity-title" aria-label="Trocar título">{titleName}</button>
                </span>
              </span>
              <button onClick={() => supabase.auth.signOut()} className="corio-tap corio-home-v2-identity-link">Sair</button>
            </div>
          ) : null}

          {loggedInName && progression && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(20,20,26,0.55)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '8px 12px' }}>
              <div style={{ flex: 'none', fontSize: 10, fontWeight: 800, color: '#FFC93C', fontFamily: "'Space Grotesk',sans-serif" }}>Nv. {progression.level}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                  <div style={{ width: `${levelFillPct}%`, height: '100%', background: 'linear-gradient(90deg,#8B5CF6,#FFC93C)', borderRadius: 3 }} />
                </div>
              </div>
              {progression.currentDayStreak > 0 && (
                <div style={{ flex: 'none', fontSize: 10, fontWeight: 800, color: '#FF9C5C', display: 'flex', alignItems: 'center', gap: 3 }}>
                  🔥 {progression.currentDayStreak}
                </div>
              )}
            </div>
          )}

          {!loggedInName && (
            <button onClick={() => { onClearError(); onLogin(); }} className="corio-home-v2-btn corio-home-v2-btn-secondary corio-home-v2-btn-split">
              <span className="corio-home-v2-btn-split-left">
                <span className="corio-home-v2-entrar-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" /></svg>
                </span>
                Entrar
              </span>
              <span className="corio-home-v2-chevron">›</span>
            </button>
          )}

          {error && (
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#fff', background: 'rgba(239,68,68,0.35)', border: '2px solid #EF4444', borderRadius: 12, padding: '9px 12px' }}>{error}</div>
          )}

          <button
            onClick={() => loggedInName && onStartCreate(loggedInName)}
            disabled={connecting || !nameOk}
            className="corio-home-v2-btn corio-home-v2-btn-primary is-active"
            style={{ opacity: connecting || !nameOk ? 0.6 : 1 }}
          >
            <img src={`${IMG}/doodle-rocket.webp`} alt="" />
            {connecting ? 'Conectando…' : 'Criar sala'}
          </button>
          <button
            onClick={() => loggedInName && onFindRooms(loggedInName)}
            disabled={!nameOk}
            className="corio-home-v2-btn corio-home-v2-btn-secondary"
            style={{ opacity: nameOk ? 1 : 0.6 }}
          >
            <img src={`${IMG}/doodle-key.webp`} alt="" />
            Procurar salas
          </button>
        </div>
      </div>

      {pickerMode && loggedInName && (
        <IdentityPickerModal
          initialMode={pickerMode}
          playerName={loggedInName}
          fallbackLetter={loggedInName[0].toUpperCase()}
          currentAvatarId={loggedInAvatar}
          currentTitleId={equippedTitleId}
          unlockedAvatarIds={EMPTY_AVATAR_UNLOCKS}
          unlockedTitleIds={EMPTY_TITLE_UNLOCKS}
          onAvatarEquipped={() => { /* accountAvatar() re-derives from the session, which useSession() already refreshes */ }}
          onTitleEquipped={(id) => setEquippedTitleId(id)}
          onClose={() => setPickerMode(null)}
        />
      )}
    </div>
  );
}
