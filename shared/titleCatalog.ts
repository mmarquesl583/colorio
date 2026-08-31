// Same shape/rationale as shared/avatarIcons.ts — one small typed array as
// the catalog, shared between client (display) and the achievement-reward
// SQL function (which inserts these ids straight into player_titles).
export type TitleCategory = 'especiais' | 'conquistas' | 'sazonais';

export interface TitleOption {
  id: string;
  name: string;
  category: TitleCategory;
  description: string;
  free?: boolean;
}

export const TITLE_CATALOG: TitleOption[] = [
  { id: 'novato', name: 'Novato das Cores', category: 'especiais', description: 'Todo mestre um dia começou por aqui.', free: true },
  { id: 'primeira-pintura', name: 'Primeira Pintura', category: 'conquistas', description: 'Sua primeira partida jogada no Colorio.' },
  { id: 'olho-perfeito', name: 'Olho Perfeito', category: 'conquistas', description: 'Acertou sua primeira cor perfeita.' },
  { id: 'colorista', name: 'Colorista', category: 'conquistas', description: 'Já são 10 cores perfeitas na conta.' },
  { id: 'maratonista', name: 'Maratonista', category: 'conquistas', description: '100 partidas jogadas e contando.' },
  { id: 'viciado-em-cores', name: 'Viciado em Cores', category: 'conquistas', description: '10 horas dedicadas ao Colorio.' },
  { id: 'imparavel', name: 'Imparável', category: 'conquistas', description: '20 acertos seguidos, sem errar uma vez.' },
  { id: 'mestre-das-cores', name: 'Mestre das Cores', category: 'conquistas', description: 'Completou o modo campanha inteiro.' },
];

export const TITLE_CATEGORIES: { id: TitleCategory; label: string }[] = [
  { id: 'conquistas', label: 'Conquistas' },
  { id: 'especiais', label: 'Especiais' },
  { id: 'sazonais', label: 'Sazonais' },
];
