// P-13 الإبلاغ عن معلومة خاطئة — works without an account, rate-limited per browser.
import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlert } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button, Dialog, useToast } from '../../components/ui';
import type { GovFilter, NewReport, ReportReason } from '../../data';
import { useSubmitReport } from '../../data/queries';
import { allowReport } from '../../lib/rateLimit';
import { safeStorage } from '../../lib/storage';

const REASONS: ReportReason[] = ['wrong_availability', 'closed_or_moved', 'wrong_phone', 'misleading', 'other'];

const schema = z.object({
  reason: z.enum(['wrong_availability', 'closed_or_moved', 'wrong_phone', 'misleading', 'other', 'shortage', 'suggest_medicine']),
  details: z.string().max(500),
});
type Form = z.infer<typeof schema>;

export function ReportDialog({
  open,
  onClose,
  entityType,
  entityId,
  governorate,
  preset,
}: {
  open: boolean;
  onClose: () => void;
  entityType: NewReport['entityType'];
  entityId: string;
  governorate?: GovFilter;
  /** "أبلغ عن نقص" from P-05 opens with the shortage reason fixed. */
  preset?: 'shortage';
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const submit = useSubmitReport();
  const { register, handleSubmit, reset, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { reason: preset ?? 'wrong_availability', details: '' },
  });

  const onSubmit = handleSubmit(async (f) => {
    if (!allowReport(safeStorage)) {
      toast(t('report.tooMany'), 'error');
      return;
    }
    await submit.mutateAsync({ entityType, entityId, reason: f.reason, details: f.details.trim(), governorate });
    toast(t('report.thanks'));
    reset();
    onClose();
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={preset ? t('report.shortageTitle') : t('report.title')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="report-form" loading={submit.isPending}>
            {t('report.send')}
          </Button>
        </>
      }
    >
      <form id="report-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        {preset ? (
          <p className="text-ink-muted">{t('report.shortageBody')}</p>
        ) : (
          <fieldset className="space-y-2">
            <legend className="mb-1 font-medium">{t('report.reasonLabel')}</legend>
            {REASONS.map((r) => (
              <label key={r} className="flex min-h-11 items-center gap-3 rounded-control border border-border px-3">
                <input type="radio" value={r} {...register('reason')} className="size-4 accent-primary" />
                {t(`report.reasons.${r}`)}
              </label>
            ))}
          </fieldset>
        )}
        <div>
          <label htmlFor="report-details" className="font-medium">
            {t('report.details')}
          </label>
          <textarea
            id="report-details"
            rows={3}
            maxLength={500}
            {...register('details')}
            className="mt-1 w-full rounded-control border border-border p-3"
          />
          {formState.errors.details && (
            <p className="mt-1 flex items-center gap-1 text-meta text-bad-text">
              <CircleAlert aria-hidden className="size-4" />
              {t('errors.tooLong')}
            </p>
          )}
        </div>
        <p className="text-meta text-ink-muted">{t('report.noAccountNeeded')}</p>
      </form>
    </Dialog>
  );
}
