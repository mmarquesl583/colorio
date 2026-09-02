// Same shape/rationale as shared/avatarIcons.ts — one small typed array as
// the catalog, shared between client (display) and the achievement-reward
// SQL function (which inserts these ids straight into player_titles).
//
// Which stat/threshold unlocks each title lives in Postgres only
// (achievements.criteria_type/criteria_value, joined through
// achievement_rewards) — not duplicated here. The client cross-references
// that at runtime (see client/src/stats.ts's fetchAchievementRewards) to
// compute "how close am I" progress without a second source of truth.
export type TitleCategory = 'especiais' | 'precisao' | 'velocidade' | 'sequencias' | 'pontuacao' | 'numeros-especiais' | 'experiencia' | 'social' | 'progressao';

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
  { id: 'combo-quente', name: 'Sequência Quente', category: 'sequencias', description: 'Alcance um combo de 5 na mesma partida.' },
  { id: 'em-chamas', name: 'Em Chamas', category: 'sequencias', description: 'Alcance um combo de 10 na mesma partida.' },
  { id: 'combo-lendario', name: 'Combo Lendário', category: 'sequencias', description: 'Alcance um combo de 15 na mesma partida.' },

  // Pontuação
  { id: 'rei-dos-pontos', name: 'Rei dos Pontos', category: 'pontuacao', description: 'Termine 10 partidas em primeiro lugar.' },
  { id: 'recordista', name: 'Recordista', category: 'pontuacao', description: 'Quebre seu próprio recorde de pontuação 5 vezes.' },
  { id: 'monstro-dos-pontos', name: 'Monstro dos Pontos', category: 'pontuacao', description: 'Faça 10.000 pontos em uma única partida.' },

  // Números Especiais
  { id: '666', name: '666', category: 'numeros-especiais', description: 'Alcance exatamente 666 pontos em uma partida.' },
  { id: 'pega-infernal', name: 'Pega Infernal', category: 'numeros-especiais', description: 'Alcance exatamente 666 pontos 3 vezes.' },
  { id: 'diabolico', name: 'Diabólico', category: 'numeros-especiais', description: 'Alcance exatamente 666 pontos e termine a partida em primeiro lugar.' },
  { id: 'bafomeeeeeeee', name: 'Bafomeeeeeeee', category: 'numeros-especiais', description: 'Alcance exatamente 666 pontos 6 vezes.' },
  { id: '777', name: '777', category: 'numeros-especiais', description: 'Alcance exatamente 777 pontos em uma partida.' },
  { id: 'santinho', name: 'Santinho', category: 'numeros-especiais', description: 'Alcance exatamente 777 pontos 3 vezes.' },
  { id: 'abencoado', name: 'Abençoado', category: 'numeros-especiais', description: 'Alcance exatamente 777 pontos e consiga um perfeito na mesma partida.' },
  { id: 'divindade', name: 'Divindade', category: 'numeros-especiais', description: 'Alcance exatamente 777 pontos 5 vezes.' },

  // Experiência
  { id: 'veterano-das-cores', name: 'Veterano das Cores', category: 'experiencia', description: 'Jogue 100 partidas.' },
  { id: 'morador-do-colorio', name: 'Morador do Colorio', category: 'experiencia', description: 'Passe 10 horas dentro do jogo.' },
  { id: 'desocupado', name: 'Desocupado', category: 'experiencia', description: 'Jogue por 1 hora no total.' },
  { id: 'vagabundo', name: 'Vagabundo', category: 'experiencia', description: 'Jogue por 6 horas no total.' },
  { id: 'acorda-pra-vida', name: 'Acorda pra Vida', category: 'experiencia', description: 'Jogue por 12 horas no total.' },
  { id: 'chama-inicial', name: 'Chama Inicial', category: 'experiencia', description: 'Jogue 3 dias seguidos.' },
  { id: 'semana-de-fogo', name: 'Uma Semana de Fogo', category: 'experiencia', description: 'Jogue 7 dias seguidos.' },
  { id: 'constancia-de-ferro', name: 'Constância de Ferro', category: 'experiencia', description: 'Jogue 14 dias seguidos.' },
  { id: 'lenda-da-rotina', name: 'Lenda da Rotina', category: 'experiencia', description: 'Jogue 30 dias seguidos.' },

  // Social
  { id: 'um-bom-amigo', name: 'Um Bom Amigo', category: 'social', description: 'Adicione 1 amigo.' },
  { id: 'amigao-da-vizinhanca', name: 'Amigão da Vizinhança', category: 'social', description: 'Adicione 3 amigos.' },
  { id: 'popularidade-maxima', name: 'Popularidade Máxima', category: 'social', description: 'Adicione 5 amigos.' },

  // Progressão
  { id: 'aprendiz-das-cores', name: 'Aprendiz das Cores', category: 'progressao', description: 'Alcance o nível 5.' },
  { id: 'colorista-experiente', name: 'Colorista Experiente', category: 'progressao', description: 'Alcance o nível 10.' },
  { id: 'mestre-das-nuances', name: 'Mestre das Nuances', category: 'progressao', description: 'Alcance o nível 20.' },
  { id: 'lenda-do-colorio', name: 'Lenda do Colorio', category: 'progressao', description: 'Alcance o nível 35.' },
];

export const TITLE_CATEGORIES: { id: TitleCategory; label: string }[] = [
  { id: 'precisao', label: 'Precisão' },
  { id: 'velocidade', label: 'Velocidade' },
  { id: 'sequencias', label: 'Sequências' },
  { id: 'pontuacao', label: 'Pontuação' },
  { id: 'numeros-especiais', label: 'Números Especiais' },
  { id: 'experiencia', label: 'Experiência' },
  { id: 'social', label: 'Social' },
  { id: 'progressao', label: 'Progressão' },
  { id: 'especiais', label: 'Especiais' },
];

// Every player has a title to show even before equipping one — `novato` is
// the always-free default. Centralized here since the same lookup+fallback
// repeats everywhere a title is displayed (Home, Profile, the picker, and
// now in-room player lists).
export function titleNameFor(titleId: string | null): string {
  return TITLE_CATALOG.find((t) => t.id === titleId)?.name ?? 'Novato das Cores';
}
