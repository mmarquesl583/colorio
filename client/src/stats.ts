// Typed reads against the stats/history tables (see supabase/migrations).
// Everything here is a SELECT through the existing anon-key client
// (client/src/supabase.ts) — RLS restricts every table to the caller's own
// rows, so there's nothing to protect client-side. The one exception is
// equipTitle() below, which goes through the equip_title() Postgres
// function (SECURITY DEFINER, ownership-checked server-side) since
// `profiles` itself has no update policy for regular users — everything
// else stays read-only from here; the server's service-role key does the
// actual stats writes.
import { supabase } from './supabase.ts';

export interface Profile {
  user_id: string;
  title_id: string | null;
  first_seen_at: string;
  last_login_at: string | null;
  last_played_at: string | null;
  session_count: number;
  friend_code: string | null;
  last_checked_unlocks_at: string;
}

export interface Friend {
  friend_id: string;
  name: string;
  avatar_id: string | null;
  title_id: string | null;
  games_played: number;
  games_won: number;
  best_score: number;
  total_perfects: number;
}

export interface PlayerStats {
  user_id: string;
  games_played: number;
  games_won: number;
  games_lost: number;
  games_drawn: number;
  abandoned_games: number;
  total_score: number;
  best_score: number;
  correct_answers: number;
  wrong_answers: number;
  total_perfects: number;
  current_answer_streak: number;
  best_answer_streak: number;
  current_perfect_streak: number;
  best_perfect_streak: number;
  total_playtime_seconds: number;
  longest_session_seconds: number;
  total_match_duration_seconds: number;
  current_day_streak: number;
  best_day_streak: number;
  last_play_date: string | null;
  // Global, all-modes — power the titleCatalog.ts v2 achievement set.
  zero_score_guesses: number;
  best_precision98_in_match: number;
  current_exact990_streak: number;
  best_exact990_streak: number;
  fastest_correct_response_ms: number | null;
  fastest_perfect_response_ms: number | null;
  sub2s_correct_count: number;
  personal_best_breaks: number;
  hit_666_count: number;
  hit_666_won_count: number;
  hit_666_with_perfect_count: number;
  hit_777_count: number;
  hit_777_with_perfect_count: number;
}

export interface ModeStats {
  mode_id: string;
  games_played: number;
  wins: number;
  perfects: number;
  best_score: number;
  total_score: number;
  // Corrida contra o Tempo only — null for every other mode_id.
  best_response_ms: number | null;
  best_correct_response_ms: number | null;
  best_multiplier: number | null;
  multiplier_2x_count: number;
  total_response_ms: number;
  timed_rounds_count: number;
  no_timeout_matches: number;
}

export interface ThemeStats {
  theme_id: string;
  rounds_played: number;
  correct_answers: number;
  wrong_answers: number;
  perfects: number;
  best_score: number;
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string | null;
  criteria_type: string;
  criteria_value: number;
  sort_order: number;
  required_mode_id: string | null;
}

export interface AchievementReward {
  achievement_id: string;
  reward_type: string;
  reward_id: string;
}

export interface MatchHistoryRow {
  id: string;
  match_id: string;
  room_code: string;
  mode_id: string;
  theme_ids: string[];
  difficulty: string | null;
  score: number;
  correct_answers: number;
  wrong_answers: number;
  perfects: number;
  result: 'won' | 'lost' | 'drawn';
  duration_seconds: number;
  played_at: string;
  // Corrida contra o Tempo only — null for every other mode_id.
  race_score_normal_total: number | null;
  race_avg_response_ms: number | null;
  race_avg_multiplier: number | null;
  race_best_multiplier: number | null;
}

export interface ProfileData {
  profile: Profile | null;
  stats: PlayerStats | null;
  modeStats: ModeStats[];
  themeStats: ThemeStats[];
  achievements: AchievementDef[];
  achievementRewards: AchievementReward[];
  unlockedAchievementIds: Set<string>;
  unlockedAvatarIds: Set<string>;
  unlockedTitleIds: Set<string>;
  daysPlayed: number;
  friends: Friend[];
  friendsCount: number;
  // achievement_id + when it unlocked — lets the UI show a "new" badge for
  // anything granted after the player's own last_checked_unlocks_at,
  // without a second table just for read/unread state.
  recentUnlocks: { achievement_id: string; unlocked_at: string }[];
}

const emptyProfileData: ProfileData = {
  profile: null,
  stats: null,
  modeStats: [],
  themeStats: [],
  achievements: [],
  achievementRewards: [],
  unlockedAchievementIds: new Set(),
  unlockedAvatarIds: new Set(),
  unlockedTitleIds: new Set(),
  daysPlayed: 0,
  friends: [],
  friendsCount: 0,
  recentUnlocks: [],
};

