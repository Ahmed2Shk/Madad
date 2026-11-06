// P-09 إرسال استفسار — needs an account; an inquiry never becomes an order or a reservation.
import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlert, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button, Dialog, useToast } from '../../components/ui';
import { useSendInquiry } from '../../data/queries';
import { addToOutbox } from '../../lib/outbox';
import { safeStorage } from '../../lib/storage';
import { INQUIRY_BOX } from './inquiryBox';

const MAX = 500;
const schema = z.object({
  subject: z.string().trim().min(1, 'required').max(120),
  body: z.string().trim().min(1, 'required').max(MAX, 'tooLong'),
});
type Form = z.infer<typeof schema>;

export function InquiryDialog({
  open,
  onClose,
  orgId,
  orgName,
  medicineId,
  medicineName,
  services,
}: {
  open: boolean;
  onClose: () => void;
  orgId: string;
  orgName: string;
  medicineId: string | null;
  medicineName?: string;
  /** P-08: the question may be about one of the provider's services or programmes (PR-06). */
  services?: { id: string; name: string }[];
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const send = useSendInquiry();
  const { register, handleSubmit, control, formState, reset } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { subject: medicineName ?? '', body: '' },
    shouldFocusError: true,
  });
  const length = useWatch({ control, name: 'body' })?.length ?? 0;
  const err = (k: keyof Form) => formState.errors[k]?.message;
  const [serviceId, setServiceId] = useState('');

  const onSubmit = handleSubmit(async (f) => {
    const inquiry = { orgId, medicineId, serviceId: serviceId || null, subject: f.subject, body: f.body };
    // Offline: kept on this device and sent when the connection returns (InquiryOutbox).
    if (!navigator.onLine) {
      if (!addToOutbox(safeStorage, INQUIRY_BOX, inquiry)) return toast(t('inquiry.outboxFull'), 'error');
      toast(t('inquiry.queued'));
    } else {
      await send.mutateAsync(inquiry);
      toast(t('inquiry.sent'));
    }
    reset();
    onClose();
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('inquiry.title', { name: orgName })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="inquiry-form" loading={send.isPending}>
            {t('inquiry.send')}
          </Button>
        </>
      }
    >
      <form id="inquiry-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        <p className="flex items-start gap-2 rounded-card bg-warn-bg p-3 text-meta text-warn-text">
          <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warn-icon" />
          {t('inquiry.noMedicalInfo')}
        </p>
        {services && services.length > 0 && (
          <div>
            <label htmlFor="inq-service" className="font-medium">
              {t('inquiry.about')}
            </label>
            <select id="inq-service" value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="mt-1 min-h-11 w-full rounded-control border border-border bg-surface px-3">
              <option value="">{t('inquiry.aboutGeneral')}</option>
              {services.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="inq-subject" className="font-medium">
            {t('inquiry.subject')}
          </label>
          <input
            id="inq-subject"
            {...register('subject')}
            aria-invalid={!!err('subject')}
            aria-describedby={err('subject') ? 'inq-subject-err' : undefined}
            className="mt-1 min-h-11 w-full rounded-control border border-border px-3"
          />
          {err('subject') && (
            <p id="inq-subject-err" className="mt-1 flex items-center gap-1 text-meta text-bad-text">
              <CircleAlert aria-hidden className="size-4" />
              {t(`errors.${err('subject')}`)}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="inq-body" className="font-medium">
            {t('inquiry.message')}
          </label>
          <textarea
            id="inq-body"
            rows={5}
            maxLength={MAX}
            {...register('body')}
            aria-invalid={!!err('body')}
            aria-describedby="inq-body-count"
            className="mt-1 w-full rounded-control border border-border p-3"
          />
          <div className="mt-1 flex justify-between text-meta">
            <span className="text-bad-text">
              {err('body') && (
                <span className="flex items-center gap-1">
                  <CircleAlert aria-hidden className="size-4" />
                  {t(`errors.${err('body')}`)}
                </span>
              )}
            </span>
            <span id="inq-body-count" className="text-ink-muted">
              <bdi dir="ltr">
                {length}/{MAX}
              </bdi>
            </span>
          </div>
        </div>
        <p className="text-meta text-ink-muted">{t('inquiry.notAnOrder')}</p>
      </form>
    </Dialog>
  );
}
