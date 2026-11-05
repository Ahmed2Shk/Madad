// Provider portal shell (SPEC §9): hospitals, medical points and humanitarian organizations.
import { OrgShell } from './PharmacyShell';

export default function ProviderShell() {
  return <OrgShell kind="provider" />;
}
