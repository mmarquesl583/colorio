// Perceptual color-distance scoring: CIELAB + CIEDE2000 distance, mapped to a
// -100..1000 score by a piecewise curve tuned so it reflects visual
// perception (near-identical colors score near 1000) rather than punishing
// small, imperceptible Delta E differences the way a straight linear/power
// curve would. Every part of the app (game screen, reveal, placar, ranking,
// master's score) goes through calculateColorScore() below — there is
// intentionally no second scoring path.
//
// The seven bands below (kept in sync with badgeFromScore's thresholds) are
// continuous at every boundary by construction — each segment's end value is
// the next segment's start value, so nudging a breakpoint only needs to
// change two numbers, never introduces a jump.

import { hexToRgb, rgbToLab, deltaE2000 } from './color.ts';

export interface ColorScoreResult {
  score: number;
  deltaE: number;
}

export function calculateColorScore(playerHex: string, targetHex: string): ColorScoreResult {
  const player = hexToRgb(playerHex);
  const target = hexToRgb(targetHex);
  const playerLab = rgbToLab(player.r, player.g, player.b);
  const targetLab = rgbToLab(target.r, target.g, target.b);
  const deltaE = deltaE2000(playerLab, targetLab);

  let score: number;
  if (deltaE <= 2) {
    score = 1000;
  } else if (deltaE <= 6) {
    score = Math.round(1000 - ((deltaE - 2) / 4) * 100);
  } else if (deltaE <= 12) {
    score = Math.round(900 - ((deltaE - 6) / 6) * 100);
  } else if (deltaE <= 20) {
    score = Math.round(800 - ((deltaE - 12) / 8) * 200);
  } else if (deltaE <= 32) {
    score = Math.round(600 - ((deltaE - 20) / 12) * 200);
  } else if (deltaE <= 55) {
    score = Math.round(400 - ((deltaE - 32) / 23) * 400);
  } else if (deltaE <= 80) {
    score = Math.round(0 - ((deltaE - 55) / 25) * 100);
  } else {
    score = -100;
  }
  score = Math.max(-100, Math.min(1000, score));

  return { score, deltaE };
}

/** The Color Master's round gain: the average of what their guessers scored. */
export function calculateMasterScore(playerScores: number[]): number {
  if (playerScores.length === 0) return 0;
  const total = playerScores.reduce((sum, score) => sum + score, 0);
  return Math.round(Math.min(1000, total / playerScores.length));
}

// Perceptual-closeness label shown on the reveal screen, derived straight
// from the color-match score (not the speed/MVP-bonus-inflated total) so it
// always reflects how close the guess itself was. Score range is -100..1000;
// thresholds line up exactly with calculateColorScore()'s band boundaries.
export function badgeFromScore(score: number): 'PERFEITO' | 'CIRÚRGICO' | 'MUITO PERTO' | 'PERTO' | 'QUASE LÁ' | 'NEM PERTO' | 'PASSOU LONGE' {
  if (score >= 1000) return 'PERFEITO';
  if (score >= 900) return 'CIRÚRGICO';
  if (score >= 800) return 'MUITO PERTO';
  if (score >= 600) return 'PERTO';
  if (score >= 400) return 'QUASE LÁ';
  if (score >= 0) return 'NEM PERTO';
  return 'PASSOU LONGE';
}

// This game has no native right/wrong (it's a continuous color-distance
// guess) — for stats purposes (correct/wrong answer counters, streaks),
// "correct" is defined as MUITO PERTO or better (score >= 800), same
// threshold the reveal screen already uses to color a guess as close. One
// definition, reused everywhere a binary outcome is needed.
export function roundOutcomeFromScore(score: number): 'perfect' | 'correct' | 'wrong' {
  if (score >= 1000) return 'perfect';
  if (score >= 800) return 'correct';
  return 'wrong';
}
