import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Crown, LineChart, LogOut, Clock } from 'lucide-react';
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
  fullWidth?: boolean;
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
  showRankingsLink = true,
  fullWidth = false
}: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());

  const filteredNav = NAV_ITEMS.filter((item) =>
    item.label === 'Admin' ? showAdminLink : showRankingsLink
  );

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleLogout = async () => {
    try {
      const role = await supabaseAuth.getCurrentRole();
      
      // If judge is logging out, clear last_active and log activity
      if (role === 'judge') {
        const judge = await supabaseAuth.getUserJudge();
        if (judge) {
          const { getSupabaseClient } = await import('../lib/supabaseClient');
          const supabase = getSupabaseClient();
          // Clear last_active by setting it to null
          await supabase
            .from('judges')
            .update({ last_active: null })
            .eq('id', judge.id);
          
          // Log logout activity
          const { logActivity } = await import('../services/supabaseApi');
          await logActivity({
            user_id: judge.id,
            user_type: 'judge',
            user_name: judge.full_name,
            action_type: 'judge_logged_out',
            description: `${judge.full_name} logged out`,
            metadata: { division: judge.division }
          });
        }
      }
      
      await supabaseAuth.signOut();
      navigate(role === 'admin' ? '/admin/login' : '/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Fallback to judge login if role check fails
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/70">
        <div className={cn(
          "mx-auto flex w-full items-center justify-between px-4 py-4 sm:px-6 lg:px-8",
          !fullWidth && "max-w-6xl"
        )}>
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
          <div className="flex items-center gap-3">
            {/* Real-time Clock */}
            <div className="hidden items-center gap-2 rounded-xl border border-slate-200/80 bg-white/70 px-3 py-1.5 shadow-sm dark:border-white/10 dark:bg-slate-900/60 sm:flex">
              <Clock className="h-4 w-4 text-slate-600 dark:text-slate-300" />
              <div className="flex flex-col items-end">
                <span className="text-sm font-mono font-semibold text-slate-900 dark:text-white">
                  {formatTime(currentTime)}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  {formatDate(currentTime)}
                </span>
              </div>
            </div>
          </div>
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
          className={cn(
            "relative mx-auto w-full px-4 py-10 sm:px-6 lg:px-8",
            !fullWidth && "max-w-6xl"
          )}
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}


