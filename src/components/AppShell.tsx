import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Crown, LineChart, LogOut, Clock, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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

const DEV_PILL_BASE =
  'flex items-center gap-1.5 rounded-full border border-amber-300/70 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-amber-200 shadow-xl shadow-slate-900/30 dark:bg-white dark:text-slate-900 dark:border-amber-500/50';

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const filteredNav = NAV_ITEMS.filter((item) =>
    item.label === 'Admin' ? showAdminLink : showRankingsLink
  );

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

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
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/70 relative">
        <div className={cn(
          "mx-auto flex w-full items-center justify-between gap-2 px-3 py-3 sm:px-4 sm:py-4 md:px-6 lg:px-8",
          !fullWidth && "max-w-6xl"
        )}>
          {/* Logo and Title */}
          <Link to={showAdminLink ? '/admin' : '/judge'} className="group flex items-center gap-2 sm:gap-3 min-w-0 flex-shrink">
            <div className="flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center overflow-hidden rounded-xl sm:rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/10 dark:border-white/10 dark:bg-slate-900 flex-shrink-0">
              <img
                src="/mrmsteenlogo.jpg"
                alt="Mr & Ms Teen Guimbal 2025 logo"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="flex items-center gap-4 lg:gap-12 min-w-0">
              <div className="min-w-0">
                <p className="text-[9px] sm:text-[11px] uppercase tracking-[0.2em] sm:tracking-[0.3em] text-slate-500 transition-colors group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200 truncate">
                  Mr & Ms Teen
                </p>
                <h1 className="text-sm sm:text-lg font-semibold text-slate-900 transition-colors group-hover:text-slate-700 dark:text-white truncate">
                  {title}
                </h1>
              </div>
              {/* Developer pill - hidden on mobile and tablet */}
              <div className={`hidden xl:flex ${DEV_PILL_BASE}`}>
                <span className="uppercase tracking-[0.2em] font-black text-amber-300 dark:text-amber-600">BY</span>
                <span className="h-4 w-px bg-amber-300/60 dark:bg-amber-500/50" />
                <span className="uppercase tracking-[0.2em] font-black text-amber-300 dark:text-amber-600">codewithlyle</span>
                <span className="h-4 w-px bg-amber-300/60 dark:bg-amber-500/50" />
                <span className="font-semibold">Lyle Denver Lague</span>
              </div>
            </div>
          </Link>
          
          {/* Real-time Clock - hidden on mobile/tablet */}
          <div className="hidden lg:flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/70 px-3 py-1.5 shadow-sm dark:border-white/10 dark:bg-slate-900/60 flex-shrink-0">
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
          
          {/* Desktop Navigation - hidden on mobile/tablet */}
          <div className="hidden md:flex items-center gap-2 lg:gap-3 flex-shrink-0">
            {/* Nav items */}
            {filteredNav.map((item) => {
              const isActive = location.pathname === item.href;
              const Icon = item.icon;
              return (
                <Link key={item.href} to={item.href}>
                  <Button
                    variant={isActive ? 'default' : 'ghost'}
                    size="sm"
                    className={cn(
                      'rounded-xl px-4 h-10',
                      isActive
                        ? 'bg-slate-900 text-white shadow-sm hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-white/90'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                    )}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
            
            {/* Actions slot */}
            {actions && (
              <div className="flex items-center gap-2">
                {actions}
              </div>
            )}
            
            {/* Theme and Logout */}
            <div className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/70 px-2 py-1 shadow-sm dark:border-white/10 dark:bg-slate-900/60">
              <ThemeToggle />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white px-3 h-9"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
          
          {/* Mobile/Tablet: Hamburger Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rounded-xl h-9 w-9 p-0 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
        
        {/* Mobile/Tablet Menu Dropdown */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              {/* Backdrop overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="md:hidden fixed inset-0 top-[57px] bg-black/20 backdrop-blur-sm z-40"
                onClick={() => setMobileMenuOpen(false)}
              />
              
              {/* Menu panel */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="md:hidden absolute left-0 right-0 top-full bg-white shadow-xl shadow-slate-900/10 dark:bg-slate-900 dark:shadow-black/30 z-50 border-b border-slate-200 dark:border-slate-800"
              >
                <div className="max-h-[calc(100vh-60px)] overflow-y-auto">
                  {/* Clock */}
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                      <span className="text-sm font-mono font-medium text-slate-700 dark:text-slate-200">
                        {formatTime(currentTime)}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(currentTime)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Navigation Links */}
                  <div className="p-2">
                    {filteredNav.map((item) => {
                      const isActive = location.pathname === item.href;
                      const Icon = item.icon;
                      return (
                        <Link key={item.href} to={item.href} onClick={() => setMobileMenuOpen(false)}>
                          <div
                            className={cn(
                              'flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors',
                              isActive
                                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                                : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                            )}
                          >
                            <Icon className="h-5 w-5" />
                            {item.label}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                  
                  {/* Actions (if any) */}
                  {actions && (
                    <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                        Actions
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        {actions}
                      </div>
                    </div>
                  )}
                  
                  {/* Logout Button */}
                  <div className="p-2 border-t border-slate-100 dark:border-slate-800">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full justify-start rounded-lg text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-300 h-12"
                    >
                      <LogOut className="h-5 w-5 mr-3" />
                      Logout
                    </Button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </header>

      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-slate-100/70 via-white to-transparent dark:from-slate-900/80 dark:via-slate-950" />
        <motion.main
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className={cn(
            "relative mx-auto w-full px-3 py-6 sm:px-4 sm:py-8 md:px-6 md:py-10 lg:px-8",
            !fullWidth && "max-w-6xl"
          )}
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}


