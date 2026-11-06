// PH-04 إضافة دواء / طلب دواء جديد — search the catalog first; a pharmacy never creates catalog entries itself.
import { zodResolver } from '@hookform/resolvers/zod';
import { Barcode, CirclePlus, FilePlus2, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import {
  Button,
  CardSkeleton,
  EmptyState,
  Field,
  Freshness,
  StatusBadge,
  StatusPicker,
  Tabs,
  inputClass,
  useToast,
} from '../../components/ui';
import type { DosageForm, Reported } from '../../data';
import { useAddMedicine, useMedicineRequests, usePortalStock, useRequestMedicine } from '../../data/portalQueries';
import { useCatalog } from '../../data/queries';
import { useLang } from '../../hooks/useLang';
import { matchCatalog } from '../../lib/search';
import { usePharmacyCtx } from './context';
import { RequirePerm } from './NoAccess';

const FORMS: DosageForm[] = ['tablet', 'capsule', 'syrup', 'suspension', 'injection_pen', 'vial', 'inhaler', 'sachet', 'cream'];

export default function AddMedicinePage() {
  return (
    <RequirePerm perm="medicines">
      <AddMedicine />
    </RequirePerm>
  );
}

function AddMedicine() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('catalog');
  return (
    <div className="space-y-4">
      <h1 className="text-page">{t('portal.pharmacy.nav.add')}</h1>
      <Tabs
        label={t('portal.pharmacy.nav.add')}
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'catalog', label: t('add.fromCatalog') },
          { id: 'request', label: t('add.request') },
          { id: 'mine', label: t('add.myRequests') },
        ]}
      >
        {tab === 'catalog' && <FromCatalog onNotFound={() => setTab('request')} />}
        {tab === 'request' && <RequestForm onSent={() => setTab('mine')} />}
        {tab === 'mine' && <MyRequests />}
      </Tabs>
      {/* CSV import (PH-04 step 4) belongs to product phase 2 per SPEC §8; not built yet. */}
    </div>
  );
}

