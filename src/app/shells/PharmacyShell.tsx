import { PortalShell } from './PortalShell';
import { pharmacyNav } from './navs';

export default function PharmacyShell() {
  return <PortalShell titleKey="portal.pharmacy.title" nav={pharmacyNav} />;
}
