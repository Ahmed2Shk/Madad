// P-10 المفضلة — every saved item shows its current state and time.
import { Building2, Heart, Pill, Store } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { AvailabilityStatus, CardSkeleton, EmptyState, Freshness, Tabs, buttonClass, useAreaLabel } from '../../components/ui';
import type { Favorite, FavoriteType } from '../../data';
import { useCatalog, useFavorites, useFreshnessSettings, usePharmacies, usePharmaciesFor } from '../../data/queries';
import { useProvider } from '../../data/providerQueries';
import { useLang } from '../../hooks/useLang';
import { useNow } from '../../hooks/useNow';
import { usePreferences } from '../../hooks/usePreferences';
import { sortRanked, viewRow } from '../../lib/availability';
import { SignedInOnly } from './SignedInOnly';

function MedicineFavorite({ id }: { id: string }) {
  const { t } = useTranslation();
  const { pick } = useLang();
  const [prefs] = usePreferences();
  const now = useNow();
  const settings = useFreshnessSettings();
  const catalog = useCatalog();
  const rows = usePharmaciesFor(id, prefs.gov);
  const best = useMemo(
    () => sortRanked((rows.data ?? []).map((row) => ({ row, view: viewRow(row, now, settings), distanceKm: null })))[0],
    [rows.data, now, settings],
  );
  const m = catalog.data?.medicines.find((x) => x.id === id);
  return (
    <Link to={`/medicine/${id}?gov=${prefs.gov}`} className="flex items-center gap-4 rounded-card border border-border bg-surface p-4 hover:border-secondary">
      <Pill aria-hidden className="size-6 shrink-0 text-secondary" />
      <div className="flex-1">
        <p className="font-semibold">{pick(m)}</p>
        {best ? <AvailabilityStatus row={best.row} view={best.view} /> : <p className="text-meta text-ink-muted">{t('search.noRecentReports')}</p>}
      </div>
    </Link>
  );
}

function PharmacyFavorite({ id }: { id: string }) {
  const { t } = useTranslation();
  const { pick } = useLang();
  const area = useAreaLabel();
  const pharmacies = usePharmacies('all');
  const p = pharmacies.data?.find((x) => x.id === id);
  if (!p) return null;
  return (
    <Link to={`/pharmacy/${id}`} className="flex items-center gap-4 rounded-card border border-border bg-surface p-4 hover:border-secondary">
      <Store aria-hidden className="size-6 shrink-0 text-secondary" />
      <div className="flex-1">
        <p className="font-semibold">{pick(p)}</p>
        <p className="text-meta text-ink-muted">{area(p)}</p>
        <p className="text-meta">
          <span className="text-ink-muted">{t('pharmacies.lastStockUpdate')} </span>
          {p.lastStockUpdateAt ? <Freshness at={p.lastStockUpdateAt} /> : t('pharmacies.never')}
        </p>
      </div>
    </Link>
  );
}

function ProviderFavorite({ id }: { id: string }) {
  const { t } = useTranslation();
  const { pick } = useLang();
  const area = useAreaLabel();
  const p = useProvider(id);
  if (p.isPending) return <CardSkeleton />;
  if (!p.data) return null;
  return (
    <Link to={`/org/${id}`} className="flex items-center gap-4 rounded-card border border-border bg-surface p-4 hover:border-secondary">
      <Building2 aria-hidden className="size-6 shrink-0 text-secondary" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{pick(p.data)}</p>
        <p className="text-meta text-ink-muted">
          {t(`orgTypes.${p.data.type}`)} · {area(p.data)}
        </p>
        <p className="text-micro text-ink-muted">
          {t('pharmacy.infoUpdated')} <Freshness at={p.data.infoUpdatedAt} />
        </p>
      </div>
    </Link>
  );
}

function List({ items, type }: { items: Favorite[]; type: FavoriteType }) {
  const { t } = useTranslation();
  const mine = items.filter((f) => f.entityType === type);
  if (mine.length === 0)
    return (
      <EmptyState
        icon={Heart}
        title={t('favorites.emptyTitle')}
        body={type === 'provider' ? t('favorites.providersEmpty') : t('favorites.emptyBody')}
        actions={
          <Link to={type === 'provider' ? '/directory' : '/'} className={buttonClass('primary')}>
            {type === 'provider' ? t('dir.title') : t('search.submit')}
          </Link>
        }
      />
    );
  return (
    <ul className="space-y-3">
      {mine.map((f) => (
        <li key={f.entityId}>{type === 'medicine' ? <MedicineFavorite id={f.entityId} /> : type === 'provider' ? <ProviderFavorite id={f.entityId} /> : <PharmacyFavorite id={f.entityId} />}</li>
      ))}
    </ul>
  );
}

function Favorites() {
  const { t } = useTranslation();
  const favorites = useFavorites();
  const [tab, setTab] = useState<FavoriteType>('medicine');
  const items = favorites.data ?? [];
  const count = (type: FavoriteType) => items.filter((f) => f.entityType === type).length;
  return (
    <div className="space-y-4">
      <h1 className="text-page">{t('favorites.title')}</h1>
      <Tabs
        label={t('favorites.title')}
        active={tab}
        onChange={(id) => setTab(id as FavoriteType)}
        tabs={[
          { id: 'medicine', label: t('favorites.medicines'), count: count('medicine') },
          { id: 'pharmacy', label: t('favorites.pharmacies'), count: count('pharmacy') },
          { id: 'provider', label: t('favorites.providers'), count: count('provider') },
        ]}
      >
        {favorites.isPending ? <CardSkeleton /> : <List items={items} type={tab} />}
      </Tabs>
    </div>
  );
}

export default function FavoritesPage() {
  return (
    <SignedInOnly>
      <Favorites />
    </SignedInOnly>
  );
}
