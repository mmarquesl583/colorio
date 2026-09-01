// Pure timing/scoring rules for "Corrida contra o Tempo" — zero imports, so
// this is reusable as-is by a future offline/campaign engine (spec ask),
// exactly like shared/scoring.ts already is for the base color score.
export const RACE_SECONDS = 10;
export const RACE_MS = RACE_SECONDS * 1000;

// Discrete table, NOT a linear formula — the spec is explicit that the
// multiplier must never exceed 2.0x, which a continuous formula could do by
// accident. Ordered inclusive-upper-bound buckets; order matters.
//
// Never call this with RACE_SECONDS (10.0) to represent "timed out" — 10.0s
// is still inside the last (1.2x) bucket. Timeout is a distinct state
// upstream (no response recorded at all) and must be scored as 0x directly,
// without going through this function.
export function raceTimeMultiplier(responseSeconds: number): number {
  if (responseSeconds <= 2) return 2.0;
  if (responseSeconds <= 4) return 1.8;
  if (responseSeconds <= 6) return 1.6;
  if (responseSeconds <= 8) return 1.4;
  if (responseSeconds <= 10) return 1.2;
  return 0;
}
