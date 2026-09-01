import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { hslFracToRgb } from '@shared/color';
import { NEXT_ROUND_READY_TIMEOUT_MS } from '@shared/gameData';
import { avatarSmallSrc } from '@shared/avatarIcons';
import type { GameMode, PlayerPublic, RoundResults } from '@shared/types';

type Stage = 'guesses' | 'sorted' | 'filling' | 'final';

// How long the ranked/badged board stays on screen before auto-advancing.
// Fixed and identical for every client — nobody can rush or stall it.
const SORTED_VIEW_MS = 3000;

// Matches the server's own fallback window (see room.ts computeReveal) —
// only used to size the "loading" fill on the ready button, the server is
// still the one actually deciding when to advance.
const READY_TOTAL_SECONDS = Math.round((NEXT_ROUND_READY_TIMEOUT_MS + 6000) / 1000);

interface Row {
  id: string;
  pos: number;
  initial: string;
  avatarId: string | null;
  name: string;
  isTop: boolean;
  badge: string | null;
  roundMvp: boolean;
  currentScore: number;
  gainLabel: string;
  stripeColor: string;
  stripeVisible: boolean;
  isMasterRow: boolean;
  timeMultiplier?: number;
}

interface Props {
  results: RoundResults;
  you: PlayerPublic;
  gameMode: GameMode;
  nextReady: { ready: number; total: number };
  readySecondsLeft: number | null;
  onReadyNext: () => void;
}

