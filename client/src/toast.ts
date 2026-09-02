// Tiny pub/sub notification queue — plain module + exported functions,
// same style as auth.ts/stats.ts, no React context/provider tree. No toast/
// notification mechanism existed anywhere in this codebase before; this is
// the first one, kept deliberately minimal (small cards, auto-expire, no
// blocking popups) per the "não usar popups gigantes pra tudo" requirement.
export type ToastKind = 'level-up' | 'record' | 'unlock' | 'streak';

export interface ToastMsg {
  id: string;
  kind: ToastKind;
  icon: string;
  title: string;
  subtitle?: string;
}

const TOAST_TTL_MS = 4200;

let toasts: ToastMsg[] = [];
const listeners = new Set<(toasts: ToastMsg[]) => void>();

function notify() {
  for (const fn of listeners) fn(toasts);
}

export function pushToast(t: Omit<ToastMsg, 'id'>): void {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  toasts = [...toasts, { ...t, id }];
  notify();
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== id);
    notify();
  }, TOAST_TTL_MS);
}

export function subscribeToasts(fn: (toasts: ToastMsg[]) => void): () => void {
  listeners.add(fn);
  fn(toasts);
  return () => listeners.delete(fn);
}
