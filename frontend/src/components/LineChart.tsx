import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent,
} from 'react';
import type { SeriesPoint } from '../lib/applicationSeries';

const WIDTH = 760;
const HEIGHT = 210;
const PAD_LEFT = 30;
const PAD_RIGHT = 14;
const PAD_TOP = 16;
const PAD_BOTTOM = 16;
const GRADIENT_ID = 'lineChartFill';

interface Scale {
  max: number;
  ticks: number[];
}

/** A y-axis that ends on a round number and never shows fractional counts. */
function buildScale(rawMax: number, target = 4): Scale {
  const max = Math.max(1, Math.ceil(rawMax));
  if (max <= 6) {
    return { max, ticks: Array.from({ length: max + 1 }, (_, i) => i) };
  }
  const rough = max / target;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = [1, 2, 2.5, 5, 10].map((c) => c * pow).find((c) => c >= rough) ?? 10 * pow;
  const niceMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= niceMax + 1e-9; v += step) ticks.push(Math.round(v));
  return { max: niceMax, ticks };
}

const plural = (n: number) => (n === 1 ? '' : 's');

export type ChartGranularity = 'week' | 'month' | 'year';

export function LineChart({
  data,
  granularity = 'month',
}: {
  data: SeriesPoint[];
  granularity?: ChartGranularity;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const lastTipIndex = useRef(0);

  // Stable identity for the current bucket set — changes only when the range
  // toggle swaps in different periods, not on every parent re-render.
  const seriesKey = data.map((d) => d.key).join('|');
  useEffect(() => {
    setActiveIndex(null);
    lastTipIndex.current = 0;
  }, [seriesKey]);

  const innerW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const baseline = PAD_TOP + innerH;
  const n = data.length;

  const scale = useMemo(() => buildScale(Math.max(...data.map((d) => d.count), 0)), [data]);

  const points = useMemo(
    () =>
      data.map((d, i) => {
        const x = n === 1 ? PAD_LEFT + innerW / 2 : PAD_LEFT + (i / (n - 1)) * innerW;
        const y = baseline - (d.count / scale.max) * innerH;
        return { ...d, x, y, index: i };
      }),
    [data, n, innerW, baseline, innerH, scale.max],
  );

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${baseline} L ${points[0].x.toFixed(1)} ${baseline} Z`
      : '';

  const total = data.reduce((sum, d) => sum + d.count, 0);
  const peak = points.reduce<(typeof points)[number] | null>((best, p) => (best && best.count >= p.count ? best : p), null);
  const peakWhen =
    peak && granularity === 'week'
      ? `the week of ${peak.label}`
      : peak && granularity === 'year'
        ? peak.label
        : (peak?.periodLabel ?? '');

  const active = activeIndex != null ? points[activeIndex] : null;

  // Keep the tooltip mounted so it can glide between points and fade out in
  // place rather than blinking away. `tip` is the point it currently describes:
  // the hovered one, or the last hovered one while it fades.
  if (activeIndex != null) lastTipIndex.current = activeIndex;
  const tip = points[Math.min(points.length - 1, activeIndex ?? lastTipIndex.current)];
  const tipDelta = tip && tip.index > 0 ? tip.count - points[tip.index - 1].count : null;

  function indexFromClientX(clientX: number): number {
    const svg = svgRef.current;
    if (!svg || n <= 1) return 0;
    const rect = svg.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    const t = (ratio * WIDTH - PAD_LEFT) / innerW;
    return Math.min(n - 1, Math.max(0, Math.round(t * (n - 1))));
  }

  function handlePointerMove(e: ReactPointerEvent<SVGRectElement>) {
    setActiveIndex(indexFromClientX(e.clientX));
  }

  function handleKeyDown(e: KeyboardEvent<SVGRectElement>) {
    if (e.key === 'Escape') {
      setActiveIndex(null);
      return;
    }
    const current = activeIndex ?? n - 1;
    let next: number | null = null;
    if (e.key === 'ArrowLeft') next = Math.max(0, current - 1);
    else if (e.key === 'ArrowRight') next = Math.min(n - 1, current + 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    if (next != null) {
      e.preventDefault();
      setActiveIndex(next);
    }
  }

  // Tooltip placement: percentages of the viewBox so it tracks the point at any
  // rendered size. Nudge it inward near the edges so it never clips.
  const ratioX = tip ? tip.x / WIDTH : 0;
  const ratioY = tip ? tip.y / HEIGHT : 0;
  const tooltipTx = ratioX < 0.18 ? '0%' : ratioX > 0.82 ? '-100%' : '-50%';
  const tooltipTy = ratioY < 0.35 ? '12px' : '-100%';
  const tooltipOffsetY = ratioY < 0.35 ? '0.5rem' : '-0.65rem';

  return (
    <div className="linechart">
      <div className="linechart-summary">
        {peak && peak.count > 0 ? (
          <span>
            <strong>{peak.count}</strong> application{plural(peak.count)} in {peakWhen}
          </span>
        ) : (
          <span>No applications in this range yet</span>
        )}
      </div>

      <div className="linechart-plot" key={data.map((d) => d.key).join('|')}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className={`linechart-svg ${active ? 'is-inspecting' : ''}`}
          role="img"
          aria-label={`Applications over time. ${total} total across ${n} ${n === 1 ? 'period' : 'periods'}.`}
        >
          <defs>
            <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.32" />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {scale.ticks.map((tick) => {
            const y = baseline - (tick / scale.max) * innerH;
            return (
              <g key={tick}>
                <line
                  x1={PAD_LEFT}
                  y1={y}
                  x2={WIDTH - PAD_RIGHT}
                  y2={y}
                  className={tick === 0 ? 'linechart-baseline' : 'linechart-grid'}
                />
                <text x={PAD_LEFT - 8} y={y} className="linechart-axis-label" dominantBaseline="middle" textAnchor="end">
                  {tick}
                </text>
              </g>
            );
          })}

          {areaPath && <path d={areaPath} fill={`url(#${GRADIENT_ID})`} stroke="none" className="linechart-area" />}
          <path d={linePath} fill="none" className="linechart-line" />

          {active && (
            <line
              x1={0}
              y1={PAD_TOP}
              x2={0}
              y2={baseline}
              className="linechart-crosshair"
              style={{ transform: `translateX(${active.x.toFixed(1)}px)` }}
            />
          )}

          {active && (
            <circle
              cx={0}
              cy={0}
              r={12}
              className="linechart-dot-halo"
              style={{ transform: `translate(${active.x.toFixed(1)}px, ${active.y.toFixed(1)}px)` }}
            />
          )}

          {points.map((p) => {
            const isActive = active?.index === p.index;
            const isLast = p.index === n - 1;
            return (
              <circle
                key={p.key}
                cx={p.x}
                cy={p.y}
                r={isActive ? 5.5 : isLast ? 4 : 3}
                className={`linechart-dot ${isActive ? 'linechart-dot-active' : ''} ${isLast ? 'linechart-dot-last' : ''}`}
                style={{ animationDelay: `${0.35 + p.index * 0.04}s` }}
              >
                <title>{`${p.periodLabel}: ${p.count} application${plural(p.count)}`}</title>
              </circle>
            );
          })}

          <rect
            x={PAD_LEFT}
            y={0}
            width={innerW + PAD_RIGHT}
            height={HEIGHT}
            className="linechart-capture"
            tabIndex={0}
            role="slider"
            aria-label="Inspect applications by period. Use the arrow keys."
            aria-valuemin={0}
            aria-valuemax={n - 1}
            aria-valuenow={activeIndex ?? n - 1}
            aria-valuetext={
              active
                ? `${active.periodLabel}: ${active.count} application${plural(active.count)}`
                : undefined
            }
            onPointerMove={handlePointerMove}
            onPointerDown={handlePointerMove}
            onPointerLeave={() => setActiveIndex(null)}
            onFocus={() => setActiveIndex((i) => i ?? n - 1)}
            onBlur={() => setActiveIndex(null)}
            onKeyDown={handleKeyDown}
          />
        </svg>

        {tip && (
          <div
            className="linechart-tooltip"
            data-visible={active ? 'true' : 'false'}
            style={{
              left: `${ratioX * 100}%`,
              top: `${ratioY * 100}%`,
              transform: `translate(${tooltipTx}, ${tooltipTy}) translateY(${tooltipOffsetY}) scale(${active ? 1 : 0.96})`,
            }}
            role="status"
          >
            <p className="linechart-tooltip-period">{tip.periodLabel}</p>
            <p className="linechart-tooltip-value">
              <strong>{tip.count}</strong> application{plural(tip.count)}
            </p>
            <dl className="linechart-tooltip-rows">
              <div>
                <dt>Total to date</dt>
                <dd>{tip.cumulative}</dd>
              </div>
              {tipDelta != null && (
                <div>
                  <dt>vs. previous</dt>
                  <dd
                    className={
                      tipDelta > 0
                        ? 'linechart-delta-up'
                        : tipDelta < 0
                          ? 'linechart-delta-down'
                          : 'linechart-delta-flat'
                    }
                  >
                    {tipDelta > 0 ? '+' : ''}
                    {tipDelta}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </div>

      <div className="linechart-labels" aria-hidden="true">
        {points.map((p) => (
          <span
            key={p.key}
            className={`linechart-label ${active?.index === p.index ? 'linechart-label-active' : ''}`}
          >
            {p.label}
          </span>
        ))}
      </div>

      <table className="sr-only">
        <caption>Applications created per period</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            <th scope="col">Applications</th>
            <th scope="col">Total to date</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th scope="row">{d.periodLabel}</th>
              <td>{d.count}</td>
              <td>{d.cumulative}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
