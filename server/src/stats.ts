// Best-effort stats/history persistence — same philosophy as the existing
// reports.jsonl "mailbox" (server/src/index.ts): writes happen in the
// background after the game has already moved on, never block/throw into
// the room's own logic, and silently no-op when Supabase isn't configured
// (statsConfigured === false), so local dev needs zero setup to just play.
import { statsConfigured, supabaseAdmin } from './supabaseAdmin.ts';

export type RoundOutcome = 'perfect' | 'correct' | 'wrong';

export interface ThemeTally {
  theme_id: string;
  correct: number;
  wrong: number;
  perfects: number;
  best_score: number;
}

export interface MatchParticipantSummary {
  userId: string;
  matchId: string;
  roomCode: string;
  modeId: string;
  themeIds: string[];
  difficulty: string | null;
  score: number;
  perfects: number;
  result: 'won' | 'lost' | 'drawn';
  durationSeconds: number;
  playedAt: string; // ISO timestamp
  roundOutcomes: RoundOutcome[];
  themeTallies: ThemeTally[];
}

export async function openGameSession(userId: string, roomCode: string): Promise<string | null> {
  if (!statsConfigured) return null;
  try {
    const { data, error } = await supabaseAdmin!.rpc('open_game_session', { p_user_id: userId, p_room_code: roomCode });
    if (error) { console.error('open_game_session failed:', error.message); return null; }
    return (data as string) ?? null;
  } catch (err) {
    console.error('openGameSession failed:', err);
    return null;
  }
}

export function closeGameSession(sessionId: string | null): void {
  if (!statsConfigured || !sessionId) return;
  supabaseAdmin!.rpc('close_game_session', { p_session_id: sessionId }).then(({ error }) => {
    if (error) console.error('close_game_session failed:', error.message);
  });
}

export function recordAbandonedMatch(userIds: string[]): void {
  if (!statsConfigured) return;
  for (const userId of userIds) {
    supabaseAdmin!.rpc('record_abandoned_match', { p_user_id: userId }).then(({ error }) => {
      if (error) console.error('record_abandoned_match failed:', error.message);
    });
  }
}

async function applyOne(p: MatchParticipantSummary): Promise<void> {
  const { error } = await supabaseAdmin!.rpc('apply_match_result', {
    p_user_id: p.userId,
    p_match_id: p.matchId,
    p_room_code: p.roomCode,
    p_mode_id: p.modeId,
    p_theme_ids: p.themeIds,
    p_difficulty: p.difficulty,
    p_score: p.score,
    p_perfects: p.perfects,
    p_result: p.result,
    p_duration_seconds: p.durationSeconds,
    p_played_at: p.playedAt,
    p_round_outcomes: p.roundOutcomes,
    p_theme_tallies: p.themeTallies,
  });
  if (error) { console.error('apply_match_result failed:', error.message); return; }

  const { error: achError } = await supabaseAdmin!.rpc('check_and_grant_achievements', { p_user_id: p.userId });
  if (achError) console.error('check_and_grant_achievements failed:', achError.message);
}

/** Fire-and-forget: called once right after a match finishes, for every
 * participant with a known userId. Never awaited by the game loop. */
export function recordMatchResult(participants: MatchParticipantSummary[]): void {
  if (!statsConfigured) return;
  for (const p of participants) {
    applyOne(p).catch((err) => console.error('recordMatchResult failed for', p.userId, err));
  }
}

/** Safety net for sessions whose ws never fired a close event (dead
 * network, process kill, etc). Runs once at boot, then every 30min. */
export function startStaleSessionSweep(): void {
  if (!statsConfigured) return;
  const sweep = () => {
    supabaseAdmin!.rpc('close_stale_sessions', { p_max_hours: 6 }).then(({ data, error }) => {
      if (error) console.error('close_stale_sessions failed:', error.message);
      else if (typeof data === 'number' && data > 0) console.log(`Closed ${data} stale game session(s).`);
    });
  };
  sweep();
  setInterval(sweep, 30 * 60 * 1000);
}
