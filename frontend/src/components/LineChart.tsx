import type { SeriesPoint } from '../lib/applicationSeries';

const WIDTH = 760;
const HEIGHT = 190;
const PAD_LEFT = 12;
const PAD_RIGHT = 12;
const PAD_TOP = 18;
const PAD_BOTTOM = 14;
const GRADIENT_ID = 'lineChartFill';

export function LineChart({ data }: { data: SeriesPoint[] }) {
  const innerW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const max = Math.max(1, ...data.map((d) => d.count));
  const n = data.length;
  const baseline = PAD_TOP + innerH;

  const points = data.map((d, i) => {
    const x = n === 1 ? PAD_LEFT + innerW / 2 : PAD_LEFT + (i / (n - 1)) * innerW;
    const y = baseline - (d.count / max) * innerH;
    return { ...d, x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${baseline} L ${points[0].x.toFixed(1)} ${baseline} Z`
      : '';

  return (
    <div className="linechart">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="linechart-svg" role="img" aria-label="Applications over time">
        <defs>
          <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={PAD_LEFT} y1={baseline} x2={WIDTH - PAD_RIGHT} y2={baseline} className="linechart-baseline" />
        {areaPath && <path d={areaPath} fill={`url(#${GRADIENT_ID})`} stroke="none" />}
        <path d={linePath} fill="none" className="linechart-line" />
        {points.map((p) => (
          <circle key={p.key} cx={p.x} cy={p.y} r={3.5} className="linechart-dot">
            <title>{`${p.label}: ${p.count} application${p.count === 1 ? '' : 's'}`}</title>
          </circle>
        ))}
      </svg>
      <div className="linechart-labels">
        {points.map((p) => (
          <span key={p.key} className="linechart-label">
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}
