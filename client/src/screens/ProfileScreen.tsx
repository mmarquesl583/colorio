import { useState } from 'react';
import Logo from '../components/Logo.tsx';
import { useSession, accountAvatar, accountName, setAccountName } from '../auth.ts';
import { AVATAR_ICONS, avatarSmallSrc } from '@shared/avatarIcons';
import { TITLE_CATALOG, titleNameFor } from '@shared/titleCatalog';
import { LOBBY_THEMES } from '@shared/gameData';
import { xpForLevel, nextLevelMilestone } from '@shared/progression';
import { useProfileData } from '../hooks/useProfileData.ts';
import { addFriend, removeFriend, markUnlocksSeen } from '../stats.ts';
import IdentityPickerModal from '../components/IdentityPickerModal.tsx';
import MatchDetailModal from '../components/MatchDetailModal.tsx';

const ADD_FRIEND_MESSAGES: Record<string, string> = {
  not_found: 'Nenhum jogador com esse código.',
  self: 'Esse código é o seu próprio :)',
  already_friends: 'Vocês já são amigos!',
  not_authenticated: 'Faça login pra adicionar amigos.',
  error: 'Não deu pra adicionar agora. Tenta de novo.',
};

const MODE_LABELS: Record<string, string> = { players: 'Frase dos jogadores', ai: 'Frase da IA', race: 'Corrida contra o Tempo', verbal: 'Com a Galera' };
const THEME_BY_ID = new Map(LOBBY_THEMES.map((t) => [t.id, t]));
const FREE_AVATAR_COUNT = AVATAR_ICONS.filter((a) => a.free).length;
const FREE_TITLE_COUNT = TITLE_CATALOG.filter((t) => t.free).length;

