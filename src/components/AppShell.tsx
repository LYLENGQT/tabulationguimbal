import { Link, useLocation, useNavigate } from 'react-router-dom';
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:text-white">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-xl dark:border-white/5 dark:bg-slate-950/80">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
              Mr & Ms Teen
            </p>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h1>
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
                        ? 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-white/90'
                        : 'text-slate-600 dark:text-slate-300'
                    )}
                  >
                    {item.label}
                  </Button>
                </Link>
              );
            })}
            {actions}
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="rounded-2xl text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              Logout
            </Button>
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



            </p>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h1>
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
                        ? 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-white/90'
                        : 'text-slate-600 dark:text-slate-300'
                    )}
                  >
                    {item.label}
                  </Button>
                </Link>
              );
            })}
            {actions}
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="rounded-2xl text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              Logout
            </Button>
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



            </p>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h1>
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
                        ? 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-white/90'
                        : 'text-slate-600 dark:text-slate-300'
                    )}
                  >
                    {item.label}
                  </Button>
                </Link>
              );
            })}
            {actions}
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="rounded-2xl text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              Logout
            </Button>
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



            </p>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h1>
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
                        ? 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-white/90'
                        : 'text-slate-600 dark:text-slate-300'
                    )}
                  >
                    {item.label}
                  </Button>
                </Link>
              );
            })}
            {actions}
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="rounded-2xl text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              Logout
            </Button>
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



            </p>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h1>
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
                        ? 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-white/90'
                        : 'text-slate-600 dark:text-slate-300'
                    )}
                  >
                    {item.label}
                  </Button>
                </Link>
              );
            })}
            {actions}
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="rounded-2xl text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              Logout
            </Button>
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



            </p>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h1>
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
                        ? 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-white/90'
                        : 'text-slate-600 dark:text-slate-300'
                    )}
                  >
                    {item.label}
                  </Button>
                </Link>
              );
            })}
            {actions}
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="rounded-2xl text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              Logout
            </Button>
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


