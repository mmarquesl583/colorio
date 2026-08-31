// Base names living in client/public/images/avatars/. Empty until real icon
// assets are dropped in — the picker shows a "coming soon" state instead of
// broken images until this list is populated.
//
// Each entry is a base name only — the actual files on disk are the pair
// "<name>-sm.webp" (small, used for the picker grid and the tiny identity
// avatar) and "<name>-lg.webp" (bigger, for any future full-size display),
// both generated from one source image so small screens never pay for
// pixels they can't show.
export const AVATAR_ICONS: string[] = [];

export function avatarSmallSrc(icon: string): string {
  return `/images/avatars/${icon}-sm.webp`;
}

export function avatarLargeSrc(icon: string): string {
  return `/images/avatars/${icon}-lg.webp`;
}