function FromCatalog({ onNotFound }: { onNotFound: () => void }) {
  const { t } = useTranslation();
  const { pick, strength } = useLang();
  const toast = useToast();
  const { orgId } = usePharmacyCtx();
  const catalog = useCatalog();
  const stock = usePortalStock(orgId);
  const add = useAddMedicine(orgId);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<Record<string, Reported>>({});
  const mine = useMemo(() => new Set((stock.data ?? []).map((r) => r.medicineId)), [stock.data]);
  const hits = useMemo(() => (catalog.data && q.trim().length >= 2 ? matchCatalog(catalog.data.medicines, q, 12) : []), [catalog.data, q]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-xl">
        <label htmlFor="add-q" className="sr-only">
          {t('add.searchLabel')}
        </label>
        <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-ink-muted" />
        <input
          id="add-q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('add.searchLabel')}
          className="min-h-12 w-full rounded-control border border-border bg-surface ps-10 pe-10"
        />
        <Barcode aria-hidden className="pointer-events-none absolute end-3 top-1/2 size-5 -translate-y-1/2 text-ink-muted" />
      </div>

      {q.trim().length < 2 ? (
        <p className="text-ink-muted">{t('add.typeToSearch')}</p>
      ) : hits.length === 0 ? (
        <EmptyState
          icon={Search}
          title={t('add.notFound')}
          body={t('add.notFoundBody')}
          actions={
            <Button onClick={onNotFound}>
              <FilePlus2 aria-hidden className="size-4" />
              {t('add.request')}
            </Button>
          }
        />
      ) : (
        <ul className="rise-children divide-y divide-border rounded-card border border-border bg-surface">
          {hits.map((m) => (
            <li key={m.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{pick(m)}</p>
                <p className="text-meta text-ink-muted">
                  <bdi dir="ltr">{m.genericName}</bdi> · {strength(m)} · {t(`forms.${m.dosageForm}`)}
                </p>
              </div>
              {mine.has(m.id) ? (
                <span className="text-meta text-ok-text">{t('add.alreadyListed')}</span>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <StatusPicker label={t('update.statusFor', { name: pick(m) })} value={status[m.id] ?? 'available'} onChange={(v) => setStatus((s) => ({ ...s, [m.id]: v }))} />
                  <Button
                    loading={add.isPending && add.variables?.medicineId === m.id}
                    onClick={async () => {
                      await add.mutateAsync({ medicineId: m.id, status: status[m.id] ?? 'available' });
                      toast(t('dashboard.added', { name: pick(m) }));
                    }}
                  >
                    <CirclePlus aria-hidden className="size-4" />
                    {t('add.addToMine')}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const requestSchema = z.object({
  nameAr: z.string().trim().min(2, 'required'),
  nameEn: z.string().trim().min(2, 'required'),
  genericName: z.string().trim().min(2, 'required'),
  strength: z.string().trim().min(1, 'required'),
  dosageForm: z.enum(FORMS as [DosageForm, ...DosageForm[]]),
  packSize: z.string().trim().min(1, 'required'),
  manufacturer: z.string().trim(),
  barcode: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d{8,14}$/.test(v), 'barcode'),
  categoryId: z.string().min(1, 'required'),
});
type RequestForm = z.infer<typeof requestSchema>;

function RequestForm({ onSent }: { onSent: () => void }) {
  const { t } = useTranslation();
  const { pick } = useLang();
  const toast = useToast();
  const { orgId } = usePharmacyCtx();
  const catalog = useCatalog();
  const request = useRequestMedicine(orgId);
  const { register, handleSubmit, formState } = useForm<RequestForm>({
    resolver: zodResolver(requestSchema),
    defaultValues: { nameAr: '', nameEn: '', genericName: '', strength: '', dosageForm: 'tablet', packSize: '', manufacturer: '', barcode: '', categoryId: '' },
    shouldFocusError: true,
  });
  const err = (k: keyof RequestForm) => formState.errors[k]?.message;

  const onSubmit = handleSubmit(async (f) => {
    await request.mutateAsync({ ...f, manufacturer: f.manufacturer || null, barcode: f.barcode || null });
    toast(t('add.requestSent'));
    onSent();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4 rounded-card border border-border bg-surface p-5">
      <p className="text-ink-muted">{t('add.requestIntro')}</p>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t('add.f.nameAr')} error={err('nameAr')}><input className={inputClass} {...register('nameAr')} /></Field>
        <Field label={t('add.f.nameEn')} error={err('nameEn')}><input dir="ltr" className={inputClass} {...register('nameEn')} /></Field>
        <Field label={t('add.f.generic')} error={err('genericName')}><input dir="ltr" className={inputClass} {...register('genericName')} /></Field>
        <Field label={t('table.strength')} error={err('strength')}><input className={inputClass} {...register('strength')} /></Field>
        <Field label={t('table.form')}>
          <select className={inputClass} {...register('dosageForm')}>
            {FORMS.map((x) => (
              <option key={x} value={x}>
                {t(`forms.${x}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('medicine.pack')} error={err('packSize')}><input className={inputClass} {...register('packSize')} /></Field>
        <Field label={t('medicine.manufacturer')} optional><input className={inputClass} {...register('manufacturer')} /></Field>
        <Field label={t('add.f.barcode')} optional error={err('barcode')}><input dir="ltr" inputMode="numeric" className={inputClass} {...register('barcode')} /></Field>
        <Field label={t('medicine.category')} error={err('categoryId')}>
          <select className={inputClass} {...register('categoryId')}>
            <option value="">{t('add.f.pickCategory')}</option>
            {catalog.data?.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {pick(c)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="text-meta text-ink-muted">{t('add.requestNote')}</p>
      <Button type="submit" loading={request.isPending}>
        {t('add.sendRequest')}
      </Button>
    </form>
  );
}

function MyRequests() {
  const { t } = useTranslation();
  const { pick } = useLang();
  const { orgId } = usePharmacyCtx();
  const requests = useMedicineRequests(orgId);
  if (requests.isPending) return <CardSkeleton />;
  if (!requests.data?.length) return <EmptyState icon={FilePlus2} title={t('add.noRequests')} />;
  return (
    <ul className="rise-children divide-y divide-border rounded-card border border-border bg-surface">
      {requests.data.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="font-semibold">{pick(r)}</p>
            <p className="text-meta text-ink-muted">
              <bdi dir="ltr">{r.genericName}</bdi> · {r.strength} · {t(`forms.${r.dosageForm}`)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {r.status === 'pending' ? <StatusBadge status="pending_review" /> : <span className="text-meta">{t(`add.requestStatus.${r.status}`)}</span>}
            <Freshness at={r.createdAt} bare />
          </div>
        </li>
      ))}
    </ul>
  );
}
