import { useEffect, useRef, useState } from 'react';
import Logo from '../components/Logo.tsx';
import { avatarSmallSrc } from '@shared/avatarIcons';
import ColorPicker from '../components/ColorPicker.tsx';
import ChatPlacar from '../components/ChatPlacar.tsx';
import RoundIntroModal from '../components/RoundIntroModal.tsx';
import RevealModal from '../components/RevealModal.tsx';
import RaceTimer from '../components/RaceTimer.tsx';
import { randomSecretHsl, hslFracToRgb, rgbToHex } from '@shared/color';
import { PLACING_SECONDS } from '@shared/gameData';
import type { HslColor } from '@shared/types';
import type { RoomConnection } from '../ws.ts';

const DEFAULT_COLOR: HslColor = { h: 270, s: 50, l: 60 };
// The round-intro card stays up for this many ticks of the server's
// authoritative countdown — same instant for every client, no click to
// dismiss, so nobody gets extra picking time by rushing past it.
const ROUND_INTRO_SECONDS = 3;

export default function GameScreen({ conn }: { conn: RoomConnection }) {
  const s = conn.state!;
  const you = s.you;
  const round = s.round!;
  const phase = s.phase!;

  const [copyLabel, setCopyLabel] = useState('🔗 Compartilhar');
  const [localColor, setLocalColor] = useState<HslColor>(you.pickedColor ?? DEFAULT_COLOR);
  const [masterDraft, setMasterDraft] = useState('');
  const [masterSpin, setMasterSpin] = useState<{ spinning: boolean; color: HslColor }>({ spinning: false, color: you.masterSecret ?? DEFAULT_COLOR });
  // Race mode drops the SALA pill from the header (room code shows only on
  // "Compartilhar" tap, via copyLabel below) and gives that freed row width
  // to the timer instead — raceUrgent lets the question card react to the
  // same last-3s window RaceTimer already tracks, shrinking its own text
  // so the timer/bonus numbers read as the main event in that window.
  const [raceUrgent, setRaceUrgent] = useState(false);

  const lastRoundRef = useRef(-1);
  useEffect(() => {
    if (round.idx !== lastRoundRef.current) {
      lastRoundRef.current = round.idx;
      setLocalColor(you.pickedColor ?? DEFAULT_COLOR);
      setMasterDraft('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round.idx]);

  useEffect(() => {
    if (!you.isMaster || phase !== 'master-writing' || !you.masterSecret) return;
    const target = you.masterSecret;
    setMasterSpin({ spinning: true, color: randomSecretHsl() });
    const steps = [80, 80, 90, 100, 120, 140, 170, 210, 260, 320, 400, 480];
    const timers: ReturnType<typeof setTimeout>[] = [];
    let elapsed = 0;
    steps.forEach((delay, i) => {
      elapsed += delay;
      timers.push(setTimeout(() => {
        const isLast = i === steps.length - 1;
        setMasterSpin({ spinning: !isLast, color: isLast ? target : randomSecretHsl() });
      }, elapsed));
    });
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round.idx, you.isMaster, phase]);

  const copyLink = () => {
    navigator.clipboard?.writeText(s.code).catch(() => {});
    // Race mode has no persistent SALA pill in the header — this is the
    // only place the code shows at all, so the confirmation spells it out
    // instead of just saying "copiado". Harmless (if redundant) for
    // classic mode, which still shows the code in its own pill too.
    setCopyLabel(`✓ ${s.code} copiado!`);
    setTimeout(() => setCopyLabel('🔗 Compartilhar'), 1800);
  };

  const onColorChange = (hsl: HslColor) => { setLocalColor(hsl); conn.send({ type: 'pick_color', hsl }); };
  const onConfirm = () => conn.send({ type: 'confirm_color' });
  const submitPhrase = () => { if (masterDraft.trim() && !masterSpin.spinning) conn.send({ type: 'submit_phrase', text: masterDraft }); };

  const eligibleGuessers = s.players.filter((p) => p.id !== round.masterId);
  const confirmedCount = eligibleGuessers.filter((p) => p.confirmed).length;
  const isRace = s.config.gameMode === 'race';

  const seconds = s.secondsLeft ?? 0;
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  const timerColor = phase === 'placing' && seconds <= 10 ? '#FF5C8A' : '#29E7FF';

  const masterLabel = you.isMaster ? 'Sua vez' : round.masterName;
  const themeHint = round.phrase || (you.isMaster ? 'Escreva sua pista' : (round.isAiPhrase ? 'A IA está preparando a pista...' : 'Aguardando a pista...'));

  const showTabsPanel = !(phase === 'master-writing' && you.isMaster) && phase !== 'reveal';
  // Race rounds never enter this phase state combo (isRace already implies
  // secondsLeft stays null → seconds falls back to 0, which alone would
  // already make this false) — the explicit !isRace just documents the
  // intent: a 3s intro would eat 30% of a 10s race round.
  const showRoundIntro = phase === 'placing' && !!round.phrase && !you.isMaster && !isRace && seconds > PLACING_SECONDS - ROUND_INTRO_SECONDS;

  return (
    <>
      <div className="corio-game-header" style={{ flex: 'none', padding: '8px 16px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Logo size={21} />
          <button onClick={conn.leaveRoom} className="corio-tap" style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 999, padding: '5px 9px', fontSize: 9, fontWeight: 700, color: '#FCA5A5' }}>↩ SAIR</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={copyLink} className="corio-tap" style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: 0.2, color: '#E9E4FF', background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.4)', borderRadius: 999, padding: '8px 14px', whiteSpace: 'nowrap' }}>{copyLabel}</button>
          <div className="corio-you-chip">
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: `${you.color}33`, border: `1.5px solid ${you.color}`, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', overflow: 'hidden' }}>
              {you.avatarId ? <img src={avatarSmallSrc(you.avatarId)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : you.initial}
            </div>
            <div className="corio-you-name" style={{ fontSize: 12.5, fontWeight: 700 }}>{you.name}</div>
          </div>
        </div>
      </div>

      <div className="corio-game-body">
        <div className="corio-game-main">
          {isRace ? (
            <div style={{ flex: 'none', display: 'flex', alignItems: 'stretch', gap: 8, padding: '0 16px 6px' }}>
              <RaceRoundCard number={round.number} total={s.config.numRounds} />
              {/* Room code drops from the header entirely in race mode — it
                 only shows via the Compartilhar button's own confirmation
                 label now (see copyLink) — all the freed width goes to a
                 much bigger, more prominent timer/bonus readout instead.
                 Only rendered once the answer clock actually starts —
                 during 'race-intro' raceMsLeft is still null, and showing
                 a static "0,0s" timer while the read-the-phrase popup is
                 up would look like the round already ended. */}
              {phase === 'placing' && (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <RaceTimer raceMsLeft={s.raceMsLeft} onUrgentChange={setRaceUrgent} />
                </div>
              )}
            </div>
          ) : (
            <div style={{ flex: 'none', display: 'flex', gap: 8, padding: '0 16px 8px' }}>
              <Pill label="SALA" value={s.code} />
              <Pill label="RODADA" value={`${round.number} / ${s.config.numRounds}`} />
              <Pill label="TEMPO" value={`⏱ ${mm}:${ss}`} valueColor={timerColor} />
            </div>
          )}

          {isRace ? (
            // Nothing rendered here during 'race-intro' — RoundIntroModal
            // below already covers the theme+phrase reading moment as a
            // popup; this card only appears once the answer clock actually
            // starts (phase 'placing'). The live timer itself now lives in
            // the header row above, not inside this card.
            phase === 'placing' && (
              <RaceQuestionCard
                roundIdx={round.idx}
                themeIcon={round.themeIcon}
                themeName={round.themeName}
                aiSource={round.aiSource}
                phrase={round.phrase}
                urgent={raceUrgent}
                onReport={() => conn.send({ type: 'report_question' })}
              />
            )
          ) : (
            <div className="corio-card" style={{ position: 'relative', flex: 'none', margin: '0 16px 8px', padding: '10px 12px', borderRadius: 14, background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 10, paddingRight: 28 }}>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flex: 'none' }}>{round.themeIcon}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="corio-eyebrow" style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.6, color: '#A78BFA' }}>TEMA</div>
                    <div className="corio-card-title" style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{round.themeName}</div>
                  </div>
                </div>
                {/* AI-sourced rounds have no "whose turn" to show — every
                   round is the AI's — so that second column becomes the
                   question's specific sub-theme (e.g. which show/franchise
                   within "Cartoon") instead. Some AI banks don't tag a
                   source (aiSource null); those just drop the column and
                   let TEMA take the full row. */}
                {(!round.isAiPhrase || round.aiSource) && (
                  <>
                    <div style={{ width: 1, background: 'rgba(255,255,255,0.08)', flex: 'none' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {round.isAiPhrase ? (
                        <>
                          <div className="corio-eyebrow" style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.6, color: '#FFC93C' }}>SUBTEMA</div>
                          <div className="corio-card-title" style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{round.aiSource}</div>
                        </>
                      ) : (
                        <>
                          <div className="corio-eyebrow" style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.6, color: '#FFC93C' }}>VEZ DE {you.isMaster ? '👑' : ''}</div>
                          <div className="corio-card-title" style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{masterLabel}</div>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
              {/* Full-width row so long AI questions wrap and stay readable
                 instead of being clipped to a narrow ellipsis-truncated
                 third of the card. */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8 }}>
                <div className="corio-eyebrow" style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.6, color: '#5CE1F0' }}>FRASE {round.aiDifficulty && difficultyDot(round.aiDifficulty)}</div>
                <div className="corio-card-sub" style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.4, marginTop: 2 }}>{themeHint}</div>
              </div>
              {round.isAiPhrase && <ReportButton key={round.idx} onReport={() => conn.send({ type: 'report_question' })} />}
            </div>
          )}

          {phase === 'master-writing' && you.isMaster && (
            <MasterWritingCard
              secretCss={cssFromHsl(masterSpin.color)}
              hexLabel={hexFromHsl(masterSpin.color)}
              spinning={masterSpin.spinning}
              draft={masterDraft}
              onDraftChange={setMasterDraft}
              onSubmit={submitPhrase}
            />
          )}

          {phase === 'master-writing' && !you.isMaster && (
            <WaitingCard title={`${round.masterName} está escrevendo a pista`} subtitle="Aguarde só um instante." />
          )}

          {phase === 'placing' && you.isMaster && (
            <MasterSentCard secretCss={cssFromHsl(you.masterSecret ?? DEFAULT_COLOR)} waitingLabel={`Aguardando jogadores... (${confirmedCount}/${eligibleGuessers.length})`} />
          )}

          {phase === 'placing' && !you.isMaster && (
            <ColorPicker
              value={localColor}
              onChange={onColorChange}
              confirmed={you.confirmed}
              onConfirm={onConfirm}
              colorHistory={you.colorHistory}
              waitingReady={confirmedCount}
              waitingTotal={eligibleGuessers.length}
            />
          )}
        </div>

        {showTabsPanel && (
          <div className="corio-game-sidebar">
            <ChatPlacar players={s.players} youId={you.id} chat={s.chat} onSendChat={(text) => conn.send({ type: 'send_chat', text })} />
          </div>
        )}
      </div>

      {(showRoundIntro || phase === 'race-intro') && <RoundIntroModal round={round} raceMode={isRace} />}
      {phase === 'reveal' && s.results && (
        <RevealModal results={s.results} you={you} gameMode={s.config.gameMode} nextReady={s.nextReady} readySecondsLeft={s.readySecondsLeft} onReadyNext={() => conn.send({ type: 'ready_next' })} />
      )}
    </>
  );
}

