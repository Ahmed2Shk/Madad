// Sends inquiries written offline once the connection returns (SPEC §11 طابور الإرسال).
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../components/ui';
import type { NewInquiry } from '../../data';
import { useSendInquiry, useSession } from '../../data/queries';
import { useOnline } from '../../hooks/useOnline';
import { flushOutbox, outboxItems } from '../../lib/outbox';
import { safeStorage } from '../../lib/storage';
import { INQUIRY_BOX } from './inquiryBox';

export function InquiryOutbox() {
  const { t } = useTranslation();
  const toast = useToast();
  const online = useOnline();
  const session = useSession();
  const { mutateAsync } = useSendInquiry();
  const busy = useRef(false);
  const signedIn = !!session.data;

  useEffect(() => {
    if (!online || !signedIn || busy.current || outboxItems(safeStorage, INQUIRY_BOX).length === 0) return;
    busy.current = true;
    void flushOutbox<NewInquiry>(safeStorage, INQUIRY_BOX, (inq) => mutateAsync(inq))
      .then((n) => n > 0 && toast(t('inquiry.queuedSent', { count: n })))
      .finally(() => {
        busy.current = false;
      });
  }, [online, signedIn, mutateAsync, toast, t]);

  return null;
}
