// AD-04 الكتالوج وطلبات الأدوية — catalog, aliases, requests with duplicate detection, one-time CSV import.
import { zodResolver } from '@hookform/resolvers/zod';
import { CircleCheck, CircleX, FileUp, GitMerge, Pencil, Plus, TriangleAlert } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  Button,
  CardSkeleton,
  DataTable,
  Dialog,
  EmptyState,
  ErrorBanner,
  Field,
  Freshness,
  StatusBadge,
  Tabs,
  inputClass,
  useToast,
  type Column,
} from '../../components/ui';
import { DOSAGE_FORMS, type DosageForm, type Medicine, type MedicineRequestInput, type RequestReview } from '../../data';
import { useAddCatalogMedicine, useAdminCatalog, useAdminRequests, useImportCatalog, useReviewRequest, useSetAliases } from '../../data/adminQueries';
import { useLang } from '../../hooks/useLang';
import { csvToObjects } from '../../lib/csv';

const FORMS: readonly DosageForm[] = DOSAGE_FORMS;
const CSV_HEADER = ['name_ar', 'name_en', 'generic_name', 'strength', 'dosage_form', 'pack_size', 'manufacturer', 'barcode', 'category_id', 'aliases'];

export default function CatalogPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'catalog';
  return (
    <div className="space-y-4">
      <h1 className="text-page">{t('portal.admin.nav.catalog')}</h1>
      <Tabs
        label={t('portal.admin.nav.catalog')}
        active={tab}
        onChange={(id) => setParams({ tab: id }, { replace: true })}
        tabs={[
          { id: 'catalog', label: t('admin.catalogTab') },
          { id: 'requests', label: t('admin.requestsTab') },
          { id: 'import', label: t('admin.importTab') },
        ]}
      >
        {tab === 'catalog' && <CatalogTab />}
        {tab === 'requests' && <RequestsTab />}
        {tab === 'import' && <ImportTab />}
      </Tabs>
    </div>
  );
}

function CatalogTab() {
  const { t } = useTranslation();
  const { pick, strength } = useLang();
  const toast = useToast();
  const catalog = useAdminCatalog();
  const setAliases = useSetAliases();
  const [editing, setEditing] = useState<Medicine | null>(null);
  const [aliases, setAliasText] = useState('');
  const [params, setParams] = useSearchParams();
  const adding = params.get('add');
  const categories = useMemo(() => new Map((catalog.data?.categories ?? []).map((c) => [c.id, c])), [catalog.data]);

  const columns: Column<Medicine>[] = [
    { key: 'name', header: t('table.medicine'), cell: (m) => <span className="font-medium">{pick(m)}</span>, sortValue: (m) => pick(m), hideInCard: true },
    { key: 'generic', header: t('table.generic'), cell: (m) => <bdi dir="ltr">{m.genericName}</bdi>, sortValue: (m) => m.genericName },
    { key: 'strength', header: t('table.strength'), cell: (m) => strength(m) },
    { key: 'form', header: t('table.form'), cell: (m) => t(`forms.${m.dosageForm}`), sortValue: (m) => m.dosageForm },
    { key: 'cat', header: t('medicine.category'), cell: (m) => pick(categories.get(m.categoryId)), sortValue: (m) => m.categoryId },
    { key: 'aliases', header: t('admin.aliases'), cell: (m) => <span className="text-ink-muted">{m.aliases.join('، ') || '—'}</span> },
    {
      key: 'edit',
      header: t('table.actions'),
      cell: (m) => (
        <Button
          variant="ghost"
          size="sm"
          aria-label={t('admin.editAliases', { name: pick(m) })}
          onClick={() => {
            setEditing(m);
            setAliasText(m.aliases.join('، '));
          }}
        >
          <Pencil aria-hidden className="size-4" />
        </Button>
      ),
    },
  ];

  if (catalog.isPending) return <CardSkeleton />;
  if (catalog.isError || !catalog.data) return <ErrorBanner onRetry={() => void catalog.refetch()} />;

  const counts = new Map<string, number>();
  for (const m of catalog.data.medicines) counts.set(m.categoryId, (counts.get(m.categoryId) ?? 0) + 1);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setParams({ tab: 'catalog', add: '' }, { replace: true })}>
          <Plus aria-hidden className="size-4" />
          {t('admin.addMedicine')}
        </Button>
      </div>
      {adding !== null && (
        <AddMedicineDialog
          initialName={adding}
          categories={catalog.data.categories.map((c) => ({ id: c.id, label: pick(c) }))}
          onClose={() => setParams({ tab: 'catalog' }, { replace: true })}
        />
      )}
      <ul className="flex flex-wrap gap-2" aria-label={t('admin.categories')}>
        {catalog.data.categories.map((c) => (
          <li key={c.id} className="rounded-full border border-border bg-surface px-3 py-1 text-meta">
            {pick(c)} · <bdi>{counts.get(c.id) ?? 0}</bdi>
          </li>
        ))}
      </ul>
      <DataTable
        caption={t('admin.catalogTab')}
        rows={catalog.data.medicines}
        columns={columns}
        rowKey={(m) => m.id}
        searchText={(m) => `${m.nameAr} ${m.nameEn} ${m.genericName} ${m.aliases.join(' ')} ${m.barcode ?? ''}`}
        cardTitle={(m) => pick(m)}
        pageSize={20}
      />
      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={t('admin.editAliases', { name: editing ? pick(editing) : '' })}
        size="sm"
        footer={
          <Button
            loading={setAliases.isPending}
            onClick={async () => {
              await setAliases.mutateAsync({ medicineId: editing!.id, aliases: aliases.split(/[،,]/) });
              toast(t('admin.aliasesSaved'));
              setEditing(null);
            }}
          >
            {t('common.save')}
          </Button>
        }
      >
        <Field label={t('admin.aliases')} hint={t('admin.aliasesHint')}>
          <input className={inputClass} value={aliases} onChange={(e) => setAliasText(e.target.value)} />
        </Field>
      </Dialog>
    </div>
  );
}

