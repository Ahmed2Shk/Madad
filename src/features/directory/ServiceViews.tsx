// How a department, service or programme looks to patients (P-08), also used as the live preview
// next to the editor (PR-03, PR-04). Every status has an icon, a text and its time (SPEC §5, §3).
import { CalendarRange, CircleCheck, CirclePause, CircleSlash, Clock, Hourglass, Info, MapPin, Phone, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Freshness } from '../../components/ui';
import type { ServiceItem } from '../../data';
import { cn } from '../../lib/cn';
import type { ProgramDisplay } from '../../lib/programs';
import { programDisplay } from './programDisplay';
import { HoursList } from '../pharmacy-public/HoursList';

const programStyles: Record<ProgramDisplay, { Icon: LucideIcon; pill: string; icon: string }> = {
  info: { Icon: Info, pill: 'bg-review-bg text-review-text', icon: 'text-review-icon' },
  active: { Icon: CircleCheck, pill: 'bg-ok-bg text-ok-text', icon: 'text-ok-icon' },
  needs_update: { Icon: Clock, pill: 'bg-warn-bg text-warn-text', icon: 'text-warn-icon' },
  paused: { Icon: CirclePause, pill: 'bg-warn-bg text-warn-text', icon: 'text-warn-icon' },
  ended: { Icon: CircleSlash, pill: 'bg-unknown-bg text-unknown-text', icon: 'text-unknown-icon' },
};

export function ProgramBadge({ display }: { display: ProgramDisplay }) {
  const { t } = useTranslation();
  const { Icon, pill, icon } = programStyles[display];
  return (
    <span data-program={display} className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-meta font-medium', pill)}>
      <Icon aria-hidden className={cn('size-4 shrink-0', icon)} />
      {t(`program.status.${display}`)}
    </span>
  );
}

export function DepartmentBadge({ operating }: { operating: boolean }) {
  const { t } = useTranslation();
  return operating ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-bg px-2.5 py-0.5 text-meta font-medium text-ok-text">
      <CircleCheck aria-hidden className="size-4 text-ok-icon" />
      {t('dir.operating')}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-warn-bg px-2.5 py-0.5 text-meta font-medium text-warn-text">
      <CirclePause aria-hidden className="size-4 text-warn-icon" />
      {t('dir.pausedDept')}
    </span>
  );
}

export function PendingTag() {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-review-bg px-2 py-0.5 text-micro font-medium text-review-text">
      <Hourglass aria-hidden className="size-3.5 text-review-icon" />
      {t('dir.pendingTag')}
    </span>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-meta font-medium">{title}</p>
      <ul className="mt-1 list-disc space-y-0.5 ps-5 text-meta text-ink-muted">
        {items.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </div>
  );
}

/** One department, service or programme, as patients see it. */
export function ServiceCard({ item, now, confirmDays }: { item: ServiceItem; now: Date; confirmDays: number }) {
  const { t } = useTranslation();
  const isProgram = item.kind === 'program';
  return (
    <article className="space-y-3 rounded-card border border-border bg-surface p-4 shadow-card">
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">{item.name}</h3>
        {item.category && <span className="rounded-full bg-canvas px-2 py-0.5 text-micro text-ink-muted">{t(`serviceCategory.${item.category}`)}</span>}
        {isProgram && <ProgramBadge display={programDisplay(item, now, confirmDays)} />}
        {item.kind === 'department' && <DepartmentBadge operating={item.operating} />}
        {item.reviewStatus === 'pending' && <PendingTag />}
      </header>
      {item.description && <p className="text-ink-muted">{item.description}</p>}

      <dl className="grid gap-2 text-meta sm:grid-cols-2">
        {item.beneficiaries && (
          <div>
            <dt className="font-medium">{t('dir.beneficiaries')}</dt>
            <dd className="text-ink-muted">{item.beneficiaries}</dd>
          </div>
        )}
        {(item.place || item.location) && (
          <div>
            <dt className="font-medium">{t('dir.place')}</dt>
            <dd className="flex items-center gap-1 text-ink-muted">
              <MapPin aria-hidden className="size-4" />
              {item.place ?? item.location}
            </dd>
          </div>
        )}
        {item.phone && (
          <div>
            <dt className="font-medium">{t('dir.extension')}</dt>
            <dd className="flex items-center gap-1 text-ink-muted">
              <Phone aria-hidden className="size-4" />
              <bdi dir="ltr">{item.phone}</bdi>
            </dd>
          </div>
        )}
        {(item.startsOn || item.endsOn) && (
          <div>
            <dt className="font-medium">{t('dir.dates')}</dt>
            <dd className="flex items-center gap-1 text-ink-muted">
              <CalendarRange aria-hidden className="size-4" />
              <bdi dir="ltr">
                {item.startsOn ?? '…'} – {item.endsOn ?? '…'}
              </bdi>
            </dd>
          </div>
        )}
        {item.contact && (
          <div>
            <dt className="font-medium">{t('dir.contactMethod')}</dt>
            <dd className="text-ink-muted">{item.contact}</dd>
          </div>
        )}
      </dl>

      <List title={t('dir.eligibility')} items={item.eligibility} />
      <List title={t('dir.requiredDocs')} items={item.requiredDocs} />
      {item.howToApply && (
        <div>
          <p className="text-meta font-medium">{t('dir.howToApply')}</p>
          <p className="text-meta text-ink-muted">{item.howToApply}</p>
        </div>
      )}
      {item.hours && Object.keys(item.hours).length > 0 && (
        <details className="text-meta">
          <summary className="cursor-pointer text-primary">{t('hours.title')}</summary>
          <div className="mt-2">
            <HoursList hours={item.hours} />
          </div>
        </details>
      )}

      <p className="text-micro text-ink-muted">
        {isProgram ? t('dir.lastConfirmed') : t('dir.updated')} <Freshness at={(isProgram && item.confirmedAt) || item.updatedAt} />
      </p>
    </article>
  );
}
