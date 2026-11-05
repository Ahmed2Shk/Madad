// P-07 الدليل الطبي — hospitals, medical points and humanitarian organizations, with what they say
// they offer. Information about services and programmes, never about medicine stock.
import { BadgeCheck, Building2, HeartHandshake, Hospital, MapPin, Stethoscope } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { CardSkeleton, EmptyState, ErrorBanner, FilterChips, Freshness, GovernorateSelect, SavedBadge, Tabs, useAreaLabel } from '../../components/ui';
import { governorateById, SERVICE_CATEGORIES, type DirectoryEntry, type GovFilter, type ProviderType } from '../../data';
import { useDirectory } from '../../data/providerQueries';
import { useLang } from '../../hooks/useLang';
import { useNow } from '../../hooks/useNow';
import { usePreferences } from '../../hooks/usePreferences';
import { isOpenNow } from '../../lib/hours';
import { OpenNowBadge } from '../pharmacy-public/HoursList';

const TYPES: (ProviderType | 'all')[] = ['all', 'hospital', 'medical_point', 'humanitarian'];
const typeIcon = { hospital: Hospital, medical_point: Stethoscope, humanitarian: HeartHandshake } as const;

export default function DirectoryPage() {
  const { t } = useTranslation();
  const { pick } = useLang();
  const now = useNow();
  const area = useAreaLabel();
  const [params, setParams] = useSearchParams();
  const [prefs, setPrefs] = usePreferences();
  const type = (TYPES.find((x) => x === params.get('type')) ?? 'all') as ProviderType | 'all';
  const gov = (params.get('gov') ?? prefs.gov) as GovFilter;
  const [areaId, setAreaId] = useState('all');
  const [category, setCategory] = useState('all');
  const [openNow, setOpenNow] = useState(false);
  const [activeOnly, setActiveOnly] = useState(false);
  const directory = useDirectory(type, gov);
  const set = (k: string, v: string) => setParams((p) => (p.set(k, v), p), { replace: true });

  const areas = gov !== 'all' ? (governorateById(gov)?.areas ?? []) : [];
  const list = useMemo(
    () =>
      (directory.data ?? []).filter(
        (p: DirectoryEntry) =>
          (areaId === 'all' || p.area === areaId) &&
          (category === 'all' || p.categories.includes(category as DirectoryEntry['categories'][number])) &&
          (!openNow || isOpenNow(p.hours, now) === true) &&
          (!activeOnly || p.activePrograms > 0),
      ),
    [directory.data, areaId, category, openNow, activeOnly, now],
  );

  return (
    <div className="space-y-5">
      <h1 className="text-page">{t('dir.title')}</h1>
      <p className="text-ink-muted">{t('dir.lead')}</p>

      <Tabs
        label={t('dir.title')}
        active={type}
        onChange={(id) => set('type', id)}
        tabs={TYPES.map((id) => ({ id, label: t(`dir.tabs.${id}`) }))}
      >
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <GovernorateSelect
              value={gov}
              onChange={(g) => {
                set('gov', g);
                setAreaId('all');
                if (g !== 'all') setPrefs({ gov: g });
              }}
            />
            <label className="block">
              <span className="text-meta font-medium">{t('dir.filters.area')}</span>
              <select value={areaId} disabled={!areas.length} onChange={(e) => setAreaId(e.target.value)} className="mt-1 min-h-11 w-full rounded-control border border-border bg-surface px-3 disabled:opacity-50">
                <option value="all">{t('dir.filters.allAreas')}</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {pick(a)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-meta font-medium">{t('dir.filters.category')}</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 min-h-11 w-full rounded-control border border-border bg-surface px-3">
                <option value="all">{t('dir.filters.allCategories')}</option>
                {SERVICE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(`serviceCategory.${c}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <FilterChips
            label={t('filters.label')}
            onToggle={(id) => (id === 'open' ? setOpenNow((v) => !v) : setActiveOnly((v) => !v))}
            chips={[
              { id: 'open', label: t('dir.filters.openNow'), on: openNow },
              { id: 'active', label: t('dir.filters.activePrograms'), on: activeOnly },
            ]}
          />
          <SavedBadge updatedAt={directory.dataUpdatedAt} />

          {directory.isError && <ErrorBanner onRetry={() => void directory.refetch()} hasCached={!!directory.data} />}
          {directory.isPending ? (
            <div className="grid gap-3 md:grid-cols-2">
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : list.length === 0 ? (
            <EmptyState icon={Building2} title={t('dir.emptyTitle')} body={t('dir.emptyBody')} />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {list.map((p) => {
                const Icon = typeIcon[p.type];
                return (
                  <li key={p.id}>
                    <Link to={`/org/${p.id}`} className="block h-full space-y-2 rounded-card border border-border bg-surface p-4 shadow-card hover:border-secondary">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Icon aria-hidden className="size-5 text-secondary" />
                        <h2 className="text-section">{pick(p)}</h2>
                        <span className="inline-flex items-center gap-1 text-meta text-ok-text">
                          <BadgeCheck aria-hidden className="size-4 text-ok-icon" />
                          {t('dir.verified')}
                        </span>
                        <OpenNowBadge open={isOpenNow(p.hours, now)} />
                      </div>
                      <p className="flex items-center gap-1 text-meta text-ink-muted">
                        <MapPin aria-hidden className="size-4" />
                        {t(`orgTypes.${p.type}`)} · {area(p)}
                      </p>
                      {p.description && <p className="line-clamp-1 text-meta">{p.description}</p>}
                      {p.topServices.length > 0 && (
                        <ul className="flex flex-wrap gap-1.5">
                          {p.topServices.map((s) => (
                            <li key={s} className="rounded-full bg-canvas px-2 py-0.5 text-micro">
                              {s}
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="text-micro text-ink-muted">
                        {p.activePrograms > 0 && <>{t('dir.activeCount', { count: p.activePrograms })} · </>}
                        {t('dir.updated')} <Freshness at={p.updatedAt} />
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Tabs>
    </div>
  );
}
