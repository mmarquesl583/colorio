import type { RoundView } from '@shared/types';

function difficultyDot(d: 'facil' | 'media' | 'dificil'): string {
  return d === 'facil' ? '🟢' : d === 'media' ? '🟡' : '🔴';
}

// No dismiss control here on purpose: every client shows and hides this
// card on the same tick of the server's countdown (see GameScreen's
// showRoundIntro) — or, for gameMode:'race', on the server's own
// race-intro→placing phase transition — so nobody can rush past it for
// extra picking/reading time.
export default function RoundIntroModal({ round, raceMode }: { round: RoundView; raceMode?: boolean }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(5,5,7,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 28 }}>
      <div style={{ background: '#15151f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18, padding: 20, width: '100%', maxWidth: 340, animation: 'corio-rise .35s ease', textAlign: 'center' }}>
        <div style={{ fontSize: 18, animation: 'corio-twinkle 1.6s ease-in-out infinite' }}>✦</div>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.6, color: '#A78BFA', marginTop: 4 }}>TEMA · {round.themeName}{round.aiSource ? ` — ${round.aiSource}` : ''}</div>
        <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>
          {raceMode ? '⏱️ Corrida contra o Tempo' : round.isAiPhrase ? '🤖 Frase da IA' : `✏️ Vez de ${round.masterName}`}
        </div>
        <div style={{ marginTop: 12, background: '#1c1c26', borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 8.5, fontWeight: 700, color: 'rgba(244,242,248,0.4)', marginBottom: 4 }}>FRASE {round.aiDifficulty && difficultyDot(round.aiDifficulty)}</div>
          <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.35 }}>"{round.phrase}"</div>
        </div>
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#8B5CF6', animation: 'corio-pulse 1.2s infinite' }} />
          <div style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(244,242,248,0.55)' }}>{raceMode ? 'O cronômetro começa já já...' : 'Preparando...'}</div>
        </div>
      </div>
    </div>
  );
}
