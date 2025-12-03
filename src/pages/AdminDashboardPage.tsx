import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/ui/button';
import {
  createContestant,
  createJudge,
  fetchAllContestants,
  fetchJudges,
  fetchLeaderboard,
  fetchScoresForExport,
  refreshLeaderboard,
  supabaseAuth,
  updateJudge,
  deleteJudge
} from '../services/supabaseApi';
import type { Division } from '../types/scoring';
import { downloadCsv, toCsv } from '../utils/export';

const contestantSchema = z.object({
  full_name: z.string().min(2),
  number: z.number().int().min(1)
});

const judgeSchema = z.object({
  full_name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  division: z.enum(['male', 'female'])
});

export function AdminDashboardPage() {
  const queryClient = useQueryClient();
  const [divisionFilter, setDivisionFilter] = useState<Division>('male');
  const [editingJudgeId, setEditingJudgeId] = useState<string | null>(null);

  const contestantsQuery = useQuery({
    queryKey: ['contestants-all'],
    queryFn: fetchAllContestants
  });

  const judgesQuery = useQuery({
    queryKey: ['judges'],
    queryFn: fetchJudges
  });

  const leaderboardQuery = useQuery({
    queryKey: ['leaderboard', divisionFilter],
    queryFn: () => fetchLeaderboard(divisionFilter)
  });

  const contestantForm = useForm<z.infer<typeof contestantSchema>>({
    resolver: zodResolver(contestantSchema),
    defaultValues: {
      full_name: '',
      number: 1
    }
  });

  const judgeForm = useForm<z.infer<typeof judgeSchema>>({
    resolver: zodResolver(judgeSchema),
    defaultValues: {
      full_name: '',
      email: '',
      password: '',
      division: 'male'
    }
  });

  // Count contestants per division to enforce a max of 5 per gender.
  const allContestants = contestantsQuery.data ?? [];
  const maleCount = allContestants.filter((c) => c.division === 'male').length;
  const femaleCount = allContestants.filter((c) => c.division === 'female').length;
  const maxPerDivision = 5;
  const maleFull = maleCount >= maxPerDivision;
  const femaleFull = femaleCount >= maxPerDivision;
  const allFull = maleFull && femaleFull;

  // Automatically suggest the next available contestant number (shared across divisions).
  useEffect(() => {
    const numbersInDivision = allContestants
      .map((c) => c.number);
    const nextNumber =
      numbersInDivision.length > 0 ? Math.max(...numbersInDivision) + 1 : 1;
    contestantForm.setValue('number', nextNumber);
  }, [allContestants, contestantForm]);

  const contestantMutation = useMutation({
    // Create one male and one female contestant for the given school/number.
    mutationFn: async (values: z.infer<typeof contestantSchema>) => {
      await createContestant({
        full_name: values.full_name,
        number: values.number,
        division: 'male'
      });
      await createContestant({
        full_name: values.full_name,
        number: values.number,
        division: 'female'
      });
    },
    onSuccess: () => {
      contestantForm.reset();
      queryClient.invalidateQueries({ queryKey: ['contestants-all'] });
    }
  });

  const judgeMutation = useMutation({
    mutationFn: async (values: z.infer<typeof judgeSchema>) => {
      // 1) Create Supabase auth user (credentials)
      await supabaseAuth.signUpWithPassword({
        email: values.email,
        password: values.password,
        full_name: values.full_name,
        division: values.division
      });
      // 2) Store judge profile in judges table
      await createJudge({
        full_name: values.full_name,
        email: values.email,
        division: values.division
      });
    },
    onSuccess: () => {
      judgeForm.reset();
      queryClient.invalidateQueries({ queryKey: ['judges'] });
    }
  });

  const updateJudgeMutation = useMutation({
    mutationFn: async (values: z.infer<typeof judgeSchema> & { id: string }) => {
      await updateJudge(values.id, {
        full_name: values.full_name,
        email: values.email,
        division: values.division
      });
    },
    onSuccess: () => {
      setEditingJudgeId(null);
      queryClient.invalidateQueries({ queryKey: ['judges'] });
    }
  });

  const deleteJudgeMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteJudge(id);
    },
    onSuccess: () => {
      if (editingJudgeId) setEditingJudgeId(null);
      queryClient.invalidateQueries({ queryKey: ['judges'] });
    }
  });

  const refreshMutation = useMutation({
    mutationFn: refreshLeaderboard,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    }
  });

  const handleExport = async () => {
    const rows = await fetchScoresForExport();
    const csv = toCsv(rows);
    downloadCsv('scores.csv', csv);
  };

  // Simple RBAC: only users marked as admin in our auth helper can view this page.
  const [roleChecked, setRoleChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const role = await supabaseAuth.getCurrentRole();
        if (!isMounted) return;
        setIsAdmin(role === 'admin');
      } catch (error) {
        console.error('Failed to determine auth role', error);
        if (!isMounted) return;
        setIsAdmin(false);
      } finally {
        if (isMounted) {
          setRoleChecked(true);
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  if (!roleChecked) {
    return (
      <AppShell title="Admin Dashboard" showAdminLink={false}>
        <p className="text-sm text-slate-400">Checking access…</p>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell title="Admin Dashboard" showAdminLink={false}>
        <p className="text-sm text-red-300">
          You are not authorized to view this page.
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Admin Dashboard"
      showAdminLink={false}
      actions={
        <Button variant="outline" onClick={handleExport}>
          Export CSV
        </Button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr,1fr]">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-lg font-semibold">Add School (1 Male & 1 Female)</h2>
          {allFull ? (
            <p className="mt-4 text-sm text-slate-400">
              You already have {maxPerDivision} male and {maxPerDivision} female contestants.
            </p>
          ) : (
            <form
              className="mt-4 space-y-4"
              onSubmit={contestantForm.handleSubmit((values) => {
                if (maleFull || femaleFull) {
                  return;
                }
                const existing = (contestantsQuery.data ?? []).find(
                  (c) =>
                    c.number === values.number
                );
                if (existing) {
                  contestantForm.setError('number', {
                    type: 'manual',
                    message: 'This number is already used'
                  });
                  return;
                }
                contestantMutation.mutate(values);
              })}
            >
              <div>
                <label className="text-sm text-slate-300">School</label>
                <input
                  className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                  {...contestantForm.register('full_name')}
                />
              </div>
              <div>
                <label className="text-sm text-slate-300">Number</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                  {...contestantForm.register('number', { valueAsNumber: true })}
                />
                {contestantForm.formState.errors.number && (
                  <p className="mt-1 text-xs text-red-400">
                    {contestantForm.formState.errors.number.message}
                  </p>
                )}
              </div>
              <Button type="submit" disabled={contestantMutation.isPending}>
                {contestantMutation.isPending ? 'Saving…' : 'Save Contestant'}
              </Button>
            </form>
          )}
        </section>
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-lg font-semibold">Add Judge</h2>
          <form
            className="mt-4 space-y-4"
            onSubmit={judgeForm.handleSubmit((values) => judgeMutation.mutate(values))}
          >
            <div>
              <label className="text-sm text-slate-300">Full Name</label>
              <input
                className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                {...judgeForm.register('full_name')}
              />
            </div>
            <div>
              <label className="text-sm text-slate-300">Email</label>
              <input
                type="email"
                className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                {...judgeForm.register('email')}
              />
            </div>
            <div>
              <label className="text-sm text-slate-300">Initial password</label>
              <input
                type="password"
                className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                {...judgeForm.register('password')}
              />
            </div>
            <div>
              <label className="text-sm text-slate-300">Division</label>
              <select
                className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                {...judgeForm.register('division')}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <Button type="submit" disabled={judgeMutation.isPending}>
              {judgeMutation.isPending ? 'Saving…' : 'Save Judge'}
            </Button>
          </form>
        </section>
      </div>

      <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Leaderboard</h2>
          <div className="flex items-center gap-3">
            <select
              className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
              value={divisionFilter}
              onChange={(e) => setDivisionFilter(e.target.value as Division)}
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
            <Button onClick={() => refreshMutation.mutate()} disabled={refreshMutation.isPending}>
              {refreshMutation.isPending ? 'Refreshing…' : 'Refresh totals'}
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="py-2">Rank</th>
                <th className="py-2">Contestant</th>
                <th className="py-2">Total Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {leaderboardQuery.data?.map((row) => (
                <tr key={row.contestant_id}>
                  <td className="py-3">{row.rank}</td>
                  <td className="py-3">
                    #{row.number?.toString().padStart(2, '0')} {row.full_name}
                  </td>
                  <td className="py-3">{row.total_score?.toFixed(3)}</td>
                </tr>
              )) ?? (
                <tr>
                  <td className="py-3" colSpan={3}>
                    No data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-lg font-semibold">Judges</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {judgesQuery.data?.map((judge) => {
              const isEditing = editingJudgeId === judge.id;
              return (
                <li
                  key={judge.id}
                  className="flex flex-col gap-2 rounded-md border border-slate-800 px-3 py-2"
                >
                  {isEditing ? (
                    <form
                      className="space-y-2"
                      onSubmit={judgeForm.handleSubmit((values) =>
                        updateJudgeMutation.mutate({ ...values, id: judge.id })
                      )}
                    >
                      <input
                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                        defaultValue={judge.full_name}
                        {...judgeForm.register('full_name')}
                      />
                      <input
                        type="email"
                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                        defaultValue={judge.email}
                        {...judgeForm.register('email')}
                      />
                      <select
                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                        defaultValue={judge.division}
                        {...judgeForm.register('division')}
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                      </select>
                      <div className="flex items-center gap-2">
                        <Button
                          type="submit"
                          size="sm"
                          disabled={updateJudgeMutation.isPending}
                        >
                          {updateJudgeMutation.isPending ? 'Saving…' : 'Save'}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingJudgeId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <p className="font-medium">{judge.full_name}</p>
                      <p className="text-xs uppercase text-slate-500">
                        {judge.division}
                      </p>
                      <p className="text-xs text-slate-400">{judge.email}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingJudgeId(judge.id);
                            judgeForm.reset({
                              full_name: judge.full_name,
                              email: judge.email,
                              password: '',
                              division: judge.division as Division
                            });
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteJudgeMutation.mutate(judge.id)}
                          disabled={deleteJudgeMutation.isPending}
                        >
                          Delete
                        </Button>
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-lg font-semibold">Contestants</h2>
          <ul className="mt-4 space-y-2 text-sm max-h-64 overflow-y-auto pr-2">
            {contestantsQuery.data?.map((contestant) => (
              <li key={contestant.id} className="rounded-md border border-slate-800 px-3 py-2">
                <p className="font-medium">
                  #{contestant.number.toString().padStart(2, '0')} {contestant.full_name}
                </p>
                <p className="text-xs uppercase text-slate-500">{contestant.division}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </AppShell>
  );
}