// Race mode's RODADA card — same slot the generic Pill used to fill, but
// with a per-round progress strip (one segment per configured round, filled
// up to the current one) so "where am I in the match" reads at a glance
// without doing the "number / total" math yourself.
function RaceRoundCard({ number, total }: { number: number; total: number }) {
  return (
    <div className="corio-card" style={{ flex: 'none', minWidth: 82, background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '5px 10px' }}>
      <div className="corio-eyebrow" style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: 1, color: 'rgba(244,242,248,0.4)' }}>RODADA</div>
      <div className="corio-value-lg" style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 13.5, fontWeight: 700 }}>{number} / {total}</div>
      <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
        {Array.from({ length: total }, (_, i) => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < number ? '#8B5CF6' : 'rgba(255,255,255,0.12)' }} />
        ))}
      </div>
    </div>
  );
}

function Pill({ label, value, valueColor, flex, minWidth, compact }: { label: string; value: string; valueColor?: string; flex?: React.CSSProperties['flex']; minWidth?: number; compact?: boolean }) {
  return (
    <div className="corio-card" style={{ flex: flex ?? 1, minWidth: minWidth ?? 0, background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: compact ? '5px 10px' : '7px 10px' }}>
      <div className="corio-eyebrow" style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: 1, color: 'rgba(244,242,248,0.4)' }}>{label}</div>
      <div className="corio-value-lg" style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 13.5, fontWeight: 700, color: valueColor }}>{value}</div>
    </div>
  );
}

