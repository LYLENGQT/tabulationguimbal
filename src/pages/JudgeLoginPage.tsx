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
  username: z.string().min(3, 'Username must be at least 3 characters'),
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
    // If the auth server can't be reached, show the form instead of hanging on the check
    checkAuth().catch(() => setIsChecking(false));
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

  return (
    <AuthStage
      title="Judge sign in"
      description="Use the username and password from the tabulation committee."
      note={{
        title: 'Before you submit',
        body: 'Scores lock when you submit a round, so check each criterion before you send it.'
      }}
      switchTo={{ to: '/admin/login', label: 'Admin sign in' }}
    >
      {isChecking ? (
        <SessionCheck />
      ) : (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
          <StageField
            id="username"
            label="Username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            error={errors.username?.message}
            {...register('username')}
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
