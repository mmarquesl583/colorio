import { useEffect, type ReactNode } from 'react';

export default function AppShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Best-effort only — the Screen Orientation API needs fullscreen on
    // most browsers and isn't supported by iOS Safari at all in a regular
    // tab, so this silently no-ops there. The CSS overlay below (always
    // reliable, no API support needed) is what actually enforces portrait.
    const orientation = (screen as unknown as { orientation?: { lock?: (o: string) => Promise<void> } }).orientation;
    orientation?.lock?.('portrait').catch(() => {});
  }, []);

  return (
    <div className="corio-outer-wrap">
      <div className="corio-screen">{children}</div>
      <div className="corio-rotate-lock" aria-hidden="true">
        <div className="corio-rotate-lock-icon">🔄</div>
        <div className="corio-rotate-lock-title">Gire seu aparelho</div>
        <div className="corio-rotate-lock-subtitle">O Colorio funciona só no modo retrato.</div>
      </div>
    </div>
  );
}
