// AD-01 charts (Recharts, admin bundle only — SPEC §12). Colors come from tokens.css; every chart
// has a legend or a title naming its single series, a hover tooltip, and a table view beside it.
import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useLang } from '../../hooks/useLang';
import { useReducedMotion } from '../../hooks/useReducedMotion';

// Charts draw themselves in once, smoothly; not at all for people who asked for less motion.
const motion = (reduced: boolean) => ({ isAnimationActive: !reduced, animationDuration: 900, animationEasing: 'ease-out' as const });

function useTokens() {
  return useMemo(() => {
    const css = getComputedStyle(document.documentElement);
    const v = (n: string) => css.getPropertyValue(n).trim();
    return {
      s1: v('--color-chart-1'),
      s2: v('--color-chart-2'),
      ok: v('--color-ok-icon'),
      warn: v('--color-warn-icon'),
      unknown: v('--color-unknown-icon'),
      ink: v('--color-ink'),
      muted: v('--color-ink-muted'),
      grid: v('--color-border'),
      surface: v('--color-surface'),
    };
  }, []);
}

const tooltipStyle = (c: ReturnType<typeof useTokens>) => ({
  contentStyle: { borderRadius: 10, border: `1px solid ${c.grid}`, background: c.surface, color: c.ink, fontSize: 13 },
  labelStyle: { color: c.ink, fontWeight: 600 },
  itemStyle: { color: c.ink },
});

/** A figure: title, chart, and a collapsible data table (SPEC §11 accessibility). */
export function ChartFigure({ title, children, table, html = false }: { title: string; children: ReactNode; table: ReactNode; html?: boolean }) {
  const { t } = useTranslation();
  return (
    <figure className="rounded-card border border-border bg-surface p-5 shadow-card">
      <figcaption className="text-section mb-3">{title}</figcaption>
      {/* Recharts lays out in LTR (axes are mirrored for Arabic); HTML charts follow the page direction. */}
      <div dir={html ? undefined : 'ltr'} aria-hidden className="h-64">
        {children}
      </div>
      <details className="mt-3 text-meta">
        <summary className="cursor-pointer text-primary">{t('admin.showTable')}</summary>
        <div className="mt-2 max-h-64 overflow-auto">{table}</div>
      </details>
    </figure>
  );
}

export function SearchesLine({ data }: { data: { date: string; searches: number; failed: number }[] }) {
  const { t } = useTranslation();
  const { lang } = useLang();
  const c = useTokens();
  const reduced = useReducedMotion();
  const rtl = lang === 'ar';
  const day = (d: string) => new Intl.DateTimeFormat(rtl ? 'ar-u-nu-latn' : 'en', { day: 'numeric', month: 'short' }).format(new Date(d));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart accessibilityLayer={false} data={data} margin={{ top: 8, right: 12, left: 12, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis dataKey="date" tickFormatter={day} reversed={rtl} tick={{ fill: c.muted, fontSize: 12 }} stroke={c.grid} minTickGap={24} />
        <YAxis orientation={rtl ? 'right' : 'left'} allowDecimals={false} tick={{ fill: c.muted, fontSize: 12 }} stroke={c.grid} width={36} />
        <Tooltip {...tooltipStyle(c)} labelFormatter={(d) => day(String(d))} />
        <Legend wrapperStyle={{ color: c.ink, fontSize: 13 }} />
        <Line {...motion(reduced)} type="monotone" dataKey="searches" name={t('admin.searches')} stroke={c.s1} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: c.surface, strokeWidth: 2 }} />
        <Line {...motion(reduced)} type="monotone" dataKey="failed" name={t('admin.failed')} stroke={c.s2} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: c.surface, strokeWidth: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function FreshnessStack({ data }: { data: { name: string; fresh: number; stale: number; expired: number }[] }) {
  const { t } = useTranslation();
  const { lang } = useLang();
  const c = useTokens();
  const reduced = useReducedMotion();
  const rtl = lang === 'ar';
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart accessibilityLayer={false} data={data} margin={{ top: 8, right: 12, left: 12, bottom: 0 }} barCategoryGap="30%">
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis dataKey="name" reversed={rtl} tick={{ fill: c.muted, fontSize: 12 }} stroke={c.grid} interval={0} />
        <YAxis orientation={rtl ? 'right' : 'left'} allowDecimals={false} tick={{ fill: c.muted, fontSize: 12 }} stroke={c.grid} width={36} />
        <Tooltip {...tooltipStyle(c)} cursor={{ fill: c.grid, opacity: 0.4 }} />
        <Legend wrapperStyle={{ color: c.ink, fontSize: 13 }} />
        {/* Freshness is a state: status colors, with a legend, and a 2px surface gap between segments. */}
        <Bar {...motion(reduced)} dataKey="fresh" stackId="f" name={t('meds.fresh.fresh')} fill={c.ok} stroke={c.surface} strokeWidth={2} />
        <Bar {...motion(reduced)} dataKey="stale" stackId="f" name={t('meds.fresh.stale')} fill={c.warn} stroke={c.surface} strokeWidth={2} />
        <Bar {...motion(reduced)} dataKey="expired" stackId="f" name={t('meds.fresh.expired')} fill={c.unknown} stroke={c.surface} strokeWidth={2} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Horizontal bars as plain HTML: names sit on the start side and bars grow toward the end in both
 * directions, which an SVG axis cannot do cleanly in RTL. One series, so the title names it.
 */
export function TopUnmetBars({ data }: { data: { name: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <ul className="flex h-full flex-col justify-between gap-1">
      {data.map((d, i) => (
        <li key={d.name} className="grid grid-cols-[minmax(0,10rem)_1fr_2.5rem] items-center gap-2 text-meta" title={`${d.name}: ${d.count}`}>
          <span className="truncate">{d.name}</span>
          <span className="animate-grow h-4 rounded-e-[4px] bg-chart-1" style={{ width: `${(d.count / max) * 100}%`, "--i": i } as CSSProperties} />
          <bdi className="text-end font-medium">{d.count}</bdi>
        </li>
      ))}
    </ul>
  );
}
