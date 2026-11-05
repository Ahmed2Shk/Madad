// PR-02 الملف التعريفي — name, type, registration number, contact person, contact details, main location
// and its precision, extra locations, hours, description and website. Changing the name or the
// registration number sends the organization back to review, as for pharmacies (PH-07).
import { MapPin, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, CardSkeleton, ConfirmDialog, ErrorBanner, Field, GovernorateSelect, HoursEditor, inputClass, useToast } from '../../components/ui';
import { governorateById, type LocationPrecision, type ProviderProfile } from '../../data';
import { useProviderProfile, useUpdateProviderProfile } from '../../data/providerQueries';
import { useLang } from '../../hooks/useLang';
import { profileCompleteness } from '../../lib/completeness';
import { usePharmacyCtx } from '../pharmacy-portal/context';

const PRECISIONS: LocationPrecision[] = ['exact', 'area', 'hidden'];

export default function ProviderProfilePage() {
  const { orgId } = usePharmacyCtx();
  const profile = useProviderProfile(orgId);
  if (profile.isPending) return <CardSkeleton />;
  if (profile.isError || !profile.data) return <ErrorBanner onRetry={() => void profile.refetch()} />;
  // Keyed by load time so a saved profile restarts the form from the server's copy.
  return <Form key={profile.dataUpdatedAt} initial={profile.data} />;
}

