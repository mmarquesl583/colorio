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
export interface AvatarIcon {
  id: string;
  name: string;
  free?: boolean;
}

export const AVATAR_ICONS: AvatarIcon[] = [
  { id: 'avatar-cat', name: 'Morfeu', free: true },
  { id: 'avatar-dog', name: 'Peter', free: true },
  { id: 'avatar-jogador', name: 'Neymar', free: true },
  { id: 'avatar-piloto', name: 'Dyna', free: true },
  { id: 'avatar-raposa', name: 'Raposa Pequeno Príncipe', free: true },
  { id: 'avatar-calopsita', name: 'Thor Doidão', free: true },
];

export function avatarSmallSrc(icon: string): string {
  return `/images/avatars/${icon}-sm.webp`;
}

export function avatarLargeSrc(icon: string): string {
  return `/images/avatars/${icon}-lg.webp`;
}
