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
}

export interface ModeStats {
  mode_id: string;
  games_played: number;
  wins: number;
  perfects: number;
  best_score: number;
  total_score: number;
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
}

export interface ProfileData {
  profile: Profile | null;
  stats: PlayerStats | null;
  modeStats: ModeStats[];
  themeStats: ThemeStats[];
  achievements: AchievementDef[];
  unlockedAchievementIds: Set<string>;
  unlockedAvatarIds: Set<string>;
  unlockedTitleIds: Set<string>;
  daysPlayed: number;
}

const emptyProfileData: ProfileData = {
  profile: null,
  stats: null,
  modeStats: [],
  themeStats: [],
  achievements: [],
  unlockedAchievementIds: new Set(),
  unlockedAvatarIds: new Set(),
  unlockedTitleIds: new Set(),
  daysPlayed: 0,
};

export async function fetchProfileData(userId: string): Promise<ProfileData> {
  try {
    const [profileRes, statsRes, modeRes, themeRes, achRes, playerAchRes, avatarRes, titleRes, daysRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('player_stats').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('player_mode_stats').select('*').eq('user_id', userId),
      supabase.from('player_theme_stats').select('*').eq('user_id', userId),
      supabase.from('achievements').select('*').order('sort_order', { ascending: true }),
      supabase.from('player_achievements').select('achievement_id').eq('user_id', userId),
      supabase.from('player_avatars').select('avatar_id').eq('user_id', userId),
      supabase.from('player_titles').select('title_id').eq('user_id', userId),
      // Row count only (head: true skips fetching the actual rows) — this
      // is the "quantidade de dias em que jogou" number, kept as a real
      // table so it's O(1) per match to maintain instead of scanning all
      // of match_history every time the profile opens.
      supabase.from('player_play_days').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    ]);

    return {
      profile: (profileRes.data as Profile | null) ?? null,
      stats: (statsRes.data as PlayerStats | null) ?? null,
      modeStats: (modeRes.data as ModeStats[] | null) ?? [],
      themeStats: (themeRes.data as ThemeStats[] | null) ?? [],
      achievements: (achRes.data as AchievementDef[] | null) ?? [],
      unlockedAchievementIds: new Set(((playerAchRes.data ?? []) as { achievement_id: string }[]).map((r) => r.achievement_id)),
      unlockedAvatarIds: new Set(((avatarRes.data ?? []) as { avatar_id: string }[]).map((r) => r.avatar_id)),
      unlockedTitleIds: new Set(((titleRes.data ?? []) as { title_id: string }[]).map((r) => r.title_id)),
      daysPlayed: daysRes.count ?? 0,
    };
  } catch (err) {
    console.error('fetchProfileData failed:', err);
    return emptyProfileData;
  }
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

export async function equipTitle(titleId: string | null): Promise<void> {
  const { error } = await supabase.rpc('equip_title', { p_title_id: titleId });
  if (error) console.error('equip_title failed:', error.message);
}
