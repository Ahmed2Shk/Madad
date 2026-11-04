import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Day, Hours } from '../../lib/hours';

const ORDER: Day[] = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'];

/** Weekly opening-hours editor (A-05 step 2, PH-07). One range per day; empty = closed. */
export function HoursEditor({ value, onChange }: { value: Hours; onChange: (h: Hours) => void }) {
  const { t } = useTranslation();
  const set = (d: Day, range: [string, string] | null) => {
    const next = { ...value };
    if (range) next[d] = [range];
    else delete next[d];
    onChange(next);
  };
  const copyToAll = (d: Day) => {
    const r = value[d]?.[0];
    if (!r) return;
    onChange(Object.fromEntries(ORDER.map((x) => [x, [r]])) as Hours);
  };
  return (
    <fieldset className="space-y-2">
      <legend className="font-medium">{t('hours.title')}</legend>
      {ORDER.map((d) => {
        const r = value[d]?.[0];
        return (
          <div key={d} className="flex flex-wrap items-center gap-2">
            <span className="w-20 text-meta">{t(`days.${d}`)}</span>
            {r ? (
              <>
                <input
                  type="time"
                  aria-label={t('hours.opens', { day: t(`days.${d}`) })}
                  value={r[0]}
                  onChange={(e) => set(d, [e.target.value, r[1]])}
                  className="min-h-10 rounded-control border border-border px-2"
                  dir="ltr"
                />
                <span aria-hidden>–</span>
                <input
                  type="time"
                  aria-label={t('hours.closes', { day: t(`days.${d}`) })}
                  value={r[1] === '24:00' ? '23:59' : r[1]}
                  onChange={(e) => set(d, [r[0], e.target.value])}
                  className="min-h-10 rounded-control border border-border px-2"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => set(d, null)}
                  aria-label={t('hours.markClosed', { day: t(`days.${d}`) })}
                  className="inline-flex size-10 items-center justify-center rounded-control text-ink-muted hover:bg-canvas"
                >
                  <Trash2 aria-hidden className="size-4" />
                </button>
                <button type="button" onClick={() => copyToAll(d)} className="text-meta text-primary hover:underline">
                  {t('hours.copyAll')}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => set(d, ['08:00', '20:00'])}
                className="inline-flex min-h-10 items-center gap-1 rounded-control border border-dashed border-border px-3 text-meta text-ink-muted hover:bg-canvas"
              >
                <Plus aria-hidden className="size-4" />
                {t('hours.closed')} · {t('hours.addRange')}
              </button>
            )}
          </div>
        );
      })}
    </fieldset>
  );
}
