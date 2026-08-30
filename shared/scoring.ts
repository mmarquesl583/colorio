// Perceptual color-distance scoring: CIELAB + CIEDE2000 distance, mapped to a
// 0-1000 score by a piecewise curve tuned so it reflects visual perception
// (near-identical colors score near 1000) rather than punishing small,
// imperceptible Delta E differences the way a straight linear/power curve
// would. Every part of the app (game screen, reveal, placar, ranking,
// master's score) goes through calculateColorScore() below — there is
// intentionally no second scoring path.

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
  if (deltaE <= 3) {
    score = 1000;
  } else if (deltaE <= 5) {
    score = Math.round(1000 - ((deltaE - 3) / 2) * 20);
  } else if (deltaE <= 10) {
    score = Math.round(980 - ((deltaE - 5) / 5) * 80);
  } else if (deltaE <= 15) {
    score = Math.round(900 - ((deltaE - 10) / 5) * 100);
  } else if (deltaE <= 25) {
    score = Math.round(800 - ((deltaE - 15) / 10) * 200);
  } else if (deltaE <= 40) {
    score = Math.round(600 - ((deltaE - 25) / 15) * 300);
  } else if (deltaE <= 60) {
    score = Math.round(300 - ((deltaE - 40) / 20) * 300);
  } else {
    score = 0;
  }
  score = Math.max(0, Math.min(1000, score));

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
// always reflects how close the guess itself was.
export function badgeFromScore(score: number): 'PERFEITO' | 'QUASE PERFEITO' | 'MUITO PERTO' | 'PERTO' | 'DISTANTE' {
  if (score >= 1000) return 'PERFEITO';
  if (score >= 950) return 'QUASE PERFEITO';
  if (score >= 850) return 'MUITO PERTO';
  if (score >= 700) return 'PERTO';
  return 'DISTANTE';
}
