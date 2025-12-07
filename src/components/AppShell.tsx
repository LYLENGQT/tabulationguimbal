import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Crown, LineChart, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { ThemeToggle } from './ThemeToggle';
import { cn } from '../lib/utils';
import { supabaseAuth } from '../services/supabaseApi';

type Props = {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  showAdminLink?: boolean;
  showRankingsLink?: boolean;
};

const NAV_ITEMS = [
  { label: 'Rankings', href: '/rankings', icon: LineChart },
  { label: 'Admin', href: '/admin', icon: Crown }
];

export function AppShell({
  title,
  actions,
  children,
  showAdminLink = true,
  showRankingsLink = true
}: Props) {
  const location = useLocation();
  const navigate = useNavigate();

  const filteredNav = NAV_ITEMS.filter((item) =>
    item.label === 'Admin' ? showAdminLink : showRankingsLink
  );

  const handleLogout = async () => {
    try {
      await supabaseAuth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/70">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to={showAdminLink ? '/admin' : '/judge'} className="group flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 text-white shadow-sm shadow-slate-900/10 dark:from-white dark:to-slate-200 dark:text-slate-900">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500 transition-colors group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200">
                Mr & Ms Teen
              </p>
              <h1 className="text-lg font-semibold text-slate-900 transition-colors group-hover:text-slate-700 dark:text-white">
                {title}
              </h1>
            </div>
          </Link>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {filteredNav.map((item) => {
              const isActive = location.pathname === item.href;
              const Icon = item.icon;
              return (
                <Link key={item.href} to={item.href}>
                  <Button
                    variant={isActive ? 'default' : 'ghost'}
                    size="sm"
                    className={cn(
                      'rounded-xl px-4',
                      isActive
                        ? 'bg-slate-900 text-white shadow-sm hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-white/90'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                    )}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
            {actions}
            <div className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/70 px-2 py-1 shadow-sm dark:border-white/10 dark:bg-slate-900/60">
              <ThemeToggle />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-slate-100/70 via-white to-transparent dark:from-slate-900/80 dark:via-slate-950" />
        <motion.main
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="relative mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}


