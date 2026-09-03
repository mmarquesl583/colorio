// Level constants — zero imports, same reusability rationale as
// shared/raceMode.ts and shared/scoring.ts.

// Levels track lifetime accumulated points (player_stats.total_score — the
// real sum of every match's final score, every mode, since day one), not a
// separately curated XP economy. `xp` still exists as its own field/column
// purely so the existing progress-bar UI (HomeScreen/ProfileScreen) keeps
// working unchanged — it's just kept equal to total_score. Linear pacing:
// every level costs exactly POINTS_PER_LEVEL more than the last (level 2 =
// 10,000, level 10 = 90,000, level 50 = 490,000). Mirrored in SQL inside
// apply_match_result (plpgsql can't import this file); if this changes,
// update both places.
export const POINTS_PER_LEVEL = 10000;

export function xpForLevel(level: number): number {
  return POINTS_PER_LEVEL * (level - 1);
}

export function levelForXp(xp: number): number {
  return Math.max(1, Math.floor(xp / POINTS_PER_LEVEL) + 1);
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
