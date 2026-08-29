import type { ReactNode } from 'react';

export default function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="corio-outer-wrap">
      <div className="corio-phone">
        <div className="corio-phone-bezel" />
        <div className="corio-screen">{children}</div>
      </div>
    </div>
  );
}
