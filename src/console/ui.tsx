import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { AlertTriangle, CheckCircle2, Loader2, Lock, Table2, X } from 'lucide-react';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { withMotion } from '../shared/motion';
import { ApiError, nf } from './api';

// Shared building blocks of the owner console (layout of the approved prototype, 31 Oct 2026): page header, white panels,
// state badges, notices, KPI tiles, meters, the line chart and the modal dialog. Numbers shown here always come from the API.

export function PageHead({
  title,
  lede,
  actions,
  back,
  small = false,
}: {
  title: ReactNode;
  lede?: ReactNode;
  actions?: ReactNode;
  back?: ReactNode;
  small?: boolean;
}) {
  return (
    <header className={small ? 'cs-vh small' : 'cs-vh'}>
      <div className="cs-vh-text">
        {back}
        <h1 id="cs-h1">{title}</h1>
        {lede && <p>{lede}</p>}
      </div>
      {actions && <div className="cs-vh-acts">{actions}</div>}
    </header>
  );
}

export function Panel({
  title,
  sub,
  actions,
  children,
  className = '',
  pad = false,
  as: Tag = 'section',
  ...rest
}: {
  title?: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  pad?: boolean;
  as?: 'section' | 'div' | 'aside';
} & React.HTMLAttributes<HTMLElement>) {
  const id = useId();
  return (
    <Tag
      className={`cs-panel ${className}`.trim()}
      aria-labelledby={title ? id : undefined}
      {...rest}
    >
      {(title || actions) && (
        <div className="cs-ph">
          <div>
            {title && <h2 id={id}>{title}</h2>}
            {sub && <p>{sub}</p>}
          </div>
          {actions && <div className="cs-ph-acts">{actions}</div>}
        </div>
      )}
      {pad ? <div className="cs-pb">{children}</div> : children}
    </Tag>
  );
}

export type Tone = 'ok' | 'warn' | 'violet' | 'grey' | 'blue' | 'danger';
export function Badge({
  tone = 'grey',
  dot = true,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
}) {
  return <span className={`cs-badge ${tone}${dot ? '' : ' plain'}`}>{children}</span>;
}

/** The four content states, worded the same everywhere. */
export type ContentState = 'Published' | 'Changes not published' | 'Draft only' | 'Hidden';
export const contentState = (i: {
  published: boolean;
  unpublished: boolean;
  hasDraft: boolean;
}): ContentState =>
  !i.published
    ? 'Draft only'
    : i.unpublished
      ? 'Hidden'
      : i.hasDraft
        ? 'Changes not published'
        : 'Published';
const STATE_TONE: Record<ContentState, Tone> = {
  Published: 'ok',
  'Changes not published': 'warn',
  'Draft only': 'violet',
  Hidden: 'grey',
};
export function StateBadge({ state }: { state: ContentState }) {
  return <Badge tone={STATE_TONE[state]}>{state}</Badge>;
}

export function Notice({
  kind = 'ok',
  children,
  action,
}: {
  kind?: 'ok' | 'error' | 'warn' | 'info';
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      className={`cs-notice ${kind}`}
      aria-live={kind === 'error' ? undefined : 'polite'}
    >
      {kind === 'error' || kind === 'warn' ? (
        <AlertTriangle size={16} aria-hidden="true" />
      ) : (
        <CheckCircle2 size={16} aria-hidden="true" />
      )}
      <span>{children}</span>
      {action}
    </div>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="cs-loading" role="status">
      <Loader2 size={18} className="cs-spin" aria-hidden="true" />
      {label}
    </div>
  );
}

/** A failed request. A refusal by the server (not signed in, or not the owner) gets its own calm panel with the server's words. */
export function LoadError({ error, retry }: { error: unknown; retry?: () => void }) {
  const msg = error instanceof Error ? error.message : String(error);
  const denied = error instanceof ApiError && (error.status === 401 || error.status === 403);
  if (denied)
    return (
      <div className="cs-gate" role="alert">
        <span className="cs-gate-tile" aria-hidden="true">
          <Lock size={24} />
        </span>
        <h2>This area is for the owner</h2>
        <p>{msg} Nothing here is visible to this account, and no content was loaded.</p>
        <a className="cs-btn primary" href="#/">
          Back to the app
        </a>
      </div>
    );
  return (
    <Notice
      kind="error"
      action={
        retry && (
          <button type="button" className="cs-linkbtn" onClick={retry}>
            Try again
          </button>
        )
      }
    >
      {msg}
    </Notice>
  );
}

