import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

type Props = {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  showAdminLink?: boolean;
  showRankingsLink?: boolean;
};

const NAV_ITEMS = [
  { label: 'Rankings', href: '/rankings' },
  { label: 'Admin', href: '/admin' }
];

export function AppShell({
  title,
  actions,
  children,
  showAdminLink = true,
  showRankingsLink = true
}: Props) {
  const location = useLocation();

  const filteredNav = NAV_ITEMS.filter((item) =>
    item.label === 'Admin' ? showAdminLink : showRankingsLink
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <header className="sticky top-0 z-30 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
              Mr & Ms Teen
            </p>
            <h1 className="text-xl font-semibold text-white">{title}</h1>
          </div>
          <div className="flex items-center gap-3">
            {filteredNav.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link key={item.href} to={item.href}>
                  <Button
                    variant={isActive ? 'default' : 'ghost'}
                    className={cn(
                      'rounded-2xl px-5',
                      isActive
                        ? 'bg-white text-slate-900 hover:bg-white/90'
                        : 'text-slate-300'
                    )}
                  >
                    {item.label}
                  </Button>
                </Link>
              );
            })}
            {actions}
          </div>
        </div>
      </header>

      <motion.main
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mx-auto w-full max-w-7xl px-6 py-10"
      >
        {children}
      </motion.main>
    </div>
  );
}