// The live timer/bonus now lives in the header row (GameScreen), not here
// — this card is just theme + phrase, which shrinks out of the way once
// `urgent` (last 3s) so the timer above reads as the main event. Breadcrumb-
// style TEMA › SUBTEMA line (matches how RoundIntroModal already writes it)
// with the report button inline at its end, instead of floating absolutely
// over the corner — reads more like an info card, less like an overlay.
function RaceQuestionCard({ roundIdx, themeIcon, themeName, aiSource, phrase, urgent, onReport }: { roundIdx: number; themeIcon: string; themeName: string; aiSource: string | null; phrase: string; urgent: boolean; onReport: () => void }) {
  return (
    <div className={`corio-card corio-race-card${urgent ? ' is-urgent' : ''}`} style={{ flex: 'none', margin: '0 16px 8px', padding: '10px 14px', borderRadius: 16, background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', animation: 'corio-rise .35s ease' }}>
      <div className="corio-race-card-top">
        <div className="corio-race-card-theme">
          <span>{themeIcon}</span>
          <span>{themeName}</span>
          {aiSource && (<><span style={{ opacity: 0.45 }}>›</span><span style={{ color: '#FFC93C' }}>{aiSource}</span></>)}
        </div>
        <ReportButton key={roundIdx} onReport={onReport} inline />
      </div>
      <div className="corio-race-card-phrase">{phrase || 'Preparando a próxima pergunta...'}</div>
    </div>
  );
}

function WaitingCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="corio-card" style={{ flex: 1, minHeight: 0, margin: '0 16px', background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, textAlign: 'center', animation: 'corio-rise .35s ease' }}>
      <div style={{ fontSize: 22, animation: 'corio-breathe 2.2s ease-in-out infinite' }}>🎨</div>
      <div className="corio-title" style={{ fontSize: 13, fontWeight: 700 }}>{title}</div>
      <div className="corio-subtitle" style={{ fontSize: 11, color: 'rgba(244,242,248,0.55)' }}>{subtitle}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#8B5CF6', animation: 'corio-pulse 1.2s infinite' }} />
      </div>
    </div>
  );
}

