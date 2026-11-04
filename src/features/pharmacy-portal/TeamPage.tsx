// PH-08 الفريق والصلاحيات — members, roles and permission boxes; only the owner edits, every change is logged.
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Trash2, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button, CardSkeleton, ConfirmDialog, EmptyState, ErrorBanner, Field, inputClass, useToast } from '../../components/ui';
import { PERMS, type MemberRole, type TeamMember } from '../../data';
import { useInvite, useRemoveMember, useTeam, useUpdateMember } from '../../data/portalQueries';
import { usePharmacyCtx } from './context';

const ROLES: MemberRole[] = ['manager', 'staff', 'viewer'];
const inviteSchema = z.object({ email: z.string().trim().email('email'), role: z.enum(['manager', 'staff', 'viewer']) });

export default function TeamPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const { orgId, membership } = usePharmacyCtx();
  const team = useTeam(orgId);
  const invite = useInvite(orgId);
  const update = useUpdateMember(orgId);
  const remove = useRemoveMember(orgId);
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  const isOwner = membership.role === 'owner';
  const { register, handleSubmit, formState, reset } = useForm<z.infer<typeof inviteSchema>>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', role: 'staff' },
  });

  const onInvite = handleSubmit(async (f) => {
    await invite.mutateAsync(f);
    toast(t('team.invited', { email: f.email }));
    reset();
  });

  if (team.isPending) return <CardSkeleton />;
  if (team.isError) return <ErrorBanner onRetry={() => void team.refetch()} />;
  const members = team.data ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-page">{t('portal.pharmacy.nav.team')}</h1>
        <p className="text-meta text-ink-muted">{isOwner ? t('team.ownerHint') : t('team.readOnly')}</p>
      </div>

      {isOwner && (
        <form onSubmit={onInvite} noValidate className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-surface p-4">
          <Field label={t('team.inviteEmail')} error={formState.errors.email?.message} className="min-w-64 flex-1">
            <input type="email" dir="ltr" className={inputClass} {...register('email')} />
          </Field>
          <Field label={t('team.role')}>
            <select className={inputClass} {...register('role')}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`roles.${r}`)}
                </option>
              ))}
            </select>
          </Field>
          <Button type="submit" loading={invite.isPending}>
            <UserPlus aria-hidden className="size-4" />
            {t('team.invite')}
          </Button>
        </form>
      )}

      {members.length === 0 ? (
        <EmptyState icon={Users} title={t('team.empty')} />
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full text-meta">
            <caption className="sr-only">{t('portal.pharmacy.nav.team')}</caption>
            <thead className="bg-canvas text-ink-muted">
              <tr>
                <th scope="col" className="px-3 py-2 text-start font-medium">{t('team.member')}</th>
                <th scope="col" className="px-3 py-2 text-start font-medium">{t('team.role')}</th>
                {PERMS.map((p) => (
                  <th key={p} scope="col" className="px-2 py-2 text-center font-medium">
                    {t(`perms.${p}`)}
                  </th>
                ))}
                <th scope="col" className="px-3 py-2"><span className="sr-only">{t('table.actions')}</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.map((m) => {
                const locked = !isOwner || m.role === 'owner';
                return (
                  <tr key={m.key} className="h-[38px]">
                    <td className="px-3 py-2">
                      <span className="block font-medium">{m.displayName ?? m.email}</span>
                      <span className="inline-flex items-center gap-1 text-micro text-ink-muted">
                        {m.status === 'invited' && <Mail aria-hidden className="size-3.5" />}
                        <bdi dir="ltr">{m.email}</bdi>
                        {m.status === 'invited' && <> · {t('team.invitedStatus')}</>}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {locked ? (
                        t(`roles.${m.role}`)
                      ) : (
                        <select
                          aria-label={t('team.roleFor', { name: m.displayName ?? m.email })}
                          value={m.role}
                          onChange={(e) => void update.mutateAsync({ key: m.key, role: e.target.value as MemberRole }).then(() => toast(t('team.updated')))}
                          className="min-h-[38px] rounded-control border border-border bg-surface px-2"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {t(`roles.${r}`)}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    {PERMS.map((p) => (
                      <td key={p} className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          aria-label={t('team.permFor', { perm: t(`perms.${p}`), name: m.displayName ?? m.email })}
                          checked={m.perms[p]}
                          disabled={locked}
                          onChange={(e) => void update.mutateAsync({ key: m.key, perms: { ...m.perms, [p]: e.target.checked } })}
                          className="size-4 accent-primary"
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2 text-end">
                      {!locked && (
                        <Button variant="ghost" size="sm" aria-label={t('team.remove', { name: m.displayName ?? m.email })} onClick={() => setRemoving(m)}>
                          <Trash2 aria-hidden className="size-4 text-bad-text" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={t('team.removeTitle')}
        body={t('team.removeBody', { name: removing?.displayName ?? removing?.email ?? '' })}
        confirmLabel={t('team.removeConfirm')}
        loading={remove.isPending}
        onConfirm={async () => {
          await remove.mutateAsync(removing!.key);
          setRemoving(null);
          toast(t('team.removed'));
        }}
      />
    </div>
  );
}