export default function ProfileScreen({ onBack, onOpenAdmin }: { onBack: () => void; onOpenAdmin: () => void }) {
  const { session } = useSession();
  const userId = session?.user.id ?? null;
  const { data, loading, history, historyHasMore, historyLoading, loadMoreHistory, refresh } = useProfileData(userId);
  const [pickerMode, setPickerMode] = useState<'avatar' | 'title' | null>(null);
  // undefined = no local override yet (still trusting whatever useProfileData
  // last fetched); set the instant the picker actually equips a new title,
  // since a full profile re-fetch isn't needed just to reflect that.
  const [titleOverride, setTitleOverride] = useState<string | null | undefined>(undefined);
  // null = not currently being edited — the input mirrors `name` straight
  // from the session. Set on every keystroke, reset back to null once a
  // save round-trips (useSession() picks up the new display_name itself,
  // same auto-refresh pattern as the avatar picker below).
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [friendCodeInput, setFriendCodeInput] = useState('');
  const [addingFriend, setAddingFriend] = useState(false);
  const [addFriendMsg, setAddFriendMsg] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [openMatchId, setOpenMatchId] = useState<string | null>(null);
  // Cleared the moment either picker tab opens (it lets you switch between
  // Ícone/Título from the same modal either way) — local-only, so the "new
  // stuff to check" dot disappears instantly instead of waiting on the
  // mark_unlocks_seen() round-trip.
  const [unlocksChecked, setUnlocksChecked] = useState(false);

  const name = accountName(session) ?? 'Jogador';
  const avatarId = accountAvatar(session);
  const stats = data?.stats ?? null;
  const titleId = titleOverride !== undefined ? titleOverride : (data?.profile?.title_id ?? null);
  const titleName = titleNameFor(titleId);
  const avatarCount = FREE_AVATAR_COUNT + (data?.unlockedAvatarIds.size ?? 0);
  const titleCount = FREE_TITLE_COUNT + (data?.unlockedTitleIds.size ?? 0);

  // "New unlock" dots: any achievement granted after the player's own
  // last_checked_unlocks_at, split by which kind of reward it handed out
  // (an achievement can in principle hand out both) — reward_type lookup
  // goes through achievementRewards since player_achievements itself only
  // has the achievement id, not what it unlocked.
  const lastCheckedAt = data?.profile?.last_checked_unlocks_at ? new Date(data.profile.last_checked_unlocks_at).getTime() : 0;
  const newRewardTypes = new Set(
    unlocksChecked ? [] : (data?.recentUnlocks ?? [])
      .filter((u) => new Date(u.unlocked_at).getTime() > lastCheckedAt)
      .flatMap((u) => (data?.achievementRewards ?? []).filter((r) => r.achievement_id === u.achievement_id).map((r) => r.reward_type))
  );
  const hasNewAvatar = newRewardTypes.has('avatar');
  const hasNewTitle = newRewardTypes.has('title');

  const commitName = async () => {
    const trimmed = (nameDraft ?? '').trim();
    if (!trimmed || trimmed === name) { setNameDraft(null); return; }
    setSavingName(true);
    await setAccountName(trimmed).finally(() => setSavingName(false));
    setNameDraft(null);
  };

  const openPicker = (mode: 'avatar' | 'title') => {
    setPickerMode(mode);
    if (!unlocksChecked) { setUnlocksChecked(true); markUnlocksSeen(); }
  };

  const copyFriendCode = () => {
    const code = data?.profile?.friend_code;
    if (!code) return;
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1500);
  };

  const handleAddFriend = async () => {
    const code = friendCodeInput.trim();
    if (!code || addingFriend) return;
    setAddingFriend(true);
    setAddFriendMsg(null);
    const result = await addFriend(code).finally(() => setAddingFriend(false));
    if (result === 'ok') {
      setFriendCodeInput('');
      setAddFriendMsg('Amigo adicionado! 🎉');
      refresh();
    } else {
      setAddFriendMsg(ADD_FRIEND_MESSAGES[result] ?? ADD_FRIEND_MESSAGES.error);
    }
    setTimeout(() => setAddFriendMsg(null), 3000);
  };

  const handleRemoveFriend = async (friendId: string) => {
    await removeFriend(friendId);
    refresh();
  };

  return (
    <div className="corio-wide corio-noscroll" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '8px 16px 16px', gap: 10, overflowY: 'auto', animation: 'corio-rise .4s ease' }}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div onClick={onBack} className="corio-tap corio-back-btn" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, width: 28, height: 28, borderRadius: 9, background: 'rgba(255,255,255,0.06)', justifyContent: 'center', fontSize: 13 }}>
          <span>‹</span>
          <span className="corio-back-label">VOLTAR</span>
        </div>
        <Logo size={17} />
        {data?.profile?.is_admin ? (
          <div onClick={onOpenAdmin} className="corio-tap" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 9, background: 'rgba(255,255,255,0.06)', fontSize: 13 }} aria-label="Abrir painel admin" title="Admin">
            ⚙
          </div>
        ) : (
          <div style={{ width: 28 }} />
        )}
      </div>

      <div className="corio-card" style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 12, background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 14 }}>
        <button
          onClick={() => openPicker('avatar')}
          className="corio-tap"
          style={{ all: 'unset', cursor: 'pointer', boxSizing: 'border-box', width: 56, height: 56, borderRadius: '50%', background: '#8B5CF6', color: '#fff', fontWeight: 800, fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flex: 'none' }}
          aria-label="Trocar ícone"
        >
          {avatarId ? <img src={avatarSmallSrc(avatarId)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : name[0]?.toUpperCase()}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              value={nameDraft ?? name}
              onChange={(e) => setNameDraft(e.target.value.slice(0, 24))}
              onFocus={() => setNameDraft((d) => d ?? name)}
              onBlur={commitName}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              disabled={savingName}
              aria-label="Editar nome de usuário"
              className="corio-title"
              style={{
                all: 'unset', boxSizing: 'border-box', minWidth: 0, flex: 1,
                fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 16, color: '#fff',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                borderBottom: '1px dashed rgba(255,255,255,0.25)', paddingBottom: 2,
                opacity: savingName ? 0.6 : 1,
              }}
            />
            <span style={{ flex: 'none', fontSize: 11 }} aria-hidden="true">{savingName ? '…' : '✏️'}</span>
          </div>
          <button onClick={() => openPicker('title')} className="corio-tap" style={{ all: 'unset', cursor: 'pointer', display: 'inline-block', fontSize: 10.5, fontWeight: 700, color: '#FFC93C', marginTop: 3 }}>{titleName} ✏️</button>
        </div>
      </div>

      {loading && !data && (
        <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 11.5, fontWeight: 700, color: 'rgba(244,242,248,0.6)' }}>Carregando estatísticas…</div>
      )}

      {stats && (
        <div className="corio-card" style={{ flex: 'none', background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 10 }}>
          <div className="corio-eyebrow" style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.6, color: 'rgba(244,242,248,0.5)', marginBottom: 8 }}>MINHA HISTÓRIA</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 'none', fontSize: 12, fontWeight: 800, color: '#FFC93C', fontFamily: "'Space Grotesk',sans-serif" }}>Nível {stats.level}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.max(0, Math.min(100, ((stats.xp - xpForLevel(stats.level)) / (xpForLevel(stats.level + 1) - xpForLevel(stats.level))) * 100))}%`,
                  height: '100%', background: 'linear-gradient(90deg,#8B5CF6,#FFC93C)', borderRadius: 3,
                }} />
              </div>
            </div>
            <div style={{ flex: 'none', fontSize: 8.5, color: 'rgba(244,242,248,0.5)' }}>{stats.xp.toLocaleString('pt-BR')} XP</div>
          </div>
          {(() => {
            const next = nextLevelMilestone(stats.level);
            return next ? (
              <div style={{ fontSize: 9, color: 'rgba(244,242,248,0.5)', marginBottom: 10 }}>
                🔒 Nível {next.level} desbloqueia o título <span style={{ color: '#C4B5FD', fontWeight: 700 }}>{next.title}</span>
              </div>
            ) : null;
          })()}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            <StatCell label="Partidas" value={stats.games_played} />
            <StatCell label="Vitórias" value={stats.games_won} />
            <StatCell label="Perfeitos" value={stats.total_perfects} />
            <StatCell label="Pontos acumulados" value={stats.total_score.toLocaleString('pt-BR')} />
            <StatCell label="Precisão média" value={stats.best_avg_precision} />
            <StatCell label="Sequência atual" value={stats.current_day_streak > 0 ? `🔥 ${stats.current_day_streak}` : 0} />
            <StatCell label="Conta criada em" value={session?.user.created_at ? new Date(session.user.created_at).toLocaleDateString('pt-BR') : '—'} />
            <StatCell label="Última vez online" value={session?.user.last_sign_in_at ? formatLastOnline(session.user.last_sign_in_at) : '—'} />
          </div>
        </div>
      )}

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

      <div style={{ flex: 'none', display: 'flex', gap: 8 }}>
        <button onClick={() => openPicker('avatar')} className="corio-tap corio-card" style={collectionCardStyle}>
          {hasNewAvatar && <span className="corio-new-dot" />}
          <div style={{ fontSize: 18 }}>🖼️</div>
          <div className="corio-card-title" style={{ fontSize: 10, fontWeight: 700, marginTop: 4 }}>{avatarCount} avatares</div>
        </button>
        <button onClick={() => openPicker('title')} className="corio-tap corio-card" style={collectionCardStyle}>
          {hasNewTitle && <span className="corio-new-dot" />}
          <div style={{ fontSize: 18 }}>🏅</div>
          <div className="corio-card-title" style={{ fontSize: 10, fontWeight: 700, marginTop: 4 }}>{titleCount} títulos</div>
        </button>
      </div>

      <div className="corio-card" style={{ flex: 'none', background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 10 }}>
        <div className="corio-eyebrow" style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.6, color: 'rgba(244,242,248,0.5)' }}>
          AMIGOS {data ? `(${data.friends.length})` : ''}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
          <div className="corio-card-sub" style={{ fontSize: 9.5, color: 'rgba(244,242,248,0.5)' }}>Seu código de amigo</div>
          <button onClick={copyFriendCode} className="corio-tap" style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 13, letterSpacing: 1, color: '#29E7FF' }}>
            {data?.profile?.friend_code ?? '------'} <span style={{ fontSize: 10 }}>{copiedCode ? '✓' : '📋'}</span>
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <input
            value={friendCodeInput}
            onChange={(e) => setFriendCodeInput(e.target.value.toUpperCase().slice(0, 6))}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddFriend(); }}
            placeholder="Código do amigo"
            maxLength={6}
            style={{ flex: 1, minWidth: 0, boxSizing: 'border-box', background: '#1c1c26', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 10px', color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: 1, outline: 'none' }}
          />
          <button onClick={handleAddFriend} disabled={addingFriend || !friendCodeInput.trim()} className="corio-tap" style={{ all: 'unset', cursor: 'pointer', flex: 'none', boxSizing: 'border-box', padding: '8px 14px', borderRadius: 10, background: 'linear-gradient(90deg,#8B5CF6,#6D28D9)', color: '#fff', fontWeight: 700, fontSize: 10.5, opacity: addingFriend || !friendCodeInput.trim() ? 0.55 : 1 }}>
            {addingFriend ? '…' : 'Adicionar'}
          </button>
        </div>
        {addFriendMsg && <div style={{ fontSize: 9.5, fontWeight: 700, color: '#FFC93C', marginTop: 6 }}>{addFriendMsg}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
          {(data?.friends.length ?? 0) === 0 && (
            <div className="corio-card-sub" style={{ fontSize: 10.5, color: 'rgba(244,242,248,0.5)', textAlign: 'center', padding: '8px 0' }}>Nenhum amigo ainda — compartilhe seu código!</div>
          )}
          {data?.friends.map((f) => (
            <div key={f.friend_id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '8px 10px' }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(139,92,246,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flex: 'none', overflow: 'hidden' }}>
                {f.avatar_id ? <img src={avatarSmallSrc(f.avatar_id)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : f.name[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="corio-card-title" style={{ fontSize: 10.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                <div className="corio-card-sub" style={{ fontSize: 8.5, color: 'rgba(244,242,248,0.5)' }}>{titleNameFor(f.title_id)} · {f.games_played} partidas · {f.best_score.toLocaleString('pt-BR')} pts</div>
              </div>
              <button onClick={() => handleRemoveFriend(f.friend_id)} className="corio-tap" aria-label={`Remover ${f.name} dos amigos`} style={{ all: 'unset', cursor: 'pointer', flex: 'none', width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(244,242,248,0.4)', fontSize: 11 }}>✕</button>
            </div>
          ))}
        </div>
      </div>

      <div className="corio-card" style={{ flex: 'none', background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 10 }}>
        <div className="corio-eyebrow" style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.6, color: 'rgba(244,242,248,0.5)' }}>HISTÓRICO DE PARTIDAS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          {history.length === 0 && !historyLoading && (
            <div className="corio-card-sub" style={{ fontSize: 10.5, color: 'rgba(244,242,248,0.5)', textAlign: 'center', padding: '10px 0' }}>Nenhuma partida registrada ainda.</div>
          )}
          {history.map((h) => (
            <div key={h.id} onClick={() => setOpenMatchId(h.match_id)} className="corio-tap" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '8px 10px' }}>
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
          progress={data ? { stats: data.stats, modeStats: data.modeStats, achievements: data.achievements, achievementRewards: data.achievementRewards, friendsCount: data.friendsCount } : undefined}
          onAvatarEquipped={() => { /* useSession() auto-refreshes */ }}
          onTitleEquipped={(id) => setTitleOverride(id)}
          onClose={() => setPickerMode(null)}
        />
      )}

      {openMatchId && (
        <MatchDetailModal matchId={openMatchId} youUserId={userId} onClose={() => setOpenMatchId(null)} />
      )}
    </div>
  );
}

// "Online" covers the fresh case (just signed in, or reloaded and the
// session silently refreshed) — last_sign_in_at only moves on an actual
// sign-in event, not on every request, so a persisted session can sit at
// the same timestamp for days while you're actively using the app right
// now. Past that, plain minutes/hours/days — no need for weeks/months on
// what's ultimately a "last time you signed in" stat.
function formatLastOnline(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 2) return 'Online';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days} ${days === 1 ? 'dia' : 'dias'}`;
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
  all: 'unset', cursor: 'pointer', position: 'relative', boxSizing: 'border-box', flex: 1, minWidth: 0, textAlign: 'center',
  background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '12px 8px',
};
