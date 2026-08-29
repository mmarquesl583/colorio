import { useEffect, useRef } from 'react';
import { hslFracToRgb, rgbToHex } from '@shared/color';
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

export default function ColorPicker({ value, onChange, confirmed, onConfirm, colorHistory, waitingReady, waitingTotal }: Props) {
  const squareRef = useRef<HTMLCanvasElement>(null);
  const draggingRef = useRef(false);
  const hueDraggingRef = useRef(false);

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
    const sat = value.s / 100;
    for (let y = 0; y < h; y += step) {
      const light = 1 - y / h;
      for (let x = 0; x < w; x += step) {
        const hue = (x / w) * 360;
        const { r, g, b } = hslFracToRgb(hue, sat, light);
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
  }, [value.s]);

  const rgb = hslFracToRgb(value.h, value.s / 100, value.l / 100);
  const pickedColorCss = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
  const lum = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  const confirmTextColor = lum > 0.6 ? '#050507' : '#fff';
  const hueVivid = hslFracToRgb(value.h, 1, 0.5);
  const satTrackCss = `linear-gradient(90deg, rgb(150,150,150), rgb(${hueVivid.r},${hueVivid.g},${hueVivid.b}))`;
  const lightTrackCss = `linear-gradient(90deg, #000, rgb(${hueVivid.r},${hueVivid.g},${hueVivid.b}), #fff)`;
  const pickedHex = rgbToHex(rgb.r, rgb.g, rgb.b);

  const posFromSquareEvent = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const hue = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    const light = 1 - Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1);
    return { h: Math.round(hue * 360), s: value.s, l: Math.round(light * 100) };
  };
  const hueFromBarEvent = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const t = Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1);
    return Math.round(t * 360);
  };

  if (confirmed) {
    return (
      <div style={{ flex: 1, minHeight: 0, margin: '0 16px', background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, textAlign: 'center' }}>
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
    <div style={{ flex: 1, minHeight: 0, margin: '0 16px', background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6, color: 'rgba(244,242,248,0.55)' }}>ESCOLHA SUA COR</div>
      </div>

      <div style={{ display: 'flex', gap: 8, flex: 1, minHeight: 0 }}>
        <div
          style={{ position: 'relative', flex: 1, minWidth: 0, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.12)', touchAction: 'none' }}
          onPointerDown={(e) => { draggingRef.current = true; onChange(posFromSquareEvent(e)); }}
          onPointerMove={(e) => { if (draggingRef.current) onChange(posFromSquareEvent(e)); }}
          onPointerUp={() => { draggingRef.current = false; }}
        >
          <canvas ref={squareRef} style={{ width: '100%', height: '100%', display: 'block' }} />
          <div style={{
            position: 'absolute', left: `${(value.h / 360) * 100}%`, top: `${100 - value.l}%`,
            width: 16, height: 16, margin: '-8px 0 0 -8px', borderRadius: '50%', background: pickedColorCss,
            border: '2px solid #fff', boxShadow: '0 1px 5px rgba(0,0,0,0.5)', pointerEvents: 'none',
          }} />
        </div>
        <div
          style={{ position: 'relative', width: 14, flex: 'none', borderRadius: 7, overflow: 'hidden', background: 'linear-gradient(180deg,#ff0000,#ffff00,#00ff00,#00ffff,#0000ff,#ff00ff,#ff0000)' }}
          onPointerDown={(e) => { hueDraggingRef.current = true; onChange({ ...value, h: hueFromBarEvent(e) }); }}
          onPointerMove={(e) => { if (hueDraggingRef.current) onChange({ ...value, h: hueFromBarEvent(e) }); }}
          onPointerUp={() => { hueDraggingRef.current = false; }}
        >
          <div style={{ position: 'absolute', left: 0, right: 0, top: `${(value.h / 360) * 100}%`, height: 4, marginTop: -2, background: '#fff', boxShadow: '0 0 3px rgba(0,0,0,0.6)' }} />
        </div>
        <div style={{ width: 84, flex: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 7.5, fontWeight: 700, color: 'rgba(244,242,248,0.4)' }}>SUA COR</div>
          <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: 10, background: pickedColorCss, border: `2px solid ${pickedColorCss}`, boxShadow: `0 0 12px ${pickedColorCss}88`, flex: 'none' }} />
          <div>
            <div style={{ fontSize: 7, fontWeight: 700, color: 'rgba(244,242,248,0.4)' }}>HEX</div>
            <div style={{ fontSize: 11, fontWeight: 700, fontFamily: "'Space Grotesk',sans-serif" }}>{pickedHex}</div>
          </div>
          <div>
            <div style={{ fontSize: 6.5, fontWeight: 700, color: 'rgba(244,242,248,0.4)', marginBottom: 3 }}>RECENTES</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {colorHistory.map((hc, i) => (
                <div key={i} style={{ width: 15, height: 15, borderRadius: 5, background: hc, border: '1px solid rgba(255,255,255,0.25)' }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <SliderRow icon="☀️" min={0} max={360} value={value.h} onChange={(v) => onChange({ ...value, h: v })} track="linear-gradient(90deg,#ff0000,#ffff00,#00ff00,#00ffff,#0000ff,#ff00ff,#ff0000)" suffix="°" />
      <SliderRow icon="💧" min={0} max={100} value={value.s} onChange={(v) => onChange({ ...value, s: v })} track={satTrackCss} suffix="%" />
      <SliderRow icon="⚪" min={0} max={100} value={value.l} onChange={(v) => onChange({ ...value, l: v })} track={lightTrackCss} suffix="%" />

      <button onClick={onConfirm} className="corio-tap" style={{ all: 'unset', cursor: 'pointer', boxSizing: 'border-box', width: '100%', textAlign: 'center', background: pickedColorCss, color: confirmTextColor, fontWeight: 700, fontSize: 12.5, padding: 9, borderRadius: 11, marginTop: 2 }}>✓ Confirmar cor</button>
      <div style={{ fontSize: 8.5, color: 'rgba(244,242,248,0.4)', textAlign: 'center' }}>Você pode alterar até confirmar</div>
    </div>
  );
}

function SliderRow({ icon, min, max, value, onChange, track, suffix }: { icon: string; min: number; max: number; value: number; onChange: (v: number) => void; track: string; suffix: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ fontSize: 11, flex: 'none', width: 14 }}>{icon}</div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="corio-range"
        style={{ background: track }}
      />
      <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(244,242,248,0.5)', width: 26, flex: 'none', textAlign: 'right' }}>{value}{suffix}</div>
    </div>
  );
}
