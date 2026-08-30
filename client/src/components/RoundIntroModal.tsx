import type { RoundView } from '@shared/types';

function difficultyDot(d: 'facil' | 'media' | 'dificil'): string {
  return d === 'facil' ? '🟢' : d === 'media' ? '🟡' : '🔴';
}

export default function RoundIntroModal({ round, onClose }: { round: RoundView; onClose: () => void }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(5,5,7,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 28 }}>
      <div style={{ background: '#15151f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18, padding: 20, width: '100%', maxWidth: 340, animation: 'corio-rise .35s ease', textAlign: 'center' }}>
        <div style={{ fontSize: 18, animation: 'corio-twinkle 1.6s ease-in-out infinite' }}>✦</div>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.6, color: '#A78BFA', marginTop: 4 }}>TEMA · {round.themeName}{round.aiSource ? ` — ${round.aiSource}` : ''}</div>
        <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>
          {round.isAiPhrase ? '🤖 Frase da IA' : `✏️ Vez de ${round.masterName}`}
        </div>
        <div style={{ marginTop: 12, background: '#1c1c26', borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 8.5, fontWeight: 700, color: 'rgba(244,242,248,0.4)', marginBottom: 4 }}>FRASE {round.aiDifficulty && difficultyDot(round.aiDifficulty)}</div>
          <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.35 }}>"{round.phrase}"</div>
        </div>
        <button onClick={onClose} className="corio-tap" style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%', boxSizing: 'border-box', textAlign: 'center', marginTop: 14, background: 'linear-gradient(90deg,#8B5CF6,#C084FC)', color: '#fff', fontWeight: 700, fontSize: 13, padding: 11, borderRadius: 12 }}>Vamos adivinhar →</button>
      </div>
    </div>
  );
}
