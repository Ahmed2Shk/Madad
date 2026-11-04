// Hooks for the admin panel (AD-01..AD-11) and the demo switcher. Keys live under 'me' (never persisted).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRepos } from './index';
import type { AdminRepo, DocumentStatus, MedicineRequestInput, PlatformSettings, ReportStatus, ReviewDecision } from './types';

const a = <T>(fn: (r: AdminRepo) => Promise<T>) => () => getRepos().then((r) => fn(r.admin));
export const adminKeys = {
  all: ['me', 'admin'] as const,
  overview: ['me', 'admin', 'overview'] as const,
  queue: ['me', 'admin', 'queue'] as const,
  orgs: ['me', 'admin', 'orgs'] as const,
  catalog: ['me', 'admin', 'catalog'] as const,
  requests: ['me', 'admin', 'requests'] as const,
  quality: ['me', 'admin', 'quality'] as const,
  demand: (days: number, cat: string, region: string) => ['me', 'admin', 'demand', days, cat, region] as const,
  reports: ['me', 'admin', 'reports'] as const,
  audit: ['me', 'admin', 'audit'] as const,
  settings: ['me', 'admin', 'settings'] as const,
};

export const useAdminOverview = () => useQuery({ queryKey: adminKeys.overview, queryFn: a((r) => r.overview()) });
export const useVerificationQueue = () => useQuery({ queryKey: adminKeys.queue, queryFn: a((r) => r.verificationQueue()) });
export const useAdminOrgs = () => useQuery({ queryKey: adminKeys.orgs, queryFn: a((r) => r.organizations()) });
export const useAdminCatalog = () => useQuery({ queryKey: adminKeys.catalog, queryFn: a((r) => r.catalog()) });
export const useAdminRequests = () => useQuery({ queryKey: adminKeys.requests, queryFn: a((r) => r.requests()) });
export const useDataQuality = () => useQuery({ queryKey: adminKeys.quality, queryFn: a((r) => r.dataQuality()) });
export const useUnmetDemand = (days: number, categoryId: string, region: 'gaza' | 'west_bank') =>
  useQuery({ queryKey: adminKeys.demand(days, categoryId, region), queryFn: a((r) => r.unmetDemand(days, categoryId, region)) });
export const useAdminReports = () => useQuery({ queryKey: adminKeys.reports, queryFn: a((r) => r.reports()) });
export const useAuditLog = () => useQuery({ queryKey: adminKeys.audit, queryFn: a((r) => r.audit()) });
export const usePlatformSettings = () => useQuery({ queryKey: adminKeys.settings, queryFn: a((r) => r.settings()) });

/** Admin writes change public reads too (approvals, suspensions, settings), so refresh everything. */
function useAdminMutation<V, R>(fn: (r: AdminRepo, v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (v: V) => getRepos().then((r) => fn(r.admin, v)), onSuccess: () => qc.invalidateQueries() });
}

export const useReviewOrg = () =>
  useAdminMutation((r, v: { orgId: string; decision: ReviewDecision; note: string }) => r.reviewOrg(v.orgId, v.decision, v.note));
export const useSetDocumentStatus = () =>
  useAdminMutation((r, v: { orgId: string; fileName: string; status: DocumentStatus }) => r.setDocumentStatus(v.orgId, v.fileName, v.status));
export const useSuspendOrg = () => useAdminMutation((r, v: { orgId: string; reason: string }) => r.suspendOrg(v.orgId, v.reason));
export const useReactivateOrg = () => useAdminMutation((r, orgId: string) => r.reactivateOrg(orgId));
export const useAddCatalogMedicine = () =>
  useAdminMutation((r, v: MedicineRequestInput & { aliases: string[] }) => r.addCatalogMedicine(v));
export const useSetAliases = () => useAdminMutation((r, v: { medicineId: string; aliases: string[] }) => r.setAliases(v.medicineId, v.aliases));
export const useImportCatalog = () =>
  useAdminMutation((r, rows: (MedicineRequestInput & { aliases: string[] })[]) => r.importCatalog(rows));
export const useReviewRequest = () =>
  useAdminMutation((r, v: { id: string; decision: 'approve' | 'merge' | 'reject'; mergeInto?: string }) => r.reviewRequest(v.id, v.decision, v.mergeInto));
export const useRemindPharmacy = () => useAdminMutation((r, id: string) => r.remindPharmacy(id));
export const useHideReport = () =>
  useAdminMutation((r, v: { pharmacyId: string; medicineId: string; reason: string }) => r.hideReport(v.pharmacyId, v.medicineId, v.reason));
export const useUpdateReport = () =>
  useAdminMutation((r, v: { id: string; status?: ReportStatus; adminNote?: string; resolution?: string }) => r.updateReport(v.id, v));
export const useUpdateSettings = () => useAdminMutation((r, patch: Partial<PlatformSettings>) => r.updateSettings(patch));

// ---------------------------------------------------------------- demo

export function useDemoSwitch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string | null) => getRepos().then((r) => r.demo.signInAs(userId)),
    onSuccess: () => {
      qc.removeQueries({ queryKey: ['me'] });
      void qc.invalidateQueries();
    },
  });
}

export function useDemoReset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => getRepos().then((r) => r.demo.reset()),
    onSuccess: () => qc.clear(),
  });
}
