import { List, Map as MapIcon, WifiOff } from 'lucide-react';
import { lazy, Suspense, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { useDataSaver } from '../../hooks/usePreferences';
import { useOnline } from '../../hooks/useOnline';
import { cn } from '../../lib/cn';
import { Skeleton } from './Skeleton';

const MapView = lazy(() => import('./MapView'));

/** The map chunk loads on demand only; off in data-saver mode and offline (tiles are never cached). */
export function LazyMap(props: ComponentProps<typeof MapView>) {
  const { t } = useTranslation();
  const saver = useDataSaver();
  const online = useOnline();
  if (saver || !online) {
    return (
      <p className="flex items-center gap-2 rounded-card border border-border bg-surface p-4 text-ink-muted">
        <WifiOff aria-hidden className="size-5" />
        {saver ? t('map.dataSaver') : t('map.offline')}
      </p>
    );
  }
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <MapView {...props} />
    </Suspense>
  );
}

export type ListOrMap = 'list' | 'map';

/** Segmented "قائمة | خريطة" toggle. */
export function ViewToggle({ value, onChange }: { value: ListOrMap; onChange: (v: ListOrMap) => void }) {
  const { t } = useTranslation();
  const opts = [
    { id: 'list' as const, label: t('map.list'), Icon: List },
    { id: 'map' as const, label: t('map.map'), Icon: MapIcon },
  ];
  return (
    <div role="group" aria-label={t('map.toggle')} className="inline-flex rounded-control border border-border bg-surface p-0.5">
      {opts.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className={cn(
            'inline-flex min-h-10 items-center gap-1.5 rounded-[8px] px-3 font-medium',
            value === id ? 'bg-primary text-white' : 'text-ink hover:bg-canvas',
          )}
        >
          <Icon aria-hidden className="size-4" />
          {label}
        </button>
      ))}
    </div>
  );
}
