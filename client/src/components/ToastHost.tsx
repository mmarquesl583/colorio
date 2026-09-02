import { useEffect, useState } from 'react';
import { subscribeToasts, type ToastKind, type ToastMsg } from '../toast.ts';

const ACCENT: Record<ToastKind, string> = {
  'level-up': '#FFC93C',
  record: '#FFC93C',
  unlock: '#29E7FF',
  streak: '#FF5C8A',
};

export default function ToastHost() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  useEffect(() => subscribeToasts(setToasts), []);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed', top: 'max(12px, env(safe-area-inset-top))', left: 0, right: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        pointerEvents: 'none', zIndex: 200, padding: '0 16px',
      }}
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            width: '100%', maxWidth: 340, display: 'flex', alignItems: 'center', gap: 9,
            background: '#12121a', border: `1px solid ${ACCENT[t.kind]}55`, borderRadius: 12,
            padding: '9px 12px', boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            animation: 'corio-rise .3s ease',
          }}
        >
          <div style={{ fontSize: 18, flex: 'none' }}>{t.icon}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT[t.kind] }}>{t.title}</div>
            {t.subtitle && <div style={{ fontSize: 9.5, color: 'rgba(244,242,248,0.6)', marginTop: 1 }}>{t.subtitle}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
