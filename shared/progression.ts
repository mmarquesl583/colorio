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

// --- Level-milestone titles -----------------------------------------------
// Display mirror of supabase/migrations/0009_level_titles.sql's
// achievements (criteria_type='player_level') / shared/titleCatalog.ts —
// the actual unlock is always enforced server-side via that migration's
// seed rows; this list exists purely so the client can show "which title
// is next" without a round trip. If the level titles ever change, update
// both this list and the migration/catalog together.
export interface LevelMilestone { level: number; title: string; }
export const LEVEL_MILESTONES: LevelMilestone[] = [
  { level: 5, title: 'Pupilo' },
  { level: 10, title: 'Gafanhoto' },
  { level: 15, title: 'Soldado' },
  { level: 20, title: 'Guerreiro' },
  { level: 25, title: 'Viking' },
  { level: 30, title: 'Samurai' },
  { level: 35, title: 'Sensei' },
  { level: 40, title: 'Máquina de Guerra' },
  { level: 45, title: 'Lenda' },
  { level: 50, title: 'Mestre Supremo' },
];

/** The nearest milestone still ahead of `currentLevel`, or null once every
 * tier has been passed. */
export function nextLevelMilestone(currentLevel: number): LevelMilestone | null {
  return LEVEL_MILESTONES.find((m) => m.level > currentLevel) ?? null;
}

/** The single highest milestone strictly newly crossed going from `from`
 * (exclusive) to `to` (inclusive) — used to know which title, if any, a
 * level-up popup should call out. */
export function milestoneCrossed(from: number, to: number): LevelMilestone | null {
  const crossed = LEVEL_MILESTONES.filter((m) => m.level > from && m.level <= to);
  return crossed.length ? crossed[crossed.length - 1] : null;
}
