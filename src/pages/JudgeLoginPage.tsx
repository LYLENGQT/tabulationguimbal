import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { supabaseAuth } from '../services/supabaseApi';
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
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<{ email: string; password: string }>({
    resolver: zodResolver(schema)
  });

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-lg"
      >
        <Card className="p-8">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl">Judge Portal</CardTitle>
            <CardDescription>
              Sign in with the access provided by the tabulation committee.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@pageant.com"
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-xs text-rose-300">{errors.email.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  {...register('password')}
                />
                {errors.password && (
                  <p className="text-xs text-rose-300">{errors.password.message}</p>
                )}
              </div>
              <Button
                type="submit"
                className="h-12 w-full rounded-2xl text-base"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Signing in…' : 'Enter panel'}
              </Button>
              {message && (
                <p className="rounded-2xl bg-rose-500/10 px-4 py-2 text-center text-sm text-rose-200">
                  {message}
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}


