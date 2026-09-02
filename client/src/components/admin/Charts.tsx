// Hand-rolled SVG charts — the rest of the app has zero chart/UI-kit
// dependency, so these follow the same convention instead of pulling one
// in just for the admin panel. Deliberately simple (bar/line/donut), no
// animation libraries, styled with the same palette as everything else.
const PALETTE = ['#8B5CF6', '#29E7FF', '#FFC93C', '#FF5C8A', '#4ADE80', '#A78BFA', '#F97316'];

export function BarChart({ data, height = 140, color = '#8B5CF6', formatLabel }: { data: { label: string; count: number }[]; height?: number; color?: string; formatLabel?: (l: string) => string }) {
  if (data.length === 0) return <EmptyChart height={height} />;
  const max = Math.max(1, ...data.map((d) => d.count));
  const barW = 100 / data.length;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }}>
        {data.map((d, i) => {
          const h = (d.count / max) * (height - 4);
          return (
            <rect key={i} x={i * barW + barW * 0.15} y={height - h} width={barW * 0.7} height={h} rx={1.5} fill={color} opacity={0.9}>
              <title>{`${d.label}: ${d.count}`}</title>
            </rect>
          );
        })}
      </svg>
      <div style={{ display: 'flex', fontSize: 8, color: 'rgba(244,242,248,0.45)', fontWeight: 700 }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 1px' }}>
            {formatLabel ? formatLabel(d.label) : d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export function LineChart({ data, height = 140, color = '#29E7FF' }: { data: { date: string; count: number }[]; height?: number; color?: string }) {
  if (data.length === 0) return <EmptyChart height={height} />;
  const max = Math.max(1, ...data.map((d) => d.count));
  const stepX = data.length > 1 ? 100 / (data.length - 1) : 0;
  const points = data.map((d, i) => `${i * stepX},${height - (d.count / max) * (height - 4)}`).join(' ');
  const areaPoints = `0,${height} ${points} ${100},${height}`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }}>
        <polygon points={areaPoints} fill={color} opacity={0.12} />
        <polyline points={points} fill="none" stroke={color} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
        {data.map((d, i) => (
          <circle key={i} cx={i * stepX} cy={height - (d.count / max) * (height - 4)} r={1.4} fill={color}>
            <title>{`${d.date}: ${d.count}`}</title>
          </circle>
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'rgba(244,242,248,0.4)', fontWeight: 700 }}>
        <span>{data[0]?.date?.slice(5)}</span>
        <span>{data[data.length - 1]?.date?.slice(5)}</span>
      </div>
    </div>
  );
}

export function DonutChart({ data, size = 120 }: { data: { label: string; count: number }[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return <EmptyChart height={size} />;
  const r = 40, cx = 50, cy = 50, strokeWidth = 16;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <svg viewBox="0 0 100 100" style={{ width: size, height: size, flex: 'none', transform: 'rotate(-90deg)' }}>
        {data.map((d, i) => {
          const frac = d.count / total;
          const dash = frac * circumference;
          const el = (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={PALETTE[i % PALETTE.length]} strokeWidth={strokeWidth}
              strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={-offset}>
              <title>{`${d.label}: ${d.count}`}</title>
            </circle>
          );
          offset += dash;
          return el;
        })}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9.5, fontWeight: 700 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: PALETTE[i % PALETTE.length], flex: 'none' }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</span>
            <span style={{ color: 'rgba(244,242,248,0.5)', flex: 'none' }}>{Math.round((d.count / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The precision breakdown bars in the request's own mockup (████ 3%
 * Perfeito etc.) — a horizontal stacked/labeled bar list, not a chart type
 * the other two components cover. */
export function PrecisionBars({ tiers }: { tiers: { label: string; count: number; pct: number }[] }) {
  const tierColor: Record<string, string> = {
    Perfeito: '#4ADE80', 'Quase perfeito': '#29E7FF', Bom: '#8B5CF6', Mediano: '#FFC93C', Ruim: '#FF9C5C', 'Muito ruim': '#FF5C8A',
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {tiers.map((t) => (
        <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 84, flex: 'none', fontSize: 10, fontWeight: 700, color: 'rgba(244,242,248,0.7)' }}>{t.label}</div>
          <div style={{ flex: 1, height: 10, borderRadius: 6, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div style={{ width: `${t.pct}%`, height: '100%', background: tierColor[t.label] ?? '#8B5CF6', borderRadius: 6, transition: 'width .4s ease' }} />
          </div>
          <div style={{ width: 46, flex: 'none', textAlign: 'right', fontSize: 10, fontWeight: 800, fontFamily: "'Space Grotesk',sans-serif" }}>{t.pct}%</div>
        </div>
      ))}
    </div>
  );
}

function EmptyChart({ height }: { height: number }) {
  return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'rgba(244,242,248,0.35)', fontWeight: 700 }}>
      Sem dado suficiente ainda
    </div>
  );
}
