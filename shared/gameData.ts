export interface LobbyTheme {
  id: string;
  icon: string;
  name: string;
  color: string;
}

export const LOBBY_THEMES: LobbyTheme[] = [
  { id: 'sentimentos', icon: '💗', name: 'Sentimentos', color: '#EC4899' },
  { id: 'clash', icon: '🛡️', name: 'Clash Royale', color: '#3B82F6' },
  { id: 'pokemon', icon: '⚡', name: 'Pokemon', color: '#EF4444' },
  { id: 'comida', icon: '🍔', name: 'Comida', color: '#F59E0B' },
  { id: 'disney', icon: '🏰', name: 'Disney', color: '#8B5CF6' },
  { id: 'futebol', icon: '⚽', name: 'Futebol', color: '#22C55E' },
];

// Used when a round's phrase mode is "AI" (auto-generated clue, no human master writes it).
export const AI_PHRASE_BANK: string[] = [
  'Cor do céu pouco antes de escurecer',
  'Cor de uma fruta tropical bem madura',
  'Cor de uma pedra preciosa rara',
  'Cor do pelo de um animal do zoológico',
  'Cor de uma bebida servida em um bar chique',
  'Cor de uma flor que só desabrocha à noite',
  'Cor de um doce vendido em festa junina',
  'Cor de uma tinta usada em grafite de rua',
  'Cor de um vestido de festa chamativo',
  'Cor de um carro esportivo de luxo',
  'Cor de uma paisagem vista de um avião',
  'Cor de um cristal encontrado em uma caverna',
  'Cor de uma sobremesa em uma vitrine de confeitaria',
  'Cor de uma roupa usada em um festival de música',
  'Cor de um pôr do sol em uma praia tropical',
];

export const PLAYER_PALETTE: string[] = [
  '#8B5CF6', '#F97316', '#22D3EE', '#F87171', '#FACC15', '#4ADE80',
  '#EC4899', '#3B82F6', '#A855F7', '#FB923C', '#2DD4BF', '#F472B6',
];

export const PLACING_SECONDS = 35;
export const NEXT_ROUND_READY_TIMEOUT_MS = 15000;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 12;
export const MIN_ROUNDS = 1;
export const MAX_ROUNDS = 12;
