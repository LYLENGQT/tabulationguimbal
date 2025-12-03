import { Link } from 'react-router-dom';
import { Button } from './ui/button';

type Props = {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  showAdminLink?: boolean;
  showRankingsLink?: boolean;
};

export function AppShell({
  title,
  actions,
  children,
  showAdminLink = true,
  showRankingsLink = true
}: Props) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <header className="border-b border-slate-800 bg-slate-900/60">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold">{title}</h1>
            <p className="text-sm text-slate-400">
              Mr & Ms Teen Pageant Tabulation System
            </p>
          </div>
          <div className="flex items-center gap-3">
            {showRankingsLink && (
              <Link to="/rankings">
                <Button variant="ghost">Rankings</Button>
              </Link>
            )}
            {showAdminLink && (
              <Link to="/admin">
                <Button variant="ghost">Admin</Button>
              </Link>
            )}
            {actions}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}


