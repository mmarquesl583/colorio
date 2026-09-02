import { useEffect } from 'react';

// Display-only mirror of the level milestones seeded in
// supabase/migrations/0009_level_titles.sql / shared/titleCatalog.ts — the
// actual unlock is enforced server-side regardless of what this shows;
// this is purely "which title, if any, did this level-up just cross" for
// the popup's own text.
const LEVEL_TITLES: Record<number, string> = {
  5: 'Pupilo', 10: 'Gafanhoto', 15: 'Soldado', 20: 'Guerreiro', 25: 'Viking',
  30: 'Samurai', 35: 'Sensei', 40: 'Máquina de Guerra', 45: 'Lenda', 50: 'Mestre Supremo',
};

function titleCrossedFor(from: number, to: number): string | null {
  const milestones = Object.keys(LEVEL_TITLES).map(Number).sort((a, b) => b - a);
  const hit = milestones.find((lvl) => lvl > from && lvl <= to);
  return hit ? LEVEL_TITLES[hit] : null;
}

export default function LevelUpModal({ from, to, xpEarned, onClose }: { from: number; to: number; xpEarned: number; onClose: () => void }) {
  const titleUnlocked = titleCrossedFor(from, to);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === 'Enter') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(5,2,12,0.78)', backdropFilter: 'blur(3px)', zIndex: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 320, textAlign: 'center', background: '#1A0A33', border: '3px solid #4A2B7A',
          borderRadius: 20, padding: '28px 22px', animation: 'corio-rise .35s ease',
        }}
      >
        <div style={{ fontSize: 34, animation: 'corio-breathe 2s ease-in-out infinite' }}>⭐</div>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.6, color: 'rgba(244,242,248,0.6)', marginTop: 8 }}>VOCÊ SUBIU DE NÍVEL!</div>
        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 40, color: '#FFC93C', marginTop: 4 }}>Nível {to}</div>
        <div style={{ fontSize: 11, color: 'rgba(244,242,248,0.55)', marginTop: 4 }}>+{xpEarned} XP nessa partida</div>

        {titleUnlocked && (
          <div style={{ marginTop: 16, background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.35)', borderRadius: 14, padding: '10px 14px' }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.5, color: '#C4B5FD' }}>NOVO TÍTULO DESBLOQUEADO</div>
            <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>{titleUnlocked}</div>
          </div>
        )}

        <button
          onClick={onClose}
          className="corio-tap"
          style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 20, background: 'linear-gradient(90deg,#8B5CF6,#FFC93C)', color: '#1a1024', fontWeight: 800, fontSize: 12, padding: 12, borderRadius: 12, textAlign: 'center' }}
        >Continuar</button>
      </div>
    </div>
  );
}
