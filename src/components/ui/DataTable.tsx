import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLang } from '../../hooks/useLang';
import { cn } from '../../lib/cn';
import { normalizeArabic } from '../../lib/normalizeArabic';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Present = sortable. */
  sortValue?: (row: T) => string | number;
  /** Hidden in the narrow card view when it repeats the card title. */
  hideInCard?: boolean;
}

/**
 * Sort, search and pagination; below 768px every row becomes a card (SPEC §5 DataTable).
 * Rows are 38px high on desktop (SPEC §5).
 */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  searchText,
  pageSize = 15,
  caption,
  cardTitle,
  empty,
  toolbar,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  searchText?: (row: T) => string;
  pageSize?: number;
  caption: string;
  cardTitle?: (row: T) => ReactNode;
  empty?: ReactNode;
  toolbar?: ReactNode;
}) {
  const { t } = useTranslation();
  const { lang } = useLang();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);

  const shown = useMemo(() => {
    const nq = normalizeArabic(q);
    let list = nq && searchText ? rows.filter((r) => normalizeArabic(searchText(r)).includes(nq)) : rows;
    const col = sort && columns.find((c) => c.key === sort.key);
    if (col?.sortValue) {
      const v = col.sortValue;
      list = [...list].sort((a, b) => {
        const x = v(a);
        const y = v(b);
        return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), lang)) * sort!.dir;
      });
    }
    return list;
  }, [rows, q, sort, columns, searchText, lang]);

  const pages = Math.max(1, Math.ceil(shown.length / pageSize));
  const current = Math.min(page, pages - 1);
  const slice = shown.slice(current * pageSize, (current + 1) * pageSize);
  const Prev = lang === 'ar' ? ChevronRight : ChevronLeft;
  const Next = lang === 'ar' ? ChevronLeft : ChevronRight;

  const toggleSort = (key: string) =>
    setSort((s) => (s?.key === key ? (s.dir === 1 ? { key, dir: -1 } : null) : { key, dir: 1 }));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {searchText && (
          <div className="relative w-full max-w-sm">
            <label className="sr-only" htmlFor={`dt-${caption}`}>
              {t('table.search')}
            </label>
            <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-ink-muted" />
            <input
              id={`dt-${caption}`}
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
              placeholder={t('table.search')}
              className="min-h-11 w-full rounded-control border border-border bg-surface ps-10 pe-3"
            />
          </div>
        )}
        {toolbar}
      </div>

      {shown.length === 0 ? (
        empty
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-card border border-border bg-surface md:block">
            <table className="w-full text-meta">
              <caption className="sr-only">{caption}</caption>
              <thead className="bg-canvas text-ink-muted">
                <tr>
                  {columns.map((c) => {
                    const dir = sort?.key === c.key ? sort.dir : 0;
                    const Icon = dir === 1 ? ArrowUp : dir === -1 ? ArrowDown : ArrowUpDown;
                    return (
                      <th
                        key={c.key}
                        scope="col"
                        aria-sort={dir === 1 ? 'ascending' : dir === -1 ? 'descending' : c.sortValue ? 'none' : undefined}
                        className="px-3 py-2 text-start font-medium whitespace-nowrap"
                      >
                        {c.sortValue ? (
                          <button type="button" onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 hover:text-ink">
                            {c.header}
                            <Icon aria-hidden className="size-3.5" />
                          </button>
                        ) : (
                          c.header
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {slice.map((r) => (
                  <tr key={rowKey(r)} className="h-[38px] hover:bg-canvas">
                    {columns.map((c) => (
                      <td key={c.key} className="px-3 py-2 align-middle">
                        {c.cell(r)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 md:hidden" aria-label={caption}>
            {slice.map((r) => (
              <li key={rowKey(r)} className="rounded-card border border-border bg-surface p-4 shadow-card">
                {cardTitle && <div className="mb-2 font-semibold">{cardTitle(r)}</div>}
                <dl className="space-y-1.5 text-meta">
                  {columns
                    .filter((c) => !c.hideInCard)
                    .map((c) => (
                      <div key={c.key} className="flex items-start justify-between gap-3">
                        <dt className="text-ink-muted">{c.header}</dt>
                        <dd className="text-end">{c.cell(r)}</dd>
                      </div>
                    ))}
                </dl>
              </li>
            ))}
          </ul>

          {pages > 1 && (
            <nav aria-label={t('table.pages')} className="flex items-center justify-between gap-3 text-meta">
              <span className="text-ink-muted">{t('table.pageOf', { page: current + 1, pages })}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={current === 0}
                  onClick={() => setPage(current - 1)}
                  className={cn('inline-flex min-h-10 items-center gap-1 rounded-control border border-border px-3', 'disabled:opacity-50')}
                >
                  <Prev aria-hidden className="size-4" />
                  {t('table.prev')}
                </button>
                <button
                  type="button"
                  disabled={current >= pages - 1}
                  onClick={() => setPage(current + 1)}
                  className="inline-flex min-h-10 items-center gap-1 rounded-control border border-border px-3 disabled:opacity-50"
                >
                  {t('table.next')}
                  <Next aria-hidden className="size-4" />
                </button>
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
