// Same shape/rationale as shared/avatarIcons.ts — one small typed array as
// the catalog, shared between client (display) and the achievement-reward
// SQL function (which inserts these ids straight into player_titles).
export interface TitleOption {
  id: string;
  name: string;
  free?: boolean;
}

export const TITLE_CATALOG: TitleOption[] = [
  { id: 'novato', name: 'Novato das Cores', free: true },
  { id: 'primeira-pintura', name: 'Primeira Pintura' },
  { id: 'olho-perfeito', name: 'Olho Perfeito' },
  { id: 'colorista', name: 'Colorista' },
  { id: 'maratonista', name: 'Maratonista' },
  { id: 'viciado-em-cores', name: 'Viciado em Cores' },
  { id: 'imparavel', name: 'Imparável' },
  { id: 'mestre-das-cores', name: 'Mestre das Cores' },
];
