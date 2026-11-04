// P-12 الحساب والإعدادات — no medical fields, ever (SPEC §2 rule 8).
import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, CircleAlert, Download, LogOut, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button, ConfirmDialog, GovernorateSelect, useToast } from '../../components/ui';
import { exportMyData, useDeleteAccount, useSession, useSignOut, useUpdateProfile } from '../../data/queries';
import { usePreferences } from '../../hooks/usePreferences';
import { SignedInOnly } from './SignedInOnly';

const schema = z.object({
  displayName: z.string().trim().min(2, 'required').max(60),
  phone: z
    .string()
    .trim()
    .refine((v) => v === '' || /^[+\d][\d\s-]{6,16}$/.test(v), 'phone'),
});
type Form = z.infer<typeof schema>;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-card border border-border bg-surface p-5 shadow-card">
      <h2 className="text-section">{title}</h2>
      {children}
    </section>
  );
}

function Account() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const session = useSession().data!;
  const update = useUpdateProfile();
  const signOut = useSignOut();
  const del = useDeleteAccount();
  const [prefs, setPrefs] = usePreferences();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { register, handleSubmit, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: session.displayName, phone: session.phone ?? '' },
    shouldFocusError: true,
  });
  const err = (k: keyof Form) => formState.errors[k]?.message;

  const save = handleSubmit(async (f) => {
    await update.mutateAsync({ displayName: f.displayName, phone: f.phone || null });
    toast(t('account.saved'));
  });

  const download = async () => {
    const data = await exportMyData();
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'madad-my-data.json' });
    a.click();
    URL.revokeObjectURL(url);
  };

  const dataSaverValue = prefs.dataSaver === null ? 'auto' : prefs.dataSaver ? 'on' : 'off';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-page">{t('account.title')}</h1>

      <Section title={t('account.profile')}>
        <form onSubmit={save} className="space-y-4" noValidate>
          <div>
            <label htmlFor="acc-name" className="font-medium">
              {t('account.name')}
            </label>
            <input id="acc-name" {...register('displayName')} aria-invalid={!!err('displayName')} className="mt-1 min-h-11 w-full rounded-control border border-border px-3" />
            {err('displayName') && (
              <p className="mt-1 flex items-center gap-1 text-meta text-bad-text">
                <CircleAlert aria-hidden className="size-4" />
                {t(`errors.${err('displayName')}`)}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="acc-email" className="font-medium">
              {t('account.email')}
            </label>
            <input id="acc-email" value={session.email} readOnly dir="ltr" className="mt-1 min-h-11 w-full rounded-control border border-border bg-canvas px-3 text-ink-muted" />
          </div>
          <div>
            <label htmlFor="acc-phone" className="font-medium">
              {t('account.phone')} <span className="text-meta text-ink-muted">({t('common.optional')})</span>
            </label>
            <input id="acc-phone" type="tel" dir="ltr" {...register('phone')} aria-invalid={!!err('phone')} className="mt-1 min-h-11 w-full rounded-control border border-border px-3" />
            {err('phone') && (
              <p className="mt-1 flex items-center gap-1 text-meta text-bad-text">
                <CircleAlert aria-hidden className="size-4" />
                {t(`errors.${err('phone')}`)}
              </p>
            )}
          </div>
          <Button type="submit" loading={update.isPending}>
            {t('common.save')}
          </Button>
        </form>
      </Section>

      <Section title={t('account.preferences')}>
        <fieldset className="space-y-2">
          <legend className="font-medium">{t('account.language')}</legend>
          <div className="flex gap-4">
            {(['ar', 'en'] as const).map((l) => (
              <label key={l} className="flex min-h-11 items-center gap-2">
                <input type="radio" name="lang" checked={i18n.language === l} onChange={() => void i18n.changeLanguage(l)} className="size-4 accent-primary" />
                {t(`account.lang_${l}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <GovernorateSelect value={prefs.gov} onChange={(g) => g !== 'all' && setPrefs({ gov: g })} allowAll={false} className="max-w-xs" />
        <fieldset className="space-y-1">
          <legend className="font-medium">{t('account.dataSaver')}</legend>
          <p className="text-meta text-ink-muted">{t('account.dataSaverHint')}</p>
          <div className="flex flex-wrap gap-4">
            {(['auto', 'on', 'off'] as const).map((v) => (
              <label key={v} className="flex min-h-11 items-center gap-2">
                <input
                  type="radio"
                  name="saver"
                  checked={dataSaverValue === v}
                  onChange={() => setPrefs({ dataSaver: v === 'auto' ? null : v === 'on' })}
                  className="size-4 accent-primary"
                />
                {t(`account.saver_${v}`)}
              </label>
            ))}
          </div>
        </fieldset>
      </Section>

      <Section title={t('account.privacy')}>
        <p className="text-meta text-ink-muted">{t('account.privacyNote')}</p>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={download}>
            <Download aria-hidden className="size-4" />
            {t('account.download')}
          </Button>
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 aria-hidden className="size-4" />
            {t('account.delete')}
          </Button>
        </div>
      </Section>

      <Section title={t('account.more')}>
        <ul className="space-y-2">
          <li>
            <Link to="/about" className="text-primary underline-offset-4 hover:underline">
              {t('info.about')}
            </Link>
          </li>
          <li>
            <Link to="/terms" className="text-primary underline-offset-4 hover:underline">
              {t('info.terms')}
            </Link>
          </li>
          <li>
            <Link to="/privacy" className="text-primary underline-offset-4 hover:underline">
              {t('info.privacy')}
            </Link>
          </li>
          <li>
            <Link to="/about#contact" className="text-primary underline-offset-4 hover:underline">
              {t('info.contact')}
            </Link>
          </li>
          <li>
            <Link to="/for-organizations" className="inline-flex items-center gap-2 text-primary underline-offset-4 hover:underline">
              <Building2 aria-hidden className="size-4" />
              {t('account.haveOrg')}
            </Link>
          </li>
        </ul>
        <Button
          variant="ghost"
          onClick={async () => {
            await signOut.mutateAsync();
            navigate('/');
          }}
        >
          <LogOut aria-hidden className="size-4" />
          {t('account.signOut')}
        </Button>
      </Section>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t('account.deleteTitle')}
        body={t('account.deleteBody')}
        confirmLabel={t('account.deleteConfirm')}
        loading={del.isPending}
        onConfirm={async () => {
          await del.mutateAsync();
          setConfirmDelete(false);
          toast(t('account.deleted'));
          navigate('/');
        }}
      />
    </div>
  );
}

export default function AccountPage() {
  return (
    <SignedInOnly>
      <Account />
    </SignedInOnly>
  );
}
