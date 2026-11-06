// PH-07 ملف الصيدلية والمعاينة العامة — editing the name or licence sends the pharmacy back to review.
import { Eye, MapPin, TriangleAlert } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  CardSkeleton,
  ConfirmDialog,
  Dialog,
  ErrorBanner,
  Field,
  GovernorateSelect,
  HoursEditor,
  Skeleton,
  inputClass,
  useToast,
} from '../../components/ui';
import { governorateById, type OrgProfile } from '../../data';
import { useOrgProfile, useUpdateOrgProfile } from '../../data/portalQueries';
import { useLang } from '../../hooks/useLang';
import { cn } from '../../lib/cn';
import { profileCompleteness } from '../../lib/completeness';
import { usePharmacyCtx } from './context';
import { SignInPromptProvider } from '../account/SignInPrompt';

// The public page itself, loaded only when the preview opens.
const PharmacyPage = lazy(() => import('../pharmacy-public/PharmacyPage'));

const MapPicker = lazy(() => import('../../components/ui/MapPicker'));

export default function ProfilePage() {
  const { orgId } = usePharmacyCtx();
  const profile = useOrgProfile(orgId);
  if (profile.isPending) return <CardSkeleton />;
  if (profile.isError || !profile.data) return <ErrorBanner onRetry={() => void profile.refetch()} />;
  // Remount on fresh server data so the form starts from what was saved.
  return <ProfileForm key={profile.dataUpdatedAt} initial={profile.data} />;
}