export async function fetchProfileData(userId: string): Promise<ProfileData> {
  try {
    const [profileRes, statsRes, modeRes, themeRes, achRes, rewardsRes, playerAchRes, avatarRes, titleRes, daysRes, friendsRes, friendsCountRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('player_stats').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('player_mode_stats').select('*').eq('user_id', userId),
      supabase.from('player_theme_stats').select('*').eq('user_id', userId),
      supabase.from('achievements').select('*').order('sort_order', { ascending: true }),
      // Small, static catalog table (same RLS "read to authenticated" as
      // achievements itself) — lets the client know which achievement
      // backs a given title id, so it can look up that achievement's
      // criteria and show real "how close am I" progress in the picker.
      supabase.from('achievement_rewards').select('*'),
      supabase.from('player_achievements').select('achievement_id, unlocked_at').eq('user_id', userId),
      supabase.from('player_avatars').select('avatar_id').eq('user_id', userId),
      supabase.from('player_titles').select('title_id').eq('user_id', userId),
      // Row count only (head: true skips fetching the actual rows) — this
      // is the "quantidade de dias em que jogou" number, kept as a real
      // table so it's O(1) per match to maintain instead of scanning all
      // of match_history every time the profile opens.
      supabase.from('player_play_days').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      // Friend names/avatars/stats live in auth.users + other players' own
      // rows — RLS blocks reading those directly, so this goes through the
      // get_friends_stats() SECURITY DEFINER function instead of a table select.
      supabase.rpc('get_friends_stats'),
      supabase.from('friendships').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    ]);

    return {
      profile: (profileRes.data as Profile | null) ?? null,
      stats: (statsRes.data as PlayerStats | null) ?? null,
      modeStats: (modeRes.data as ModeStats[] | null) ?? [],
      themeStats: (themeRes.data as ThemeStats[] | null) ?? [],
      achievements: (achRes.data as AchievementDef[] | null) ?? [],
      achievementRewards: (rewardsRes.data as AchievementReward[] | null) ?? [],
      unlockedAchievementIds: new Set(((playerAchRes.data ?? []) as { achievement_id: string; unlocked_at: string }[]).map((r) => r.achievement_id)),
      unlockedAvatarIds: new Set(((avatarRes.data ?? []) as { avatar_id: string }[]).map((r) => r.avatar_id)),
      unlockedTitleIds: new Set(((titleRes.data ?? []) as { title_id: string }[]).map((r) => r.title_id)),
      daysPlayed: daysRes.count ?? 0,
      friends: (friendsRes.data as Friend[] | null) ?? [],
      friendsCount: friendsCountRes.count ?? 0,
      recentUnlocks: (playerAchRes.data ?? []) as { achievement_id: string; unlocked_at: string }[],
    };
  } catch (err) {
    console.error('fetchProfileData failed:', err);
    return emptyProfileData;
  }
}

export async function addFriend(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('add_friend', { p_code: code });
  if (error) { console.error('add_friend failed:', error.message); return 'error'; }
  return (data as string | null) ?? 'error';
}

export async function removeFriend(friendId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_friend', { p_friend_id: friendId });
  if (error) console.error('remove_friend failed:', error.message);
}

export async function markUnlocksSeen(): Promise<void> {
  const { error } = await supabase.rpc('mark_unlocks_seen');
  if (error) console.error('mark_unlocks_seen failed:', error.message);
}

const HISTORY_PAGE_SIZE = 20;

export async function fetchMatchHistoryPage(userId: string, page: number): Promise<{ rows: MatchHistoryRow[]; hasMore: boolean }> {
  const from = page * HISTORY_PAGE_SIZE;
  const to = from + HISTORY_PAGE_SIZE - 1;
  const { data, error } = await supabase
    .from('match_history')
    .select('*')
    .eq('user_id', userId)
    .order('played_at', { ascending: false })
    .range(from, to);
  if (error) { console.error('fetchMatchHistoryPage failed:', error.message); return { rows: [], hasMore: false }; }
  const rows = (data ?? []) as MatchHistoryRow[];
  return { rows, hasMore: rows.length === HISTORY_PAGE_SIZE };
}

// Derived metrics, computed on the fly from raw counts every time — never
// stored, so there's nothing that can drift out of sync with the numbers
// they're derived from (same rule the schema itself already enforces).
export function accuracyPct(stats: PlayerStats | null): number | null {
  if (!stats) return null;
  const total = stats.correct_answers + stats.wrong_answers;
  if (total === 0) return null;
  return Math.round((stats.correct_answers / total) * 100);
}

export function winRatePct(stats: PlayerStats | null): number | null {
  if (!stats || stats.games_played === 0) return null;
  return Math.round((stats.games_won / stats.games_played) * 100);
}

export function avgScore(stats: PlayerStats | null): number | null {
  if (!stats || stats.games_played === 0) return null;
  return Math.round(stats.total_score / stats.games_played);
}

export function formatPlaytime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours === 0) return `${minutes}min`;
  return `${hours}h ${minutes}min`;
}

