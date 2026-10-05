'use client';

import { useEffect, useId, useRef, useState } from 'react';

/**
 * A single-series area chart for a value over time.
 *
 * Follows the house chart rules: one colour (the primary blue, validated
 * against both card surfaces), a 2px line with a soft gradient fill under it,
 * 8px markers with a 2px surface ring, recessive gridlines, text in ink
 * colours rather than the series colour, and a crosshair plus tooltip on
 * hover and keyboard focus. The curve is monotone, so it never dips below
 * zero or overshoots a point between weeks. Drawn at the real pixel width
 * (measured), so markers stay round at every size. A visually hidden table
 * carries the same numbers. One series, so no legend: the card names it.
 */
export interface Point {
  start: string;
  value: number;
}

const PAD = { top: 18, right: 14, bottom: 8, left: 30 };

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Round tick step: 1, 2, 5 x 10^n, aiming for about four gridlines. */
function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 1, 2];
  const rough = max / 3;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= rough) ?? 10 * mag;
  const top = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

/** Monotone cubic (Fritsch-Carlson) path through the points: no overshoot. */
function monotonePath(xs: number[], ys: number[]): string {
  const n = xs.length;
  if (n === 0) return '';
  if (n === 1) return `M${xs[0]},${ys[0]}`;
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(xs[i + 1] - xs[i]);
    m.push((ys[i + 1] - ys[i]) / dx[i]);
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) t.push(0);
    else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      t.push((w1 + w2) / (w1 / m[i - 1] + w2 / m[i]));
    }
  }
  t.push(m[n - 2]);
  let d = `M${xs[0]},${ys[0]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${xs[i] + h},${ys[i] + h * t[i]} ${xs[i + 1] - h},${ys[i + 1] - h * t[i + 1]} ${xs[i + 1]},${ys[i + 1]}`;
  }
  return d;
}

interface ChartProps {
  data: Point[];
  unit: [string, string];
  caption: string;
  height?: number;
}

/**
 * The measuring shell: one wrapper that is always in the DOM and always
 * observed. The plot is drawn inside it only once its width is known, because
 * drawing at a guessed width first would stretch a narrow grid column to fit,
 * and the measurement would then read back that stretched width.
 */
export function AreaChart(props: ChartProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(200, Math.round(el.getBoundingClientRect().width)));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrap} className="w-full min-w-0">
      {width === null ? (
        <div style={{ height: (props.height ?? 220) + 24 }} aria-hidden />
      ) : (
        <AreaChartPlot {...props} width={width} />
      )}
    </div>
  );
}

function AreaChartPlot({ data, unit, caption, height = 220, width }: ChartProps & { width: number }) {
  const [active, setActive] = useState<number | null>(null);
  const gradId = useId().replace(/:/g, '');

  const n = data.length;
  const ticks = niceTicks(Math.max(0, ...data.map((d) => d.value)));
  const top = ticks[ticks.length - 1];
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const xs = data.map((_, i) => x(i));
  const ys = data.map((d) => y(d.value));
  const line = monotonePath(xs, ys);
  const baseline = PAD.top + plotH;
  const area = n ? `${line} L${xs[n - 1]},${baseline} L${xs[0]},${baseline} Z` : '';
  const plural = (v: number) => (v === 1 ? unit[0] : unit[1]);

  // Fewer x labels as the card narrows: at least ~84px apart (room for the
  // right-aligned "This week" beside a centred date), always the last.
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(plotW / 84))));
  const showLabel = (i: number) => (n - 1 - i) % every === 0;

  const a = active;
  const tipLeft = a !== null ? Math.min(Math.max(xs[a], 70), width - 70) : 0;

  return (
    <figure className="m-0 min-w-0">
      <div className="relative w-full min-w-0 select-none" onPointerLeave={() => setActive(null)}>
        <svg width={width} height={height} className="block overflow-visible" aria-hidden>
          <defs>
            <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* gridlines and y labels */}
          {ticks.map((v) => (
            <g key={v}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(v)}
                y2={y(v)}
                stroke={v === 0 ? 'var(--hairline)' : 'var(--hairline-soft)'}
                strokeDasharray={v === 0 ? undefined : '3 4'}
              />
              <text x={PAD.left - 10} y={y(v)} dy="0.32em" textAnchor="end" className="fill-[var(--muted)] text-[11px] tabular-nums">
                {v}
              </text>
            </g>
          ))}

          {/* area, then the line on top */}
          <path d={area} fill={`url(#${gradId})`} className="chart-draw-fade" />
          <path
            d={line}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            className="chart-draw"
          />

          {/* crosshair */}
          {a !== null && (
            <line x1={xs[a]} x2={xs[a]} y1={PAD.top} y2={baseline} stroke="var(--muted-soft)" strokeDasharray="2 3" />
          )}

          {/* markers: 8px with a 2px surface ring; the active one grows. On long
              ranges only the latest and the hovered point get one, so the line
              is not buried under dots. */}
          {data.map((d, i) =>
            n > 12 && i !== n - 1 && i !== a ? null : (
            <circle
              key={d.start}
              cx={xs[i]}
              cy={ys[i]}
              r={a === i ? 6 : 4}
              fill="var(--primary)"
              stroke="var(--surface-card)"
              strokeWidth={2}
              className="transition-[r] duration-150"
            />
            ),
          )}
        </svg>

        {/* Hit targets: one column per point, wider than the mark, focusable. */}
        <div className="absolute inset-y-0" style={{ left: PAD.left - plotW / Math.max(1, n - 1) / 2, width: plotW + plotW / Math.max(1, n - 1) }}>
          <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
            {data.map((d, i) => (
              <button
                key={d.start}
                type="button"
                className="h-full cursor-crosshair rounded-[6px] outline-none focus-visible:bg-[var(--surface-strong)]/40 focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                onPointerEnter={() => setActive(i)}
                onPointerMove={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                aria-label={`Week of ${dateLabel(d.start)}: ${d.value} ${plural(d.value)}`}
              />
            ))}
          </div>
        </div>

        {a !== null && (
          <div
            role="status"
            className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-[12px] border border-hairline bg-surface-card px-3 py-2 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.4)]"
            style={{ left: tipLeft, top: Math.max(0, ys[a] - 64) }}
          >
            <p className="whitespace-nowrap text-[11px] text-muted">Week of {dateLabel(data[a].start)}</p>
            <p className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap">
              <span aria-hidden className="inline-block h-0.5 w-3 rounded-full bg-primary" />
              <span className="font-mono text-[15px] font-semibold tabular-nums text-ink">{data[a].value}</span>
              <span className="text-[12px] text-muted">{plural(data[a].value)}</span>
            </p>
          </div>
        )}

        {/* x labels */}
        <div aria-hidden className="relative mt-2 h-4">
          {data.map((d, i) =>
            showLabel(i) ? (
              <span
                key={d.start}
                className="absolute top-0 whitespace-nowrap text-[11px] text-muted"
                style={
                  i === n - 1
                    ? { right: PAD.right - 2 }
                    : { left: xs[i], transform: 'translateX(-50%)' }
                }
              >
                {i === n - 1 ? 'This week' : dateLabel(d.start)}
              </span>
            ) : null,
          )}
        </div>
      </div>

      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Week of</th>
            <th scope="col">{unit[1]}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.start}>
              <td>{dateLabel(d.start)}</td>
              <td>{d.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