function Form({ initial }: { initial: ProviderProfile }) {
  const { t } = useTranslation();
  const { pick } = useLang();
  const toast = useToast();
  const { orgId, can } = usePharmacyCtx();
  const update = useUpdateProviderProfile(orgId);
  const [p, setP] = useState(initial);
  const [confirming, setConfirming] = useState(false);
  const set = (patch: Partial<ProviderProfile>) => setP((x) => ({ ...x, ...patch }));
  const gov = governorateById(p.governorate);
  const { percent } = profileCompleteness(p);
  const identityChanged = p.nameAr !== initial.nameAr || p.nameEn !== initial.nameEn || p.licenseNo !== initial.licenseNo;
  const dirty = JSON.stringify(p) !== JSON.stringify(initial);
  const websiteBad = !!p.website && !/^https?:\/\//i.test(p.website);

  const save = async () => {
    const { id: _id, type: _type, verificationStatus: _v, ...patch } = p;
    const { reReview } = await update.mutateAsync(patch);
    setConfirming(false);
    toast(reReview ? t('profile.savedReReview') : t('profile.saved'));
  };

  return (
    <div className="space-y-5 pb-20">
      <h1 className="text-page">{t('portal.provider.nav.profile')}</h1>
      <section className="rounded-card border border-border bg-surface p-5">
        <h2 className="text-section">{t('profile.completeness', { percent })}</h2>
        <div className="mt-2 h-2 rounded-full bg-unknown-bg" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={t('profile.completenessLabel')}>
          <div className="h-2 rounded-full bg-primary" style={{ width: `${percent}%` }} />
        </div>
      </section>

      <fieldset disabled={!can('profile')} className="space-y-5">
        <section className="grid gap-4 rounded-card border border-border bg-surface p-5 md:grid-cols-2">
          <h2 className="text-section md:col-span-2">{t('profile.identity')}</h2>
          <Field label={t('register.nameAr')}>
            <input className={inputClass} value={p.nameAr} onChange={(e) => set({ nameAr: e.target.value })} />
          </Field>
          <Field label={t('register.nameEn')} optional>
            <input dir="ltr" className={inputClass} value={p.nameEn} onChange={(e) => set({ nameEn: e.target.value })} />
          </Field>
          <Field label={t('provider.type')}>
            <input className={inputClass} value={t(`orgTypes.${p.type}`)} readOnly />
          </Field>
          <Field label={t('provider.registrationNo')}>
            <input dir="ltr" className={inputClass} value={p.licenseNo} onChange={(e) => set({ licenseNo: e.target.value })} />
          </Field>
          {identityChanged && (
            <p className="flex items-center gap-2 rounded-card bg-warn-bg p-3 text-meta text-warn-text md:col-span-2">
              <TriangleAlert aria-hidden className="size-4 shrink-0 text-warn-icon" />
              {t('profile.identityWarning')}
            </p>
          )}
          <Field label={t('provider.description')} optional className="md:col-span-2">
            <textarea rows={3} maxLength={600} className={`${inputClass} py-2`} value={p.description ?? ''} onChange={(e) => set({ description: e.target.value || null })} />
          </Field>
        </section>

        <section className="grid gap-4 rounded-card border border-border bg-surface p-5 md:grid-cols-2">
          <h2 className="text-section md:col-span-2">{t('profile.contact')}</h2>
          <Field label={t('provider.contactPerson')}>
            <input className={inputClass} value={p.contactPerson} onChange={(e) => set({ contactPerson: e.target.value })} />
          </Field>
          <Field label={t('register.orgPhone')}>
            <input dir="ltr" type="tel" className={inputClass} value={p.phone} onChange={(e) => set({ phone: e.target.value })} />
          </Field>
          <Field label={t('actions.whatsapp')} optional>
            <input dir="ltr" type="tel" className={inputClass} value={p.whatsapp ?? ''} onChange={(e) => set({ whatsapp: e.target.value || null })} />
          </Field>
          <Field label={t('dir.website')} optional error={websiteBad ? 'website' : undefined}>
            <input dir="ltr" type="url" placeholder="https://" className={inputClass} value={p.website ?? ''} onChange={(e) => set({ website: e.target.value || null })} />
          </Field>
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
          <Field label={t('register.precision')}>
            <select className={inputClass} value={p.locationPrecision} onChange={(e) => set({ locationPrecision: e.target.value as LocationPrecision })}>
              {PRECISIONS.map((x) => (
                <option key={x} value={x}>
                  {t(`pharmacy.precision.${x}`)}
                </option>
              ))}
            </select>
          </Field>
        </section>

        <section className="space-y-3 rounded-card border border-border bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-section">{t('dir.otherLocations')}</h2>
            <Button size="sm" variant="secondary" onClick={() => set({ locations: [...p.locations, { name: '', area: 'center', hours: null }] })}>
              <Plus aria-hidden className="size-4" />
              {t('provider.addLocation')}
            </Button>
          </div>
          {p.locations.length === 0 && <p className="text-meta text-ink-muted">{t('provider.noLocations')}</p>}
          {p.locations.map((l, i) => (
            <div key={i} className="grid gap-3 rounded-control border border-border p-3 md:grid-cols-[1fr_200px_auto]">
              <Field label={t('provider.locationName')}>
                <input className={inputClass} value={l.name} onChange={(e) => set({ locations: p.locations.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
              </Field>
              <Field label={t('register.area')}>
                <select className={inputClass} value={l.area} onChange={(e) => set({ locations: p.locations.map((x, j) => (j === i ? { ...x, area: e.target.value } : x)) })}>
                  {gov?.areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {pick(a)}
                    </option>
                  ))}
                </select>
              </Field>
              <Button variant="ghost" className="self-end" aria-label={t('provider.delete')} onClick={() => set({ locations: p.locations.filter((_, j) => j !== i) })}>
                <Trash2 aria-hidden className="size-4 text-bad-icon" />
              </Button>
              <details className="md:col-span-3">
                <summary className="flex cursor-pointer items-center gap-1 text-meta text-primary">
                  <MapPin aria-hidden className="size-4" />
                  {t('hours.title')}
                </summary>
                <div className="mt-2">
                  <HoursEditor value={l.hours ?? {}} onChange={(h) => set({ locations: p.locations.map((x, j) => (j === i ? { ...x, hours: h } : x)) })} />
                </div>
              </details>
            </div>
          ))}
        </section>

        <section className="space-y-3 rounded-card border border-border bg-surface p-5">
          <h2 className="text-section">{t('hours.title')}</h2>
          <HoursEditor value={p.hours} onChange={(h) => set({ hours: h })} />
        </section>
      </fieldset>

      {can('profile') && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface p-3">
          <div className="mx-auto flex max-w-5xl justify-end gap-2">
            <Button
              disabled={!dirty || websiteBad || p.locations.some((l) => !l.name.trim())}
              loading={update.isPending}
              onClick={() => (identityChanged && initial.verificationStatus === 'approved' ? setConfirming(true) : void save())}
            >
              {t('common.save')}
            </Button>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirming}
        title={t('profile.reReviewTitle')}
        body={t('profile.reReviewBody')}
        confirmLabel={t('profile.reReviewConfirm')}
        loading={update.isPending}
        onClose={() => setConfirming(false)}
        onConfirm={() => void save()}
      />
    </div>
  );
}