// Lightweight, single-column fetch for places that only need to display
// the equipped title (e.g. the Home identity chip) without pulling the
// whole profile — keeps that read cheap and separate from useProfileData.
export async function fetchEquippedTitle(userId: string): Promise<string | null> {
  const { data, error } = await supabase.from('profiles').select('title_id').eq('user_id', userId).maybeSingle();
  if (error) { console.error('fetchEquippedTitle failed:', error.message); return null; }
  return (data as { title_id: string | null } | null)?.title_id ?? null;
}

export async function equipTitle(titleId: string | null): Promise<void> {
  const { error } = await supabase.rpc('equip_title', { p_title_id: titleId });
  if (error) console.error('equip_title failed:', error.message);
}

// --- Achievement progress ("how close am I") ---------------------------
// Maps an achievement's criteria_type to which stats field holds the
// player's current value, so the title picker can show real progress
// without a second source of truth for "what unlocks what" — the
// achievement itself (fetched from Postgres) already says that; this is
// just the one place that knows which TS field each criteria_type reads
// from. Extend these two maps when a future achievement adds a new
// criteria_type; nothing else needs to change.
const GLOBAL_CRITERIA_FIELDS: Partial<Record<string, keyof PlayerStats>> = {
  games_played: 'games_played',
  games_won: 'games_won',
  total_perfects: 'total_perfects',
  total_playtime_seconds: 'total_playtime_seconds',
  best_answer_streak: 'best_answer_streak',
  best_perfect_streak: 'best_perfect_streak',
  best_score: 'best_score',
  zero_score_guesses: 'zero_score_guesses',
  best_precision98_in_match: 'best_precision98_in_match',
  best_exact990_streak: 'best_exact990_streak',
  sub2s_correct_count: 'sub2s_correct_count',
  personal_best_breaks: 'personal_best_breaks',
  hit_666_count: 'hit_666_count',
  hit_666_won_count: 'hit_666_won_count',
  hit_666_with_perfect_count: 'hit_666_with_perfect_count',
  hit_777_count: 'hit_777_count',
  hit_777_with_perfect_count: 'hit_777_with_perfect_count',
  fastest_correct_response_ms: 'fastest_correct_response_ms',
  fastest_perfect_response_ms: 'fastest_perfect_response_ms',
};
const MODE_CRITERIA_FIELDS: Partial<Record<string, keyof ModeStats>> = {
  mode_perfects: 'perfects',
  multiplier_2x_count: 'multiplier_2x_count',
  no_timeout_matches: 'no_timeout_matches',
  fastest_correct_response_ms: 'best_correct_response_ms',
};
// "Fastest ___ (ms)" achievements count DOWN toward their target, unlike
// every other criteria_type (count UP) — flagged so the UI can render
// "seu recorde: 1.3s · meta: 1.0s" instead of a misleading fill bar.
const LOWER_IS_BETTER = new Set(['fastest_correct_response_ms', 'fastest_perfect_response_ms']);

export interface AchievementProgress {
  current: number;
  target: number;
  lowerIsBetter: boolean;
}

/** null return = no progress to show (criteria_type not yet mappable, or
 * a lower-is-better stat the player has never recorded at all — 0ms would
 * misleadingly read as "already there"). friendsCount only matters for the
 * friends_count criteria_type — it lives in `friendships`, not PlayerStats,
 * so it can't go through the same field-lookup map as everything else. */
export function achievementProgress(ach: AchievementDef, stats: PlayerStats | null, modeStats: ModeStats[], friendsCount?: number): AchievementProgress | null {
  if (ach.criteria_type === 'friends_count') {
    return { current: friendsCount ?? 0, target: ach.criteria_value, lowerIsBetter: false };
  }
  const lowerIsBetter = LOWER_IS_BETTER.has(ach.criteria_type);
  if (ach.required_mode_id) {
    const field = MODE_CRITERIA_FIELDS[ach.criteria_type];
    if (!field) return null;
    const m = modeStats.find((x) => x.mode_id === ach.required_mode_id);
    const raw = m ? (m[field] as number | null) : null;
    if (lowerIsBetter && (raw === null || raw === undefined)) return null;
    return { current: (raw as number) ?? 0, target: ach.criteria_value, lowerIsBetter };
  }
  const field = GLOBAL_CRITERIA_FIELDS[ach.criteria_type];
  if (!field) return null;
  const raw = stats ? (stats[field] as number | null) : null;
  if (lowerIsBetter && (raw === null || raw === undefined)) return null;
  return { current: (raw as number) ?? 0, target: ach.criteria_value, lowerIsBetter };
}

/** Find which achievement (if any) grants a given title id — the picker
 * uses this to look up criteria for the "how to unlock" progress display. */
export function achievementForTitle(titleId: string, achievements: AchievementDef[], rewards: AchievementReward[]): AchievementDef | null {
  const reward = rewards.find((r) => r.reward_type === 'title' && r.reward_id === titleId);
  if (!reward) return null;
  return achievements.find((a) => a.id === reward.achievement_id) ?? null;
}
