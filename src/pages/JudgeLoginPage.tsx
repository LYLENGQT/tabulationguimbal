import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { supabaseAuth } from '../services/supabaseApi';
import { getSupabaseClient } from '../lib/supabaseClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

export function JudgeLoginPage() {
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
        navigate(role === 'admin' ? '/admin' : '/judge', { replace: true });
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
      navigate(role === 'admin' ? '/admin' : '/judge');
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
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Left Column - Visual/Branding */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px] opacity-50" />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 text-center px-12"
        >
          <div className="mb-8">
            <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">
              Mr & Ms Teen
            </h1>
            <p className="text-xl text-slate-300 font-light">
              Tabulation System
            </p>
          </div>
          <div className="mt-12 space-y-4 text-left max-w-md">
            <div className="flex items-start gap-4">
              <div className="mt-1 w-2 h-2 rounded-full bg-white/20 flex-shrink-0" />
              <div>
                <p className="text-white font-medium mb-1">Secure Access</p>
                <p className="text-slate-400 text-sm">
                  Protected judge portal with role-based authentication
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="mt-1 w-2 h-2 rounded-full bg-white/20 flex-shrink-0" />
              <div>
                <p className="text-white font-medium mb-1">Real-time Scoring</p>
                <p className="text-slate-400 text-sm">
                  Live updates and instant ranking calculations
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="mt-1 w-2 h-2 rounded-full bg-white/20 flex-shrink-0" />
              <div>
                <p className="text-white font-medium mb-1">Professional Interface</p>
                <p className="text-slate-400 text-sm">
                  Streamlined workflow for efficient judging
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Right Column - Login Form */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 lg:px-12">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          <div className="mb-8 lg:hidden text-center">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
              Mr & Ms Teen
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Tabulation System
            </p>
          </div>
          <Card className="p-8 lg:p-10 border-slate-200 dark:border-white/10 shadow-xl">
            <CardHeader className="text-center pb-6">
              <CardTitle className="text-3xl font-semibold text-slate-900 dark:text-white mb-2">
                Judge Portal
              </CardTitle>
              <CardDescription className="text-base text-slate-600 dark:text-slate-400">
                Sign in with the access provided by the tabulation committee.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-700 dark:text-slate-300">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@pageant.com"
                    className="h-12 rounded-2xl"
                    {...register('email')}
                  />
                  {errors.email && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
                      {errors.email.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-700 dark:text-slate-300">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="h-12 rounded-2xl"
                    {...register('password')}
                  />
                  {errors.password && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
                      {errors.password.message}
                    </p>
                  )}
                </div>
                <Button
                  type="submit"
                  className="h-12 w-full rounded-2xl text-base font-medium bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-white/90"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Signing in…' : 'Enter Panel'}
                </Button>
                {message && (
                  <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 px-4 py-3 text-center">
                    <p className="text-sm text-rose-600 dark:text-rose-400">
                      {message}
                    </p>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}



            <p className="text-xl text-slate-300 font-light">
              Tabulation System
            </p>
          </div>
          <div className="mt-12 space-y-4 text-left max-w-md">
            <div className="flex items-start gap-4">
              <div className="mt-1 w-2 h-2 rounded-full bg-white/20 flex-shrink-0" />
              <div>
                <p className="text-white font-medium mb-1">Secure Access</p>
                <p className="text-slate-400 text-sm">
                  Protected judge portal with role-based authentication
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="mt-1 w-2 h-2 rounded-full bg-white/20 flex-shrink-0" />
              <div>
                <p className="text-white font-medium mb-1">Real-time Scoring</p>
                <p className="text-slate-400 text-sm">
                  Live updates and instant ranking calculations
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="mt-1 w-2 h-2 rounded-full bg-white/20 flex-shrink-0" />
              <div>
                <p className="text-white font-medium mb-1">Professional Interface</p>
                <p className="text-slate-400 text-sm">
                  Streamlined workflow for efficient judging
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Right Column - Login Form */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 lg:px-12">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          <div className="mb-8 lg:hidden text-center">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
              Mr & Ms Teen
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Tabulation System
            </p>
          </div>
          <Card className="p-8 lg:p-10 border-slate-200 dark:border-white/10 shadow-xl">
            <CardHeader className="text-center pb-6">
              <CardTitle className="text-3xl font-semibold text-slate-900 dark:text-white mb-2">
                Judge Portal
              </CardTitle>
              <CardDescription className="text-base text-slate-600 dark:text-slate-400">
                Sign in with the access provided by the tabulation committee.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-700 dark:text-slate-300">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@pageant.com"
                    className="h-12 rounded-2xl"
                    {...register('email')}
                  />
                  {errors.email && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
                      {errors.email.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-700 dark:text-slate-300">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="h-12 rounded-2xl"
                    {...register('password')}
                  />
                  {errors.password && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
                      {errors.password.message}
                    </p>
                  )}
                </div>
                <Button
                  type="submit"
                  className="h-12 w-full rounded-2xl text-base font-medium bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-white/90"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Signing in…' : 'Enter Panel'}
                </Button>
                {message && (
                  <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 px-4 py-3 text-center">
                    <p className="text-sm text-rose-600 dark:text-rose-400">
                      {message}
                    </p>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}



            <p className="text-xl text-slate-300 font-light">
              Tabulation System
            </p>
          </div>
          <div className="mt-12 space-y-4 text-left max-w-md">
            <div className="flex items-start gap-4">
              <div className="mt-1 w-2 h-2 rounded-full bg-white/20 flex-shrink-0" />
              <div>
                <p className="text-white font-medium mb-1">Secure Access</p>
                <p className="text-slate-400 text-sm">
                  Protected judge portal with role-based authentication
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="mt-1 w-2 h-2 rounded-full bg-white/20 flex-shrink-0" />
              <div>
                <p className="text-white font-medium mb-1">Real-time Scoring</p>
                <p className="text-slate-400 text-sm">
                  Live updates and instant ranking calculations
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="mt-1 w-2 h-2 rounded-full bg-white/20 flex-shrink-0" />
              <div>
                <p className="text-white font-medium mb-1">Professional Interface</p>
                <p className="text-slate-400 text-sm">
                  Streamlined workflow for efficient judging
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Right Column - Login Form */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 lg:px-12">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          <div className="mb-8 lg:hidden text-center">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
              Mr & Ms Teen
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Tabulation System
            </p>
          </div>
          <Card className="p-8 lg:p-10 border-slate-200 dark:border-white/10 shadow-xl">
            <CardHeader className="text-center pb-6">
              <CardTitle className="text-3xl font-semibold text-slate-900 dark:text-white mb-2">
                Judge Portal
              </CardTitle>
              <CardDescription className="text-base text-slate-600 dark:text-slate-400">
                Sign in with the access provided by the tabulation committee.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-700 dark:text-slate-300">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@pageant.com"
                    className="h-12 rounded-2xl"
                    {...register('email')}
                  />
                  {errors.email && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
                      {errors.email.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-700 dark:text-slate-300">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="h-12 rounded-2xl"
                    {...register('password')}
                  />
                  {errors.password && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
                      {errors.password.message}
                    </p>
                  )}
                </div>
                <Button
                  type="submit"
                  className="h-12 w-full rounded-2xl text-base font-medium bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-white/90"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Signing in…' : 'Enter Panel'}
                </Button>
                {message && (
                  <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 px-4 py-3 text-center">
                    <p className="text-sm text-rose-600 dark:text-rose-400">
                      {message}
                    </p>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}



            <p className="text-xl text-slate-300 font-light">
              Tabulation System
            </p>
          </div>
          <div className="mt-12 space-y-4 text-left max-w-md">
            <div className="flex items-start gap-4">
              <div className="mt-1 w-2 h-2 rounded-full bg-white/20 flex-shrink-0" />
              <div>
                <p className="text-white font-medium mb-1">Secure Access</p>
                <p className="text-slate-400 text-sm">
                  Protected judge portal with role-based authentication
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="mt-1 w-2 h-2 rounded-full bg-white/20 flex-shrink-0" />
              <div>
                <p className="text-white font-medium mb-1">Real-time Scoring</p>
                <p className="text-slate-400 text-sm">
                  Live updates and instant ranking calculations
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="mt-1 w-2 h-2 rounded-full bg-white/20 flex-shrink-0" />
              <div>
                <p className="text-white font-medium mb-1">Professional Interface</p>
                <p className="text-slate-400 text-sm">
                  Streamlined workflow for efficient judging
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Right Column - Login Form */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 lg:px-12">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          <div className="mb-8 lg:hidden text-center">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
              Mr & Ms Teen
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Tabulation System
            </p>
          </div>
          <Card className="p-8 lg:p-10 border-slate-200 dark:border-white/10 shadow-xl">
            <CardHeader className="text-center pb-6">
              <CardTitle className="text-3xl font-semibold text-slate-900 dark:text-white mb-2">
                Judge Portal
              </CardTitle>
              <CardDescription className="text-base text-slate-600 dark:text-slate-400">
                Sign in with the access provided by the tabulation committee.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-700 dark:text-slate-300">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@pageant.com"
                    className="h-12 rounded-2xl"
                    {...register('email')}
                  />
                  {errors.email && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
                      {errors.email.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-700 dark:text-slate-300">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="h-12 rounded-2xl"
                    {...register('password')}
                  />
                  {errors.password && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
                      {errors.password.message}
                    </p>
                  )}
                </div>
                <Button
                  type="submit"
                  className="h-12 w-full rounded-2xl text-base font-medium bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-white/90"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Signing in…' : 'Enter Panel'}
                </Button>
                {message && (
                  <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 px-4 py-3 text-center">
                    <p className="text-sm text-rose-600 dark:text-rose-400">
                      {message}
                    </p>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

            <p className="text-xl text-slate-300 font-light">
              Tabulation System
            </p>
          </div>
          <div className="mt-12 space-y-4 text-left max-w-md">
            <div className="flex items-start gap-4">
              <div className="mt-1 w-2 h-2 rounded-full bg-white/20 flex-shrink-0" />
              <div>
                <p className="text-white font-medium mb-1">Secure Access</p>
                <p className="text-slate-400 text-sm">
                  Protected judge portal with role-based authentication
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="mt-1 w-2 h-2 rounded-full bg-white/20 flex-shrink-0" />
              <div>
                <p className="text-white font-medium mb-1">Real-time Scoring</p>
                <p className="text-slate-400 text-sm">
                  Live updates and instant ranking calculations
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="mt-1 w-2 h-2 rounded-full bg-white/20 flex-shrink-0" />
              <div>
                <p className="text-white font-medium mb-1">Professional Interface</p>
                <p className="text-slate-400 text-sm">
                  Streamlined workflow for efficient judging
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Right Column - Login Form */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 lg:px-12">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          <div className="mb-8 lg:hidden text-center">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
              Mr & Ms Teen
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Tabulation System
            </p>
          </div>
          <Card className="p-8 lg:p-10 border-slate-200 dark:border-white/10 shadow-xl">
            <CardHeader className="text-center pb-6">
              <CardTitle className="text-3xl font-semibold text-slate-900 dark:text-white mb-2">
                Judge Portal
              </CardTitle>
              <CardDescription className="text-base text-slate-600 dark:text-slate-400">
                Sign in with the access provided by the tabulation committee.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-700 dark:text-slate-300">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@pageant.com"
                    className="h-12 rounded-2xl"
                    {...register('email')}
                  />
                  {errors.email && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
                      {errors.email.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-700 dark:text-slate-300">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="h-12 rounded-2xl"
                    {...register('password')}
                  />
                  {errors.password && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
                      {errors.password.message}
                    </p>
                  )}
                </div>
                <Button
                  type="submit"
                  className="h-12 w-full rounded-2xl text-base font-medium bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-white/90"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Signing in…' : 'Enter Panel'}
                </Button>
                {message && (
                  <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 px-4 py-3 text-center">
                    <p className="text-sm text-rose-600 dark:text-rose-400">
                      {message}
                    </p>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}


