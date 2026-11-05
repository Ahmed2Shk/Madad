// Editor for a department, service or programme (PR-03, PR-04), with a live preview of what patients
// will see. Saving sends the content to review (AD-08). There is no medicine field anywhere here.
import { Info } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Dialog, Field, HoursEditor, inputClass, useToast } from '../../components/ui';
import { SERVICE_CATEGORIES, type ProgramStatus, type ServiceInput, type ServiceItem, type ServiceKind } from '../../data';
import { useSaveService } from '../../data/providerQueries';
import { useSettings } from '../../data/queries';
import { useNow } from '../../hooks/useNow';
import { DEFAULT_PROGRAM_CONFIRM_DAYS } from '../../lib/programs';
import { ServiceCard } from '../directory/ServiceViews';

const PROGRAM_STATUSES: ProgramStatus[] = ['info', 'active', 'paused', 'ended'];

const lines = (v: string) => v.split('\n').map((x) => x.trim()).filter(Boolean);
const text = (v: string | null) => v ?? '';
const orNull = (v: string) => (v.trim() ? v : null);

export function ServiceEditor({
  orgId,
  initial,
  kinds,
  onClose,
}: {
  orgId: string;
  initial: ServiceInput;
  /** Kinds this screen may create (a department only for hospitals). */
  kinds: ServiceKind[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const now = useNow();
  const confirmDays = useSettings().data?.programConfirmDays ?? DEFAULT_PROGRAM_CONFIRM_DAYS;
  const save = useSaveService(orgId);
  const [v, setV] = useState<ServiceInput>(initial);
  const [docs, setDocs] = useState(initial.requiredDocs.join('\n'));
  const [elig, setElig] = useState(initial.eligibility.join('\n'));
  const [error, setError] = useState(false);
  const set = (patch: Partial<ServiceInput>) => setV((x) => ({ ...x, ...patch }));
  const value: ServiceInput = { ...v, requiredDocs: lines(docs), eligibility: lines(elig) };
  const preview: ServiceItem = {
    ...value,
    id: v.id ?? 'preview',
    orgId,
    name: v.name || t('provider.untitled'),
    confirmedAt: now.toISOString(),
    reviewStatus: 'pending',
    rejectionReason: null,
    updatedAt: now.toISOString(),
  };
  const isDept = v.kind === 'department';
  const isProgram = v.kind === 'program';

  const submit = async () => {
    if (!v.name.trim()) return setError(true);
    await save.mutateAsync(value);
    toast(t('provider.sentToReview'));
    onClose();
  };

  return (
    <Dialog
      open
      side
      size="lg"
      onClose={onClose}
      title={v.id ? t('provider.edit') : t(`provider.add.${v.kind}`)}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void submit()} loading={save.isPending}>
            {t('provider.saveForReview')}
          </Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <p className="flex items-start gap-2 rounded-card bg-review-bg p-3 text-meta text-review-text">
            <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-review-icon" />
            {t('provider.reviewNote')}
          </p>
          {!v.id && kinds.length > 1 && (
            <Field label={t('provider.kind')}>
              <select value={v.kind} onChange={(e) => set({ kind: e.target.value as ServiceKind })} className={inputClass}>
                {kinds.map((k) => (
                  <option key={k} value={k}>
                    {t(`serviceKind.${k}`)}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label={t('provider.name')} error={error && !v.name.trim() ? 'required' : undefined}>
            <input className={inputClass} maxLength={160} value={v.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label={t('provider.category')} optional>
            <select value={v.category ?? ''} onChange={(e) => set({ category: (e.target.value || null) as ServiceInput['category'] })} className={inputClass}>
              <option value="">—</option>
              {SERVICE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`serviceCategory.${c}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('provider.description')} optional>
            <textarea rows={3} maxLength={600} className={`${inputClass} py-2`} value={text(v.description)} onChange={(e) => set({ description: orNull(e.target.value) })} />
          </Field>

          {isProgram && (
            <Field label={t('provider.programStatus')}>
              <select value={v.programStatus ?? 'info'} onChange={(e) => set({ programStatus: e.target.value as ProgramStatus })} className={inputClass}>
                {PROGRAM_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`program.status.${s}`)}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {isDept ? (
            <>
              <Field label={t('dir.place')} optional>
                <input className={inputClass} value={text(v.place)} onChange={(e) => set({ place: orNull(e.target.value) })} />
              </Field>
              <Field label={t('dir.extension')} optional>
                <input className={inputClass} dir="ltr" value={text(v.phone)} onChange={(e) => set({ phone: orNull(e.target.value) })} />
              </Field>
              <label className="flex min-h-11 items-center gap-2">
                <input type="checkbox" className="size-4 accent-primary" checked={v.operating} onChange={(e) => set({ operating: e.target.checked })} />
                {t('provider.operating')}
              </label>
            </>
          ) : (
            <>
              <Field label={t('dir.beneficiaries')} optional>
                <input className={inputClass} value={text(v.beneficiaries)} onChange={(e) => set({ beneficiaries: orNull(e.target.value) })} />
              </Field>
              {isProgram && (
                <Field label={t('dir.eligibility')} hint={t('provider.onePerLine')} optional>
                  <textarea rows={3} className={`${inputClass} py-2`} value={elig} onChange={(e) => setElig(e.target.value)} />
                </Field>
              )}
              <Field label={t('dir.requiredDocs')} hint={t('provider.onePerLine')} optional>
                <textarea rows={2} className={`${inputClass} py-2`} value={docs} onChange={(e) => setDocs(e.target.value)} />
              </Field>
              {isProgram && (
                <>
                  <Field label={t('dir.howToApply')} optional>
                    <textarea rows={2} className={`${inputClass} py-2`} value={text(v.howToApply)} onChange={(e) => set({ howToApply: orNull(e.target.value) })} />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t('provider.startsOn')} optional>
                      <input type="date" className={inputClass} value={text(v.startsOn)} onChange={(e) => set({ startsOn: orNull(e.target.value) })} />
                    </Field>
                    <Field label={t('provider.endsOn')} optional>
                      <input type="date" className={inputClass} value={text(v.endsOn)} onChange={(e) => set({ endsOn: orNull(e.target.value) })} />
                    </Field>
                  </div>
                </>
              )}
              <Field label={t('dir.place')} optional>
                <input className={inputClass} value={text(v.location)} onChange={(e) => set({ location: orNull(e.target.value) })} />
              </Field>
              <Field label={t('dir.contactMethod')} optional>
                <input className={inputClass} value={text(v.contact)} onChange={(e) => set({ contact: orNull(e.target.value) })} />
              </Field>
            </>
          )}
          {!isProgram && (
            <details>
              <summary className="cursor-pointer text-primary">{t('hours.title')}</summary>
              <div className="mt-3">
                <HoursEditor value={v.hours ?? {}} onChange={(h) => set({ hours: h })} />
              </div>
            </details>
          )}
        </div>

        <aside aria-label={t('provider.preview')} className="space-y-2">
          <p className="text-meta font-medium text-ink-muted">{t('provider.preview')}</p>
          <div className="lg:sticky lg:top-0">
            <ServiceCard item={preview} now={now} confirmDays={confirmDays} />
          </div>
        </aside>
      </div>
    </Dialog>
  );
}