export default function RevealModal({ results, you, gameMode, nextReady, readySecondsLeft, onReadyNext }: Props) {
  const [stage, setStage] = useState<Stage>('guesses');
  const [revealCount, setRevealCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showFinalContinue, setShowFinalContinue] = useState(false);
  const [continued, setContinued] = useState(false);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const prevRectsRef = useRef<Record<string, DOMRect>>({});
  const flipDurationRef = useRef(500);

  useEffect(() => {
    setStage('guesses'); setRevealCount(0); setProgress(0); setShowFinalContinue(false); setContinued(false);
    prevRectsRef.current = {};
    const timers: ReturnType<typeof setTimeout>[] = [];
    const t = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    results.guesses.forEach((_, i) => t(700 * (i + 1), () => setRevealCount(i + 1)));
    const tSorted = 700 * results.guesses.length + 1300;
    t(tSorted, () => { flipDurationRef.current = 500; setStage('sorted'); setProgress(0); });
    t(tSorted + 900, () => {
      for (let i = 1; i <= 16; i++) t(110 * i, () => setProgress(i / 16));
    });
    // From here on the sequence advances on its own, on the same schedule
    // for every client — no button, nobody can rush or stall the reveal.
    const tRankedShown = tSorted + 900 + 1760;
    const tContinue = tRankedShown + SORTED_VIEW_MS;
    t(tContinue, () => { flipDurationRef.current = 500; setStage('filling'); });
    t(tContinue + 800, () => { flipDurationRef.current = 1800; setStage('final'); });
    t(tContinue + 800 + 2000, () => setShowFinalContinue(true));
    return () => timers.forEach(clearTimeout);
    // Every WS broadcast re-parses a brand-new `results` object even when
    // nothing about the reveal changed (a chat message, another player
    // readying up) — depending on the object itself restarted this whole
    // animation on each one. secretHex is a primitive that's stable for
    // the duration of a single round's reveal, so it only re-fires when
    // the reveal actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.secretHex]);

  const yourGuess = results.guesses.find((g) => g.playerId === you.id);
  const guessesByStanding = results.guesses; // server orders these by pre-round standing already
  // Ranking is by round score; equal scores are tied and break by the lower
  // (more accurate) Delta E rather than an arbitrary order.
  const guessesByRoundScore = [...results.guesses].sort((a, b) => b.score - a.score || a.deltaE - b.deltaE);

  // The "sorted" stage washes the whole modal in the secret color — some
  // secrets are near-white or near-black, which would make the default
  // light title text (or the row backing) unreadable against it.
  const secretRgb = hslFracToRgb(results.secretHsl.h, results.secretHsl.s / 100, results.secretHsl.l / 100);
  const secretLum = (0.299 * secretRgb.r + 0.587 * secretRgb.g + 0.114 * secretRgb.b) / 255;
  const onSecretBg = secretLum > 0.6 ? '#050507' : '#F4F2F8';
  const onSecretBgMuted = secretLum > 0.6 ? 'rgba(5,5,7,0.7)' : 'rgba(244,242,248,0.65)';

  let rows: Row[] = [];
  let title = '', subtitle = '', revealBg = 'rgba(5,5,7,0.94)';
  let showMasterDivider = false;
  let masterRow: Row | null = null;

  const animVal = (score: number) => Math.round(score * progress);

  if (stage === 'guesses' || stage === 'sorted') {
    const isSorted = stage === 'sorted';
    title = isSorted ? 'ESSA ERA A COR CORRETA' : 'REVELANDO AS ESCOLHAS...';
    subtitle = isSorted ? 'Quem se camuflou melhor no fundo, chegou mais perto' : 'Veja as cores que cada jogador escolheu para a frase';
    revealBg = isSorted ? `hsl(${hslToCss(results.secretHsl)})` : 'rgba(5,5,7,0.94)';
    const ordered = isSorted ? guessesByRoundScore : guessesByStanding;
    // Round ranking: only exactly equal round scores share a rank.
    const roundRanks = isSorted ? computeRoundRanks(guessesByRoundScore.map((g) => g.score)) : null;
    rows = ordered.map((g, i) => {
      const visible = isSorted || i < revealCount;
      const pos = roundRanks ? roundRanks[i] : i + 1;
      return {
        id: g.playerId, pos, initial: g.initial, avatarId: g.avatarId, name: g.playerId === you.id ? 'Você' : g.name,
        isTop: isSorted && progress >= 1 && pos === 1,
        badge: (isSorted && progress >= 1) ? g.badge : null,
        roundMvp: (isSorted && progress >= 1) ? g.isRoundMvp : false,
        currentScore: g.prevScore,
        gainLabel: (isSorted && progress > 0) ? `+${animVal(g.score)}` : '',
        stripeColor: visible ? `hsl(${hslToCss(g.hsl)})` : '#2a2a35',
        stripeVisible: true,
        isMasterRow: false,
        timeMultiplier: (isSorted && progress >= 1) ? g.timeMultiplier : undefined,
      };
    });
    if (isSorted && results.masterId) {
      showMasterDivider = true;
      masterRow = {
        id: results.masterId, pos: 0, initial: results.masterName?.[0] ?? 'M', avatarId: results.masterAvatarId,
        name: results.masterId === you.id ? 'Você' : (results.masterName ?? ''),
        isTop: false, badge: null, roundMvp: false,
        currentScore: results.masterPrevScore,
        gainLabel: progress > 0 ? `+${animVal(results.masterGain)}` : '',
        stripeColor: 'transparent', stripeVisible: false, isMasterRow: true,
      };
    }
  } else {
    title = stage === 'filling' ? 'SOMANDO OS PONTOS...' : 'PLACAR ATUALIZADO';
    subtitle = stage === 'filling' ? 'Cada cor representa quem escolheu ela' : 'Nova posição geral da sala';
    revealBg = 'rgba(5,5,7,0.94)';
    const entries = results.guesses.map((g) => ({
      id: g.playerId, initial: g.initial, avatarId: g.avatarId, name: g.playerId === you.id ? 'Você' : g.name,
      score: stage === 'final' ? g.newScore : g.prevScore,
      stripe: `hsl(${g.hsl.h},${g.hsl.s}%,${g.hsl.l}%)`,
    }));
    if (results.masterId) {
      entries.push({
        id: results.masterId, initial: results.masterName?.[0] ?? 'M', avatarId: results.masterAvatarId,
        name: results.masterId === you.id ? 'Você' : (results.masterName ?? ''),
        score: stage === 'final' ? results.masterNewScore : results.masterPrevScore,
        stripe: '',
      });
    }
    const roundScoreOf = (id: string) => results.guesses.find((x) => x.playerId === id)?.score ?? 0;
    const ordered = stage === 'final'
      ? [...entries].sort((a, b) => b.score - a.score)
      : [...entries.filter((e) => e.id !== results.masterId)].sort((a, b) => roundScoreOf(b.id) - roundScoreOf(a.id))
          .concat(entries.filter((e) => e.id === results.masterId));
    rows = ordered.map((e, i) => ({
      id: e.id, pos: i + 1, initial: e.initial, avatarId: e.avatarId, name: e.name, isTop: false, badge: null, roundMvp: false,
      currentScore: e.score, gainLabel: '',
      stripeColor: e.stripe || 'transparent', stripeVisible: stage === 'final',
      isMasterRow: e.id === results.masterId,
    }));
  }

  const allRows = masterRow ? [...rows] : rows;
  const orderIds = allRows.map((r) => r.id).join('|') + '|' + stage;

  useLayoutEffect(() => {
    const newRects: Record<string, DOMRect> = {};
    allRows.forEach((r) => { const el = rowRefs.current[r.id]; if (el) newRects[r.id] = el.getBoundingClientRect(); });
    const oldRects = prevRectsRef.current;
    allRows.forEach((r) => {
      const el = rowRefs.current[r.id];
      if (!el) return;
      const old = oldRects[r.id], now = newRects[r.id];
      if (old && now) {
        const dy = old.top - now.top;
        if (Math.abs(dy) > 0.5) {
          el.style.transition = 'none';
          el.style.transform = `translateY(${dy}px)`;
          requestAnimationFrame(() => {
            el.style.transition = `transform ${flipDurationRef.current}ms cubic-bezier(.22,.61,.16,1)`;
            el.style.transform = 'translateY(0)';
          });
        }
      }
    });
    prevRectsRef.current = newRects;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderIds]);

  const clickNextRound = () => {
    setContinued(true);
    onReadyNext();
  };

  // Race mode's sorted stage gets its own bigger, staged board (below) —
  // precision score shown alone first, then the multiplier pops in and the
  // total counts up from there. Reuses the same `progress` ramp already
  // driving the classic gainLabel count-up, just with a different formula
  // (base→total instead of 0→total) and an earlier reveal point (as soon
  // as progress starts, not only once it finishes).
  const isRaceSorted = gameMode === 'race' && stage === 'sorted';
  const showHeaderCols = (stage === 'guesses' || stage === 'sorted') && !isRaceSorted;

  return (
    <div style={{ position: 'absolute', inset: 0, background: revealBg, transition: 'background 1.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 40, boxSizing: 'border-box' }}>
      <div className="corio-noscroll" style={{ width: '100%', maxHeight: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ fontSize: 16, color: '#FFC93C', marginBottom: 4, animation: 'corio-twinkle 1.6s ease-in-out infinite' }}>✦</div>
        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 16, letterSpacing: 0.5, textAlign: 'center', color: stage === 'sorted' ? onSecretBg : undefined }}>{title}</div>
        <div style={{ fontSize: 10.5, color: stage === 'sorted' ? onSecretBgMuted : 'rgba(244,242,248,0.65)', textAlign: 'center', marginTop: 2, marginBottom: 12 }}>{subtitle}</div>

        {showHeaderCols && (
          <div style={{ width: '100%', maxWidth: 360, display: 'flex', justifyContent: 'flex-end', gap: 18, paddingRight: 6, marginBottom: 6 }}>
            <div style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: 0.4, color: stage === 'sorted' ? onSecretBgMuted : 'rgba(244,242,248,0.4)', width: 44, textAlign: 'center' }}>PONTOS ATUAIS</div>
            <div style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: 0.4, color: stage === 'sorted' ? onSecretBgMuted : 'rgba(244,242,248,0.4)', width: 44, textAlign: 'center' }}>PONTOS RODADA</div>
          </div>
        )}

        {!isRaceSorted && rows.map((r) => (
          <div key={r.id} ref={(el) => { rowRefs.current[r.id] = el; }} style={{ width: '100%', maxWidth: 360, display: 'flex', alignItems: 'center', gap: 9, height: 52, borderRadius: 12, overflow: 'hidden', position: 'relative', background: (stage === 'sorted') ? 'rgba(8,8,12,0.72)' : 'rgba(20,20,26,0.9)', backdropFilter: (stage === 'guesses' || stage === 'sorted') ? 'blur(2px)' : undefined, marginBottom: 8, paddingRight: 8 }}>
            <div style={{ width: 14, height: '100%', flex: 'none', background: r.stripeColor, opacity: r.stripeVisible ? 1 : 0, transition: 'background .7s ease, opacity .6s ease' }} />
            <div style={{ flex: 'none', width: 16, fontSize: 10, fontWeight: 700, color: 'rgba(244,242,248,0.45)', textAlign: 'center' }}>{r.pos || ''}</div>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flex: 'none', overflow: 'hidden' }}>
              {r.avatarId ? <img src={avatarSmallSrc(r.avatarId)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : r.initial}
            </div>
            <div style={{ flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}>
              {r.name}
              {r.isTop && <span style={{ flex: 'none' }} title="Maior pontuação da rodada">🏆</span>}
              {r.roundMvp && <span style={{ flex: 'none' }} title="Palpite mais preciso da rodada">🎯</span>}
              {r.badge && <span style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: 0.3, background: '#FFC93C', color: '#151007', padding: '2px 5px', borderRadius: 5, flex: 'none' }}>{r.badge}</span>}
              {r.timeMultiplier != null && (
                <span style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: 0.3, background: r.timeMultiplier > 0 ? 'rgba(41,231,255,0.18)' : 'rgba(239,68,68,0.18)', color: r.timeMultiplier > 0 ? '#29E7FF' : '#FCA5A5', padding: '2px 5px', borderRadius: 5, flex: 'none' }} title="Bônus de velocidade">
                  ×{r.timeMultiplier.toFixed(1).replace('.', ',')}
                </span>
              )}
            </div>
            <div style={{ width: 44, textAlign: 'center', fontSize: 11.5, fontWeight: 700 }}>{r.currentScore.toLocaleString('pt-BR')}</div>
            {showHeaderCols && <div style={{ width: 44, textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: '#A78BFA' }}>{r.gainLabel}</div>}
          </div>
        ))}

        {isRaceSorted && (() => {
          const ranked = guessesByRoundScore;
          const ranks = computeRoundRanks(ranked.map((g) => g.score));
          // Phase 1 (progress===0, ~900ms): only PONTUAÇÃO shown, same for
          // everyone regardless of speed — an intentionally "fair" beat
          // before speed enters the picture at all. Phase 2 (progress>0):
          // MULTI pops in and TOTAL counts up live from PONTUAÇÃO to the
          // true final score, driven by the same progress ramp.
          const revealed = progress > 0;
          return (
            <div className="corio-noscroll" style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ranked.map((g, i) => {
                const base = g.baseScore ?? 0;
                const mult = g.timeMultiplier ?? 0;
                const total = revealed ? Math.round(base + (g.score - base) * progress) : base;
                return (
                  <div key={g.playerId} ref={(el) => { rowRefs.current[g.playerId] = el; }} className="corio-race-reveal-card">
                    {/* The chosen color sits against the modal's own
                       background (washed in the secret color once sorted)
                       — seeing them side by side is the whole point of this
                       reveal, no need to read the badge to know how close
                       it was. */}
                    <div className="corio-race-reveal-swatch" style={{ background: `hsl(${hslToCss(g.hsl)})` }} title="Sua cor escolhida" />
                    <div className="corio-race-reveal-card-body">
                      <div className="corio-race-reveal-card-top">
                        <div className="corio-race-reveal-rank">{ranks[i]}</div>
                        <div className="corio-race-reveal-avatar">
                          {g.avatarId ? <img src={avatarSmallSrc(g.avatarId)} alt="" /> : g.initial}
                        </div>
                        <div className="corio-race-reveal-name">{g.playerId === you.id ? 'Você' : g.name}</div>
                        {g.isRoundMvp && <span title="Palpite mais preciso da rodada">🎯</span>}
                        <span className="corio-race-reveal-badge">{g.badge}</span>
                      </div>
                      <div className="corio-race-reveal-stats">
                        <div className="corio-race-reveal-stat">
                          <div className="corio-race-reveal-stat-label">PONTUAÇÃO</div>
                          <div className="corio-race-reveal-stat-value">{base.toLocaleString('pt-BR')}</div>
                        </div>
                        <div className="corio-race-reveal-stat">
                          <div className="corio-race-reveal-stat-label">MULTI</div>
                          <div className={`corio-race-reveal-stat-value corio-race-reveal-multi ${revealed ? 'is-shown' : ''}`}>
                            {revealed ? `×${mult.toFixed(1).replace('.', ',')}` : '—'}
                          </div>
                        </div>
                        <div className="corio-race-reveal-stat corio-race-reveal-stat-total">
                          <div className="corio-race-reveal-stat-label">TOTAL</div>
                          <div className="corio-race-reveal-stat-value">{total.toLocaleString('pt-BR')}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {gameMode === 'race' && yourGuess && stage !== 'guesses' && stage !== 'sorted' && (
          <div style={{ width: '100%', maxWidth: 360, marginBottom: 10, background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.35)', borderRadius: 14, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, animation: 'corio-rise .3s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: `hsl(${hslToCss(yourGuess.hsl)})`, flex: 'none', border: '1px solid rgba(255,255,255,0.25)' }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.5, color: 'rgba(244,242,248,0.5)' }}>SUA COR</div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{yourGuess.badge}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: 0.4, color: 'rgba(244,242,248,0.5)' }}>PRECISÃO</div>
                <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 15 }}>{(yourGuess.baseScore ?? 0).toLocaleString('pt-BR')}</div>
              </div>
              <div>
                <div style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: 0.4, color: 'rgba(244,242,248,0.5)' }}>BÔNUS DE VELOCIDADE</div>
                <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 15, color: '#29E7FF' }}>×{(yourGuess.timeMultiplier ?? 0).toFixed(1).replace('.', ',')}</div>
              </div>
              <div>
                <div style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: 0.4, color: 'rgba(244,242,248,0.5)' }}>TEMPO</div>
                <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 15 }}>{yourGuess.raceResponseSeconds != null ? `${yourGuess.raceResponseSeconds.toFixed(1).replace('.', ',')}s` : '—'}</div>
              </div>
            </div>
            <div style={{ textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 8 }}>
              <div style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: 0.4, color: '#FFC93C' }}>PONTUAÇÃO DA RODADA</div>
              <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 20, color: '#FFC93C' }}>{yourGuess.score.toLocaleString('pt-BR')}</div>
            </div>
          </div>
        )}

        {showMasterDivider && masterRow && (
          <>
            <div style={{ width: '100%', maxWidth: 360, height: 1, background: 'rgba(255,255,255,0.12)', margin: '4px 0 10px' }} />
            <div ref={(el) => { rowRefs.current[masterRow!.id] = el; }} style={{ width: '100%', maxWidth: 360, display: 'flex', alignItems: 'center', gap: 9, height: 52, borderRadius: 12, overflow: 'hidden', background: 'rgba(20,20,26,0.9)', marginBottom: 8, padding: '0 8px', boxSizing: 'border-box' }}>
              <div style={{ width: 16, fontSize: 10, flex: 'none', textAlign: 'center' }}>🎨</div>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flex: 'none', overflow: 'hidden' }}>
                {masterRow.avatarId ? <img src={avatarSmallSrc(masterRow.avatarId)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : masterRow.initial}
              </div>
              <div style={{ flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: 700 }}>Mestre {masterRow.name}</div>
              <div style={{ width: 44, textAlign: 'center', fontSize: 11.5, fontWeight: 700 }}>{masterRow.currentScore.toLocaleString('pt-BR')}</div>
              <div style={{ width: 44, textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: '#FFC93C' }}>{masterRow.gainLabel}</div>
            </div>
            <div style={{ marginTop: 14, textAlign: 'center', animation: 'corio-rise .3s ease' }}>
              <div style={{ fontSize: 14, color: '#8B5CF6', marginBottom: 4, animation: 'corio-twinkle 1.6s ease-in-out infinite' }}>✦✦</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(244,242,248,0.7)' }}>Revelação completa!</div>
            </div>
          </>
        )}

        {showFinalContinue && !continued && (() => {
          const fillPct = readySecondsLeft === null ? 0 : Math.min(100, Math.max(0, ((READY_TOTAL_SECONDS - readySecondsLeft) / READY_TOTAL_SECONDS) * 100));
          return (
            <button onClick={clickNextRound} className="corio-tap" style={{ all: 'unset', position: 'relative', overflow: 'hidden', cursor: 'pointer', display: 'block', background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)', color: '#fff', fontWeight: 700, fontSize: 12.5, padding: '10px 22px', borderRadius: 12, marginTop: 8 }}>
              <div style={{ position: 'absolute', inset: 0, width: `${fillPct}%`, background: 'rgba(255,255,255,0.25)', transition: 'width 1s linear', pointerEvents: 'none' }} />
              <span style={{ position: 'relative' }}>Próxima rodada →</span>
            </button>
          );
        })()}
        {continued && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#8B5CF6', animation: 'corio-pulse 1.2s infinite' }} />
            <div style={{ fontSize: 10.5, color: 'rgba(244,242,248,0.55)' }}>Aguardando jogadores... ({nextReady.ready}/{nextReady.total})</div>
          </div>
        )}
      </div>
    </div>
  );
}

// Round ranking: only guesses with the exact same score share a rank.
function computeRoundRanks(scoresDesc: number[], tolerance = 0): number[] {
  const ranks: number[] = [];
  let lastScore: number | null = null;
  let lastRank = 0;
  scoresDesc.forEach((score, i) => {
    if (lastScore === null || lastScore - score > tolerance) lastRank = i + 1;
    ranks.push(lastRank);
    lastScore = score;
  });
  return ranks;
}

function hslToCss(hsl: { h: number; s: number; l: number }): string {
  return `${hsl.h},${hsl.s}%,${hsl.l}%`;
}
