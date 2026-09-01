// Pure timing/scoring rules for "Corrida contra o Tempo" — zero imports, so
// this is reusable as-is by a future offline/campaign engine (spec ask),
// exactly like shared/scoring.ts already is for the base color score.
export const RACE_SECONDS = 12;
export const RACE_MS = RACE_SECONDS * 1000;

// How long the theme+phrase popup stays up before the answer clock starts —
// a genuine separate phase (RoundPhase:'race-intro'), not just a client-side
// overlay drawn on top of an already-ticking timer, so reading time never
// eats into the time players actually get to answer.
export const RACE_INTRO_MS = 3000;

// Discrete table, NOT a linear formula — the multiplier must never exceed
// 2.0x, which a continuous formula could do by accident. Ordered inclusive-
// upper-bound buckets (each 1s wide past the initial 2s grace window,
// dropping 0.1x per bucket); order matters.
//
// Never call this with RACE_SECONDS (12.0) to represent "timed out" — 12.0s
// is still inside the last (1.0x) bucket. Timeout is a distinct state
// upstream (no response recorded at all) and must be scored as 0x directly,
// without going through this function.
export function raceTimeMultiplier(responseSeconds: number): number {
  if (responseSeconds <= 2) return 2.0;
  if (responseSeconds <= 3) return 1.9;
  if (responseSeconds <= 4) return 1.8;
  if (responseSeconds <= 5) return 1.7;
  if (responseSeconds <= 6) return 1.6;
  if (responseSeconds <= 7) return 1.5;
  if (responseSeconds <= 8) return 1.4;
  if (responseSeconds <= 9) return 1.3;
  if (responseSeconds <= 10) return 1.2;
  if (responseSeconds <= 11) return 1.1;
  if (responseSeconds <= 12) return 1.0;
  return 0;
}
