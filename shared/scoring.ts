// Delta E -> points curve, ported verbatim from the design prototype.

export function scoreFromDeltaE(de: number): number {
  let score: number;
  if (de <= 1) score = 1000 - de * 150;
  else if (de <= 3) score = 850 - ((de - 1) / 2) * 150;
  else if (de <= 6) score = 700 - ((de - 3) / 3) * 200;
  else if (de <= 10) score = 500 - ((de - 6) / 4) * 200;
  else if (de <= 20) score = 300 - ((de - 10) / 10) * 200;
  else score = 100 * Math.exp(-(de - 20) / 15);
  return Math.max(0, Math.min(1000, Math.round(score)));
}

export function badgeFromDeltaE(de: number): 'PERFEITO' | 'QUASE PERFEITO' | null {
  if (de <= 1) return 'PERFEITO';
  if (de <= 2) return 'QUASE PERFEITO';
  return null;
}
