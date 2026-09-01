// Same shape/rationale as shared/avatarIcons.ts — one small typed array as
// the catalog, shared between client (display) and the achievement-reward
// SQL function (which inserts these ids straight into player_titles).
//
// Which stat/threshold unlocks each title lives in Postgres only
// (achievements.criteria_type/criteria_value, joined through
// achievement_rewards) — not duplicated here. The client cross-references
// that at runtime (see client/src/stats.ts's fetchAchievementRewards) to
// compute "how close am I" progress without a second source of truth.
export type TitleCategory = 'especiais' | 'precisao' | 'velocidade' | 'sequencias' | 'pontuacao' | 'numeros-especiais' | 'experiencia';

export interface TitleOption {
  id: string;
  name: string;
  category: TitleCategory;
  description: string;
  free?: boolean;
}

export const TITLE_CATALOG: TitleOption[] = [
  { id: 'novato', name: 'Novato das Cores', category: 'especiais', description: 'Todo mestre um dia começou por aqui.', free: true },

  // Precisão
  { id: 'daltonico', name: 'Daltônico', category: 'precisao', description: 'Tire 0 pontos em 10 palpites.' },
  { id: 'michelangelo', name: 'Michelangelo', category: 'precisao', description: 'Consiga 10 palpites perfeitos.' },
  { id: 'olho-de-aguia', name: 'Olho de Águia', category: 'precisao', description: 'Consiga 5 palpites com pelo menos 98% de precisão em uma única partida.' },
  { id: 'mao-de-deus', name: 'Mão de Deus', category: 'precisao', description: 'Consiga 5 perfeitos consecutivos.' },
  { id: 'cirurgico', name: 'Cirúrgico', category: 'precisao', description: 'Consiga 3 palpites consecutivos com exatamente 99% de precisão.' },

  // Velocidade
  { id: 'relampago', name: 'Relâmpago', category: 'velocidade', description: 'Acerte uma cor em menos de 1 segundo.' },
  { id: 'flash', name: 'Flash', category: 'velocidade', description: 'Consiga 10 acertos em menos de 2 segundos.' },
  { id: 'sem-pensar', name: 'Sem Pensar', category: 'velocidade', description: 'Consiga um palpite perfeito em menos de 1 segundo.' },
  { id: 'velocista', name: 'Tempo é Dinheiro', category: 'velocidade', description: 'Consiga 10 multiplicadores de 2x na Corrida contra o Tempo.' },

  // Sequências
  { id: 'embalado', name: 'Embalado', category: 'sequencias', description: 'Acerte 10 palpites consecutivos.' },
  { id: 'imparavel', name: 'Imparável', category: 'sequencias', description: 'Acerte 20 palpites consecutivos.' },
  { id: 'perfeicao-ininterrupta', name: 'Perfeição Ininterrupta', category: 'sequencias', description: 'Consiga 10 palpites perfeitos consecutivos.' },

  // Pontuação
  { id: 'rei-dos-pontos', name: 'Rei dos Pontos', category: 'pontuacao', description: 'Termine 10 partidas em primeiro lugar.' },
  { id: 'recordista', name: 'Recordista', category: 'pontuacao', description: 'Quebre seu próprio recorde de pontuação 5 vezes.' },
  { id: 'monstro-dos-pontos', name: 'Monstro dos Pontos', category: 'pontuacao', description: 'Faça 10.000 pontos em uma única partida.' },

  // Números Especiais
  { id: '666', name: '666', category: 'numeros-especiais', description: 'Alcance exatamente 666 pontos em uma partida.' },
  { id: 'pega-infernal', name: 'Pega Infernal', category: 'numeros-especiais', description: 'Alcance exatamente 666 pontos 3 vezes.' },
  { id: 'diabolico', name: 'Diabólico', category: 'numeros-especiais', description: 'Alcance exatamente 666 pontos e termine a partida em primeiro lugar.' },
  { id: 'bafomeeeeeeee', name: 'Bafomeeeeeeee', category: 'numeros-especiais', description: 'Alcance exatamente 666 pontos após conseguir um palpite perfeito.' },
  { id: '777', name: '777', category: 'numeros-especiais', description: 'Alcance exatamente 777 pontos em uma partida.' },
  { id: 'santinho', name: 'Santinho', category: 'numeros-especiais', description: 'Alcance exatamente 777 pontos 3 vezes.' },
  { id: 'abencoado', name: 'Abençoado', category: 'numeros-especiais', description: 'Alcance exatamente 777 pontos e consiga um perfeito na mesma partida.' },
  { id: 'divindade', name: 'Divindade', category: 'numeros-especiais', description: 'Alcance exatamente 777 pontos 5 vezes.' },

  // Experiência
  { id: 'veterano-das-cores', name: 'Veterano das Cores', category: 'experiencia', description: 'Jogue 100 partidas.' },
  { id: 'morador-do-colorio', name: 'Morador do Colorio', category: 'experiencia', description: 'Passe 10 horas dentro do jogo.' },
];

export const TITLE_CATEGORIES: { id: TitleCategory; label: string }[] = [
  { id: 'precisao', label: 'Precisão' },
  { id: 'velocidade', label: 'Velocidade' },
  { id: 'sequencias', label: 'Sequências' },
  { id: 'pontuacao', label: 'Pontuação' },
  { id: 'numeros-especiais', label: 'Números Especiais' },
  { id: 'experiencia', label: 'Experiência' },
  { id: 'especiais', label: 'Especiais' },
];

// Every player has a title to show even before equipping one — `novato` is
// the always-free default. Centralized here since the same lookup+fallback
// repeats everywhere a title is displayed (Home, Profile, the picker, and
// now in-room player lists).
export function titleNameFor(titleId: string | null): string {
  return TITLE_CATALOG.find((t) => t.id === titleId)?.name ?? 'Novato das Cores';
}
