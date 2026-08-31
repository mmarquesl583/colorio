// Each entry's id is a base name living in client/public/images/avatars/ —
// the actual files on disk are the pair "<id>-sm.webp" (small, used for the
// picker grid and the tiny identity avatar) and "<id>-lg.webp" (bigger, for
// any future full-size display), both generated from one source image so
// small screens never pay for pixels they can't show.
export interface AvatarIcon {
  id: string;
  name: string;
}

export const AVATAR_ICONS: AvatarIcon[] = [
  { id: 'avatar-cat', name: 'Morfeu' },
  { id: 'avatar-dog', name: 'Peter' },
  { id: 'avatar-jogador', name: 'Neymar' },
  { id: 'avatar-piloto', name: 'Dyna' },
  { id: 'avatar-raposa', name: 'Raposa Pequeno Príncipe' },
  { id: 'avatar-calopsita', name: 'Thor Doidão' },
];

export function avatarSmallSrc(icon: string): string {
  return `/images/avatars/${icon}-sm.webp`;
}

export function avatarLargeSrc(icon: string): string {
  return `/images/avatars/${icon}-lg.webp`;
}
