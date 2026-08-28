import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { EmailSyncBadgeProvider, useEmailSyncBadge } from '../context/EmailSyncBadgeContext';
import { BriefcaseIcon, ChartIcon, FileIcon, GridIcon, LogoutIcon, MailIcon } from './icons';
import { NavBadge } from './NavBadge';

function LayoutShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pendingCount } = useEmailSyncBadge();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  const initial = (user?.firstName?.[0] ?? user?.email?.[0] ?? '?').toUpperCase();

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-brand">
          <span className="app-brand-mark">JT</span>
          <span>Job Tracker</span>
        </div>
        <nav className="app-nav">
          <NavLink to="/" end>
            <GridIcon />
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/applications">
            <BriefcaseIcon />
            <span>Applications</span>
          </NavLink>
          <NavLink to="/resumes">
            <FileIcon />
            <span>Resumes</span>
          </NavLink>
          <NavLink to="/statistics">
            <ChartIcon />
            <span>Statistics</span>
          </NavLink>
          <NavLink to="/email-sync">
            <MailIcon />
            <span>Email Sync</span>
            <NavBadge count={pendingCount} />
          </NavLink>
        </nav>
        <div className="app-sidebar-footer">
          <div className="app-user">
            <span className="app-user-avatar">{initial}</span>
            <span className="app-user-email">{user?.email}</span>
          </div>
          <button type="button" className="app-logout-btn" onClick={handleLogout} title="Log out">
            <LogoutIcon />
          </button>
        </div>
      </aside>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}

export function Layout() {
  return (
    <EmailSyncBadgeProvider>
      <LayoutShell />
    </EmailSyncBadgeProvider>
  );
}
