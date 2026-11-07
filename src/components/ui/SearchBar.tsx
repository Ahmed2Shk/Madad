import { Barcode, Search } from 'lucide-react';
import { lazy, Suspense, useId, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { GovFilter } from '../../data';
import { useCatalog } from '../../data/queries';
import { useLang } from '../../hooks/useLang';
import { usePreferences } from '../../hooks/usePreferences';
import { cn } from '../../lib/cn';
import { closeMatches, matchCatalog } from '../../lib/search';
import { Button } from './Button';
import { GovernorateSelect } from './GovernorateSelect';
import { searchUrl } from './searchUrl';

const BarcodeScanner = lazy(() => import('./BarcodeScanner'));

/**
 * Field + instant suggestions + barcode + governorate (SPEC §5). Suggestions come from the local
 * catalog only: typing sends nothing anywhere and logs nothing (SPEC §7).
 */
export function SearchBar({
  variant = 'compact',
  initialQuery = '',
  initialGov,
}: {
  variant?: 'hero' | 'compact';
  initialQuery?: string;
  initialGov?: GovFilter;
}) {
  const { t } = useTranslation();
  const { pick, strength } = useLang();
  const navigate = useNavigate();
  const [prefs, setPrefs] = usePreferences();
  const { data: catalog } = useCatalog();
  const [q, setQ] = useState(initialQuery);
  const [gov, setGov] = useState<GovFilter>(initialGov ?? prefs.gov);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [scanning, setScanning] = useState(false);
  const ids = { input: useId(), list: useId(), avail: useId() };

  // Direct matches first; with none, «هل تقصد؟» close names to choose from (never swapped in by themselves).
  const { suggestions, fuzzy } = useMemo(() => {
    if (!catalog || q.trim().length < 2) return { suggestions: [], fuzzy: false };
    const direct = matchCatalog(catalog.medicines, q, 6);
    return direct.length ? { suggestions: direct, fuzzy: false } : { suggestions: closeMatches(catalog.medicines, q, 3), fuzzy: true };
  }, [catalog, q]);
  const showList = open && suggestions.length > 0;

  const chooseGov = (g: GovFilter) => {
    setGov(g);
    if (g !== 'all') setPrefs({ gov: g });
  };

  const submit = (query = q) => {
    const text = query.trim();
    if (!text) return;
    setOpen(false);
    navigate(searchUrl(text, gov, prefs.availableOnly));
  };

  const pickSuggestion = (i: number) => {
    const m = suggestions[i];
    if (!m) return;
    setOpen(false);
    setQ(pick(m));
    // Picking a suggestion counts as a search; the medicine page logs it once (SPEC §7).
    navigate(`/medicine/${m.id}?gov=${gov}`, { state: { logQuery: pick(m) } });
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && suggestions.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp' && suggestions.length) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter' && showList && active >= 0) {
      e.preventDefault();
      pickSuggestion(active);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit();
  };

  const hero = variant === 'hero';

  return (
    <form
      role="search"
      onSubmit={onSubmit}
      className={cn(
        'flex flex-col gap-3',
        hero ? 'rounded-card bg-surface p-4 shadow-dialog lg:flex-row lg:items-end lg:p-5' : 'md:flex-row md:items-end',
      )}
    >
      <div className="relative flex-1">
        <label htmlFor={ids.input} className={cn('text-meta font-medium', !hero && 'sr-only')}>
          {t('search.fieldLabel')}
        </label>
        <div className="relative mt-1">
          <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-ink-muted" />
          <input
            id={ids.input}
            type="search"
            role="combobox"
            aria-expanded={showList}
            aria-controls={ids.list}
            aria-autocomplete="list"
            aria-activedescendant={showList && active >= 0 ? `${ids.list}-${active}` : undefined}
            autoComplete="off"
            enterKeyHint="search"
            value={q}
            placeholder={t('search.placeholder')}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
              setActive(-1);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={onKey}
            className="min-h-12 w-full rounded-control border border-border bg-surface ps-10 pe-12 text-ink placeholder:text-ink-muted"
          />
          <button
            type="button"
            onClick={() => setScanning(true)}
            aria-label={t('barcode.open')}
            className="absolute end-1 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-control text-primary hover:bg-mint"
          >
            <Barcode aria-hidden className="size-5" />
          </button>
        </div>
        {showList && (
          <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-card border border-border bg-surface shadow-dialog">
          {fuzzy && <p className="px-4 pt-2.5 text-meta font-medium text-ink-muted">{t('search.didYouMean')}</p>}
          <ul id={ids.list} role="listbox" aria-label={fuzzy ? t('search.didYouMean') : t('search.suggestions')}>
            {suggestions.map((m, i) => (
              <li
                key={m.id}
                id={`${ids.list}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickSuggestion(i)}
                className={cn('cursor-pointer px-4 py-2.5', i === active ? 'bg-mint' : 'hover:bg-canvas')}
              >
                <span className="font-medium">{pick(m)}</span>
                <span className="ms-2 text-meta text-ink-muted">
                  <bdi dir="ltr">{m.genericName}</bdi>
                  {m.strength && <> · {strength(m)}</>}
                </span>
              </li>
            ))}
          </ul>
          </div>
        )}
      </div>

      <GovernorateSelect value={gov} onChange={chooseGov} hideLabel={!hero} className={hero ? 'lg:w-52' : 'md:w-52'} />

      {hero && (
        <label htmlFor={ids.avail} className="flex min-h-11 items-center gap-2 font-medium lg:pb-0.5">
          <input
            id={ids.avail}
            type="checkbox"
            checked={prefs.availableOnly}
            onChange={(e) => setPrefs({ availableOnly: e.target.checked })}
            className="size-5 accent-primary"
          />
          {t('filters.availableOnly')}
        </label>
      )}

      <Button type="submit" className={hero ? 'lg:min-w-32' : undefined}>
        <Search aria-hidden className="size-4" />
        {t('search.submit')}
      </Button>

      {scanning && (
        <Suspense fallback={null}>
          <BarcodeScanner
            onClose={() => setScanning(false)}
            onDetected={(code) => {
              setScanning(false);
              setQ(code);
              submit(code);
            }}
          />
        </Suspense>
      )}
    </form>
  );
}
