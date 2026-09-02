// Each entry's id is a base name living in client/public/images/avatars/ —
// the actual files on disk are the pair "<id>-sm.webp" (small, used for the
// picker grid and the tiny identity avatar) and "<id>-lg.webp" (bigger, for
// any future full-size display), both generated from one source image so
// small screens never pay for pixels they can't show.
//
// Lives in shared/ (not client/) because the achievement-reward system
// (server-side) inserts reward_id strings straight into player_avatars —
// server and client need the same catalog as their one source of truth.
//
// `free` avatars need no player_avatars row to be selectable — every
// avatar that existed before the unlock system shipped is grandfathered
// in as free so nobody loses access to what they already had. Only future
// non-free avatars actually get gated behind player_avatars/achievements.
export type AvatarCategory = 'animais' | 'divertidos' | 'especiais';
export type Rarity = 'comum' | 'raro' | 'epico' | 'lendario' | 'unico';

export interface AvatarIcon {
  id: string;
  name: string;
  category: AvatarCategory;
  rarity: Rarity;
  description: string;
  free?: boolean;
}

export const AVATAR_ICONS: AvatarIcon[] = [
  { id: 'avatar-cat', name: 'Morfeu', category: 'animais', rarity: 'unico', description: 'Sério por fora, mestre das cores por dentro.' },
  { id: 'avatar-dog', name: 'Peter', category: 'animais', rarity: 'raro', description: 'Sempre animado pra descobrir a próxima cor.', free: true },
  { id: 'avatar-jogador', name: 'Neymar', category: 'divertidos', rarity: 'lendario', description: 'Craque dentro e fora do campo de cores.', free: true },
  { id: 'avatar-piloto', name: 'Dyna', category: 'divertidos', rarity: 'epico', description: 'Acelera direto pra vitória mais colorida.', free: true },
  { id: 'avatar-raposa', name: 'Raposa Pequeno Príncipe', category: 'especiais', rarity: 'raro', description: 'Cativa qualquer cor que encontra pelo caminho.', free: true },
  { id: 'avatar-calopsita', name: 'Thor Doidão', category: 'divertidos', rarity: 'comum', description: 'Doido pra ganhar, mais doido ainda pra comemorar.', free: true },
];

export const AVATAR_CATEGORIES: { id: AvatarCategory; label: string; icon: string }[] = [
  { id: 'animais', label: 'Animais', icon: '🐾' },
  { id: 'divertidos', label: 'Divertidos', icon: '😄' },
  { id: 'especiais', label: 'Especiais', icon: '⭐' },
];

export const RARITY_LABELS: Record<Rarity, string> = {
  comum: 'Comum',
  raro: 'Raro',
  epico: 'Épico',
  lendario: 'Lendário',
  unico: 'Único',
};

export function avatarSmallSrc(icon: string): string {
  return `/images/avatars/${icon}-sm.webp`;
}

export function avatarLargeSrc(icon: string): string {
  return `/images/avatars/${icon}-lg.webp`;
}
