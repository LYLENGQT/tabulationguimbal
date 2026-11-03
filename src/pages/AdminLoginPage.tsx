import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { supabaseAuth } from '../services/supabaseApi';
import { getSupabaseClient } from '../lib/supabaseClient';
import { AuthStage, FormAlert, SessionCheck } from '../components/auth/AuthStage';
import { StageField } from '../components/auth/StageField';
import { primaryButton } from '../components/stage/tokens';

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
    // If the auth server can't be reached, show the form instead of hanging on the check
    checkAuth().catch(() => setIsChecking(false));
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

  return (
    <AuthStage
      title="Admin sign in"
      description="For the tabulation team. Use your administrator email and password."
      note={{
        title: 'Tabulation team',
        body: 'Manage contestants, judges and rounds, and follow every score as it arrives.'
      }}
      switchTo={{ to: '/login', label: 'Judge sign in' }}
    >
      {isChecking ? (
        <SessionCheck />
      ) : (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
          <StageField
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="name@example.com"
            error={errors.email?.message}
            {...register('email')}
          />
          <StageField
            id="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password')}
          />
          {message && <FormAlert>{message}</FormAlert>}
          <button type="submit" disabled={isSubmitting} className={`${primaryButton} mt-2 w-full disabled:opacity-70`}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {isSubmitting ? 'Signing in' : 'Sign in'}
          </button>
        </form>
      )}
    </AuthStage>
  );
}
