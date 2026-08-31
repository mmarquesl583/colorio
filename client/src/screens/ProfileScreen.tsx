import { useState } from 'react';
import Logo from '../components/Logo.tsx';
import { useSession, accountAvatar, accountName } from '../auth.ts';
import { AVATAR_ICONS, avatarSmallSrc } from '@shared/avatarIcons';
import { TITLE_CATALOG } from '@shared/titleCatalog';
import { LOBBY_THEMES } from '@shared/gameData';
import { useProfileData } from '../hooks/useProfileData.ts';
import { accuracyPct, formatPlaytime } from '../stats.ts';
import IdentityPickerModal from '../components/IdentityPickerModal.tsx';

const MODE_LABELS: Record<string, string> = { players: 'Frase dos jogadores', ai: 'Frase da IA' };
const THEME_BY_ID = new Map(LOBBY_THEMES.map((t) => [t.id, t]));
const FREE_AVATAR_COUNT = AVATAR_ICONS.filter((a) => a.free).length;
const FREE_TITLE_COUNT = TITLE_CATALOG.filter((t) => t.free).length;

export default function ProfileScreen({ onBack }: { onBack: () => void }) {
  const { session } = useSession();
  const userId = session?.user.id ?? null;
  const { data, loading, history, historyHasMore, historyLoading, loadMoreHistory } = useProfileData(userId);
  const [pickerMode, setPickerMode] = useState<'avatar' | 'title' | null>(null);
  // undefined = no local override yet (still trusting whatever useProfileData
  // last fetched); set the instant the picker actually equips a new title,
  // since a full profile re-fetch isn't needed just to reflect that.
  const [titleOverride, setTitleOverride] = useState<string | null | undefined>(undefined);

  const name = accountName(session) ?? 'Jogador';
  const avatarId = accountAvatar(session);
  const stats = data?.stats ?? null;
  const titleId = titleOverride !== undefined ? titleOverride : (data?.profile?.title_id ?? null);
  const titleName = TITLE_CATALOG.find((t) => t.id === titleId)?.name ?? 'Novato das Cores';
  const accuracy = accuracyPct(stats);
  const avatarCount = FREE_AVATAR_COUNT + (data?.unlockedAvatarIds.size ?? 0);
  const titleCount = FREE_TITLE_COUNT + (data?.unlockedTitleIds.size ?? 0);

  return (
    <div className="corio-wide corio-noscroll" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '8px 16px 16px', gap: 10, overflowY: 'auto', animation: 'corio-rise .4s ease' }}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div onClick={onBack} className="corio-tap corio-back-btn" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, width: 28, height: 28, borderRadius: 9, background: 'rgba(255,255,255,0.06)', justifyContent: 'center', fontSize: 13 }}>
          <span>‹</span>
          <span className="corio-back-label">VOLTAR</span>
        </div>
        <Logo size={17} />
        <div style={{ width: 28 }} />
      </div>

      <div className="corio-card" style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 12, background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 14 }}>
        <button
          onClick={() => setPickerMode('avatar')}
          className="corio-tap"
          style={{ all: 'unset', cursor: 'pointer', boxSizing: 'border-box', width: 56, height: 56, borderRadius: '50%', background: '#8B5CF6', color: '#fff', fontWeight: 800, fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flex: 'none' }}
          aria-label="Trocar ícone"
        >
          {avatarId ? <img src={avatarSmallSrc(avatarId)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : name[0]?.toUpperCase()}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="corio-title" style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
          <button onClick={() => setPickerMode('title')} className="corio-tap" style={{ all: 'unset', cursor: 'pointer', display: 'inline-block', fontSize: 10.5, fontWeight: 700, color: '#FFC93C', marginTop: 3 }}>{titleName} ✏️</button>
        </div>
      </div>

      {loading && !data && (
        <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 11.5, fontWeight: 700, color: 'rgba(244,242,248,0.6)' }}>Carregando estatísticas…</div>
      )}

      <div className="corio-card" style={{ flex: 'none', background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 10 }}>
        <div className="corio-eyebrow" style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.6, color: 'rgba(244,242,248,0.5)', marginBottom: 8 }}>ESTATÍSTICAS</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <StatCell label="Partidas" value={stats?.games_played ?? 0} />
          <StatCell label="Vitórias" value={stats?.games_won ?? 0} />
          <StatCell label="Perfeitos" value={stats?.total_perfects ?? 0} />
          <StatCell label="Maior pontuação" value={(stats?.best_score ?? 0).toLocaleString('pt-BR')} />
          <StatCell label="Precisão" value={accuracy === null ? '—' : `${accuracy}%`} />
          <StatCell label="Sequência atual" value={stats?.current_answer_streak ?? 0} />
        </div>
      </div>

      <div className="corio-card" style={{ flex: 'none', background: 'linear-gradient(135deg,rgba(139,92,246,0.18),rgba(41,231,255,0.1))', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 14, padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="corio-card-sub" style={{ fontSize: 9, color: 'rgba(244,242,248,0.55)' }}>Tempo de jogo</div>
            <div className="corio-value-lg" style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 19 }}>{formatPlaytime(stats?.total_playtime_seconds ?? 0)}</div>
          </div>
          <div style={{ fontSize: 26 }}>⏱️</div>
        </div>
        <div className="corio-card-sub" style={{ fontSize: 9.5, color: 'rgba(244,242,248,0.5)', marginTop: 6 }}>
          Você já jogou por {data?.daysPlayed ?? 0} {(data?.daysPlayed ?? 0) === 1 ? 'dia' : 'dias'}
          {(stats?.current_day_streak ?? 0) > 1 ? ` · sequência de ${stats?.current_day_streak} dias` : ''}
        </div>
      </div>

      {data && data.modeStats.length > 0 && (
        <div className="corio-card" style={{ flex: 'none', background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 10 }}>
          <div className="corio-eyebrow" style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.6, color: 'rgba(244,242,248,0.5)', marginBottom: 8 }}>POR MODO</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.modeStats.map((m) => (
              <div key={m.mode_id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '8px 10px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="corio-card-title" style={{ fontSize: 11, fontWeight: 700 }}>{MODE_LABELS[m.mode_id] ?? m.mode_id}</div>
                  <div className="corio-card-sub" style={{ fontSize: 9, color: 'rgba(244,242,248,0.5)' }}>{m.games_played} partidas · {m.wins} vitórias · {m.perfects} perfeitos</div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 800, fontFamily: "'Space Grotesk',sans-serif", color: '#FFC93C', flex: 'none' }}>{m.best_score.toLocaleString('pt-BR')}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data && data.themeStats.length > 0 && (
        <div className="corio-card" style={{ flex: 'none', background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 10 }}>
          <div className="corio-eyebrow" style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.6, color: 'rgba(244,242,248,0.5)', marginBottom: 8 }}>POR TEMA</div>
          <div className="corio-theme-grid" style={{ gap: 8 }}>
            {data.themeStats.map((t) => {
              const theme = THEME_BY_ID.get(t.theme_id);
              return (
                <div key={t.theme_id} style={{ borderRadius: 12, padding: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontSize: 15 }}>{theme?.icon ?? '🎨'}</div>
                    <div className="corio-card-title" style={{ fontSize: 10, fontWeight: 700 }}>{theme?.name ?? t.theme_id}</div>
                  </div>
                  <div className="corio-card-sub" style={{ fontSize: 8.5, color: 'rgba(244,242,248,0.5)', marginTop: 4 }}>{t.correct_answers} acertos · {t.wrong_answers} erros · {t.perfects} perfeitos</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="corio-card" style={{ flex: 'none', background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 10 }}>
        <div className="corio-eyebrow" style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.6, color: 'rgba(244,242,248,0.5)', marginBottom: 6 }}>CAMPANHA</div>
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{ fontSize: 22 }}>🏆</div>
          <div className="corio-card-sub" style={{ fontSize: 10, color: 'rgba(244,242,248,0.55)', marginTop: 4 }}>Em desenvolvimento! Em breve seu progresso na campanha aparece aqui.</div>
        </div>
      </div>

      <div style={{ flex: 'none', display: 'flex', gap: 8 }}>
        <button onClick={() => setPickerMode('avatar')} className="corio-tap corio-card" style={collectionCardStyle}>
          <div style={{ fontSize: 18 }}>🖼️</div>
          <div className="corio-card-title" style={{ fontSize: 10, fontWeight: 700, marginTop: 4 }}>{avatarCount} avatares</div>
        </button>
        <button onClick={() => setPickerMode('title')} className="corio-tap corio-card" style={collectionCardStyle}>
          <div style={{ fontSize: 18 }}>🏅</div>
          <div className="corio-card-title" style={{ fontSize: 10, fontWeight: 700, marginTop: 4 }}>{titleCount} títulos</div>
        </button>
      </div>

      <div className="corio-card" style={{ flex: 'none', background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 10 }}>
        <div className="corio-eyebrow" style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.6, color: 'rgba(244,242,248,0.5)' }}>
          CONQUISTAS {data ? `(${data.unlockedAchievementIds.size}/${data.achievements.length})` : ''}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 8 }}>
          {(data?.achievements ?? []).map((a) => {
            const unlocked = data?.unlockedAchievementIds.has(a.id) ?? false;
            return (
              <div key={a.id} style={{ borderRadius: 12, padding: 10, background: unlocked ? 'rgba(255,201,60,0.1)' : 'rgba(255,255,255,0.03)', border: unlocked ? '1px solid rgba(255,201,60,0.35)' : '1px solid rgba(255,255,255,0.08)', opacity: unlocked ? 1 : 0.55 }}>
                <div style={{ fontSize: 17 }}>{unlocked ? (a.icon ?? '🏆') : '🔒'}</div>
                <div className="corio-card-title" style={{ fontSize: 10, fontWeight: 700, marginTop: 4 }}>{a.name}</div>
                <div className="corio-card-sub" style={{ fontSize: 8, color: 'rgba(244,242,248,0.5)', marginTop: 2 }}>{a.description}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="corio-card" style={{ flex: 'none', background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 10 }}>
        <div className="corio-eyebrow" style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.6, color: 'rgba(244,242,248,0.5)' }}>HISTÓRICO DE PARTIDAS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          {history.length === 0 && !historyLoading && (
            <div className="corio-card-sub" style={{ fontSize: 10.5, color: 'rgba(244,242,248,0.5)', textAlign: 'center', padding: '10px 0' }}>Nenhuma partida registrada ainda.</div>
          )}
          {history.map((h) => (
            <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '8px 10px' }}>
              <div style={{ fontSize: 15, flex: 'none' }}>{h.result === 'won' ? '🏆' : h.result === 'drawn' ? '🤝' : '💧'}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="corio-card-title" style={{ fontSize: 10.5, fontWeight: 700 }}>{MODE_LABELS[h.mode_id] ?? h.mode_id}</div>
                <div className="corio-card-sub" style={{ fontSize: 8.5, color: 'rgba(244,242,248,0.5)' }}>{new Date(h.played_at).toLocaleDateString('pt-BR')} · {h.correct_answers} acertos · {h.perfects} perfeitos</div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 800, fontFamily: "'Space Grotesk',sans-serif", flex: 'none' }}>{h.score.toLocaleString('pt-BR')}</div>
            </div>
          ))}
        </div>
        {historyHasMore && (
          <button onClick={loadMoreHistory} disabled={historyLoading} className="corio-tap" style={{ all: 'unset', cursor: 'pointer', boxSizing: 'border-box', display: 'block', textAlign: 'center', width: '100%', marginTop: 10, fontSize: 10.5, fontWeight: 700, color: '#29E7FF' }}>
            {historyLoading ? 'Carregando…' : 'Carregar mais'}
          </button>
        )}
      </div>

      {pickerMode && (
        <IdentityPickerModal
          initialMode={pickerMode}
          playerName={name}
          fallbackLetter={name[0]?.toUpperCase() ?? '?'}
          currentAvatarId={avatarId}
          currentTitleId={titleId}
          unlockedAvatarIds={data?.unlockedAvatarIds ?? new Set()}
          unlockedTitleIds={data?.unlockedTitleIds ?? new Set()}
          onAvatarEquipped={() => { /* useSession() auto-refreshes */ }}
          onTitleEquipped={(id) => setTitleOverride(id)}
          onClose={() => setPickerMode(null)}
        />
      )}
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div className="corio-value-lg" style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 15 }}>{value}</div>
      <div className="corio-card-sub" style={{ fontSize: 8, color: 'rgba(244,242,248,0.5)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

const collectionCardStyle: React.CSSProperties = {
  all: 'unset', cursor: 'pointer', boxSizing: 'border-box', flex: 1, minWidth: 0, textAlign: 'center',
  background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '12px 8px',
};