export function Empty({
  icon,
  title,
  children,
}: {
  icon?: ReactNode;
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className="cs-empty">
      {icon && <span className="cs-empty-ico">{icon}</span>}
      {title && <h3>{title}</h3>}
      {children && <p>{children}</p>}
    </div>
  );
}

/** A thin line of the shape of a series, in the tile's corner colour. Decorative: the number beside it says the same. */
export function Spark({ values, tone = 1 }: { values: number[]; tone?: 1 | 2 }) {
  if (values.length < 2) return <span className="cs-spark-none" aria-hidden="true" />;
  const mx = Math.max(...values),
    mn = Math.min(...values);
  const d = values
    .map(
      (v, i) =>
        `${i ? 'L' : 'M'}${((i * 100) / (values.length - 1)).toFixed(2)} ${(30 - ((v - mn) / (mx - mn || 1)) * 26).toFixed(2)}`,
    )
    .join(' ');
  return (
    <svg className="cs-spark" viewBox="0 0 100 34" preserveAspectRatio="none" aria-hidden="true">
      <path d={d} className={`cs-ln s${tone}`} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Units used against an allowance. The dark tick marks the stop: at that point the server refuses further paid calls. */
export function Meter({
  used,
  cap,
  label,
  stopLabel,
}: {
  used: number;
  cap: number;
  label: string;
  stopLabel?: string;
}) {
  const p = cap > 0 ? Math.min(100, (used / cap) * 100) : 0;
  return (
    <div
      className="cs-track"
      role="progressbar"
      aria-valuenow={used}
      aria-valuemin={0}
      aria-valuemax={cap}
      aria-label={label}
    >
      <i className={p >= 90 ? 'warn' : ''} style={{ width: `${p}%` }} />
      <span className="cs-stop" title={stopLabel} />
    </div>
  );
}

export function Kpi({
  icon,
  label,
  value,
  sub,
  corner,
  cornerTone,
  spark,
  meter,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  corner?: ReactNode;
  cornerTone?: 'ok' | 'warn' | 'muted';
  spark?: number[];
  meter?: ReactNode;
}) {
  return (
    <div className="cs-kpi">
      <div className="cs-kpi-top">
        <span className="cs-kpi-tile" aria-hidden="true">
          {icon}
        </span>
        {corner != null && (
          <span className={`cs-kpi-corner c-${cornerTone || 'muted'}`}>{corner}</span>
        )}
      </div>
      <strong className="cs-num">{typeof value === 'number' ? nf.format(value) : value}</strong>
      <span className="cs-kpi-label">{label}</span>
      {sub && <small>{sub}</small>}
      <div className="cs-kpi-foot">{meter ?? (spark ? <Spark values={spark} /> : null)}</div>
    </div>
  );
}

export const shortDay = (d: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(`${d}T12:00:00Z`),
  );

const niceMax = (v: number) => {
  if (v <= 4) return 4;
  const raw = v / 4,
    mag = 10 ** Math.floor(Math.log10(raw)),
    n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag * 4;
};

export type Series = { name: string; values: number[]; tone: 1 | 2 };

/**
 * Line chart drawn at the width it really has (measured), so labels stay readable on a phone. One value axis with a recessive
 * grid, a soft area under each line, the latest value labelled at the end of each line, and a crosshair with the values for
 * the day under the pointer. The crosshair is keyboard reachable (focus the chart, then the arrow keys). Series 1 is blue,
 * series 2 the darker amber that stays distinct for colour-blind readers.
 */
function LineChart({
  series,
  dates,
  label,
  height = 260,
}: {
  series: Series[];
  dates: string[];
  label: string;
  height?: number;
}) {
  const wrap = useRef<HTMLDivElement>(null),
    svg = useRef<SVGSVGElement>(null);
  const [W, setW] = useState<number | null>(null),
    [idx, setIdx] = useState<number | null>(null);
  const gid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => {
      const w = Math.round(el.getBoundingClientRect().width);
      setW(w > 0 ? w : 640);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Lines draw once when the chart first appears. Inline styles are cleared afterwards so a later resize is never clipped.
  useGSAP(
    () => {
      if (!W || !svg.current) return;
      const lines = svg.current.querySelectorAll('.cs-chart-line');
      const areas = svg.current.querySelectorAll('.cs-chart-area');
      withMotion(() => {
        if (lines.length)
          gsap.from(lines, {
            drawSVG: '0%',
            duration: 1.1,
            ease: 'power2.out',
            stagger: 0.15,
            clearProps: 'all',
          });
        if (areas.length)
          gsap.from(areas, { opacity: 0, duration: 0.8, delay: 0.3, clearProps: 'all' });
      });
    },
    { dependencies: [W != null], scope: wrap },
  );
  const n = dates.length,
    H = height,
    L = 44,
    R = 52,
    T = 14,
    B = 30;
  const w = W ?? 640,
    iw = Math.max(40, w - L - R),
    ih = H - T - B;
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values)));
  const x = (i: number) => L + (n <= 1 ? iw / 2 : (i * iw) / (n - 1));
  const y = (v: number) => T + ih * (1 - v / max);
  const ticks = [0, 1, 2, 3, 4].map((k) => (max * k) / 4);
  const labelCount = Math.max(2, Math.min(n, Math.floor(iw / 92)));
  const xLabels = [
    ...new Set(
      Array.from({ length: labelCount }, (_, k) =>
        Math.round((k * (n - 1)) / Math.max(1, labelCount - 1)),
      ),
    ),
  ];
  const path = (vals: number[]) =>
    vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  // End labels: nudge apart when two lines finish close together.
  const ends = series.map((s) => ({ v: s.values[n - 1] ?? 0, y: y(s.values[n - 1] ?? 0) + 4 }));
  if (ends.length === 2 && Math.abs(ends[0].y - ends[1].y) < 14) {
    const up = ends[0].y <= ends[1].y ? 0 : 1;
    const mid = (ends[0].y + ends[1].y) / 2;
    ends[up].y = mid - 7;
    ends[1 - up].y = mid + 7;
  }
  const pick = (clientX: number) => {
    const r = svg.current?.getBoundingClientRect();
    if (!r || n === 0) return;
    const px = ((clientX - r.left) / r.width) * w;
    setIdx(Math.max(0, Math.min(n - 1, Math.round(((px - L) / iw) * (n - 1)))));
  };
  const tipTop = idx == null ? 0 : Math.min(...series.map((s) => y(s.values[idx] ?? 0)));
  return (
    <div className="cs-chart" ref={wrap}>
      {W != null && n > 0 && (
        <svg
          ref={svg}
          viewBox={`0 0 ${w} ${H}`}
          width={w}
          height={H}
          role="group"
          aria-label={label}
        >
          <defs>
            {series.map((s) => (
              <linearGradient key={s.tone} id={`${gid}g${s.tone}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" className={`cs-stop-a s${s.tone}`} />
                <stop offset="1" className={`cs-stop-b s${s.tone}`} />
              </linearGradient>
            ))}
          </defs>
          <g className="cs-grid">
            {ticks.map((t) => (
              <line key={t} x1={L} x2={L + iw} y1={y(t)} y2={y(t)} />
            ))}
          </g>
          <g className="cs-ax">
            {ticks.map((t) => (
              <text key={t} x={L - 10} y={y(t) + 4} textAnchor="end">
                {nf.format(t)}
              </text>
            ))}
            {xLabels.map((i) => (
              <text
                key={i}
                x={x(i)}
                y={H - 8}
                textAnchor={n > 1 && i === 0 ? 'start' : i === n - 1 && n > 1 ? 'end' : 'middle'}
              >
                {shortDay(dates[i])}
              </text>
            ))}
          </g>
          {series.map((s) => (
            <g key={s.name}>
              <path
                className="cs-chart-area"
                d={`${path(s.values)} L${x(n - 1).toFixed(1)} ${y(0)} L${x(0).toFixed(1)} ${y(0)}Z`}
                fill={`url(#${gid}g${s.tone})`}
              />
              <path className={`cs-chart-line cs-ln s${s.tone}`} d={path(s.values)} />
            </g>
          ))}
          {series.map((s, k) => (
            <g key={s.name} className="cs-end">
              <circle
                cx={x(n - 1)}
                cy={y(s.values[n - 1] ?? 0)}
                r="4.5"
                className={`cs-dot s${s.tone}`}
              />
              <text x={x(n - 1) + 10} y={ends[k].y} className="cs-end-label">
                {nf.format(ends[k].v)}
              </text>
            </g>
          ))}
          {idx != null && (
            <g className="cs-xh">
              <line x1={x(idx)} x2={x(idx)} y1={T} y2={T + ih} />
              {series.map((s) => (
                <circle
                  key={s.name}
                  cx={x(idx)}
                  cy={y(s.values[idx] ?? 0)}
                  r="4"
                  className={`cs-dot s${s.tone}`}
                />
              ))}
            </g>
          )}
          {/* biome-ignore lint/a11y/noNoninteractiveTabindex: the plot is a keyboard stop so its values can be read with the arrow keys */}
          <rect
            x={L}
            y={T}
            width={iw}
            height={ih}
            fill="transparent"
            className="cs-hit"
            tabIndex={0}
            role="slider"
            aria-label={`${label}. Use the left and right arrow keys to read each day.`}
            aria-valuemin={0}
            aria-valuemax={Math.max(0, n - 1)}
            aria-valuenow={idx ?? n - 1}
            aria-valuetext={
              idx == null
                ? undefined
                : `${shortDay(dates[idx])}: ${series.map((s) => `${s.name} ${nf.format(s.values[idx] ?? 0)}`).join(', ')}`
            }
            onPointerMove={(e) => pick(e.clientX)}
            onPointerDown={(e) => pick(e.clientX)}
            onPointerLeave={() => setIdx(null)}
            onFocus={() => setIdx(n - 1)}
            onBlur={() => setIdx(null)}
            onKeyDown={(e) => {
              const cur = idx ?? n - 1;
              const next =
                e.key === 'ArrowRight' || e.key === 'ArrowUp'
                  ? cur + 1
                  : e.key === 'ArrowLeft' || e.key === 'ArrowDown'
                    ? cur - 1
                    : e.key === 'Home'
                      ? 0
                      : e.key === 'End'
                        ? n - 1
                        : null;
              if (next == null) return;
              e.preventDefault();
              setIdx(Math.max(0, Math.min(n - 1, next)));
            }}
          />
        </svg>
      )}
      {W == null && <div style={{ height: H }} />}
      {idx != null && W != null && (
        <div
          className="cs-tip"
          style={{ left: `${(x(idx) / w) * 100}%`, top: `${tipTop}px` }}
          aria-hidden="true"
        >
          <b>{shortDay(dates[idx])}</b>
          {series.map((s) => (
            <div key={s.name}>
              <i className={`s${s.tone}`} />
              {s.name}: <span className="cs-num">{nf.format(s.values[idx] ?? 0)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** A chart panel: title, legend and a "Show as table" switch, so every value can also be read as text. */
export function ChartPanel({
  title,
  sub,
  series,
  dates,
  height,
  className = '',
}: {
  title: string;
  sub?: ReactNode;
  series: Series[];
  dates: string[];
  height?: number;
  className?: string;
}) {
  const [table, setTable] = useState(false);
  const total = series.map((s) => s.values.reduce((a, b) => a + b, 0));
  return (
    <Panel
      title={title}
      sub={sub}
      className={`cs-chartpanel ${className}`.trim()}
      actions={
        <>
          <div className="cs-legend" aria-hidden={series.length < 2}>
            {series.map((s) => (
              <span key={s.name}>
                <i className={`s${s.tone}`} />
                {s.name}
              </span>
            ))}
          </div>
          <button
            type="button"
            className="cs-linkbtn"
            onClick={() => setTable((t) => !t)}
            aria-pressed={table}
          >
            <Table2 size={14} aria-hidden="true" />
            {table ? 'Show as chart' : 'Show as table'}
          </button>
        </>
      }
    >
      {dates.length === 0 ? (
        <Empty>No days in this range yet.</Empty>
      ) : table ? (
        <div
          className="cs-tw"
          tabIndex={0}
          role="region"
          aria-label="Table (scrolls sideways on small screens)"
        >
          <table className="cs-table">
            <thead>
              <tr>
                <th>Day</th>
                {series.map((s) => (
                  <th key={s.name} className="num">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dates.map((d, i) => (
                <tr key={d}>
                  <td>{shortDay(d)}</td>
                  {series.map((s) => (
                    <td key={s.name} className="num">
                      {nf.format(s.values[i] ?? 0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                {series.map((s, k) => (
                  <td key={s.name} className="num">
                    {nf.format(total[k])}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="cs-pb">
          <LineChart
            series={series}
            dates={dates}
            height={height}
            label={`${title}, ${dates.length} days: ${series.map((s, k) => `${s.name} ${nf.format(total[k])} in total`).join(', ')}`}
          />
        </div>
      )}
    </Panel>
  );
}

/** Ranked counts as a hairline table with a share bar. */
export function RankTable({
  title,
  items,
  empty,
  keyLabel = 'Name',
  countLabel = 'Count',
}: {
  title: string;
  items: { key: string; count: number }[];
  empty: string;
  keyLabel?: string;
  countLabel?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <Panel title={title}>
      {items.length === 0 ? (
        <Empty>{empty}</Empty>
      ) : (
        <div
          className="cs-tw"
          tabIndex={0}
          role="region"
          aria-label="Table (scrolls sideways on small screens)"
        >
          <table className="cs-table">
            <thead>
              <tr>
                <th>{keyLabel}</th>
                <th className="cs-rank-col">
                  <span className="cs-sr">Share</span>
                </th>
                <th className="num">{countLabel}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.key}>
                  <td className="cs-strong">{i.key}</td>
                  <td aria-hidden="true" className="cs-rank-col">
                    <span className="cs-rank-bar">
                      <i style={{ width: `${(i.count / max) * 100}%` }} />
                    </span>
                  </td>
                  <td className="num">{nf.format(i.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

/** The children of `ref` rise in once, when `deps` change (and `on` is true). Nothing moves for people who prefer reduced motion. */
export function useRise(ref: React.RefObject<HTMLElement | null>, deps: unknown[], on = true) {
  useGSAP(
    () => {
      const el = ref.current;
      if (!on || !el) return;
      withMotion(() => {
        const kids = [...el.children].filter((k) => !k.classList.contains('cs-norise'));
        if (kids.length)
          gsap.from(kids, {
            y: 12,
            autoAlpha: 0,
            duration: 0.4,
            stagger: 0.04,
            ease: 'power3.out',
            clearProps: 'transform,opacity,visibility',
          });
      });
    },
    { dependencies: deps, scope: ref, revertOnUpdate: true },
  );
}

// Toasts: short confirmations at the bottom of the screen (errors stay next to what failed).
type ToastItem = { id: number; text: string };
let pushToast: ((text: string) => void) | null = null;
/** Show a confirmation. Safe to call from any console screen. */
export const toast = (text: string) => pushToast?.(text);
export function Toasts() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    let n = 0;
    pushToast = (text) => {
      n += 1;
      const id = n;
      setItems((x) => [...x.slice(-2), { id, text }]);
      window.setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 6000);
    };
    return () => {
      pushToast = null;
    };
  }, []);
  return (
    <div className="cs-toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className="cs-toast">
          <CheckCircle2 size={18} aria-hidden="true" />
          {t.text}
        </div>
      ))}
    </div>
  );
}

/** A switch (role="switch"), as in the prototype: blue when on. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange?: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="cs-switch"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
    />
  );
}

/** A modal dialog: focus moves in, Escape or the close button closes it, focus returns to where it was. */
export function Dialog({
  title,
  sub,
  onClose,
  wide = false,
  className = '',
  children,
  footer,
  role = 'dialog',
}: {
  title: string;
  sub?: ReactNode;
  onClose: () => void;
  wide?: boolean;
  className?: string;
  children: ReactNode;
  footer?: ReactNode;
  role?: 'dialog' | 'alertdialog';
}) {
  const box = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = useCallback(() => onClose(), [onClose]);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const b = box.current;
    const first =
      b?.querySelector<HTMLElement>('[data-autofocus]') ??
      b?.querySelector<HTMLElement>('input, textarea, select') ??
      b?.querySelector<HTMLElement>('button');
    first?.focus();
    return () => prev?.focus?.();
  }, []);
  useGSAP(
    () =>
      withMotion(() => {
        gsap.from(box.current, {
          y: 16,
          scale: 0.98,
          autoAlpha: 0,
          duration: 0.3,
          ease: 'power3.out',
          clearProps: 'all',
        });
      }),
    { scope: box },
  );
  return (
    <div
      className="cs-scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={box}
        className={`cs-dialog${wide ? ' wide' : ''} ${className}`.trim()}
        role={role}
        aria-modal="true"
        aria-labelledby={id}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            close();
          }
          if (e.key === 'Tab' && box.current) {
            const f = [
              ...box.current.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), input, textarea, select, iframe, [tabindex]:not([tabindex="-1"])',
              ),
            ];
            if (!f.length) return;
            const a = f[0],
              z = f[f.length - 1];
            if (e.shiftKey && document.activeElement === a) {
              e.preventDefault();
              z.focus();
            } else if (!e.shiftKey && document.activeElement === z) {
              e.preventDefault();
              a.focus();
            }
          }
        }}
      >
        <div className="cs-dialog-head">
          <div>
            <h2 id={id}>{title}</h2>
            {sub && <p>{sub}</p>}
          </div>
          <button type="button" className="cs-ib round" onClick={close} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>
        {children}
        {footer && <div className="cs-dialog-foot">{footer}</div>}
      </div>
    </div>
  );
}
