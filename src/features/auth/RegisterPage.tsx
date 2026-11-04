// A-05 تسجيل مؤسسة (4 خطوات) — the draft is kept on the device between steps (never the password).
import { Building2, MapPin, Pencil } from 'lucide-react';
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import {
  Button,
  Field,
  FieldError,
  FileUpload,
  GovernorateSelect,
  HoursEditor,
  PasswordInput,
  Skeleton,
  Stepper,
  inputClass,
} from '../../components/ui';
import { governorateById, type DocumentMeta, type OrgType, type RegistrationDraft } from '../../data';
import { useMe, useRegister } from '../../data/portalQueries';
import { useSettings } from '../../data/queries';
import { REQUIRED_DOCS_DEFAULT } from '../../data/requiredDocs';
import { useLang } from '../../hooks/useLang';
import { readJson, safeStorage } from '../../lib/storage';
import { cn } from '../../lib/cn';

const MapPicker = lazy(() => import('../../components/ui/MapPicker'));
const TYPES: OrgType[] = ['pharmacy', 'hospital', 'medical_point', 'humanitarian'];

type Draft = Omit<RegistrationDraft, 'account'> & { account: Omit<RegistrationDraft['account'], 'password'> };
type Errors = Record<string, string>;

const emptyDraft = (type: OrgType): Draft => ({
  account: { contactName: '', contactRole: '', email: '', phone: '' },
  org: {
    type,
    nameAr: '',
    nameEn: '',
    licenseNo: '',
    governorate: 'khan_younis',
    area: 'center',
    addressText: '',
    landmark: '',
    lat: null,
    lng: null,
    locationPrecision: 'area',
    phone: '',
    whatsapp: '',
    hours: {},
  },
  documents: [],
});

const phone = z.string().trim().regex(/^[+\d][\d\s-]{6,16}$/, 'phone');
const optionalPhone = z.string().trim().refine((v) => v === '' || /^[+\d][\d\s-]{6,16}$/.test(v), 'phone');
const accountSchema = z.object({
  contactName: z.string().trim().min(2, 'required'),
  contactRole: z.string().trim().min(2, 'required'),
  email: z.string().trim().email('email'),
  phone,
  password: z.string().min(8, 'passwordShort'),
});
const orgSchema = z
  .object({
    nameAr: z.string().trim().min(2, 'required'),
    licenseNo: z.string().trim().min(2, 'licenseRequired'),
    addressText: z.string().trim().min(3, 'required'),
    phone,
    whatsapp: optionalPhone,
    locationPrecision: z.enum(['exact', 'area', 'hidden']),
    lat: z.number().nullable(),
  })
  .refine((o) => o.locationPrecision !== 'exact' || o.lat !== null, { path: ['lat'], message: 'pinRequired' });

/** zod issues → { field: errorKey }, first issue per field. */
function errorsOf(result: z.ZodSafeParseResult<unknown>): Errors {
  if (result.success) return {};
  const out: Errors = {};
  for (const i of result.error.issues) out[String(i.path[0])] ??= i.message;
  return out;
}

export default function RegisterPage() {
  const { type: typeParam } = useParams();
  const type = TYPES.find((x) => x === typeParam);
  if (!type) return <Navigate to="/for-organizations" replace />;
  return <Wizard key={type} type={type} />;
}

