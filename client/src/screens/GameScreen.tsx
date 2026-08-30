import { useEffect, useRef, useState } from 'react';
import Logo from '../components/Logo.tsx';
import ColorPicker from '../components/ColorPicker.tsx';
import ChatPlacar from '../components/ChatPlacar.tsx';
import RoundIntroModal from '../components/RoundIntroModal.tsx';
import RevealModal from '../components/RevealModal.tsx';
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
    setCopyLabel('✓ Copiado!');
    setTimeout(() => setCopyLabel('🔗 Compartilhar'), 1500);
  };

  const onColorChange = (hsl: HslColor) => { setLocalColor(hsl); conn.send({ type: 'pick_color', hsl }); };
  const onConfirm = () => conn.send({ type: 'confirm_color' });
  const submitPhrase = () => { if (masterDraft.trim() && !masterSpin.spinning) conn.send({ type: 'submit_phrase', text: masterDraft }); };

  const eligibleGuessers = s.players.filter((p) => p.id !== round.masterId);
  const confirmedCount = eligibleGuessers.filter((p) => p.confirmed).length;

  const seconds = s.secondsLeft ?? 0;
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  const timerColor = phase === 'placing' && seconds <= 10 ? '#FF5C8A' : '#29E7FF';

  const masterLabel = you.isMaster ? 'Sua vez' : round.masterName;
  const themeHint = round.phrase || (you.isMaster ? 'Escreva sua pista' : (round.isAiPhrase ? 'A IA está preparando a pista...' : 'Aguardando a pista...'));

  const showTabsPanel = !(phase === 'master-writing' && you.isMaster) && phase !== 'reveal';
  const showRoundIntro = phase === 'placing' && !!round.phrase && !you.isMaster && seconds > PLACING_SECONDS - ROUND_INTRO_SECONDS;

  return (
    <>
      <div className="corio-game-header" style={{ flex: 'none', padding: '10px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Logo size={21} />
          <button onClick={conn.leaveRoom} className="corio-tap" style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 999, padding: '5px 9px', fontSize: 9, fontWeight: 700, color: '#FCA5A5' }}>↩ SAIR</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={copyLink} className="corio-tap" style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: 0.2, color: '#E9E4FF', background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.4)', borderRadius: 999, padding: '8px 14px', whiteSpace: 'nowrap' }}>{copyLabel}</button>
          <div className="corio-you-chip">
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: `${you.color}33`, border: `1.5px solid ${you.color}`, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{you.initial}</div>
            <div className="corio-you-name" style={{ fontSize: 12.5, fontWeight: 700 }}>{you.name}</div>
          </div>
        </div>
      </div>

      <div className="corio-game-body">
        <div className="corio-game-main">
          <div style={{ flex: 'none', display: 'flex', gap: 8, padding: '0 16px 8px' }}>
            <Pill label="SALA" value={s.code} />
            <Pill label="RODADA" value={`${round.number} / ${s.config.numRounds}`} />
            <Pill label="TEMPO" value={`⏱ ${mm}:${ss}`} valueColor={timerColor} />
          </div>

          <div className="corio-card" style={{ flex: 'none', margin: '0 16px 8px', padding: '10px 12px', borderRadius: 14, background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 10 }}>
            <div style={{ flex: 1.1, minWidth: 0, display: 'flex', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flex: 'none' }}>{round.themeIcon}</div>
              <div style={{ minWidth: 0 }}>
                <div className="corio-eyebrow" style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.6, color: '#A78BFA' }}>TEMA</div>
                <div className="corio-card-title" style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{round.themeName}</div>
              </div>
            </div>
            <div style={{ width: 1, background: 'rgba(255,255,255,0.08)', flex: 'none' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="corio-eyebrow" style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.6, color: '#FFC93C' }}>VEZ DE {you.isMaster ? '👑' : ''}</div>
              <div className="corio-card-title" style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{masterLabel}</div>
            </div>
            <div style={{ width: 1, background: 'rgba(255,255,255,0.08)', flex: 'none' }} />
            <div style={{ flex: 1.4, minWidth: 0 }}>
              <div className="corio-eyebrow" style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.6, color: '#5CE1F0' }}>FRASE {round.aiDifficulty && difficultyDot(round.aiDifficulty)}</div>
              <div className="corio-card-sub" style={{ fontSize: 11.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{themeHint}</div>
            </div>
          </div>

          {round.isAiPhrase && <ReportButton key={round.idx} onReport={() => conn.send({ type: 'report_question' })} />}

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

      {showRoundIntro && <RoundIntroModal round={round} />}
      {phase === 'reveal' && s.results && (
        <RevealModal results={s.results} you={you} nextReady={s.nextReady} onReadyNext={() => conn.send({ type: 'ready_next' })} />
      )}
    </>
  );
}

function Pill({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="corio-card" style={{ flex: 1, minWidth: 0, background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '7px 10px' }}>
      <div className="corio-eyebrow" style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: 1, color: 'rgba(244,242,248,0.4)' }}>{label}</div>
      <div className="corio-value-lg" style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 13.5, fontWeight: 700, color: valueColor }}>{value}</div>
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

function ReportButton({ onReport }: { onReport: () => void }) {
  const [reported, setReported] = useState(false);
  return (
    <button
      onClick={() => { if (!reported) { onReport(); setReported(true); } }}
      disabled={reported}
      className="corio-tap"
      style={{
        all: 'unset', cursor: reported ? 'default' : 'pointer', flex: 'none', display: 'flex', alignItems: 'center',
        justifyContent: 'center', gap: 5, margin: '0 16px 8px', padding: '6px 10px', borderRadius: 10,
        background: reported ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${reported ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.1)'}`,
        fontSize: 9.5, fontWeight: 700, color: reported ? '#4ADE80' : 'rgba(244,242,248,0.5)',
      }}
    >{reported ? '✓ Reportado — obrigado!' : '🚩 A cor não combina com a pergunta? Reportar'}</button>
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
