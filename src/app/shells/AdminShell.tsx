import { PortalShell } from './PortalShell';
import { adminNav } from './navs';

export default function AdminShell() {
  return <PortalShell titleKey="portal.admin.title" nav={adminNav} />;
}