function Wizard({ type }: { type: OrgType }) {
  const { t } = useTranslation();
  const { pick } = useLang();
  const navigate = useNavigate();
  const { data: me, isPending: mePending } = useMe();
  const register = useRegister();
  const storageKey = `madad.registerDraft.${type}`;
  const [draft, setDraft] = useState<Draft>(() => readJson(storageKey, emptyDraft(type)));
  const [password, setPassword] = useState('');
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [showMap, setShowMap] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const signedIn = !!me;

  // "تُحفظ المسودة على جهازك تلقائيًا" — everything except the password.
  useEffect(() => {
    safeStorage.setItem(storageKey, JSON.stringify(draft));
  }, [draft, storageKey]);

  const steps = [t('register.stepAccount'), t('register.stepOrg'), t('register.stepDocs'), t('register.stepReview')];
  const gov = governorateById(draft.org.governorate);
  const settings = useSettings();
  const required = (settings.data?.requiredDocs ?? REQUIRED_DOCS_DEFAULT)[type];
  const docFor = (docType: string) => draft.documents.find((d) => d.docType === docType) ?? null;

  const setAccount = (patch: Partial<Draft['account']>) => setDraft((d) => ({ ...d, account: { ...d.account, ...patch } }));
  const setOrg = (patch: Partial<Draft['org']>) => setDraft((d) => ({ ...d, org: { ...d.org, ...patch } }));
  const setDoc = (docType: string, doc: DocumentMeta | null) =>
    setDraft((d) => ({ ...d, documents: [...d.documents.filter((x) => x.docType !== docType), ...(doc ? [doc] : [])] }));

  const validate = (s: number): Errors => {
    if (s === 0) return signedIn ? {} : errorsOf(accountSchema.safeParse({ ...draft.account, password }));
    if (s === 1) return errorsOf(orgSchema.safeParse(draft.org));
    if (s === 2) return Object.fromEntries(required.filter((r) => !docFor(r)).map((r) => [`doc_${r}`, 'docRequired']));
    return {};
  };

  // Focus moves to the first error (SPEC §11).
  useEffect(() => {
    const first = Object.keys(errors)[0];
    if (!first) return;
    const el = formRef.current?.querySelector<HTMLElement>(`[data-field="${first}"] input, [data-field="${first}"] button, [data-field="${first}"] select`);
    el?.focus();
  }, [errors]);

  const next = () => {
    const e = validate(step);
    setErrors(e);
    if (Object.keys(e).length === 0) setStep((s) => Math.min(3, s + 1));
  };

  const submit = async () => {
    for (const s of [0, 1, 2]) {
      const e = validate(s);
      if (Object.keys(e).length) {
        setStep(s);
        setErrors(e);
        return;
      }
    }
    const res = await register.mutateAsync({ ...draft, account: { ...draft.account, password } });
    if (!res.ok) {
      setStep(0);
      setErrors({ email: 'emailTaken' });
      return;
    }
    safeStorage.setItem(storageKey, '');
    navigate('/register/status', { replace: true });
  };

  if (mePending) return <Skeleton className="h-96" />;

  const f = (name: string, node: ReactNode) => <div data-field={name}>{node}</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-control bg-mint">
          <Building2 aria-hidden className="size-6 text-secondary" />
        </span>
        <div>
          <h1 className="text-page">{t('register.title', { type: t(`orgTypes.${type}`) })}</h1>
          <p className="text-meta text-ink-muted">{t('register.draftNote')}</p>
        </div>
      </header>
      <Stepper steps={steps} current={step} />

      <div ref={formRef} className="space-y-5 rounded-card border border-border bg-surface p-5 shadow-card">
        <h2 className="text-section">{steps[step]}</h2>

        {step === 0 &&
          (signedIn ? (
            <p className="rounded-card bg-mint p-4">{t('register.signedInAs', { name: me!.displayName, email: me!.email })}</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {f('contactName', <Field label={t('register.contactName')} error={errors.contactName}><input className={inputClass} autoComplete="name" value={draft.account.contactName} onChange={(e) => setAccount({ contactName: e.target.value })} /></Field>)}
              {f('contactRole', <Field label={t('register.contactRole')} hint={t('register.contactRoleHint')} error={errors.contactRole}><input className={inputClass} value={draft.account.contactRole} onChange={(e) => setAccount({ contactRole: e.target.value })} /></Field>)}
              {f('email', <Field label={t('account.email')} error={errors.email}><input type="email" dir="ltr" autoComplete="email" className={inputClass} value={draft.account.email} onChange={(e) => setAccount({ email: e.target.value })} /></Field>)}
              {f('phone', <Field label={t('account.phone')} error={errors.phone}><input type="tel" dir="ltr" autoComplete="tel" className={inputClass} value={draft.account.phone} onChange={(e) => setAccount({ phone: e.target.value })} /></Field>)}
              {f('password', <Field label={t('auth.password')} hint={t('register.passwordNotSaved')} error={errors.password} className="md:col-span-2"><PasswordInput autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>)}
            </div>
          ))}

        {step === 1 && (
          <div className="grid gap-4 md:grid-cols-2">
            {f('nameAr', <Field label={t('register.nameAr')} error={errors.nameAr}><input className={inputClass} value={draft.org.nameAr} onChange={(e) => setOrg({ nameAr: e.target.value })} /></Field>)}
            <Field label={t('register.nameEn')} optional>
              <input dir="ltr" className={inputClass} value={draft.org.nameEn} onChange={(e) => setOrg({ nameEn: e.target.value })} />
            </Field>
            <Field label={t('register.type')}>
              <select className={inputClass} value={draft.org.type} onChange={(e) => navigate(`/register/${e.target.value}`, { replace: true })}>
                {TYPES.map((x) => (
                  <option key={x} value={x}>
                    {t(`orgTypes.${x}`)}
                  </option>
                ))}
              </select>
            </Field>
            {f('licenseNo', <Field label={t('register.licenseNo')} error={errors.licenseNo}><input dir="ltr" className={inputClass} value={draft.org.licenseNo} onChange={(e) => setOrg({ licenseNo: e.target.value })} /></Field>)}
            <GovernorateSelect value={draft.org.governorate} allowAll={false} onChange={(g) => setOrg({ governorate: g, area: 'center', lat: null, lng: null })} />
            <Field label={t('register.area')}>
              <select className={inputClass} value={draft.org.area} onChange={(e) => setOrg({ area: e.target.value })}>
                {gov?.areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {pick(a)}
                  </option>
                ))}
              </select>
            </Field>
            {f('addressText', <Field label={t('register.address')} hint={t('register.addressHint')} error={errors.addressText} className="md:col-span-2"><input className={inputClass} value={draft.org.addressText} onChange={(e) => setOrg({ addressText: e.target.value })} /></Field>)}
            <Field label={t('register.landmark')} optional className="md:col-span-2">
              <input className={inputClass} value={draft.org.landmark} onChange={(e) => setOrg({ landmark: e.target.value })} />
            </Field>

            <div className="space-y-2 md:col-span-2" data-field="lat">
              <span className="block font-medium">{t('register.mapLabel')}</span>
              {showMap && gov ? (
                <Suspense fallback={<Skeleton className="h-64" />}>
                  <MapPicker
                    center={gov.center}
                    value={draft.org.lat != null && draft.org.lng != null ? { lat: draft.org.lat, lng: draft.org.lng } : null}
                    onChange={(p) => setOrg({ lat: p.lat, lng: p.lng })}
                    label={t('register.mapLabel')}
                  />
                </Suspense>
              ) : (
                <Button variant="secondary" onClick={() => setShowMap(true)}>
                  <MapPin aria-hidden className="size-4" />
                  {t('register.openMap')}
                </Button>
              )}
              {draft.org.lat != null && (
                <p className="text-meta text-ink-muted">
                  <bdi dir="ltr">
                    {draft.org.lat}, {draft.org.lng}
                  </bdi>
                </p>
              )}
              {errors.lat && <FieldError>{t(`errors.${errors.lat}`)}</FieldError>}
            </div>

            <fieldset className="space-y-2 md:col-span-2">
              <legend className="font-medium">{t('register.precision')}</legend>
              <p className="text-meta text-ink-muted">{t('register.precisionHint')}</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {(['exact', 'area', 'hidden'] as const).map((p) => (
                  <label
                    key={p}
                    className={cn(
                      'flex min-h-11 items-start gap-2 rounded-control border p-3',
                      draft.org.locationPrecision === p ? 'border-primary bg-mint' : 'border-border',
                    )}
                  >
                    <input type="radio" name="precision" checked={draft.org.locationPrecision === p} onChange={() => setOrg({ locationPrecision: p })} className="mt-1 size-4 accent-primary" />
                    <span>
                      <span className="block font-medium">{t(`register.precisionOpt.${p}`)}</span>
                      <span className="block text-meta text-ink-muted">{t(`register.precisionDesc.${p}`)}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {f('phone', <Field label={t('register.orgPhone')} error={errors.phone}><input type="tel" dir="ltr" className={inputClass} value={draft.org.phone} onChange={(e) => setOrg({ phone: e.target.value })} /></Field>)}
            {f('whatsapp', <Field label={t('actions.whatsapp')} optional error={errors.whatsapp}><input type="tel" dir="ltr" className={inputClass} value={draft.org.whatsapp} onChange={(e) => setOrg({ whatsapp: e.target.value })} /></Field>)}
            <div className="md:col-span-2">
              <HoursEditor value={draft.org.hours} onChange={(hours) => setOrg({ hours })} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-ink-muted">{t('register.docsIntro')}</p>
            {required.map((r) =>
              f(
                `doc_${r}`,
                <div key={r}>
                  <FileUpload label={t(`docTypes.${r}`)} docType={r} required value={docFor(r)} onChange={(d) => setDoc(r, d)} />
                  {errors[`doc_${r}`] && <FieldError>{t('errors.docRequired')}</FieldError>}
                </div>,
              ),
            )}
          </div>
        )}

        {step === 3 && (
          <dl className="space-y-4">
            <ReviewBlock title={steps[0]!} onEdit={() => setStep(0)}>
              {signedIn ? me!.email : `${draft.account.contactName} · ${draft.account.contactRole} · ${draft.account.email} · ${draft.account.phone}`}
            </ReviewBlock>
            <ReviewBlock title={steps[1]!} onEdit={() => setStep(1)}>
              {[draft.org.nameAr, draft.org.licenseNo, `${pick(gov)} · ${pick(gov?.areas.find((a) => a.id === draft.org.area))}`, draft.org.addressText, t(`register.precisionOpt.${draft.org.locationPrecision}`), draft.org.phone]
                .filter(Boolean)
                .join(' · ')}
            </ReviewBlock>
            <ReviewBlock title={steps[2]!} onEdit={() => setStep(2)}>
              {draft.documents.map((d) => `${t(`docTypes.${d.docType}`)}: ${d.fileName}`).join(' · ') || '—'}
            </ReviewBlock>
          </dl>
        )}

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <Button variant="secondary" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
            {t('register.prev')}
          </Button>
          {step < 3 ? (
            <Button onClick={next}>{t('register.next')}</Button>
          ) : (
            <Button onClick={submit} loading={register.isPending}>
              {t('register.submit')}
            </Button>
          )}
        </footer>
      </div>
    </div>
  );
}

function ReviewBlock({ title, onEdit, children }: { title: string; onEdit: () => void; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-start justify-between gap-3 rounded-card border border-border p-4">
      <div>
        <dt className="font-semibold">{title}</dt>
        <dd className="mt-1 text-meta text-ink-muted">{children}</dd>
      </div>
      <button type="button" onClick={onEdit} className="inline-flex min-h-10 items-center gap-1 text-primary hover:underline">
        <Pencil aria-hidden className="size-4" />
        {t('register.edit')}
      </button>
    </div>
  );
}

