// XP/level/combo constants — zero imports, same reusability rationale as
// shared/raceMode.ts and shared/scoring.ts. Every number here is a tuning
// knob, not a magic constant baked into the logic that uses it (server's
// room.ts and the level curve's SQL mirror in
// supabase/migrations/0007_progression.sql).

// --- XP awards ------------------------------------------------------------
export const XP_PER_ROUND_PLAYED = 5;    // flat, every round actually guessed
export const XP_PER_CORRECT = 10;        // outcome 'correct' or 'perfect' (baseScore >= 800)
export const XP_PER_PERFECT_BONUS = 15;  // additional, only badge === 'PERFEITO'
export const XP_MATCH_PLAYED_BONUS = 20; // once per match, every signed-in participant
export const XP_MATCH_WIN_BONUS = 50;    // once, only result === 'won'
export const XP_MATCH_DRAW_BONUS = 25;   // once, only result === 'drawn'

// Discrete bucket table, capped at 2.0x. Applied ONLY to XP, never to
// `score` — score decides match winners, best_score records, and
// exact-value achievements (hit_666_count/hit_777_count require score to
// equal exactly 666/777), so a combo multiplier on score would make those
// unreachable/unpredictable and let combo luck decide matches.
export function comboXpMultiplier(combo: number): number {
  if (combo >= 12) return 2.0;
  if (combo >= 8) return 1.8;
  if (combo >= 5) return 1.5;
  if (combo >= 3) return 1.2;
  return 1.0;
}

// Cumulative XP required to REACH `level` (level 1 = 0 xp). Quadratic
// curve: level 2 = 100xp, level 5 = 1,600xp, level 10 = 8,100xp, level 20 =
// 36,100xp. XP_LEVEL_FACTOR is the single pacing knob — mirrored in SQL
// inside apply_match_result (plpgsql can't import this file); if this
// factor changes, update both places.
export const XP_LEVEL_FACTOR = 100;

export function xpForLevel(level: number): number {
  return XP_LEVEL_FACTOR * (level - 1) * (level - 1);
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  return level;
}
