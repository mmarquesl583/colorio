// Perceptual color-distance scoring: CIELAB + CIEDE2000 distance, mapped to a
// 0-1000 score by a single smooth power curve. Every part of the app (game
// screen, reveal, placar, ranking, master's score) goes through
// calculateColorScore() below — there is intentionally no second scoring path.

import { hexToRgb, rgbToLab, deltaE2000 } from './color.ts';

export interface ColorScoreResult {
  score: number;
  deltaE: number;
}

const MAX_DELTA_E = 60;
const CURVE_EXPONENT = 1.35;

export function calculateColorScore(playerHex: string, targetHex: string): ColorScoreResult {
  const player = hexToRgb(playerHex);
  const target = hexToRgb(targetHex);
  const playerLab = rgbToLab(player.r, player.g, player.b);
  const targetLab = rgbToLab(target.r, target.g, target.b);
  const deltaE = deltaE2000(playerLab, targetLab);

  const normalizedDistance = Math.min(deltaE / MAX_DELTA_E, 1);
  const rawScore = 1000 * Math.pow(1 - normalizedDistance, CURVE_EXPONENT);

  return { score: Math.max(0, Math.min(1000, Math.round(rawScore))), deltaE };
}

/** The Color Master's round gain: the average of what their guessers scored. */
export function calculateMasterScore(playerScores: number[]): number {
  if (playerScores.length === 0) return 0;
  const total = playerScores.reduce((sum, score) => sum + score, 0);
  return Math.round(Math.min(1000, total / playerScores.length));
}

// Badges are a perceptual-closeness label, independent of the point curve
// above — grounded directly in deltaE so they still mean "practically
// identical / very close / great" regardless of how points are curved.
export function badgeFromDeltaE(de: number): 'PERFEITO' | 'QUASE PERFEITO' | 'ÓTIMO' | null {
  if (de <= 1) return 'PERFEITO';
  if (de <= 3) return 'QUASE PERFEITO';
  if (de <= 6) return 'ÓTIMO';
  return null;
}
