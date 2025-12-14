import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { ArrowRight, Lock, ShieldCheck, Crown } from 'lucide-react';
import { supabaseAuth } from '../services/supabaseApi';
import { getSupabaseClient } from '../lib/supabaseClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';

const schema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

export function AdminLoginPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [isChecking, setIsChecking] = useState(true);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<{ email: string; password: string }>({
    resolver: zodResolver(schema)
  });

  // Redirect if already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = getSupabaseClient();
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (user) {
        const role = await supabaseAuth.getCurrentRole();
        if (role === 'admin') {
          navigate('/admin', { replace: true });
        } else {
          // If judge is logged in, redirect to judge login
          navigate('/login', { replace: true });
        }
      } else {
        setIsChecking(false);
      }
    };
    checkAuth();
  }, [navigate]);

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setMessage('');
    try {
      await supabaseAuth.signInWithPassword(email, password);
      const role = await supabaseAuth.getCurrentRole();
      if (role === 'admin') {
        navigate('/admin');
      } else {
        setMessage('Access denied. This login is for administrators only.');
        await supabaseAuth.signOut();
      }
    } catch (error) {
      setMessage((error as Error).message);
    }
  });

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.08),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.09),transparent_25%),radial-gradient(circle_at_50%_100%,rgba(14,165,233,0.08),transparent_32%)]" />
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white via-white/70 to-transparent dark:from-slate-900 dark:via-slate-950/70" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center gap-10 px-4 py-10 sm:px-6 lg:px-10">
        {/* Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          <Card className="rounded-2xl border border-slate-200/80 bg-white/80 shadow-xl shadow-slate-900/5 backdrop-blur dark:border-white/10 dark:bg-slate-900/70 dark:shadow-black/30">
            <CardHeader className="pb-4 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-900 dark:bg-white">
                <Crown className="h-8 w-8 text-white dark:text-slate-900" />
              </div>
              <CardTitle className="text-3xl font-semibold text-slate-900 dark:text-white">Admin Portal</CardTitle>
              <CardDescription className="text-base text-slate-600 dark:text-slate-300">
                Sign in with your administrator credentials.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@mrmsteen2025.com"
                    className="h-11 rounded-xl border-slate-200 bg-white shadow-sm focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-white/30 dark:focus:ring-white/10"
                    {...register('email')}
                  />
                  {errors.email && (
                    <p className="text-xs text-rose-600 dark:text-rose-400">{errors.email.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="h-11 rounded-xl border-slate-200 bg-white shadow-sm focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-white/30 dark:focus:ring-white/10"
                    {...register('password')}
                  />
                  {errors.password && (
                    <p className="text-xs text-rose-600 dark:text-rose-400">{errors.password.message}</p>
                  )}
                </div>
                <Button
                  type="submit"
                  className="h-11 w-full rounded-xl bg-slate-900 text-white shadow-sm transition hover:-translate-y-[1px] hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-white/90"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Signing in…' : 'Enter Admin Dashboard'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                {message && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-center text-sm text-rose-600 shadow-sm dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300">
                    {message}
                  </div>
                )}
                <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                  <ShieldCheck className="h-4 w-4" />
                  Administrator access only. Judges should use the judge login page.
                </div>
                <div className="text-center">
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    onClick={() => navigate('/login')}
                  >
                    Judge Login →
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
