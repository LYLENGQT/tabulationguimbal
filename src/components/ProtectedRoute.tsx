import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getSupabaseClient } from '../lib/supabaseClient';

type Props = {
  children: React.ReactNode;
};

export function ProtectedRoute({ children }: Props) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const location = useLocation();
  const supabase = getSupabaseClient();
  const isAdminRoute = location.pathname.startsWith('/admin');

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
    };

    checkAuth();

    // Listen for auth state changes
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session?.user);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  // Show nothing while checking
  if (isAuthenticated === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400">Checking authentication…</p>
        </div>
      </div>
    );
  }

  // Redirect to appropriate login page if not authenticated
  if (!isAuthenticated) {
    return <Navigate to={isAdminRoute ? '/admin/login' : '/login'} replace />;
  }

  // Render protected content
  return <>{children}</>;
}