function ProfileForm({ initial }: { initial: OrgProfile }) {
  const { t } = useTranslation();
  const { pick } = useLang();
  const toast = useToast();
  const { orgId, can } = usePharmacyCtx();
  const update = useUpdateOrgProfile(orgId);
  const [p, setP] = useState(initial);
  const [preview, setPreview] = useState(() => typeof window !== 'undefined' && window.location.hash === '#preview');
  const [confirmIdentity, setConfirmIdentity] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const editable = can('profile');
  const set = (patch: Partial<OrgProfile>) => setP((x) => ({ ...x, ...patch }));
  const gov = governorateById(p.governorate);
  const { percent, missing } = profileCompleteness(p);
  const identityChanged = p.nameAr !== initial.nameAr || p.nameEn !== initial.nameEn || p.licenseNo !== initial.licenseNo;
  const dirty = JSON.stringify(p) !== JSON.stringify(initial);

  const save = async () => {
    const { id: _id, type: _type, verificationStatus: _v, ...patch } = p;
    const { reReview } = await update.mutateAsync(patch);
    setConfirmIdentity(false);
    toast(reReview ? t('profile.savedReReview') : t('profile.saved'));
  };

  return (
    <div className="space-y-5 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-page">{t('portal.pharmacy.nav.profile')}</h1>
        <Button variant="secondary" onClick={() => setPreview(true)}>
          <Eye aria-hidden className="size-4" />
          {t('dashboard.previewAsPatient')}
        </Button>
      </div>

      <section className="rounded-card border border-border bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-section">{t('profile.completeness', { percent })}</h2>
          <span className="text-meta text-ink-muted">
            <bdi>{percent}%</bdi>
          </span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-unknown-bg" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={t('profile.completenessLabel')}>
          <div className="h-2 rounded-full bg-primary" style={{ width: `${percent}%` }} />
        </div>
        {missing.length > 0 && <p className="mt-2 text-meta text-ink-muted">{t('profile.missing', { fields: missing.map((m) => t(`profile.fields.${m}`)).join('، ') })}</p>}
      </section>

      <fieldset disabled={!editable} className="space-y-5">
        <section className="grid gap-4 rounded-card border border-border bg-surface p-5 md:grid-cols-2">
          <h2 className="text-section md:col-span-2">{t('profile.identity')}</h2>
          <Field label={t('register.nameAr')}>
            <input className={inputClass} value={p.nameAr} onChange={(e) => set({ nameAr: e.target.value })} />
          </Field>
          <Field label={t('register.nameEn')} optional>
            <input dir="ltr" className={inputClass} value={p.nameEn} onChange={(e) => set({ nameEn: e.target.value })} />
          </Field>
          <Field label={t('register.licenseNo')}>
            <input dir="ltr" className={inputClass} value={p.licenseNo} onChange={(e) => set({ licenseNo: e.target.value })} />
          </Field>
          {identityChanged && (
            <p className="flex items-center gap-2 self-end rounded-card bg-warn-bg p-3 text-meta text-warn-text">
              <TriangleAlert aria-hidden className="size-4 shrink-0 text-warn-icon" />
              {t('profile.identityWarning')}
            </p>
          )}
        </section>

        <section className="grid gap-4 rounded-card border border-border bg-surface p-5 md:grid-cols-2">
          <h2 className="text-section md:col-span-2">{t('profile.location')}</h2>
          <GovernorateSelect value={p.governorate} allowAll={false} onChange={(g) => set({ governorate: g, area: 'center' })} />
          <Field label={t('register.area')}>
            <select className={inputClass} value={p.area} onChange={(e) => set({ area: e.target.value })}>
              {gov?.areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {pick(a)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('register.address')} className="md:col-span-2">
            <input className={inputClass} value={p.addressText} onChange={(e) => set({ addressText: e.target.value })} />
          </Field>
          <Field label={t('register.landmark')} optional className="md:col-span-2">
            <input className={inputClass} value={p.landmark ?? ''} onChange={(e) => set({ landmark: e.target.value || null })} />
          </Field>
          <div className="space-y-2 md:col-span-2">
            {showMap && gov ? (
              <Suspense fallback={<Skeleton className="h-64" />}>
                <MapPicker
                  center={gov.center}
                  value={p.exactLat != null && p.exactLng != null ? { lat: p.exactLat, lng: p.exactLng } : null}
                  onChange={(pt) => set({ exactLat: pt.lat, exactLng: pt.lng })}
                  label={t('register.mapLabel')}
                />
              </Suspense>
            ) : (
              <Button variant="secondary" onClick={() => setShowMap(true)}>
                <MapPin aria-hidden className="size-4" />
                {t('register.openMap')}
              </Button>
            )}
          </div>
          <fieldset className="space-y-2 md:col-span-2">
            <legend className="font-medium">{t('register.precision')}</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {(['exact', 'area', 'hidden'] as const).map((v) => (
                <label key={v} className={cn('flex min-h-11 items-start gap-2 rounded-control border p-3', p.locationPrecision === v ? 'border-primary bg-mint' : 'border-border')}>
                  <input type="radio" name="precision" checked={p.locationPrecision === v} onChange={() => set({ locationPrecision: v })} className="mt-1 size-4 accent-primary" />
                  <span>
                    <span className="block font-medium">{t(`register.precisionOpt.${v}`)}</span>
                    <span className="block text-meta text-ink-muted">{t(`register.precisionDesc.${v}`)}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        <section className="grid gap-4 rounded-card border border-border bg-surface p-5 md:grid-cols-2">
          <h2 className="text-section md:col-span-2">{t('profile.contact')}</h2>
          <Field label={t('register.orgPhone')}>
            <input type="tel" dir="ltr" className={inputClass} value={p.phone} onChange={(e) => set({ phone: e.target.value })} />
          </Field>
          <Field label={t('actions.whatsapp')} optional>
            <input type="tel" dir="ltr" className={inputClass} value={p.whatsapp ?? ''} onChange={(e) => set({ whatsapp: e.target.value || null })} />
          </Field>
        </section>

        <section className="space-y-4 rounded-card border border-border bg-surface p-5">
          <HoursEditor value={p.hours} onChange={(hours) => set({ hours })} />
          <label className="flex min-h-11 items-center gap-2 font-medium">
            <input
              type="checkbox"
              checked={!!p.temporarilyClosed}
              onChange={(e) => set({ temporarilyClosed: e.target.checked ? { reason: null } : null })}
              className="size-4 accent-primary"
            />
            {t('profile.temporarilyClosed')}
          </label>
          {p.temporarilyClosed && (
            <Field label={t('profile.closedReason')} optional>
              <input className={inputClass} value={p.temporarilyClosed.reason ?? ''} onChange={(e) => set({ temporarilyClosed: { reason: e.target.value || null } })} />
            </Field>
          )}
        </section>
      </fieldset>

      {editable && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 backdrop-blur lg:start-64">
          <div className="mx-auto flex max-w-content items-center justify-end gap-3 px-4 py-3 lg:px-6">
            <Button variant="ghost" disabled={!dirty} onClick={() => setP(initial)}>
              {t('common.cancel')}
            </Button>
            <Button disabled={!dirty} loading={update.isPending} onClick={() => (identityChanged && initial.verificationStatus === 'approved' ? setConfirmIdentity(true) : void save())}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmIdentity}
        onClose={() => setConfirmIdentity(false)}
        title={t('profile.reReviewTitle')}
        body={t('profile.reReviewBody')}
        confirmLabel={t('profile.reReviewConfirm')}
        loading={update.isPending}
        onConfirm={() => void save()}
      />

      <Dialog open={preview} onClose={() => setPreview(false)} title={t('dashboard.previewAsPatient')} side size="lg">
        <SignInPromptProvider>
          <Suspense fallback={<CardSkeleton />}>
            <PharmacyPage previewId={orgId} />
          </Suspense>
        </SignInPromptProvider>
      </Dialog>
    </div>
  );
}
