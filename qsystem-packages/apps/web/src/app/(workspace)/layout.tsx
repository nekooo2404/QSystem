import { SessionGuard } from '../../components/shell/SessionGuard';

// shortcut: the shell owns every workspace route until Web 5/6 fill in the
// page bodies; each page is a placeholder that already renders inside it.
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <SessionGuard>{children}</SessionGuard>;
}
