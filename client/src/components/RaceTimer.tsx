import { useEffect, useRef, useState } from 'react';
import { RACE_SECONDS, raceTimeMultiplier } from '@shared/raceMode';

interface Props {
  /** Freshly broadcast ms remaining from the server, or null outside an
   * active race round. Re-anchored locally on every change — this
   * component never compares a server epoch to the client's own clock
   * (clock-skew risk), it only measures elapsed time since the last
   * broadcast via performance.now(). */
  raceMsLeft: number | null;
  /** Fires every tick with the current urgent (last-3s) state — lets a
   * parent (e.g. RaceQuestionCard) react too, like shrinking the phrase to
   * make more room for this timer, without this component needing to know
   * anything about that layout itself. Safe to call every 100ms: passing
   * the same boolean repeatedly is a no-op re-render on the parent side. */
  onUrgentChange?: (urgent: boolean) => void;
}

export default function RaceTimer({ raceMsLeft, onUrgentChange }: Props) {
  const anchorRef = useRef({ ms: raceMsLeft ?? 0, capturedAt: performance.now() });
  const [, forceTick] = useState(0);

  useEffect(() => {
    anchorRef.current = { ms: raceMsLeft ?? 0, capturedAt: performance.now() };
  }, [raceMsLeft]);

  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 100);
    return () => clearInterval(id);
  }, []);

  const elapsedSincePush = performance.now() - anchorRef.current.capturedAt;
  const liveMs = Math.max(0, anchorRef.current.ms - elapsedSincePush);
  const liveSeconds = liveMs / 1000;
  const elapsedSeconds = Math.min(RACE_SECONDS, RACE_SECONDS - liveSeconds);
  const multiplier = liveMs <= 0 ? 0 : raceTimeMultiplier(elapsedSeconds);
  const urgent = liveMs > 0 && liveMs <= 3000;
  const timeLabel = liveSeconds.toFixed(1).replace('.', ',');
  const multLabel = multiplier.toFixed(1).replace('.', ',');

  useEffect(() => { onUrgentChange?.(urgent); });

  return (
    <div className="corio-race-timer-wrap">
      <div className={`corio-race-timer${urgent ? ' is-urgent corio-race-urgent-pulse' : ''}`}>
        <div className="corio-race-timer-col">
          <div className="corio-race-timer-label"><span aria-hidden="true">🕐</span> TEMPO</div>
          <div className="corio-race-timer-value" style={{ color: urgent ? '#FF5C8A' : '#29E7FF' }}>{timeLabel}s</div>
        </div>
        <div className="corio-race-timer-divider" />
        <div className="corio-race-timer-col">
          <div className="corio-race-timer-label"><span aria-hidden="true">⚡</span> BÔNUS</div>
          <div className="corio-race-timer-value" style={{ color: '#FFC93C' }}>{multLabel}x</div>
        </div>
      </div>
      {urgent && (
        <div className="corio-race-countdown-big corio-race-urgent-pulse" aria-hidden="true">
          {Math.ceil(liveSeconds)}
        </div>
      )}
    </div>
  );
}
