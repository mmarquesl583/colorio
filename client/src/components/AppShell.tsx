import type { ReactNode } from 'react';

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="corio-outer-wrap">
      <div className="corio-screen">{children}</div>
    </div>
  );
}
