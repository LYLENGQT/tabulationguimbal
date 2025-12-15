import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Lock, ShieldCheck, Sparkles } from 'lucide-react';
import { supabaseAuth } from '../services/supabaseApi';
import { getSupabaseClient } from '../lib/supabaseClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';

const schema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

const logoModules = import.meta.glob('../../logos/*.{jpg,jpeg,png,webp}', {
  eager: true,
  as: 'url'
});

const SCHOOL_LOGOS = Object.entries(logoModules).map(([path, src]) => {
  const filename = path.split('/').pop()?.replace(/\.[^/.]+$/, '') ?? '';
  return { name: filename, src };
});

export function JudgeLoginPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [isChecking, setIsChecking] = useState(true);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<{ username: string; password: string }>({
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
          navigate('/admin/login', { replace: true });
        } else {
          navigate('/judge', { replace: true });
        }
      } else {
        setIsChecking(false);
      }
    };
    checkAuth();
  }, [navigate]);

  const onSubmit = handleSubmit(async ({ username, password }) => {
    setMessage('');
    try {
      await supabaseAuth.signInWithUsername(username, password);
      const role = await supabaseAuth.getCurrentRole();
      if (role === 'admin') {
        setMessage('Administrators must use the admin login page.');
        await supabaseAuth.signOut();
        setTimeout(() => navigate('/admin/login'), 2000);
      } else {
        // Update last_active and log activity on successful login
        const judge = await supabaseAuth.getUserJudge();
        if (judge) {
          const { updateJudgeLastActive, logActivity } = await import('../services/supabaseApi');
          await updateJudgeLastActive(judge.id);
          await logActivity({
            user_id: judge.id,
            user_type: 'judge',
            user_name: judge.full_name,
            action_type: 'judge_logged_in',
            description: `${judge.full_name} logged in`,
            metadata: { division: judge.division }
          });
        }
        navigate('/judge');
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
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6 lg:flex-row lg:items-center lg:gap-12 lg:px-10">
        {/* Hero / Landing */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative w-full lg:w-3/5"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
            <Sparkles className="h-4 w-4 text-amber-500" />
            Live Tabulation for Mr & Ms Teen 2025
          </div>
          <h1 className="mt-4 text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl dark:text-white">
            Modern online tabulation built for judges, admins, and schools.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
            Secure judging, real-time scoring, and beautifully presented results for every participating school.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              { icon: ShieldCheck, label: 'Role-Based Secure Access' },
              { icon: Lock, label: 'Locked Rows After Submission' },
              { icon: CheckCircle2, label: 'Instant Rankings Update' },
              { icon: Sparkles, label: 'Optimized Scoring Workflow' }
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white/70 px-4 py-3 shadow-sm dark:border-white/10 dark:bg-white/5"
              >
                <item.icon className="h-5 w-5 text-emerald-500" />
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{item.label}</p>
              </div>
            ))}
            </div>

          <div className="mt-8">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Participating Schools
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
              {SCHOOL_LOGOS.map((logo) => (
                <div
                  key={logo.name}
                  className="flex items-center gap-3 rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-white/10"
                >
                  <img
                    src={logo.src}
                    alt={logo.name}
                    className="h-10 w-10 rounded-lg object-cover ring-1 ring-slate-200 dark:ring-white/10"
                  />
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{logo.name}</span>
              </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Login Card */}
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="relative w-full lg:w-2/5"
        >
          <div className="pointer-events-none absolute -top-5 -right-2 z-30 flex items-center gap-2 rounded-full border border-amber-300/70 bg-slate-900 px-4 py-2 text-sm font-semibold text-amber-200 shadow-xl shadow-slate-900/30 dark:bg-white dark:text-slate-900 dark:border-amber-500/50">
            <span className="uppercase tracking-[0.2em] font-black text-amber-300 dark:text-amber-600">codewithlyle</span>
            <span className="h-5 w-px bg-amber-300/60 dark:bg-amber-500/50" />
            <span className="font-semibold">Lyle Denver Lague</span>
          </div>
          <Card className="rounded-2xl border border-slate-200/80 bg-white/80 shadow-xl shadow-slate-900/5 backdrop-blur dark:border-white/10 dark:bg-slate-900/70 dark:shadow-black/30">
            <CardHeader className="pb-4 text-center">
              <CardTitle className="text-3xl font-semibold text-slate-900 dark:text-white">Judge Portal</CardTitle>
              <CardDescription className="text-base text-slate-600 dark:text-slate-300">
                Sign in with the credentials provided by the tabulation committee.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Username
                  </Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="judge_username"
                    className="h-11 rounded-xl border-slate-200 bg-white shadow-sm focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-white/30 dark:focus:ring-white/10"
                    {...register('username')}
                  />
                  {errors.username && (
                    <p className="text-xs text-rose-600 dark:text-rose-400">{errors.username.message}</p>
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
                  {isSubmitting ? 'Signing in…' : 'Enter Judging Panel'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                {message && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-center text-sm text-rose-600 shadow-sm dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300">
                      {message}
                  </div>
                )}
                <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                  <Lock className="h-4 w-4" />
                  Your session stays encrypted and tied to your assigned division.
                </div>
                <div className="text-center">
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    onClick={() => navigate('/admin/login')}
                  >
                    Admin Login →
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


