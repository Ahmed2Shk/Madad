// AD-11 إعدادات المنصة — freshness windows (with a live preview), price validity, program confirmation,
// disclaimer text, rejection reasons and required documents per organization type.
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, CardSkeleton, ErrorBanner, Field, FieldError, StatusBadge, inputClass, useToast } from '../../components/ui';
import { GOVERNORATES, type OrgType, type PlatformSettings } from '../../data';
import { usePlatformSettings, useUpdateSettings } from '../../data/adminQueries';
import { useLang } from '../../hooks/useLang';
import { displayOf, freshnessOf } from '../../lib/freshness';
import { RequireSuperAdmin } from './RequireSuperAdmin';

const TYPES: OrgType[] = ['pharmacy', 'hospital', 'medical_point', 'humanitarian'];
const ALL_DOCS = ['practice_license', 'pharmacy_license', 'contact_id', 'facility_license', 'authorization_letter', 'registration_certificate'];

export default function SettingsPage() {
  return (
    <RequireSuperAdmin>
      <SettingsLoader />
    </RequireSuperAdmin>
  );
}

function SettingsLoader() {
  const settings = usePlatformSettings();
  if (settings.isPending) return <CardSkeleton />;
  if (settings.isError || !settings.data) return <ErrorBanner onRetry={() => void settings.refetch()} />;
  return <SettingsForm key={settings.dataUpdatedAt} initial={settings.data} />;
}