const addSchema = z.object({
  nameAr: z.string().trim().min(2, 'required'),
  nameEn: z.string().trim().min(2, 'required'),
  genericName: z.string().trim().min(2, 'required'),
  strength: z.string().trim().min(1, 'required'),
  dosageForm: z.enum(FORMS as [DosageForm, ...DosageForm[]]),
  packSize: z.string().trim().min(1, 'required'),
  categoryId: z.string().min(1, 'required'),
  aliases: z.string(),
});

function AddMedicineDialog({ initialName, categories, onClose }: { initialName: string; categories: { id: string; label: string }[]; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const add = useAddCatalogMedicine();
  const arabic = /[؀-ۿ]/.test(initialName);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof addSchema>>({
    resolver: zodResolver(addSchema),
    defaultValues: { nameAr: arabic ? initialName : '', nameEn: arabic ? '' : initialName, genericName: '', strength: '', dosageForm: 'tablet', packSize: '', categoryId: '', aliases: '' },
  });
  const err = (k: keyof z.infer<typeof addSchema>) => formState.errors[k]?.message;
  const onSubmit = handleSubmit(async (f) => {
    await add.mutateAsync({ ...f, manufacturer: null, barcode: null, aliases: f.aliases.split(/[،,]/).map((a) => a.trim()).filter(Boolean) });
    toast(t('admin.medicineAdded', { name: f.nameAr }));
    onClose();
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title={t('admin.addMedicine')}
      size="lg"
      footer={
        <Button type="submit" form="add-med" loading={add.isPending}>
          {t('common.save')}
        </Button>
      }
    >
      <form id="add-med" onSubmit={onSubmit} noValidate className="grid gap-4 md:grid-cols-2">
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
        <Field label={t('medicine.category')} error={err('categoryId')}>
          <select className={inputClass} {...register('categoryId')}>
            <option value="">{t('add.f.pickCategory')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('admin.aliases')} hint={t('admin.aliasesHint')} optional><input className={inputClass} {...register('aliases')} /></Field>
      </form>
    </Dialog>
  );
}

function RequestsTab() {
  const { t } = useTranslation();
  const { pick } = useLang();
  const toast = useToast();
  const requests = useAdminRequests();
  const catalog = useAdminCatalog();
  const review = useReviewRequest();
  const med = (id: string) => catalog.data?.medicines.find((m) => m.id === id);

  if (requests.isPending) return <CardSkeleton />;
  if (requests.isError) return <ErrorBanner onRetry={() => void requests.refetch()} />;
  if (!requests.data?.length) return <EmptyState icon={CircleCheck} title={t('admin.noRequests')} />;

  const act = async (r: RequestReview, decision: 'approve' | 'merge' | 'reject', mergeInto?: string) => {
    await review.mutateAsync({ id: r.id, decision, mergeInto });
    toast(t(`admin.request.${decision}`, { name: pick(r) }));
  };

  return (
    <ul className="rise-children space-y-3">
      {requests.data.map((r) => (
        <li key={r.id} className="space-y-3 rounded-card border border-border bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{pick(r)}</p>
              <p className="text-meta text-ink-muted">
                <bdi dir="ltr">{r.genericName}</bdi> · {r.strength} · {t(`forms.${r.dosageForm}`)} · {r.packSize}
              </p>
              <p className="text-meta text-ink-muted">
                {t('admin.requestedBy', { org: pick({ nameAr: r.orgNameAr, nameEn: r.orgNameEn }) })} · <Freshness at={r.createdAt} bare />
              </p>
            </div>
            {r.status === 'pending' ? <StatusBadge status="pending_review" /> : <span className="text-meta">{t(`add.requestStatus.${r.status}`)}</span>}
          </div>
          {r.duplicates.length > 0 && (
            <p className="flex flex-wrap items-center gap-2 rounded-card bg-warn-bg p-3 text-meta text-warn-text">
              <TriangleAlert aria-hidden className="size-4 text-warn-icon" />
              {t('admin.maybeDuplicate')}
              {r.duplicates.map((d) => (
                <span key={d.medicineId} className="font-semibold">
                  {pick(med(d.medicineId))} (<bdi>{Math.round(d.score * 100)}%</bdi>)
                </span>
              ))}
            </p>
          )}
          {r.status === 'pending' && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void act(r, 'approve')}>
                <CircleCheck aria-hidden className="size-4" />
                {t('admin.approve')}
              </Button>
              {r.duplicates[0] && (
                <Button size="sm" variant="secondary" onClick={() => void act(r, 'merge', r.duplicates[0]!.medicineId)}>
                  <GitMerge aria-hidden className="size-4" />
                  {t('admin.mergeWith', { name: pick(med(r.duplicates[0].medicineId)) })}
                </Button>
              )}
              <Button size="sm" variant="danger" onClick={() => void act(r, 'reject')}>
                <CircleX aria-hidden className="size-4" />
                {t('admin.reject')}
              </Button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

type ImportRow = MedicineRequestInput & { aliases: string[] };

function ImportTab() {
  const { t } = useTranslation();
  const toast = useToast();
  const doImport = useImportCatalog();
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const read = async (file: File | undefined) => {
    if (!file) return;
    setProblem(null);
    const objects = csvToObjects(await file.text());
    const missing = CSV_HEADER.slice(0, 6).filter((h) => !(h in (objects[0] ?? {})));
    if (!objects.length || missing.length) return setProblem(t('admin.csvBadHeader', { cols: missing.join(', ') || CSV_HEADER.join(', ') }));
    setRows(
      objects.map((o) => ({
        nameAr: o.name_ar ?? '',
        nameEn: o.name_en ?? '',
        genericName: o.generic_name ?? '',
        strength: o.strength ?? '',
        dosageForm: (FORMS.includes(o.dosage_form as DosageForm) ? o.dosage_form : 'tablet') as DosageForm,
        packSize: o.pack_size ?? '',
        manufacturer: o.manufacturer || null,
        barcode: o.barcode || null,
        categoryId: o.category_id ?? '',
        aliases: (o.aliases ?? '').split('|').map((a) => a.trim()).filter(Boolean),
      })),
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-ink-muted">{t('admin.importIntro')}</p>
      <p className="text-meta">
        {t('admin.csvColumns')} <code dir="ltr" className="rounded bg-canvas px-1">{CSV_HEADER.join(',')}</code>
      </p>
      <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control border border-primary px-4 font-medium text-primary hover:bg-mint">
        <FileUp aria-hidden className="size-4" />
        {t('admin.chooseCsv')}
        <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => void read(e.target.files?.[0])} />
      </label>
      {problem && <p className="text-bad-text">{problem}</p>}
      {rows && (
        <div className="space-y-3">
          <p className="font-medium">{t('admin.csvPreview', { count: rows.length })}</p>
          <div className="max-h-72 overflow-auto rounded-card border border-border">
            <table className="w-full text-meta">
              <thead className="bg-canvas text-ink-muted">
                <tr>
                  <th className="px-3 py-2 text-start">{t('add.f.nameAr')}</th>
                  <th className="px-3 py-2 text-start">{t('add.f.nameEn')}</th>
                  <th className="px-3 py-2 text-start">{t('table.strength')}</th>
                  <th className="px-3 py-2 text-start">{t('table.form')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5">{r.nameAr}</td>
                    <td className="px-3 py-1.5" dir="ltr">
                      {r.nameEn}
                    </td>
                    <td className="px-3 py-1.5">{r.strength}</td>
                    <td className="px-3 py-1.5">{t(`forms.${r.dosageForm}`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button
            loading={doImport.isPending}
            onClick={async () => {
              const n = await doImport.mutateAsync(rows);
              toast(t('admin.imported', { count: n, total: rows.length }));
              setRows(null);
            }}
          >
            {t('admin.confirmImport')}
          </Button>
        </div>
      )}
    </div>
  );
}
