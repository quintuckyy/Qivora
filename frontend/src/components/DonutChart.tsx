import type { ReactNode } from 'react';

export interface DonutSegment {
  key: string;
  value: number;
  color: string;
}

export function DonutChart({
  segments,
  size = 168,
  thickness = 20,
  trackColor = 'var(--color-surface-2)',
  children,
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  trackColor?: string;
  children?: ReactNode;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const radius = (size - thickness) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  let acc = 0;
  const arcs =
    total > 0
      ? segments
          .filter((s) => s.value > 0)
          .map((s) => {
            const length = (s.value / total) * circumference;
            const offset = (acc / total) * circumference;
            acc += s.value;
            return { ...s, length, offset };
          })
      : [];

  return (
    <div className="donut-chart" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={center} cy={center} r={radius} fill="none" strokeWidth={thickness} style={{ stroke: trackColor }} />
        {arcs.map((arc) => (
          <circle
            key={arc.key}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            strokeWidth={thickness}
            strokeDasharray={`${arc.length} ${circumference - arc.length}`}
            strokeDashoffset={-arc.offset}
            transform={`rotate(-90 ${center} ${center})`}
            style={{ stroke: arc.color, transition: 'stroke-dasharray 0.3s ease' }}
          />
        ))}
      </svg>
      {children && <div className="donut-chart-center">{children}</div>}
    </div>
  );
}
