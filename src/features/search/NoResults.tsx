// P-05 لا نتائج / غير متوفر — the most common state, so it must feel useful (SPEC §7).
import { Bell, Building2, Flag, Globe, Lightbulb, SearchX, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { buttonClass, useToast } from '../../components/ui';
import { governorateById, type GovFilter, type Medicine } from '../../data';
import { useCatalog, useCreateAlert, useSubmitReport } from '../../data/queries';
import { closeMatches } from '../../lib/search';
import { useLang } from '../../hooks/useLang';
import { cn } from '../../lib/cn';
import { ReportDialog } from '../account/ReportDialog';
import { useRequireSession } from '../account/useRequireSession';

/** An action card (Stitch P-05): icon tile, title, one line, and the action as a real button inside. */
function ActionCard({
  icon: Icon,
  title,
  body,
  action,
  primary,
  onClick,
  to,
  disabled,
}: {
  icon: typeof Bell;
  title: string;
  body: string;
  action: string;
  primary?: boolean;
  onClick?: () => void;
  to?: string;
  disabled?: boolean;
}) {
  const actionCls = cn(
    buttonClass(primary ? 'secondary' : 'ghost', 'md', true),
    primary ? 'border-white' : 'bg-mint',
  );
  return (
    <div
      className={cn(
        'flex h-full flex-col items-start gap-3 rounded-card border p-5 text-start',
        primary ? 'border-primary bg-primary text-white' : 'border-border bg-surface shadow-card',
      )}
    >
      <span className={cn('flex size-11 items-center justify-center rounded-control', primary ? 'bg-primary-hover' : 'bg-mint')}>
        <Icon aria-hidden className={cn('size-6', primary ? 'text-white' : 'text-secondary')} />
      </span>
      <h3 className="font-semibold">{title}</h3>
      <p className={cn('flex-1 text-meta', primary ? 'text-mint' : 'text-ink-muted')}>{body}</p>
      {to ? (
        <Link to={to} className={actionCls}>
          {action}
        </Link>
      ) : (
        <button type="button" onClick={onClick} disabled={disabled} className={actionCls}>
          {action}
        </button>
      )}
    </div>
  );
}

/** No pharmacy recently reported this medicine as available in the chosen governorate. */
export function NotReported({ medicine, gov, allGovsUrl }: { medicine: Medicine; gov: GovFilter; allGovsUrl: string | null }) {
  const { t } = useTranslation();
  const { pick } = useLang();
  const toast = useToast();
  const requireSession = useRequireSession();
  const createAlert = useCreateAlert();
  const [reporting, setReporting] = useState(false);
  const govName = gov === 'all' ? t('gov.anywhere') : pick(governorateById(gov));

  const notify = () =>
    requireSession(async () => {
      await createAlert.mutateAsync({ medicineId: medicine.id, gov });
      toast(t('alerts.created'));
    }, 'auth.reasonAlert');

  return (
    <section className="py-8 text-center">
      <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-mint">
        <SearchX aria-hidden className="size-8 text-secondary" />
      </span>
      <h2 className="text-page mx-auto mt-4 max-w-2xl">{t('noResults.title', { gov: govName, medicine: pick(medicine) })}</h2>
      <p className="mt-2 text-ink-muted">{t('noResults.subtitle')}</p>
      <p className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full bg-mint px-4 py-1.5 text-meta text-ink-muted">
        <ShieldCheck aria-hidden className="size-4 text-secondary" />
        {t('noResults.anonymousNote')}
      </p>
      <div className="mx-auto mt-6 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ActionCard
          icon={Bell}
          primary
          title={t('alerts.notifyMe')}
          body={t('noResults.notifyBody')}
          action={t('noResults.notifyAction')}
          onClick={notify}
        />
        {allGovsUrl && (
          <ActionCard
            icon={Globe}
            title={t('noResults.allGovs')}
            body={t('noResults.allGovsBody')}
            action={t('noResults.allGovsAction')}
            to={allGovsUrl}
          />
        )}
        <ActionCard
          icon={Building2}
          title={t('noResults.nearbyPoints')}
          body={t('noResults.nearbyPointsBody')}
          action={t('noResults.nearbyPointsAction')}
          to={`/directory?gov=${gov}`}
        />
        <ActionCard
          icon={Flag}
          title={t('noResults.reportShortage')}
          body={t('noResults.reportShortageBody')}
          action={t('noResults.reportShortageAction')}
          onClick={() => setReporting(true)}
        />
      </div>
      <ReportDialog
        open={reporting}
        onClose={() => setReporting(false)}
        entityType="medicine"
        entityId={medicine.id}
        governorate={gov}
        preset="shortage"
      />
    </section>
  );
}

/** The query matched nothing in the catalog. */
export function UnknownMedicine({ query, gov }: { query: string; gov: GovFilter }) {
  const { t } = useTranslation();
  const { pick, strength } = useLang();
  const catalog = useCatalog();
  // «هل تقصد؟»: close names for the user to choose from; similar names can be different medicines.
  const close = catalog.data ? closeMatches(catalog.data.medicines, query, 3) : [];
  const toast = useToast();
  const submit = useSubmitReport();
  const [sent, setSent] = useState(false);

  const suggest = async () => {
    await submit.mutateAsync({ entityType: 'catalog', entityId: query, reason: 'suggest_medicine', details: query });
    setSent(true);
    toast(t('noResults.suggested'));
  };

  return (
    <section className="py-8 text-center">
      <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-mint">
        <SearchX aria-hidden className="size-8 text-secondary" />
      </span>
      <h2 className="text-page mt-4">{t('noResults.unknownTitle')}</h2>
      <p className="mt-2 text-ink-muted">{t('noResults.unknownHint')}</p>
      {close.length > 0 && (
        <div className="mx-auto mt-6 max-w-sm text-start">
          <h3 className="font-semibold">{t('search.didYouMean')}</h3>
          <ul className="rise-children mt-2 space-y-2">
            {close.map((m) => (
              <li key={m.id}>
                <Link to={`/medicine/${m.id}?gov=${gov}`} className="lift block rounded-card border border-border bg-surface px-4 py-3 hover:border-secondary">
                  <span className="font-medium">{pick(m)}</span>
                  <span className="block text-meta text-ink-muted">
                    <bdi dir="ltr">{m.genericName}</bdi>
                    {m.strength && <> · {strength(m)}</>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mx-auto mt-6 max-w-sm">
        <ActionCard
          icon={Lightbulb}
          title={t('noResults.suggest')}
          body={t('noResults.suggestBody', { query })}
          action={sent ? t('noResults.suggested') : t('noResults.suggestAction')}
          onClick={suggest}
          disabled={sent || submit.isPending}
        />
      </div>
    </section>
  );
}