function MasterWritingCard({ secretCss, hexLabel, spinning, draft, onDraftChange, onSubmit }: { secretCss: string; hexLabel: string; spinning: boolean; draft: string; onDraftChange: (v: string) => void; onSubmit: () => void }) {
  return (
    <div className="corio-card corio-noscroll" style={{ flex: 1, minHeight: 0, margin: '0 16px', background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', overflowY: 'auto', animation: 'corio-rise .35s ease' }}>
      <div style={{ margin: 'auto 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ textAlign: 'center', position: 'relative' }}>
          <span className="corio-sparkle" style={{ left: '10%', top: 4, fontSize: 16, animation: 'corio-twinkle 1.8s ease-in-out infinite .3s' }}>✦</span>
          <span className="corio-sparkle" style={{ right: '8%', top: 30, fontSize: 11, animation: 'corio-twinkle 1.8s ease-in-out infinite .8s' }}>✦</span>
          <div style={{ fontSize: 20, lineHeight: 1, color: '#FFC93C', animation: 'corio-twinkle 1.8s ease-in-out infinite' }}>✦</div>
          <div className="corio-title" style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.3, marginTop: 6 }}>É A SUA VEZ, <span style={{ background: 'linear-gradient(90deg,#8B5CF6,#FFC93C)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>MESTRE DA COR</span></div>
          <div className="corio-subtitle" style={{ fontSize: 12.5, color: 'rgba(244,242,248,0.6)', lineHeight: 1.5, marginTop: 4 }}>O tema é a sua cor secreta. Escreva uma frase sobre ele para os outros tentarem adivinhar.</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#1c1c26', borderRadius: 14, padding: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: 13, flex: 'none', background: secretCss, border: '1px solid rgba(139,92,246,0.4)' }} />
          <div style={{ minWidth: 0 }}>
            <div className="corio-eyebrow" style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.3, color: '#A78BFA', whiteSpace: 'nowrap' }}>{spinning ? '🎲 SORTEANDO...' : 'SUA COR SECRETA'}</div>
            <div className="corio-value-lg" style={{ fontSize: 17, fontWeight: 700, fontFamily: "'Space Grotesk',sans-serif", marginTop: 4 }}>{hexLabel}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#1c1c26', borderRadius: 14, padding: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(139,92,246,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flex: 'none' }}>🏆</div>
          <div className="corio-card-sub" style={{ fontSize: 11.5, lineHeight: 1.5, color: 'rgba(244,242,248,0.7)' }}>Quem chegar mais perto ganha mais pontos — e quanto mais perto todo mundo chegar, mais pontos você também ganha.</div>
        </div>

        <div style={{ position: 'relative' }}>
          <textarea
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            maxLength={80}
            placeholder="Ex: cor do pelo de uma raposa"
            style={{ width: '100%', boxSizing: 'border-box', background: '#1c1c26', border: '1px solid rgba(139,92,246,0.35)', borderRadius: 13, padding: '12px 14px 20px', color: '#fff', fontSize: 14, outline: 'none', resize: 'none', height: 64, fontFamily: 'inherit' }}
          />
          <div style={{ position: 'absolute', right: 11, bottom: 7, fontSize: 9, color: 'rgba(244,242,248,0.35)' }}>{draft.length}/80</div>
        </div>
        <div style={{ fontSize: 11, color: '#A78BFA', textAlign: 'center' }}>✦ DICA: quanto mais perto todo mundo chegar da sua cor, mais vocês ganham juntos!</div>
        <button onClick={onSubmit} disabled={spinning || !draft.trim()} className="corio-tap corio-btn-lg" style={{ all: 'unset', cursor: 'pointer', boxSizing: 'border-box', width: '100%', textAlign: 'center', background: 'linear-gradient(90deg,#8B5CF6,#C084FC)', color: '#fff', fontWeight: 700, fontSize: 15, padding: 13, borderRadius: 13, opacity: spinning ? 0.5 : 1 }}>➤ Enviar pista</button>
      </div>
    </div>
  );
}

function MasterSentCard({ secretCss, waitingLabel }: { secretCss: string; waitingLabel: string }) {
  return (
    <div className="corio-card" style={{ flex: 1, minHeight: 0, margin: '0 16px', background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, textAlign: 'center', position: 'relative', animation: 'corio-rise .35s ease' }}>
      <div style={{ position: 'relative', width: 72, height: 72 }}>
        <div style={{ position: 'absolute', inset: -14, borderRadius: 26, background: secretCss, opacity: 0.35, filter: 'blur(14px)', animation: 'corio-glowring 2.4s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', top: -8, right: -10, fontSize: 13, color: '#FFC93C', animation: 'corio-twinkle 1.8s ease-in-out infinite' }}>✦</div>
        <div style={{ position: 'absolute', bottom: 2, left: -16, fontSize: 10, color: '#8B5CF6', animation: 'corio-twinkle 1.8s ease-in-out infinite .4s' }}>✦</div>
        <div style={{ position: 'relative', width: 72, height: 72, borderRadius: 18, background: secretCss, border: '1px solid rgba(255,255,255,0.25)', boxShadow: `0 0 24px ${secretCss}, 0 10px 22px rgba(0,0,0,0.5)`, animation: 'corio-shimmer 2.4s ease-in-out infinite, corio-breathe 2.4s ease-in-out infinite' }} />
      </div>
      <div className="corio-title" style={{ fontSize: 12, fontWeight: 700 }}>Sua cor secreta foi enviada 👑</div>
      <div className="corio-subtitle" style={{ fontSize: 11, color: 'rgba(244,242,248,0.55)', maxWidth: 260, lineHeight: 1.4 }}>Os outros jogadores estão tentando adivinhar a partir da sua frase.</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#8B5CF6', animation: 'corio-pulse 1.2s infinite' }} />
        <div style={{ fontSize: 10.5, color: 'rgba(244,242,248,0.5)' }}>{waitingLabel}</div>
      </div>
    </div>
  );
}

// Small icon-only button, still icon-only (no label — a full-width text
// pill used to eat its own row here). Two positioning modes: the classic
// theme/phrase card floats it absolutely over its own corner (needs
// position:'relative' on the parent); the race card's breadcrumb row places
// it inline as a normal flex child instead, sitting at the end of that row.
function ReportButton({ onReport, inline }: { onReport: () => void; inline?: boolean }) {
  const [reported, setReported] = useState(false);
  return (
    <button
      onClick={() => { if (!reported) { onReport(); setReported(true); } }}
      disabled={reported}
      className="corio-tap"
      title={reported ? 'Reportado — obrigado!' : 'A cor não combina com a pergunta? Reportar'}
      aria-label={reported ? 'Pergunta reportada' : 'Reportar pergunta'}
      style={{
        all: 'unset', cursor: reported ? 'default' : 'pointer', zIndex: 1,
        ...(inline ? { position: 'relative', flex: 'none' } : { position: 'absolute', top: 8, right: 8 }),
        width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: reported ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.06)',
        border: `1px solid ${reported ? 'rgba(74,222,128,0.35)' : 'rgba(255,255,255,0.12)'}`,
        fontSize: 11,
      }}
    >{reported ? '✓' : '🚩'}</button>
  );
}

function difficultyDot(d: 'facil' | 'media' | 'dificil'): string {
  return d === 'facil' ? '🟢' : d === 'media' ? '🟡' : '🔴';
}

function cssFromHsl(hsl: HslColor): string {
  return `hsl(${hsl.h},${hsl.s}%,${hsl.l}%)`;
}
function hexFromHsl(hsl: HslColor): string {
  const rgb = hslFracToRgb(hsl.h, hsl.s / 100, hsl.l / 100);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}
