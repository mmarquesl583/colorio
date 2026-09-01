import { useEffect, useRef, useState } from 'react';
import { hslFracToRgb, rgbToHex, hexToRgb, rgbToHslFrac } from '@shared/color';
import type { HslColor } from '@shared/types';

interface Props {
  value: HslColor;
  onChange: (hsl: HslColor) => void;
  confirmed: boolean;
  onConfirm: () => void;
  colorHistory: string[];
  waitingReady: number;
  waitingTotal: number;
}

const hasEyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window;

export default function ColorPicker({ value, onChange, confirmed, onConfirm, colorHistory, waitingReady, waitingTotal }: Props) {
  const squareRef = useRef<HTMLCanvasElement>(null);
  const draggingRef = useRef(false);
  const hueDraggingRef = useRef(false);
  const [copied, setCopied] = useState(false);

  // Square: saturation across x, lightness across y, for the currently picked hue.
  const draw = () => {
    const cv = squareRef.current;
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const w = Math.round(rect.width) || 260, h = Math.round(rect.height) || 130;
    if (cv.width !== w) cv.width = w;
    if (cv.height !== h) cv.height = h;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const step = 4;
    for (let y = 0; y < h; y += step) {
      const light = 1 - y / h;
      for (let x = 0; x < w; x += step) {
        const sat = x / w;
        const { r, g, b } = hslFracToRgb(value.h, sat, light);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, y, step, step);
      }
    }
  };

  useEffect(() => {
    draw();
    const ro = new ResizeObserver(draw);
    if (squareRef.current) ro.observe(squareRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.h]);

  const rgb = hslFracToRgb(value.h, value.s / 100, value.l / 100);
  const pickedColorCss = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
  const lum = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  const confirmTextColor = lum > 0.6 ? '#050507' : '#fff';
  const pickedHex = rgbToHex(rgb.r, rgb.g, rgb.b);

  const posFromSquareEvent = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sat = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    const light = 1 - Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1);
    return { h: value.h, s: Math.round(sat * 100), l: Math.round(light * 100) };
  };
  const hueFromBarEvent = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const t = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    return Math.round(t * 360);
  };

  const setChannel = (channel: 'r' | 'g' | 'b', raw: string) => {
    const n = Math.max(0, Math.min(255, Math.round(Number(raw) || 0)));
    const next = { ...rgb, [channel]: n };
    onChange(rgbToHslFrac(next.r, next.g, next.b));
  };

  const copyHex = () => {
    navigator.clipboard?.writeText(pickedHex).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const pickWithEyeDropper = () => {
    // @ts-expect-error EyeDropper isn't in the TS DOM lib yet.
    new window.EyeDropper().open().then((res: { sRGBHex: string }) => {
      const picked = hexToRgb(res.sRGBHex);
      onChange(rgbToHslFrac(picked.r, picked.g, picked.b));
    }).catch(() => {});
  };

  if (confirmed) {
    return (
      <div style={{ flex: 1, minHeight: 0, margin: '0 16px', background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, textAlign: 'center', animation: 'corio-rise .35s ease' }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: pickedColorCss, border: '2px solid rgba(255,255,255,0.25)', boxShadow: `0 0 20px ${pickedColorCss}88` }} />
        <div style={{ fontSize: 12, fontWeight: 700 }}>Cor confirmada ✓</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#8B5CF6', animation: 'corio-pulse 1.2s infinite' }} />
          <div style={{ fontSize: 10.5, color: 'rgba(244,242,248,0.55)' }}>Aguardando jogadores... ({waitingReady}/{waitingTotal})</div>
        </div>
      </div>
    );
  }

  return (
    <div className="corio-card" style={{ flex: 1, minHeight: 0, margin: '0 16px', background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6, animation: 'corio-rise .35s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div className="corio-eyebrow" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6, color: 'rgba(244,242,248,0.55)' }}>ESCOLHA SUA COR</div>
          <div style={{ fontSize: 8.5, color: 'rgba(244,242,248,0.4)', marginTop: 2, lineHeight: 1.3 }}>Clique no quadro, arraste ou use os seletores abaixo.</div>
        </div>
        {hasEyeDropper && (
          <button onClick={pickWithEyeDropper} className="corio-tap" title="Escolher a cor exata de qualquer ponto da tela" style={{ all: 'unset', cursor: 'pointer', flex: 'none', whiteSpace: 'nowrap', padding: '5px 10px', borderRadius: 999, border: '1px solid rgba(139,92,246,0.4)', background: 'rgba(139,92,246,0.12)', color: '#C4B5FD', fontSize: 9, fontWeight: 700 }}>Modo preciso</button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minHeight: 0 }}>
        <div
          style={{ position: 'relative', flex: 1, minWidth: 0, width: '100%', aspectRatio: '1.7', maxHeight: '100%', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.12)', touchAction: 'none', cursor: 'crosshair' }}
          onPointerDown={(e) => { draggingRef.current = true; onChange(posFromSquareEvent(e)); }}
          onPointerMove={(e) => { if (draggingRef.current) onChange(posFromSquareEvent(e)); }}
          onPointerUp={() => { draggingRef.current = false; }}
        >
          <canvas ref={squareRef} style={{ width: '100%', height: '100%', display: 'block' }} />
          <div style={{
            position: 'absolute', left: `${value.s}%`, top: `${100 - value.l}%`,
            width: 16, height: 16, margin: '-8px 0 0 -8px', borderRadius: '50%', background: pickedColorCss,
            border: '2px solid #fff', boxShadow: '0 1px 5px rgba(0,0,0,0.5)', pointerEvents: 'none',
          }} />
        </div>
        <div style={{ width: 84, flex: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="corio-eyebrow" style={{ fontSize: 7.5, fontWeight: 700, color: 'rgba(244,242,248,0.4)' }}>SUA COR</div>
          <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: 10, background: pickedColorCss, border: `2px solid ${pickedColorCss}`, boxShadow: `0 0 12px ${pickedColorCss}88`, flex: 'none' }} />
          <div>
            <div className="corio-eyebrow" style={{ fontSize: 7, fontWeight: 700, color: 'rgba(244,242,248,0.4)' }}>HEX</div>
            <button onClick={copyHex} className="corio-tap" style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontSize: 10.5, fontWeight: 700, fontFamily: "'Space Grotesk',sans-serif" }}>{copied ? '✓' : pickedHex}</button>
          </div>
        </div>
      </div>

      <div
        style={{ position: 'relative', height: 14, flex: 'none', borderRadius: 7, overflow: 'hidden', background: 'linear-gradient(90deg,#ff0000,#ffff00,#00ff00,#00ffff,#0000ff,#ff00ff,#ff0000)', touchAction: 'none', cursor: 'ew-resize' }}
        onPointerDown={(e) => { hueDraggingRef.current = true; onChange({ ...value, h: hueFromBarEvent(e) }); }}
        onPointerMove={(e) => { if (hueDraggingRef.current) onChange({ ...value, h: hueFromBarEvent(e) }); }}
        onPointerUp={() => { hueDraggingRef.current = false; }}
      >
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${(value.h / 360) * 100}%`, width: 4, marginLeft: -2, background: '#fff', boxShadow: '0 0 3px rgba(0,0,0,0.6)' }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <RgbField label="R" value={rgb.r} onChange={(v) => setChannel('r', v)} />
        <RgbField label="G" value={rgb.g} onChange={(v) => setChannel('g', v)} />
        <RgbField label="B" value={rgb.b} onChange={(v) => setChannel('b', v)} />
      </div>

      <div>
        <div className="corio-eyebrow" style={{ fontSize: 6.5, fontWeight: 700, color: 'rgba(244,242,248,0.4)', marginBottom: 3 }}>CORES RECENTES</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {colorHistory.map((hc, i) => (
            <div key={i} style={{ width: 15, height: 15, borderRadius: 5, background: hc, border: '1px solid rgba(255,255,255,0.25)' }} />
          ))}
        </div>
      </div>

      <button onClick={onConfirm} className="corio-tap corio-btn-lg" style={{ all: 'unset', cursor: 'pointer', boxSizing: 'border-box', width: '100%', textAlign: 'center', background: pickedColorCss, color: confirmTextColor, fontWeight: 700, fontSize: 12.5, padding: 9, borderRadius: 11, marginTop: 2 }}>✓ Confirmar cor</button>
      <div className="corio-card-sub" style={{ fontSize: 8.5, color: 'rgba(244,242,248,0.4)', textAlign: 'center' }}>Você pode alterar até confirmar</div>
    </div>
  );
}

function RgbField({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) {
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 4, background: '#1c1c26', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '4px 6px' }}>
      <div style={{ fontSize: 8.5, fontWeight: 700, color: 'rgba(244,242,248,0.4)', flex: 'none' }}>{label}</div>
      <input
        type="number" min={0} max={255} value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ all: 'unset', width: '100%', minWidth: 0, fontSize: 10.5, fontWeight: 700, color: '#fff', textAlign: 'right', fontFamily: "'Space Grotesk',sans-serif" }}
      />
    </div>
  );
}