function SettingsForm({ initial }: { initial: PlatformSettings }) {
  const { t } = useTranslation();
  const { pick } = useLang();
  const toast = useToast();
  const update = useUpdateSettings();
  const [s, setS] = useState(initial);
  const [previewHours, setPreviewHours] = useState(30);
  const [newReason, setNewReason] = useState('');
  const set = (patch: Partial<PlatformSettings>) => setS((x) => ({ ...x, ...patch }));
  const invalid = !(s.freshHours >= 1 && s.expireHours > s.freshHours && s.priceMaxDays >= 1 && s.programConfirmDays >= 1);

  // "بلاغ عمره 30 ساعة سيظهر: يحتاج تحديث" — computed with the same function as every screen.
  const now = new Date();
  const preview = displayOf('available', freshnessOf(new Date(now.getTime() - previewHours * 36e5), now, s.freshHours, s.expireHours));
  const num = (v: string) => Math.max(0, Math.round(Number(v) || 0));

  const save = async () => {
    await update.mutateAsync(s);
    toast(t('admin.settingsSaved'));
  };

  return (
    <div className="space-y-5 pb-20">
      <h1 className="text-page">{t('portal.admin.nav.settings')}</h1>

      <section className="grid gap-4 rounded-card border border-border bg-surface p-5 md:grid-cols-2">
        <h2 className="text-section md:col-span-2">{t('admin.freshnessSettings')}</h2>
        <Field label={t('admin.freshHours')} hint={t('admin.freshHoursHint')}>
          <input type="number" min={1} dir="ltr" className={inputClass} value={s.freshHours} onChange={(e) => set({ freshHours: num(e.target.value) })} />
        </Field>
        <Field label={t('admin.expireHours')} hint={t('admin.expireHoursHint')}>
          <input type="number" min={2} dir="ltr" className={inputClass} value={s.expireHours} onChange={(e) => set({ expireHours: num(e.target.value) })} />
        </Field>
        <Field label={t('admin.priceMaxDays')}>
          <input type="number" min={1} dir="ltr" className={inputClass} value={s.priceMaxDays} onChange={(e) => set({ priceMaxDays: num(e.target.value) })} />
        </Field>
        <Field label={t('admin.programConfirmDays')}>
          <input type="number" min={1} dir="ltr" className={inputClass} value={s.programConfirmDays} onChange={(e) => set({ programConfirmDays: num(e.target.value) })} />
        </Field>
        {invalid && (
          <div className="md:col-span-2">
            <FieldError>{t('admin.settingsInvalid')}</FieldError>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3 rounded-card bg-canvas p-4 md:col-span-2">
          <label className="flex items-center gap-2">
            {t('admin.previewAge')}
            <input type="number" min={0} dir="ltr" value={previewHours} onChange={(e) => setPreviewHours(num(e.target.value))} className="min-h-10 w-20 rounded-control border border-border px-2" />
            {t('admin.hours')}
          </label>
          <span aria-live="polite" className="inline-flex items-center gap-2">
            {t('admin.willShow')} <StatusBadge status={preview} />
          </span>
        </div>
      </section>

      <section className="grid gap-4 rounded-card border border-border bg-surface p-5 md:grid-cols-2">
        <h2 className="text-section md:col-span-2">{t('admin.disclaimer')}</h2>
        <Field label={t('admin.disclaimerAr')} hint={t('admin.disclaimerHint')} optional>
          <textarea rows={4} className={`${inputClass} py-2`} value={s.disclaimerAr ?? ''} placeholder={t('disclaimer.full', { lng: 'ar' })} onChange={(e) => set({ disclaimerAr: e.target.value || null })} />
        </Field>
        <Field label={t('admin.disclaimerEn')} optional>
          <textarea rows={4} dir="ltr" className={`${inputClass} py-2`} value={s.disclaimerEn ?? ''} placeholder={t('disclaimer.full', { lng: 'en' })} onChange={(e) => set({ disclaimerEn: e.target.value || null })} />
        </Field>
      </section>

      <section className="space-y-3 rounded-card border border-border bg-surface p-5">
        <h2 className="text-section">{t('admin.rejectionReasons')}</h2>
        <ul className="rise-children space-y-2">
          {s.rejectionReasons.map((r, i) => (
            <li key={r} className="flex items-center justify-between gap-3 rounded-control border border-border px-3 py-2">
              {r}
              <Button variant="ghost" size="sm" aria-label={t('admin.removeReason', { reason: r })} onClick={() => set({ rejectionReasons: s.rejectionReasons.filter((_, j) => j !== i) })}>
                <Trash2 aria-hidden className="size-4 text-bad-text" />
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="new-reason">
            {t('admin.addReason')}
          </label>
          <input id="new-reason" className={inputClass} value={newReason} onChange={(e) => setNewReason(e.target.value)} placeholder={t('admin.addReason')} />
          <Button
            variant="secondary"
            disabled={!newReason.trim()}
            onClick={() => {
              set({ rejectionReasons: [...s.rejectionReasons, newReason.trim()] });
              setNewReason('');
            }}
          >
            <Plus aria-hidden className="size-4" />
            {t('admin.add')}
          </Button>
        </div>
      </section>

      <section className="space-y-3 rounded-card border border-border bg-surface p-5">
        <h2 className="text-section">{t('admin.requiredDocs')}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-meta">
            <thead className="text-ink-muted">
              <tr>
                <th scope="col" className="px-2 py-2 text-start font-medium">{t('register.stepDocs')}</th>
                {TYPES.map((ty) => (
                  <th key={ty} scope="col" className="px-2 py-2 text-center font-medium">
                    {t(`orgTypes.${ty}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ALL_DOCS.map((d) => (
                <tr key={d}>
                  <th scope="row" className="px-2 py-2 text-start font-normal">
                    {t(`docTypes.${d}`)}
                  </th>
                  {TYPES.map((ty) => (
                    <td key={ty} className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        aria-label={`${t(`docTypes.${d}`)} · ${t(`orgTypes.${ty}`)}`}
                        checked={s.requiredDocs[ty].includes(d)}
                        onChange={(e) =>
                          set({ requiredDocs: { ...s.requiredDocs, [ty]: e.target.checked ? [...s.requiredDocs[ty], d] : s.requiredDocs[ty].filter((x) => x !== d) } })
                        }
                        className="size-4 accent-primary"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2 rounded-card border border-border bg-surface p-5">
        <h2 className="text-section">{t('admin.lists')}</h2>
        <p className="text-meta text-ink-muted">{t('admin.listsNote')}</p>
        <p className="text-meta">{GOVERNORATES.map((g) => pick(g)).join('، ')}</p>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 backdrop-blur lg:start-64">
        <div className="mx-auto flex max-w-content items-center justify-end gap-3 px-4 py-3 lg:px-6">
          <Button variant="ghost" onClick={() => setS(initial)}>
            {t('common.cancel')}
          </Button>
          <Button disabled={invalid} loading={update.isPending} onClick={() => void save()}>
            {t('common.save')}
          </Button>
        </div>
      </div>
    </div>
  );
}
