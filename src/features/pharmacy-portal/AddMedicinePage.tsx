// PH-04 إضافة دواء / طلب دواء جديد — search the catalog first; a pharmacy never creates catalog entries itself.
import { zodResolver } from '@hookform/resolvers/zod';
import { Barcode, CirclePlus, FilePlus2, List, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import {
  Button,
  CardSkeleton,
  EmptyState,
  Field,
  FilterChips,
  Freshness,
  StatusBadge,
  StatusPicker,
  Tabs,
  inputClass,
  useToast,
} from '../../components/ui';
import { DOSAGE_FORMS, type DosageForm, type Reported } from '../../data';
import { useAddMedicine, useAddMedicines, useMedicineRequests, usePortalStock, useRequestMedicine } from '../../data/portalQueries';
import { useCatalog } from '../../data/queries';
import { useLang } from '../../hooks/useLang';
import { matchCatalog } from '../../lib/search';
import { usePharmacyCtx } from './context';
import { RequirePerm } from './NoAccess';

const FORMS: readonly DosageForm[] = DOSAGE_FORMS;

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
  const addMany = useAddMedicines(orgId);
  const [q, setQ] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState<Record<string, Reported>>({});
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulkStatus, setBulkStatus] = useState<Reported>('available');
  const mine = useMemo(() => new Set((stock.data ?? []).map((r) => r.medicineId)), [stock.data]);
  const all = useMemo(() => catalog.data?.medicines ?? [], [catalog.data]);
  const searching = q.trim().length >= 2;

  // Typing searches the whole list; «عرض الكل» lists everything (by category, then name) without typing.
  const list = useMemo(() => {
    if (searching) return matchCatalog(all, q, all.length);
    if (!showAll) return [];
    const order = new Map((catalog.data?.categories ?? []).map((c, i) => [c.id, i]));
    return all
      .filter((m) => category === 'all' || m.categoryId === category)
      .sort((a, b) => (order.get(a.categoryId) ?? 99) - (order.get(b.categoryId) ?? 99) || pick(a).localeCompare(pick(b), 'ar'));
  }, [searching, showAll, all, q, category, catalog.data, pick]);

  // «تحديد الكل» acts on what is shown and not yet in the pharmacy's list.
  const selectable = list.filter((m) => !mine.has(m.id));
  const shownSelected = selectable.filter((m) => selected.has(m.id));
  const allShownSelected = selectable.length > 0 && shownSelected.length === selectable.length;
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleAll = () =>
    setSelected((s) => {
      const n = new Set(s);
      for (const m of selectable) {
        if (allShownSelected) n.delete(m.id);
        else n.add(m.id);
      }
      return n;
    });
  const addSelected = async () => {
    const ids = [...selected].filter((id) => !mine.has(id));
    if (ids.length === 0) return;
    const added = await addMany.mutateAsync({ medicineIds: ids, status: bulkStatus });
    setSelected(new Set());
    toast(t('add.addedMany', { count: added }));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 basis-72">
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
        <Button variant={showAll ? 'primary' : 'secondary'} aria-pressed={showAll} onClick={() => setShowAll((v) => !v)}>
          <List aria-hidden className="size-4" />
          {t('add.showAll', { count: all.length })}
        </Button>
      </div>

      {showAll && !searching && (
        <FilterChips
          label={t('add.categoryFilter')}
          onToggle={setCategory}
          chips={[
            { id: 'all', label: t('add.allCategories'), on: category === 'all' },
            ...(catalog.data?.categories ?? []).map((c) => ({ id: c.id, label: pick(c), on: category === c.id })),
          ]}
        />
      )}

      {!searching && !showAll ? (
        <p className="text-ink-muted">{t('add.typeOrShowAll')}</p>
      ) : list.length === 0 ? (
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
        <>
          {/* Bulk bar: select what is shown, pick one status, add them all. Sticks while the list scrolls. */}
          <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface p-3 shadow-card">
            <label className="inline-flex min-h-11 items-center gap-2 font-medium">
              <input
                type="checkbox"
                className="size-5 accent-primary"
                checked={allShownSelected}
                ref={(el) => {
                  if (el) el.indeterminate = shownSelected.length > 0 && !allShownSelected;
                }}
                disabled={selectable.length === 0}
                onChange={toggleAll}
              />
              {t('add.selectAll')}
            </label>
            <span className="text-meta text-ink-muted">{t('add.selectedCount', { count: selected.size })}</span>
            <div className="ms-auto flex flex-wrap items-center gap-3">
              <StatusPicker label={t('add.bulkStatus')} value={bulkStatus} onChange={setBulkStatus} />
              <Button disabled={selected.size === 0} loading={addMany.isPending} onClick={() => void addSelected()}>
                <CirclePlus aria-hidden className="size-4" />
                {t('add.addSelected', { count: selected.size })}
              </Button>
            </div>
          </div>

          <ul className="rise-children divide-y divide-border rounded-card border border-border bg-surface">
            {list.map((m) => (
              <li key={m.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  {mine.has(m.id) ? (
                    <span className="size-5 shrink-0" aria-hidden />
                  ) : (
                    <input
                      type="checkbox"
                      className="mt-1 size-5 shrink-0 accent-primary"
                      aria-label={t('add.selectFor', { name: pick(m) })}
                      checked={selected.has(m.id)}
                      onChange={() => toggle(m.id)}
                    />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold">{pick(m)}</p>
                    <p className="text-meta text-ink-muted">
                      <bdi dir="ltr">{m.genericName}</bdi>
                      {m.strength && <> · {strength(m)}</>} · {t(`forms.${m.dosageForm}`)}
                    </p>
                  </div>
                </div>
                {mine.has(m.id) ? (
                  <span className="text-meta text-ok-text">{t('add.alreadyListed')}</span>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusPicker
                      label={t('update.statusFor', { name: pick(m) })}
                      value={status[m.id] ?? 'available'}
                      onChange={(v) => setStatus((s) => ({ ...s, [m.id]: v }))}
                    />
                    <Button
                      variant="secondary"
                      loading={add.isPending && add.variables?.medicineId === m.id}
                      onClick={async () => {
                        await add.mutateAsync({ medicineId: m.id, status: status[m.id] ?? 'available' });
                        setSelected((s) => {
                          const n = new Set(s);
                          n.delete(m.id);
                          return n;
                        });
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
        </>
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
