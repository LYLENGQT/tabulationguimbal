import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Award,
  Download,
  Printer,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users
} from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../components/ui/select';
import {
  createContestant,
  createJudge,
  deleteJudge,
  fetchAllContestants,
  fetchCategories,
  fetchCategoryScoreSummary,
  fetchJudges,
  fetchLeaderboard,
  fetchScoresForExport,
  refreshLeaderboard,
  resetSystem,
  supabaseAuth,
  updateJudge
} from '../services/supabaseApi';
import type { CategoryScoreSummary } from '../services/supabaseApi';
import type { Category } from '../types/scoring';
import type { Division } from '../types/scoring';
import { downloadCsv, toCsv } from '../utils/export';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ScrollArea } from '../components/ui/scroll-area';
import { Badge } from '../components/ui/badge';

const contestantSchema = z.object({
  numberOfCandidates: z.number().int().min(1).max(20, 'Maximum 20 candidates allowed')
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
  const [activeTab, setActiveTab] = useState('contestants');
  const [editingJudgeId, setEditingJudgeId] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<{
    full_name: string;
    email: string;
    division: Division;
  } | null>(null);
  const [roleChecked, setRoleChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

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
    defaultValues: { numberOfCandidates: 5 }
  });

  const judgeForm = useForm<z.infer<typeof judgeSchema>>({
    resolver: zodResolver(judgeSchema),
    defaultValues: { full_name: '', email: '', password: '', division: 'male' }
  });

  const allContestants = contestantsQuery.data ?? [];
  const maleCount = allContestants.filter((c) => c.division === 'male').length;
  const femaleCount = allContestants.filter((c) => c.division === 'female').length;
  const candidateCount = Math.max(maleCount, femaleCount);
  const totalJudges = judgesQuery.data?.length ?? 0;

  const contestantMutation = useMutation({
    mutationFn: async (values: z.infer<typeof contestantSchema>) => {
      const existingNumbers = new Set(allContestants.map((c) => c.number));
      const startNumber = existingNumbers.size > 0 ? Math.max(...Array.from(existingNumbers)) + 1 : 1;
      
      // Generate N male and N female contestants
      const promises: Promise<any>[] = [];
      for (let i = 0; i < values.numberOfCandidates; i++) {
        const candidateNumber = startNumber + i;
        // Use generic name to avoid bias
        const candidateName = `Candidate ${candidateNumber}`;
        
        promises.push(
          createContestant({
            full_name: candidateName,
            number: candidateNumber,
        division: 'male'
          })
        );
        promises.push(
          createContestant({
            full_name: candidateName,
            number: candidateNumber,
        division: 'female'
          })
        );
      }
      
      await Promise.all(promises);
    },
    onSuccess: () => {
      contestantForm.reset({ numberOfCandidates: 5 });
      queryClient.invalidateQueries({ queryKey: ['contestants-all'] });
    }
  });

  const judgeMutation = useMutation({
    mutationFn: async (values: z.infer<typeof judgeSchema>) => {
      await supabaseAuth.signUpWithPassword({
        email: values.email,
        password: values.password,
        full_name: values.full_name,
        division: values.division
      });
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
    mutationFn: async ({
      id,
      full_name,
      email,
      division
    }: {
      id: string;
      full_name: string;
      email: string;
      division: Division;
    }) => {
      await updateJudge(id, {
        full_name,
        email,
        division
      });
    },
    onSuccess: () => {
      setEditingJudgeId(null);
      setEditingValues(null);
      queryClient.invalidateQueries({ queryKey: ['judges'] });
    }
  });

  const deleteJudgeMutation = useMutation({
    mutationFn: async (id: string) => deleteJudge(id),
    onSuccess: () => {
      if (editingJudgeId) {
        setEditingJudgeId(null);
        setEditingValues(null);
      }
      queryClient.invalidateQueries({ queryKey: ['judges'] });
    }
  });

  const refreshMutation = useMutation({
    mutationFn: refreshLeaderboard,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leaderboard'] })
  });

  const resetMutation = useMutation({
    mutationFn: resetSystem,
    onSuccess: () => {
      // Invalidate all queries to refresh the UI
      queryClient.invalidateQueries();
    }
  });

  const handleExport = async () => {
    const rows = await fetchScoresForExport();
    downloadCsv('scores.csv', toCsv(rows));
  };

  const handleReset = async () => {
    // First confirmation: Warning dialog
    const confirmed = window.confirm(
      '⚠️ WARNING: This will permanently delete:\n\n' +
      '• All candidates\n' +
      '• All judges\n' +
      '• All scores\n' +
      '• All authentication users (except admin)\n\n' +
      'This action cannot be undone!\n\n' +
      'Do you want to continue?'
    );

    if (!confirmed) return;

    // Second confirmation: Final check
    const finalConfirm = window.confirm(
      '⚠️ FINAL CONFIRMATION\n\n' +
      'You are about to completely reset the system.\n\n' +
      'Are you absolutely sure?'
    );

    if (!finalConfirm) return;

    // Third confirmation: Type "RESET"
    const resetText = window.prompt(
      'Type "RESET" (all caps) to confirm:'
    );

    if (resetText !== 'RESET') {
      alert('Reset cancelled. You must type "RESET" exactly.');
      return;
    }

    // Perform reset
    try {
      await resetMutation.mutateAsync();
      alert('✅ System reset successfully! All data has been cleared.');
    } catch (error) {
      console.error('Reset error:', error);
      alert('❌ Failed to reset system. Please check the console for details.');
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      const role = await supabaseAuth.getCurrentRole();
      if (!mounted) return;
      setIsAdmin(role === 'admin');
      setRoleChecked(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (!roleChecked) {
    return (
      <AppShell title="Admin Dashboard" showAdminLink={false}>
        <p className="text-sm text-slate-600 dark:text-slate-400">Verifying access…</p>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell title="Admin Dashboard" showAdminLink={false}>
        <p className="text-sm text-rose-600 dark:text-rose-300">You are not authorized to view this page.</p>
      </AppShell>
    );
  }

  const summary = [
    { label: 'Candidates', value: candidateCount, icon: Users, accent: 'bg-indigo-500/10 text-indigo-600' },
    { label: 'Male Contestants', value: maleCount, icon: UserRound, accent: 'bg-sky-500/10 text-sky-600' },
    { label: 'Female Contestants', value: femaleCount, icon: UserRound, accent: 'bg-rose-500/10 text-rose-600' },
    { label: 'Judges', value: totalJudges, icon: ShieldCheck, accent: 'bg-emerald-500/10 text-emerald-600' }
  ];

  return (
    <AppShell
      title="Admin Dashboard"
      showAdminLink={false}
      actions={
        <>
          <Button variant="outline" onClick={handleExport} className="rounded-xl border-slate-200 dark:border-white/10">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button
            variant="destructive"
            onClick={handleReset}
            disabled={resetMutation.isPending}
            className="rounded-xl"
          >
            {resetMutation.isPending ? 'Resetting...' : 'Reset System'}
          </Button>
        </>
      }
    >
      <div className="space-y-8">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 p-6 shadow-sm dark:border-white/10 dark:from-slate-900 dark:via-slate-900/80 dark:to-slate-950">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 text-white px-3 py-1 text-xs font-medium shadow-sm dark:bg-white dark:text-slate-900">
                <Sparkles className="h-4 w-4" />
                Admin Control Center
              </div>
              <p className="text-lg font-semibold text-slate-900 dark:text-white">
                Manage candidates, judges, and scoring in one streamlined view.
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Use the tabs below to configure participants, handle judges, refresh leaderboards, and review category summaries.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-white/10 dark:bg-white/5">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200">Role: Administrator</span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {summary.map((item) => (
            <Card key={item.label} className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
              <div className="flex items-center justify-between">
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${item.accent}`}>
                  <item.icon className="h-5 w-5" />
                </div>
                <Badge className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-200">
                  Live
                </Badge>
              </div>
              <p className="mt-4 text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">{item.label}</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{item.value}</p>
            </Card>
          ))}
        </div>

        <Card className="rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-slate-900/80">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6 flex w-full flex-wrap gap-2 rounded-full bg-slate-100 p-1 dark:bg-white/5">
              <TabsTrigger value="contestants" className="rounded-full px-4 py-2 text-sm data-[state=active]:bg-white data-[state=active]:text-slate-900 dark:data-[state=active]:bg-white dark:data-[state=active]:text-slate-900">
                Contestants
              </TabsTrigger>
              <TabsTrigger value="judges" className="rounded-full px-4 py-2 text-sm data-[state=active]:bg-white data-[state=active]:text-slate-900 dark:data-[state=active]:bg-white dark:data-[state=active]:text-slate-900">
                Judges
              </TabsTrigger>
              <TabsTrigger value="leaderboard" className="rounded-full px-4 py-2 text-sm data-[state=active]:bg-white data-[state=active]:text-slate-900 dark:data-[state=active]:bg-white dark:data-[state=active]:text-slate-900">
                Leaderboard
              </TabsTrigger>
              <TabsTrigger value="scoring-summary" className="rounded-full px-4 py-2 text-sm data-[state=active]:bg-white data-[state=active]:text-slate-900 dark:data-[state=active]:bg-white dark:data-[state=active]:text-slate-900">
                Scoring Summary
              </TabsTrigger>
            </TabsList>

            <TabsContent value="contestants" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Users className="h-5 w-5 text-slate-500" />
                      Generate Candidates
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form
                      className="space-y-4"
                      onSubmit={contestantForm.handleSubmit((values) =>
                        contestantMutation.mutate(values)
                      )}
                    >
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-700 dark:text-slate-200">Number of Candidates</Label>
                        <Input 
                          type="number" 
                          {...contestantForm.register('numberOfCandidates', { valueAsNumber: true })} 
                          min={1}
                          max={20}
                          className="h-11 rounded-xl border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5"
                        />
                        {contestantForm.formState.errors.numberOfCandidates && (
                          <p className="text-xs text-rose-600 dark:text-rose-300">
                            {contestantForm.formState.errors.numberOfCandidates.message}
                          </p>
                        )}
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Creates the same count for male and female divisions. Example: 5 = 5 male + 5 female candidates.
                        </p>
                      </div>
                      <Button
                        type="submit"
                        className="w-full rounded-xl"
                        disabled={contestantMutation.isPending}
                      >
                        {contestantMutation.isPending ? 'Generating…' : 'Generate Candidates'}
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Award className="h-5 w-5 text-amber-500" />
                      Candidates on Record
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      <div className="space-y-3">
                        {candidateCount === 0 && (
                          <p className="text-sm text-slate-600 dark:text-slate-400">No candidates registered yet.</p>
                        )}
                        {Array.from(
                          new Set(allContestants.map((c) => c.number))
                        )
                          .sort((a, b) => a - b)
                          .map((number) => {
                            const male = allContestants.find((c) => c.number === number && c.division === 'male');
                            const female = allContestants.find((c) => c.number === number && c.division === 'female');
                            return (
                          <div
                            key={number}
                            className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white px-3 py-2 shadow-sm dark:border-white/10 dark:bg-white/5"
                          >
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-white">
                                    Candidate #{String(number).padStart(2, '0')}
                              </p>
                                  <p className="text-xs text-slate-600 dark:text-slate-400">
                                    {male && female ? 'Male & Female' : male ? 'Male only' : 'Female only'}
                                  </p>
                            </div>
                            <Badge className="rounded-full bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-100">
                              Registered
                            </Badge>
                          </div>
                            );
                          })}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="judges" className="space-y-6">
              <Card className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ShieldCheck className="h-5 w-5 text-emerald-500" />
                    Invite Judge
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form
                    className="grid gap-4 md:grid-cols-2"
                    onSubmit={judgeForm.handleSubmit((values) => judgeMutation.mutate(values))}
                  >
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-sm font-medium text-slate-700 dark:text-slate-200">Full Name</Label>
                      <Input {...judgeForm.register('full_name')} className="h-11 rounded-xl border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700 dark:text-slate-200">Email</Label>
                      <Input type="email" {...judgeForm.register('email')} className="h-11 rounded-xl border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700 dark:text-slate-200">Initial Password</Label>
                      <Input type="password" {...judgeForm.register('password')} className="h-11 rounded-xl border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5" />
                      {judgeForm.formState.errors.password && (
                        <p className="text-xs text-rose-600 dark:text-rose-300">
                          {judgeForm.formState.errors.password.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700 dark:text-slate-200">Division</Label>
                      <Select
                        value={judgeForm.watch('division')}
                        onValueChange={(value) => judgeForm.setValue('division', value as Division)}
                      >
                        <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
                          <SelectValue placeholder="Select division" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2">
                      <Button
                        type="submit"
                        className="w-full rounded-xl"
                        disabled={judgeMutation.isPending}
                      >
                        {judgeMutation.isPending ? 'Inviting…' : 'Invite Judge'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <UserRound className="h-5 w-5 text-slate-500" />
                    Judges Roster
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-96">
                    <table className="min-w-full divide-y divide-slate-200 overflow-hidden rounded-xl text-sm shadow-sm dark:divide-white/10">
                      <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                        <tr>
                          <th className="px-3 py-2">Name</th>
                          <th className="px-3 py-2">Email</th>
                          <th className="px-3 py-2">Division</th>
                          <th className="px-3 py-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white dark:divide-white/10 dark:bg-slate-950/30">
                        {judgesQuery.data?.map((judgeRow, idx) => {
                          const isEditing = editingJudgeId === judgeRow.id;
                          const currentValues =
                            isEditing && editingValues
                              ? editingValues
                              : {
                                  full_name: judgeRow.full_name,
                                  email: judgeRow.email ?? '',
                                  division: judgeRow.division as Division
                                };
                          const zebra = idx % 2 === 0 ? 'bg-white/70 dark:bg-white/5' : 'bg-slate-50 dark:bg-slate-950/50';
                          return (
                            <tr key={judgeRow.id} className={`${zebra} transition hover:bg-slate-100 dark:hover:bg-white/10`}>
                              <td className="px-3 py-3 text-slate-900 dark:text-white">
                                {isEditing ? (
                                  <Input
                                    value={currentValues.full_name}
                                    onChange={(e) =>
                                      setEditingValues((prev) =>
                                        prev
                                          ? { ...prev, full_name: e.target.value }
                                          : {
                                              full_name: e.target.value,
                                              email: judgeRow.email ?? '',
                                              division: judgeRow.division as Division
                                            }
                                      )
                                    }
                                    className="h-10 rounded-lg"
                                  />
                                ) : (
                                  judgeRow.full_name
                                )}
                              </td>
                              <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                                {isEditing ? (
                                  <Input
                                    value={currentValues.email}
                                    onChange={(e) =>
                                      setEditingValues((prev) =>
                                        prev
                                          ? { ...prev, email: e.target.value }
                                          : {
                                              full_name: judgeRow.full_name,
                                              email: e.target.value,
                                              division: judgeRow.division as Division
                                            }
                                      )
                                    }
                                    className="h-10 rounded-lg"
                                  />
                                ) : (
                                  judgeRow.email ?? 'No email'
                                )}
                              </td>
                              <td className="px-3 py-3 capitalize">
                                {isEditing ? (
                                  <Select
                                    value={currentValues.division}
                                    onValueChange={(value) =>
                                      setEditingValues((prev) =>
                                        prev
                                          ? { ...prev, division: value as Division }
                                          : {
                                              full_name: judgeRow.full_name,
                                              email: judgeRow.email ?? '',
                                              division: value as Division
                                            }
                                      )
                                    }
                                  >
                                    <SelectTrigger className="h-10 rounded-lg">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="male">Male</SelectItem>
                                      <SelectItem value="female">Female</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  judgeRow.division
                                )}
                              </td>
                              <td className="px-3 py-3 text-right space-x-1">
                                {isEditing ? (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="rounded-lg"
                                      onClick={() => {
                                        if (!editingValues) return;
                                        updateJudgeMutation.mutate({
                                          id: judgeRow.id,
                                          ...editingValues
                                        });
                                      }}
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="rounded-lg"
                                      onClick={() => {
                                        setEditingJudgeId(null);
                                        setEditingValues(null);
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="rounded-lg"
                                    onClick={() => {
                                      setEditingJudgeId(judgeRow.id);
                                      setEditingValues({
                                        full_name: judgeRow.full_name,
                                        email: judgeRow.email ?? '',
                                        division: judgeRow.division as Division
                                      });
                                    }}
                                  >
                                    Edit
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="rounded-lg text-rose-600 hover:text-rose-700 dark:text-rose-300"
                                  onClick={() => deleteJudgeMutation.mutate(judgeRow.id)}
                                >
                                  Remove
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {judgesQuery.data?.length === 0 && (
                      <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">No judges registered.</p>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="leaderboard" className="space-y-6">
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm dark:border-white/10 dark:bg-white/5">
                <Select
                  value={divisionFilter}
                  onValueChange={(value) => setDivisionFilter(value as Division)}
                >
                  <SelectTrigger className="w-40 rounded-lg border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => refreshMutation.mutate()}
                  disabled={refreshMutation.isPending}
                  className="rounded-lg"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {refreshMutation.isPending ? 'Refreshing…' : 'Refresh totals'}
                </Button>
              </div>
              <Card className="rounded-2xl border border-slate-200/80 bg-white/90 p-0 shadow-sm dark:border-white/10 dark:bg-slate-900/80">
                <div className="border-b border-slate-200 px-6 py-4 dark:border-white/10">
                  <p className="text-sm font-semibold text-slate-800 dark:text-white">Live Leaderboard</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Totals auto-refresh every 5 seconds.</p>
                </div>
                <ScrollArea className="max-h-[420px]">
                  <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-white/10">
                    <thead className="sticky top-0 bg-white text-left text-xs uppercase tracking-wide text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
                      <tr>
                        <th className="px-4 py-3">Rank</th>
                        <th className="px-4 py-3">Contestant</th>
                        <th className="px-4 py-3 text-right">Total score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white dark:divide-white/10 dark:bg-slate-950/30">
                      {leaderboardQuery.data?.map((row, idx) => (
                        <tr key={row.contestant_id} className={idx % 2 === 0 ? 'bg-white/70 dark:bg-white/5' : 'bg-slate-50 dark:bg-slate-950/40'}>
                          <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{row.rank}</td>
                          <td className="px-4 py-3 text-slate-900 dark:text-white">
                            Candidate #{row.number?.toString().padStart(2, '0')}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-900 dark:text-white">{row.total_score?.toFixed(3)}</td>
                        </tr>
                      )) ?? (
                        <tr>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400" colSpan={3}>
                            No records found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </ScrollArea>
              </Card>
            </TabsContent>

            <TabsContent value="scoring-summary" className="space-y-6">
              <ScoringSummarySection />
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </AppShell>
  );
}
function ScoringSummarySection() {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [printMode, setPrintMode] = useState(false);

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories
  });

  const summaryMaleQuery = useQuery({
    queryKey: ['category-score-summary', selectedCategoryId, 'male'],
    queryFn: () => fetchCategoryScoreSummary(selectedCategoryId!, 'male'),
    enabled: Boolean(selectedCategoryId)
  });

  const summaryFemaleQuery = useQuery({
    queryKey: ['category-score-summary', selectedCategoryId, 'female'],
    queryFn: () => fetchCategoryScoreSummary(selectedCategoryId!, 'female'),
    enabled: Boolean(selectedCategoryId)
  });

  const categories = categoriesQuery.data ?? [];
  const summaryMale = summaryMaleQuery.data;
  const summaryFemale = summaryFemaleQuery.data;

  useEffect(() => {
    if (printMode) {
      document.body.classList.add('printing');
    } else {
      document.body.classList.remove('printing');
    }
    return () => {
      document.body.classList.remove('printing');
    };
  }, [printMode]);

  useEffect(() => {
    if (categories.length > 0 && !selectedCategoryId) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId]);

  const handlePrint = () => {
    setPrintMode(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setPrintMode(false);
      }, 300);
    }, 300);
  };

  const renderTable = (label: string, summary?: CategoryScoreSummary | null) => {
    if (!summary) return null;
    const judgeCount = summary.judges.length;
    return (
      <Card className="rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm dark:border-white/10 dark:bg-slate-900/80">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-white/10">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
              {summary.categoryLabel}
            </p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Division: {label}</p>
          </div>
          <Badge className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-200">
            {judgeCount} judges
          </Badge>
        </div>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-white/10">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Ranking</th>
                  <th className="px-4 py-3">Candidate #</th>
                  {summary.judges.map((judge) => (
                    <th key={judge.id} className="px-4 py-3 text-center">
                      {judge.name}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center">Average</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white dark:divide-white/10 dark:bg-slate-950/30">
                {summary.contestants.map((contestant, idx) => (
                  <tr
                    key={contestant.contestantId}
                    className={`${idx % 2 === 0 ? 'bg-white/80 dark:bg-white/5' : 'bg-slate-50 dark:bg-slate-950/50'} hover:bg-slate-100 dark:hover:bg-white/10`}
                  >
                    <td className="px-4 py-3 text-center font-semibold text-slate-900 dark:text-white">
                      {contestant.rank}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-slate-800 dark:text-slate-100">
                      {String(contestant.candidateNumber).padStart(2, '0')}
                    </td>
                    {summary.judges.map((judge) => {
                      const judgeScore = contestant.judgeScores.find((js) => js.judgeId === judge.id);
                      return (
                        <td
                          key={judge.id}
                          className="px-4 py-3 text-center text-slate-800 dark:text-slate-100"
                        >
                          {judgeScore ? judgeScore.totalScore.toFixed(2) : '—'}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-center font-semibold text-slate-900 dark:text-white">
                      {contestant.average.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderPrintTable = (label: string, summary?: CategoryScoreSummary | null) => {
    if (!summary) return null;
    return (
      <div style={{ marginBottom: '0.5cm' }}>
        <div className="print-header" style={{ textAlign: 'center', marginBottom: '0.3cm' }}>
          <h1 className="print-main-title" style={{ color: 'black', fontSize: '16px', fontWeight: 'bold', margin: 0 }}>
            Mr & Ms Teen Tabulation
          </h1>
          <h2 className="print-category-title" style={{ color: 'black', fontSize: '14px', fontWeight: 'bold', margin: '0.2cm 0' }}>
            {summary.categoryLabel} - <span style={{ textTransform: 'uppercase' }}>{label}</span>
          </h2>
        </div>
        <div className="print-table-container">
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '1px solid #000',
              color: 'black',
              backgroundColor: 'white',
              fontSize: '12px'
            }}
          >
            <thead>
              <tr>
                <th style={{ border: '1px solid #000', padding: '6px 4px', color: 'black', backgroundColor: 'white', fontWeight: 'bold' }}>
                  Ranking
                </th>
                <th style={{ border: '1px solid #000', padding: '6px 4px', color: 'black', backgroundColor: 'white', fontWeight: 'bold' }}>
                  Candidate #
                </th>
                {summary.judges.map((judge) => (
                  <th
                    key={judge.id}
                    style={{ border: '1px solid #000', padding: '6px 4px', color: 'black', backgroundColor: 'white', fontWeight: 'bold' }}
                  >
                    {judge.name}
                  </th>
                ))}
                <th style={{ border: '1px solid #000', padding: '6px 4px', color: 'black', backgroundColor: 'white', fontWeight: 'bold' }}>
                  Average
                </th>
              </tr>
            </thead>
            <tbody>
              {summary.contestants.map((contestant) => (
                <tr key={contestant.contestantId}>
                  <td style={{ border: '1px solid #000', padding: '6px 4px', color: 'black', backgroundColor: 'white', textAlign: 'center' }}>
                    {contestant.rank}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '6px 4px', color: 'black', backgroundColor: 'white', textAlign: 'center' }}>
                    {String(contestant.candidateNumber).padStart(2, '0')}
                  </td>
                  {summary.judges.map((judge) => {
                    const judgeScore = contestant.judgeScores.find((js) => js.judgeId === judge.id);
                    return (
                      <td
                        key={judge.id}
                        style={{ border: '1px solid #000', padding: '6px 4px', color: 'black', backgroundColor: 'white', textAlign: 'center' }}
                      >
                        {judgeScore ? judgeScore.totalScore.toFixed(2) : '—'}
                      </td>
                    );
                  })}
                  <td style={{ border: '1px solid #000', padding: '6px 4px', color: 'black', backgroundColor: 'white', textAlign: 'center', fontWeight: 'bold' }}>
                    {contestant.average.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className={printMode ? 'space-y-6 printing' : 'space-y-6'}>
      <Card className="rounded-2xl border border-slate-200/80 bg-slate-50/70 shadow-sm dark:border-white/10 dark:bg-slate-900/40">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Category Summary</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">Review per-judge totals and print-ready tables.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={selectedCategoryId || ''} onValueChange={setSelectedCategoryId}>
              <SelectTrigger className="w-64 rounded-xl border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handlePrint} variant="outline" className="rounded-xl">
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          </div>
        </div>
      </Card>

      {(summaryMaleQuery.isLoading || summaryFemaleQuery.isLoading) && (
        <p className="text-sm text-slate-600 dark:text-slate-400">Loading...</p>
      )}
      {(summaryMaleQuery.error || summaryFemaleQuery.error) && (
        <p className="text-sm text-rose-600 dark:text-rose-300">Error loading scores</p>
      )}

      {printMode &&
        createPortal(
          <div className="print-mode" style={{ padding: '0.5cm' }}>
            {renderPrintTable('male', summaryMale)}
            {renderPrintTable('female', summaryFemale)}
          </div>,
          document.body
        )}

      {!printMode && (
        <div className="space-y-6">
          {renderTable('male', summaryMale)}
          {renderTable('female', summaryFemale)}
        </div>
      )}

      {!summaryMale && !summaryFemale && !summaryMaleQuery.isLoading && !summaryFemaleQuery.isLoading && (
        <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            No scores available for this category yet.
          </p>
        </Card>
      )}
    </div>
  );
}



import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../components/ui/select';
import {
  createContestant,
  createJudge,
  deleteJudge,
  fetchAllContestants,
  fetchJudges,
  fetchLeaderboard,
  fetchScoresForExport,
  refreshLeaderboard,
  supabaseAuth,
  updateJudge
} from '../services/supabaseApi';
import type { Division } from '../types/scoring';
import { downloadCsv, toCsv } from '../utils/export';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ScrollArea } from '../components/ui/scroll-area';
import { Badge } from '../components/ui/badge';

const contestantSchema = z.object({
  full_name: z.string().min(2, 'School name is required'),
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
  const [activeTab, setActiveTab] = useState('contestants');
  const [editingJudgeId, setEditingJudgeId] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<{
    full_name: string;
    email: string;
    division: Division;
  } | null>(null);
  const [roleChecked, setRoleChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

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
    defaultValues: { full_name: '', number: 1 }
  });

  const judgeForm = useForm<z.infer<typeof judgeSchema>>({
    resolver: zodResolver(judgeSchema),
    defaultValues: { full_name: '', email: '', password: '', division: 'male' }
  });

  const allContestants = contestantsQuery.data ?? [];
  const maleCount = allContestants.filter((c) => c.division === 'male').length;
  const femaleCount = allContestants.filter((c) => c.division === 'female').length;
  const schoolCount = Math.ceil(allContestants.length / 2);
  const totalJudges = judgesQuery.data?.length ?? 0;
  const atCapacity = maleCount >= 5 && femaleCount >= 5;

  useEffect(() => {
    const numbers = allContestants.map((c) => c.number);
    const nextNumber = numbers.length ? Math.max(...numbers) + 1 : 1;
    contestantForm.setValue('number', nextNumber);
  }, [allContestants, contestantForm]);

  const contestantMutation = useMutation({
    mutationFn: async (values: z.infer<typeof contestantSchema>) => {
      const exists = allContestants.find((c) => c.number === values.number);
      if (exists) {
        contestantForm.setError('number', {
          type: 'manual',
          message: 'This number is already assigned'
        });
        throw new Error('duplicate');
      }
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
      await supabaseAuth.signUpWithPassword({
        email: values.email,
        password: values.password,
        full_name: values.full_name,
        division: values.division
      });
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
    mutationFn: async ({
      id,
      full_name,
      email,
      division
    }: {
      id: string;
      full_name: string;
      email: string;
      division: Division;
    }) => {
      await updateJudge(id, {
        full_name,
        email,
        division
      });
    },
    onSuccess: () => {
      setEditingJudgeId(null);
      setEditingValues(null);
      queryClient.invalidateQueries({ queryKey: ['judges'] });
    }
  });

  const deleteJudgeMutation = useMutation({
    mutationFn: async (id: string) => deleteJudge(id),
    onSuccess: () => {
      if (editingJudgeId) {
        setEditingJudgeId(null);
        setEditingValues(null);
      }
      queryClient.invalidateQueries({ queryKey: ['judges'] });
    }
  });

  const refreshMutation = useMutation({
    mutationFn: refreshLeaderboard,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leaderboard'] })
  });

  const handleExport = async () => {
    const rows = await fetchScoresForExport();
    downloadCsv('scores.csv', toCsv(rows));
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      const role = await supabaseAuth.getCurrentRole();
      if (!mounted) return;
      setIsAdmin(role === 'admin');
      setRoleChecked(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (!roleChecked) {
    return (
      <AppShell title="Admin Dashboard" showAdminLink={false}>
        <p className="text-sm text-slate-600 dark:text-slate-400">Verifying access…</p>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell title="Admin Dashboard" showAdminLink={false}>
        <p className="text-sm text-rose-600 dark:text-rose-300">You are not authorized to view this page.</p>
      </AppShell>
    );
  }

  const summary = [
    { label: 'Schools', value: schoolCount },
    { label: 'Male Contestants', value: maleCount },
    { label: 'Female Contestants', value: femaleCount },
    { label: 'Judges', value: totalJudges }
  ];

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
      <div className="space-y-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {summary.map((item) => (
            <Card key={item.label} className="p-5 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">{item.label}</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{item.value}</p>
            </Card>
          ))}
        </div>

        <Card className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="contestants">Contestants</TabsTrigger>
              <TabsTrigger value="judges">Judges</TabsTrigger>
              <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
            </TabsList>

            <TabsContent value="contestants" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="p-5">
                  <CardHeader>
                    <CardTitle>Register School</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form
                      className="space-y-4"
                      onSubmit={contestantForm.handleSubmit((values) =>
                        contestantMutation.mutate(values)
                      )}
                    >
                      <div className="space-y-2">
                        <Label>School / Contingent Name</Label>
                        <Input {...contestantForm.register('full_name')} />
                      </div>
                      <div className="space-y-2">
                        <Label>Assigned Number</Label>
                        <Input type="number" {...contestantForm.register('number', { valueAsNumber: true })} />
                        {contestantForm.formState.errors.number && (
                          <p className="text-xs text-rose-600 dark:text-rose-300">
                            {contestantForm.formState.errors.number.message}
                          </p>
                        )}
                      </div>
                      <Button
                        type="submit"
                        className="w-full rounded-2xl"
                        disabled={contestantMutation.isPending || atCapacity}
                      >
                        {atCapacity
                          ? 'Capacity Reached'
                          : contestantMutation.isPending
                          ? 'Saving…'
                          : 'Add Pair'}
                      </Button>
                      {atCapacity && (
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Maximum of five per division reached. Remove a contestant first.
                        </p>
                      )}
                    </form>
                  </CardContent>
                </Card>

                <Card className="p-5">
                  <CardHeader>
                    <CardTitle>Schools on Record</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      <div className="space-y-3">
                        {schoolCount === 0 && (
                          <p className="text-sm text-slate-600 dark:text-slate-400">No schools registered yet.</p>
                        )}
                        {Array.from(
                          new Map(
                            allContestants.map((contestant) => [
                              contestant.number,
                              contestant.full_name
                            ])
                          ).entries()
                        ).map(([number, name]) => (
                          <div
                            key={number}
                            className="flex items-center justify-between rounded-2xl border border-slate-200 px-3 py-2 dark:border-white/5"
                          >
                            <div>
                              <p className="font-medium text-slate-900 dark:text-white">
                                #{String(number).padStart(2, '0')}
                              </p>
                              <p className="text-sm text-slate-600 dark:text-slate-400">{name}</p>
                            </div>
                            <Badge>Registered</Badge>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="judges" className="space-y-6">
              <Card className="p-5">
                <CardHeader>
                  <CardTitle>Invite Judge</CardTitle>
                </CardHeader>
                <CardContent>
                  <form
                    className="grid gap-4 md:grid-cols-2"
                    onSubmit={judgeForm.handleSubmit((values) => judgeMutation.mutate(values))}
                  >
                    <div className="space-y-2 md:col-span-2">
                      <Label>Full Name</Label>
                      <Input {...judgeForm.register('full_name')} />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input type="email" {...judgeForm.register('email')} />
                    </div>
                    <div className="space-y-2">
                      <Label>Initial Password</Label>
                      <Input type="password" {...judgeForm.register('password')} />
                      {judgeForm.formState.errors.password && (
                        <p className="text-xs text-rose-600 dark:text-rose-300">
                          {judgeForm.formState.errors.password.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Division</Label>
                      <Select
                        value={judgeForm.watch('division')}
                        onValueChange={(value) => judgeForm.setValue('division', value as Division)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select division" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2">
                      <Button
                        type="submit"
                        className="w-full rounded-2xl"
                        disabled={judgeMutation.isPending}
                      >
                        {judgeMutation.isPending ? 'Inviting…' : 'Invite Judge'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              <Card className="p-5">
                <CardHeader>
                  <CardTitle>Judges Roster</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-80">
                    <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-white/5">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">
                          <th className="py-2">Name</th>
                          <th className="py-2">Email</th>
                          <th className="py-2">Division</th>
                          <th className="py-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                        {judgesQuery.data?.map((judgeRow) => {
                          const isEditing = editingJudgeId === judgeRow.id;
                          const currentValues =
                            isEditing && editingValues
                              ? editingValues
                              : {
                                  full_name: judgeRow.full_name,
                                  email: judgeRow.email,
                                  division: judgeRow.division as Division
                                };
                          return (
                            <tr key={judgeRow.id}>
                              <td className="py-3 text-slate-900 dark:text-white">
                                {isEditing ? (
                                  <Input
                                    value={currentValues.full_name}
                                    onChange={(e) =>
                                      setEditingValues((prev) =>
                                        prev
                                          ? { ...prev, full_name: e.target.value }
                                          : {
                                              full_name: e.target.value,
                                              email: judgeRow.email,
                                              division: judgeRow.division as Division
                                            }
                                      )
                                    }
                                  />
                                ) : (
                                  judgeRow.full_name
                                )}
                              </td>
                              <td className="py-3 text-slate-600 dark:text-slate-400">
                                {isEditing ? (
                                  <Input
                                    value={currentValues.email}
                                    onChange={(e) =>
                                      setEditingValues((prev) =>
                                        prev
                                          ? { ...prev, email: e.target.value }
                                          : {
                                              full_name: judgeRow.full_name,
                                              email: e.target.value,
                                              division: judgeRow.division as Division
                                            }
                                      )
                                    }
                                  />
                                ) : (
                                  judgeRow.email
                                )}
                              </td>
                              <td className="py-3 capitalize">
                                {isEditing ? (
                                  <Select
                                    value={currentValues.division}
                                    onValueChange={(value) =>
                                      setEditingValues((prev) =>
                                        prev
                                          ? { ...prev, division: value as Division }
                                          : {
                                              full_name: judgeRow.full_name,
                                              email: judgeRow.email,
                                              division: value as Division
                                            }
                                      )
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="male">Male</SelectItem>
                                      <SelectItem value="female">Female</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  judgeRow.division
                                )}
                              </td>
                              <td className="py-3 text-right space-x-2">
                                {isEditing ? (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        if (!editingValues) return;
                                        updateJudgeMutation.mutate({
                                          id: judgeRow.id,
                                          ...editingValues
                                        });
                                      }}
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setEditingJudgeId(null);
                                        setEditingValues(null);
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setEditingJudgeId(judgeRow.id);
                                      setEditingValues({
                                        full_name: judgeRow.full_name,
                                        email: judgeRow.email,
                                        division: judgeRow.division as Division
                                      });
                                    }}
                                  >
                                    Edit
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteJudgeMutation.mutate(judgeRow.id)}
                                >
                                  Remove
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {judgesQuery.data?.length === 0 && (
                      <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">No judges registered.</p>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="leaderboard" className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <Select
                  value={divisionFilter}
                  onValueChange={(value) => setDivisionFilter(value as Division)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => refreshMutation.mutate()}
                  disabled={refreshMutation.isPending}
                >
                  {refreshMutation.isPending ? 'Refreshing…' : 'Refresh totals'}
                </Button>
              </div>
              <Card className="p-5">
                <ScrollArea className="max-h-[420px]">
                  <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-white/5">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">
                        <th className="py-2">Rank</th>
                        <th className="py-2">Contestant</th>
                        <th className="py-2">Total score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                      {leaderboardQuery.data?.map((row) => (
                        <tr key={row.contestant_id}>
                          <td className="py-3 text-slate-900 dark:text-white">{row.rank}</td>
                          <td className="py-3 text-slate-900 dark:text-white">
                            #{row.number?.toString().padStart(2, '0')} {row.full_name}
                          </td>
                          <td className="py-3 text-slate-900 dark:text-white">{row.total_score?.toFixed(3)}</td>
                        </tr>
                      )) ?? (
                        <tr>
                          <td className="py-3 text-sm text-slate-600 dark:text-slate-400" colSpan={3}>
                            No records found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </ScrollArea>
              </Card>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </AppShell>
  );
}


import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../components/ui/select';
import {
  createContestant,
  createJudge,
  deleteJudge,
  fetchAllContestants,
  fetchJudges,
  fetchLeaderboard,
  fetchScoresForExport,
  refreshLeaderboard,
  supabaseAuth,
  updateJudge
} from '../services/supabaseApi';
import type { Division } from '../types/scoring';
import { downloadCsv, toCsv } from '../utils/export';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ScrollArea } from '../components/ui/scroll-area';
import { Badge } from '../components/ui/badge';

const contestantSchema = z.object({
  full_name: z.string().min(2, 'School name is required'),
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
  const [activeTab, setActiveTab] = useState('contestants');
  const [editingJudgeId, setEditingJudgeId] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<{
    full_name: string;
    email: string;
    division: Division;
  } | null>(null);
  const [roleChecked, setRoleChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

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
    defaultValues: { full_name: '', number: 1 }
  });

  const judgeForm = useForm<z.infer<typeof judgeSchema>>({
    resolver: zodResolver(judgeSchema),
    defaultValues: { full_name: '', email: '', password: '', division: 'male' }
  });

  const allContestants = contestantsQuery.data ?? [];
  const maleCount = allContestants.filter((c) => c.division === 'male').length;
  const femaleCount = allContestants.filter((c) => c.division === 'female').length;
  const schoolCount = Math.ceil(allContestants.length / 2);
  const totalJudges = judgesQuery.data?.length ?? 0;
  const atCapacity = maleCount >= 5 && femaleCount >= 5;

  useEffect(() => {
    const numbers = allContestants.map((c) => c.number);
    const nextNumber = numbers.length ? Math.max(...numbers) + 1 : 1;
    contestantForm.setValue('number', nextNumber);
  }, [allContestants, contestantForm]);

  const contestantMutation = useMutation({
    mutationFn: async (values: z.infer<typeof contestantSchema>) => {
      const exists = allContestants.find((c) => c.number === values.number);
      if (exists) {
        contestantForm.setError('number', {
          type: 'manual',
          message: 'This number is already assigned'
        });
        throw new Error('duplicate');
      }
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
      await supabaseAuth.signUpWithPassword({
        email: values.email,
        password: values.password,
        full_name: values.full_name,
        division: values.division
      });
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
    mutationFn: async ({
      id,
      full_name,
      email,
      division
    }: {
      id: string;
      full_name: string;
      email: string;
      division: Division;
    }) => {
      await updateJudge(id, {
        full_name,
        email,
        division
      });
    },
    onSuccess: () => {
      setEditingJudgeId(null);
      setEditingValues(null);
      queryClient.invalidateQueries({ queryKey: ['judges'] });
    }
  });

  const deleteJudgeMutation = useMutation({
    mutationFn: async (id: string) => deleteJudge(id),
    onSuccess: () => {
      if (editingJudgeId) {
        setEditingJudgeId(null);
        setEditingValues(null);
      }
      queryClient.invalidateQueries({ queryKey: ['judges'] });
    }
  });

  const refreshMutation = useMutation({
    mutationFn: refreshLeaderboard,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leaderboard'] })
  });

  const handleExport = async () => {
    const rows = await fetchScoresForExport();
    downloadCsv('scores.csv', toCsv(rows));
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      const role = await supabaseAuth.getCurrentRole();
      if (!mounted) return;
      setIsAdmin(role === 'admin');
      setRoleChecked(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (!roleChecked) {
    return (
      <AppShell title="Admin Dashboard" showAdminLink={false}>
        <p className="text-sm text-slate-600 dark:text-slate-400">Verifying access…</p>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell title="Admin Dashboard" showAdminLink={false}>
        <p className="text-sm text-rose-600 dark:text-rose-300">You are not authorized to view this page.</p>
      </AppShell>
    );
  }

  const summary = [
    { label: 'Schools', value: schoolCount },
    { label: 'Male Contestants', value: maleCount },
    { label: 'Female Contestants', value: femaleCount },
    { label: 'Judges', value: totalJudges }
  ];

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
      <div className="space-y-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {summary.map((item) => (
            <Card key={item.label} className="p-5 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">{item.label}</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{item.value}</p>
            </Card>
          ))}
        </div>

        <Card className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="contestants">Contestants</TabsTrigger>
              <TabsTrigger value="judges">Judges</TabsTrigger>
              <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
            </TabsList>

            <TabsContent value="contestants" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="p-5">
                  <CardHeader>
                    <CardTitle>Register School</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form
                      className="space-y-4"
                      onSubmit={contestantForm.handleSubmit((values) =>
                        contestantMutation.mutate(values)
                      )}
                    >
                      <div className="space-y-2">
                        <Label>School / Contingent Name</Label>
                        <Input {...contestantForm.register('full_name')} />
                      </div>
                      <div className="space-y-2">
                        <Label>Assigned Number</Label>
                        <Input type="number" {...contestantForm.register('number', { valueAsNumber: true })} />
                        {contestantForm.formState.errors.number && (
                          <p className="text-xs text-rose-600 dark:text-rose-300">
                            {contestantForm.formState.errors.number.message}
                          </p>
                        )}
                      </div>
                      <Button
                        type="submit"
                        className="w-full rounded-2xl"
                        disabled={contestantMutation.isPending || atCapacity}
                      >
                        {atCapacity
                          ? 'Capacity Reached'
                          : contestantMutation.isPending
                          ? 'Saving…'
                          : 'Add Pair'}
                      </Button>
                      {atCapacity && (
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Maximum of five per division reached. Remove a contestant first.
                        </p>
                      )}
                    </form>
                  </CardContent>
                </Card>

                <Card className="p-5">
                  <CardHeader>
                    <CardTitle>Schools on Record</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      <div className="space-y-3">
                        {schoolCount === 0 && (
                          <p className="text-sm text-slate-600 dark:text-slate-400">No schools registered yet.</p>
                        )}
                        {Array.from(
                          new Map(
                            allContestants.map((contestant) => [
                              contestant.number,
                              contestant.full_name
                            ])
                          ).entries()
                        ).map(([number, name]) => (
                          <div
                            key={number}
                            className="flex items-center justify-between rounded-2xl border border-slate-200 px-3 py-2 dark:border-white/5"
                          >
                            <div>
                              <p className="font-medium text-slate-900 dark:text-white">
                                #{String(number).padStart(2, '0')}
                              </p>
                              <p className="text-sm text-slate-600 dark:text-slate-400">{name}</p>
                            </div>
                            <Badge>Registered</Badge>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="judges" className="space-y-6">
              <Card className="p-5">
                <CardHeader>
                  <CardTitle>Invite Judge</CardTitle>
                </CardHeader>
                <CardContent>
                  <form
                    className="grid gap-4 md:grid-cols-2"
                    onSubmit={judgeForm.handleSubmit((values) => judgeMutation.mutate(values))}
                  >
                    <div className="space-y-2 md:col-span-2">
                      <Label>Full Name</Label>
                      <Input {...judgeForm.register('full_name')} />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input type="email" {...judgeForm.register('email')} />
                    </div>
                    <div className="space-y-2">
                      <Label>Initial Password</Label>
                      <Input type="password" {...judgeForm.register('password')} />
                      {judgeForm.formState.errors.password && (
                        <p className="text-xs text-rose-600 dark:text-rose-300">
                          {judgeForm.formState.errors.password.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Division</Label>
                      <Select
                        value={judgeForm.watch('division')}
                        onValueChange={(value) => judgeForm.setValue('division', value as Division)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select division" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2">
                      <Button
                        type="submit"
                        className="w-full rounded-2xl"
                        disabled={judgeMutation.isPending}
                      >
                        {judgeMutation.isPending ? 'Inviting…' : 'Invite Judge'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              <Card className="p-5">
                <CardHeader>
                  <CardTitle>Judges Roster</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-80">
                    <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-white/5">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">
                          <th className="py-2">Name</th>
                          <th className="py-2">Email</th>
                          <th className="py-2">Division</th>
                          <th className="py-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                        {judgesQuery.data?.map((judgeRow) => {
                          const isEditing = editingJudgeId === judgeRow.id;
                          const currentValues =
                            isEditing && editingValues
                              ? editingValues
                              : {
                                  full_name: judgeRow.full_name,
                                  email: judgeRow.email,
                                  division: judgeRow.division as Division
                                };
                          return (
                            <tr key={judgeRow.id}>
                              <td className="py-3 text-slate-900 dark:text-white">
                                {isEditing ? (
                                  <Input
                                    value={currentValues.full_name}
                                    onChange={(e) =>
                                      setEditingValues((prev) =>
                                        prev
                                          ? { ...prev, full_name: e.target.value }
                                          : {
                                              full_name: e.target.value,
                                              email: judgeRow.email,
                                              division: judgeRow.division as Division
                                            }
                                      )
                                    }
                                  />
                                ) : (
                                  judgeRow.full_name
                                )}
                              </td>
                              <td className="py-3 text-slate-600 dark:text-slate-400">
                                {isEditing ? (
                                  <Input
                                    value={currentValues.email}
                                    onChange={(e) =>
                                      setEditingValues((prev) =>
                                        prev
                                          ? { ...prev, email: e.target.value }
                                          : {
                                              full_name: judgeRow.full_name,
                                              email: e.target.value,
                                              division: judgeRow.division as Division
                                            }
                                      )
                                    }
                                  />
                                ) : (
                                  judgeRow.email
                                )}
                              </td>
                              <td className="py-3 capitalize">
                                {isEditing ? (
                                  <Select
                                    value={currentValues.division}
                                    onValueChange={(value) =>
                                      setEditingValues((prev) =>
                                        prev
                                          ? { ...prev, division: value as Division }
                                          : {
                                              full_name: judgeRow.full_name,
                                              email: judgeRow.email,
                                              division: value as Division
                                            }
                                      )
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="male">Male</SelectItem>
                                      <SelectItem value="female">Female</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  judgeRow.division
                                )}
                              </td>
                              <td className="py-3 text-right space-x-2">
                                {isEditing ? (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        if (!editingValues) return;
                                        updateJudgeMutation.mutate({
                                          id: judgeRow.id,
                                          ...editingValues
                                        });
                                      }}
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setEditingJudgeId(null);
                                        setEditingValues(null);
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setEditingJudgeId(judgeRow.id);
                                      setEditingValues({
                                        full_name: judgeRow.full_name,
                                        email: judgeRow.email,
                                        division: judgeRow.division as Division
                                      });
                                    }}
                                  >
                                    Edit
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteJudgeMutation.mutate(judgeRow.id)}
                                >
                                  Remove
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {judgesQuery.data?.length === 0 && (
                      <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">No judges registered.</p>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="leaderboard" className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <Select
                  value={divisionFilter}
                  onValueChange={(value) => setDivisionFilter(value as Division)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => refreshMutation.mutate()}
                  disabled={refreshMutation.isPending}
                >
                  {refreshMutation.isPending ? 'Refreshing…' : 'Refresh totals'}
                </Button>
              </div>
              <Card className="p-5">
                <ScrollArea className="max-h-[420px]">
                  <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-white/5">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">
                        <th className="py-2">Rank</th>
                        <th className="py-2">Contestant</th>
                        <th className="py-2">Total score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                      {leaderboardQuery.data?.map((row) => (
                        <tr key={row.contestant_id}>
                          <td className="py-3 text-slate-900 dark:text-white">{row.rank}</td>
                          <td className="py-3 text-slate-900 dark:text-white">
                            #{row.number?.toString().padStart(2, '0')} {row.full_name}
                          </td>
                          <td className="py-3 text-slate-900 dark:text-white">{row.total_score?.toFixed(3)}</td>
                        </tr>
                      )) ?? (
                        <tr>
                          <td className="py-3 text-sm text-slate-600 dark:text-slate-400" colSpan={3}>
                            No records found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </ScrollArea>
              </Card>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </AppShell>
  );
}


import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../components/ui/select';
import {
  createContestant,
  createJudge,
  deleteJudge,
  fetchAllContestants,
  fetchJudges,
  fetchLeaderboard,
  fetchScoresForExport,
  refreshLeaderboard,
  supabaseAuth,
  updateJudge
} from '../services/supabaseApi';
import type { Division } from '../types/scoring';
import { downloadCsv, toCsv } from '../utils/export';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ScrollArea } from '../components/ui/scroll-area';
import { Badge } from '../components/ui/badge';

const contestantSchema = z.object({
  full_name: z.string().min(2, 'School name is required'),
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
  const [activeTab, setActiveTab] = useState('contestants');
  const [editingJudgeId, setEditingJudgeId] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<{
    full_name: string;
    email: string;
    division: Division;
  } | null>(null);
  const [roleChecked, setRoleChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

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
    defaultValues: { full_name: '', number: 1 }
  });

  const judgeForm = useForm<z.infer<typeof judgeSchema>>({
    resolver: zodResolver(judgeSchema),
    defaultValues: { full_name: '', email: '', password: '', division: 'male' }
  });

  const allContestants = contestantsQuery.data ?? [];
  const maleCount = allContestants.filter((c) => c.division === 'male').length;
  const femaleCount = allContestants.filter((c) => c.division === 'female').length;
  const schoolCount = Math.ceil(allContestants.length / 2);
  const totalJudges = judgesQuery.data?.length ?? 0;
  const atCapacity = maleCount >= 5 && femaleCount >= 5;

  useEffect(() => {
    const numbers = allContestants.map((c) => c.number);
    const nextNumber = numbers.length ? Math.max(...numbers) + 1 : 1;
    contestantForm.setValue('number', nextNumber);
  }, [allContestants, contestantForm]);

  const contestantMutation = useMutation({
    mutationFn: async (values: z.infer<typeof contestantSchema>) => {
      const exists = allContestants.find((c) => c.number === values.number);
      if (exists) {
        contestantForm.setError('number', {
          type: 'manual',
          message: 'This number is already assigned'
        });
        throw new Error('duplicate');
      }
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
      await supabaseAuth.signUpWithPassword({
        email: values.email,
        password: values.password,
        full_name: values.full_name,
        division: values.division
      });
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
    mutationFn: async ({
      id,
      full_name,
      email,
      division
    }: {
      id: string;
      full_name: string;
      email: string;
      division: Division;
    }) => {
      await updateJudge(id, {
        full_name,
        email,
        division
      });
    },
    onSuccess: () => {
      setEditingJudgeId(null);
      setEditingValues(null);
      queryClient.invalidateQueries({ queryKey: ['judges'] });
    }
  });

  const deleteJudgeMutation = useMutation({
    mutationFn: async (id: string) => deleteJudge(id),
    onSuccess: () => {
      if (editingJudgeId) {
        setEditingJudgeId(null);
        setEditingValues(null);
      }
      queryClient.invalidateQueries({ queryKey: ['judges'] });
    }
  });

  const refreshMutation = useMutation({
    mutationFn: refreshLeaderboard,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leaderboard'] })
  });

  const handleExport = async () => {
    const rows = await fetchScoresForExport();
    downloadCsv('scores.csv', toCsv(rows));
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      const role = await supabaseAuth.getCurrentRole();
      if (!mounted) return;
      setIsAdmin(role === 'admin');
      setRoleChecked(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (!roleChecked) {
    return (
      <AppShell title="Admin Dashboard" showAdminLink={false}>
        <p className="text-sm text-slate-600 dark:text-slate-400">Verifying access…</p>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell title="Admin Dashboard" showAdminLink={false}>
        <p className="text-sm text-rose-600 dark:text-rose-300">You are not authorized to view this page.</p>
      </AppShell>
    );
  }

  const summary = [
    { label: 'Schools', value: schoolCount },
    { label: 'Male Contestants', value: maleCount },
    { label: 'Female Contestants', value: femaleCount },
    { label: 'Judges', value: totalJudges }
  ];

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
      <div className="space-y-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {summary.map((item) => (
            <Card key={item.label} className="p-5 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">{item.label}</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{item.value}</p>
            </Card>
          ))}
        </div>

        <Card className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="contestants">Contestants</TabsTrigger>
              <TabsTrigger value="judges">Judges</TabsTrigger>
              <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
            </TabsList>

            <TabsContent value="contestants" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="p-5">
                  <CardHeader>
                    <CardTitle>Register School</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form
                      className="space-y-4"
                      onSubmit={contestantForm.handleSubmit((values) =>
                        contestantMutation.mutate(values)
                      )}
                    >
                      <div className="space-y-2">
                        <Label>School / Contingent Name</Label>
                        <Input {...contestantForm.register('full_name')} />
                      </div>
                      <div className="space-y-2">
                        <Label>Assigned Number</Label>
                        <Input type="number" {...contestantForm.register('number', { valueAsNumber: true })} />
                        {contestantForm.formState.errors.number && (
                          <p className="text-xs text-rose-600 dark:text-rose-300">
                            {contestantForm.formState.errors.number.message}
                          </p>
                        )}
                      </div>
                      <Button
                        type="submit"
                        className="w-full rounded-2xl"
                        disabled={contestantMutation.isPending || atCapacity}
                      >
                        {atCapacity
                          ? 'Capacity Reached'
                          : contestantMutation.isPending
                          ? 'Saving…'
                          : 'Add Pair'}
                      </Button>
                      {atCapacity && (
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Maximum of five per division reached. Remove a contestant first.
                        </p>
                      )}
                    </form>
                  </CardContent>
                </Card>

                <Card className="p-5">
                  <CardHeader>
                    <CardTitle>Schools on Record</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      <div className="space-y-3">
                        {schoolCount === 0 && (
                          <p className="text-sm text-slate-600 dark:text-slate-400">No schools registered yet.</p>
                        )}
                        {Array.from(
                          new Map(
                            allContestants.map((contestant) => [
                              contestant.number,
                              contestant.full_name
                            ])
                          ).entries()
                        ).map(([number, name]) => (
                          <div
                            key={number}
                            className="flex items-center justify-between rounded-2xl border border-slate-200 px-3 py-2 dark:border-white/5"
                          >
                            <div>
                              <p className="font-medium text-slate-900 dark:text-white">
                                #{String(number).padStart(2, '0')}
                              </p>
                              <p className="text-sm text-slate-600 dark:text-slate-400">{name}</p>
                            </div>
                            <Badge>Registered</Badge>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="judges" className="space-y-6">
              <Card className="p-5">
                <CardHeader>
                  <CardTitle>Invite Judge</CardTitle>
                </CardHeader>
                <CardContent>
                  <form
                    className="grid gap-4 md:grid-cols-2"
                    onSubmit={judgeForm.handleSubmit((values) => judgeMutation.mutate(values))}
                  >
                    <div className="space-y-2 md:col-span-2">
                      <Label>Full Name</Label>
                      <Input {...judgeForm.register('full_name')} />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input type="email" {...judgeForm.register('email')} />
                    </div>
                    <div className="space-y-2">
                      <Label>Initial Password</Label>
                      <Input type="password" {...judgeForm.register('password')} />
                      {judgeForm.formState.errors.password && (
                        <p className="text-xs text-rose-600 dark:text-rose-300">
                          {judgeForm.formState.errors.password.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Division</Label>
                      <Select
                        value={judgeForm.watch('division')}
                        onValueChange={(value) => judgeForm.setValue('division', value as Division)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select division" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2">
                      <Button
                        type="submit"
                        className="w-full rounded-2xl"
                        disabled={judgeMutation.isPending}
                      >
                        {judgeMutation.isPending ? 'Inviting…' : 'Invite Judge'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              <Card className="p-5">
                <CardHeader>
                  <CardTitle>Judges Roster</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-80">
                    <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-white/5">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">
                          <th className="py-2">Name</th>
                          <th className="py-2">Email</th>
                          <th className="py-2">Division</th>
                          <th className="py-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                        {judgesQuery.data?.map((judgeRow) => {
                          const isEditing = editingJudgeId === judgeRow.id;
                          const currentValues =
                            isEditing && editingValues
                              ? editingValues
                              : {
                                  full_name: judgeRow.full_name,
                                  email: judgeRow.email,
                                  division: judgeRow.division as Division
                                };
                          return (
                            <tr key={judgeRow.id}>
                              <td className="py-3 text-slate-900 dark:text-white">
                                {isEditing ? (
                                  <Input
                                    value={currentValues.full_name}
                                    onChange={(e) =>
                                      setEditingValues((prev) =>
                                        prev
                                          ? { ...prev, full_name: e.target.value }
                                          : {
                                              full_name: e.target.value,
                                              email: judgeRow.email,
                                              division: judgeRow.division as Division
                                            }
                                      )
                                    }
                                  />
                                ) : (
                                  judgeRow.full_name
                                )}
                              </td>
                              <td className="py-3 text-slate-600 dark:text-slate-400">
                                {isEditing ? (
                                  <Input
                                    value={currentValues.email}
                                    onChange={(e) =>
                                      setEditingValues((prev) =>
                                        prev
                                          ? { ...prev, email: e.target.value }
                                          : {
                                              full_name: judgeRow.full_name,
                                              email: e.target.value,
                                              division: judgeRow.division as Division
                                            }
                                      )
                                    }
                                  />
                                ) : (
                                  judgeRow.email
                                )}
                              </td>
                              <td className="py-3 capitalize">
                                {isEditing ? (
                                  <Select
                                    value={currentValues.division}
                                    onValueChange={(value) =>
                                      setEditingValues((prev) =>
                                        prev
                                          ? { ...prev, division: value as Division }
                                          : {
                                              full_name: judgeRow.full_name,
                                              email: judgeRow.email,
                                              division: value as Division
                                            }
                                      )
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="male">Male</SelectItem>
                                      <SelectItem value="female">Female</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  judgeRow.division
                                )}
                              </td>
                              <td className="py-3 text-right space-x-2">
                                {isEditing ? (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        if (!editingValues) return;
                                        updateJudgeMutation.mutate({
                                          id: judgeRow.id,
                                          ...editingValues
                                        });
                                      }}
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setEditingJudgeId(null);
                                        setEditingValues(null);
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setEditingJudgeId(judgeRow.id);
                                      setEditingValues({
                                        full_name: judgeRow.full_name,
                                        email: judgeRow.email,
                                        division: judgeRow.division as Division
                                      });
                                    }}
                                  >
                                    Edit
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteJudgeMutation.mutate(judgeRow.id)}
                                >
                                  Remove
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {judgesQuery.data?.length === 0 && (
                      <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">No judges registered.</p>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="leaderboard" className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <Select
                  value={divisionFilter}
                  onValueChange={(value) => setDivisionFilter(value as Division)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => refreshMutation.mutate()}
                  disabled={refreshMutation.isPending}
                >
                  {refreshMutation.isPending ? 'Refreshing…' : 'Refresh totals'}
                </Button>
              </div>
              <Card className="p-5">
                <ScrollArea className="max-h-[420px]">
                  <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-white/5">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">
                        <th className="py-2">Rank</th>
                        <th className="py-2">Contestant</th>
                        <th className="py-2">Total score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                      {leaderboardQuery.data?.map((row) => (
                        <tr key={row.contestant_id}>
                          <td className="py-3 text-slate-900 dark:text-white">{row.rank}</td>
                          <td className="py-3 text-slate-900 dark:text-white">
                            #{row.number?.toString().padStart(2, '0')} {row.full_name}
                          </td>
                          <td className="py-3 text-slate-900 dark:text-white">{row.total_score?.toFixed(3)}</td>
                        </tr>
                      )) ?? (
                        <tr>
                          <td className="py-3 text-sm text-slate-600 dark:text-slate-400" colSpan={3}>
                            No records found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </ScrollArea>
              </Card>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </AppShell>
  );
}


import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../components/ui/select';
import {
  createContestant,
  createJudge,
  deleteJudge,
  fetchAllContestants,
  fetchJudges,
  fetchLeaderboard,
  fetchScoresForExport,
  refreshLeaderboard,
  supabaseAuth,
  updateJudge
} from '../services/supabaseApi';
import type { Division } from '../types/scoring';
import { downloadCsv, toCsv } from '../utils/export';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ScrollArea } from '../components/ui/scroll-area';
import { Badge } from '../components/ui/badge';

const contestantSchema = z.object({
  full_name: z.string().min(2, 'School name is required'),
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
  const [activeTab, setActiveTab] = useState('contestants');
  const [editingJudgeId, setEditingJudgeId] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<{
    full_name: string;
    email: string;
    division: Division;
  } | null>(null);
  const [roleChecked, setRoleChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

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
    defaultValues: { full_name: '', number: 1 }
  });

  const judgeForm = useForm<z.infer<typeof judgeSchema>>({
    resolver: zodResolver(judgeSchema),
    defaultValues: { full_name: '', email: '', password: '', division: 'male' }
  });

  const allContestants = contestantsQuery.data ?? [];
  const maleCount = allContestants.filter((c) => c.division === 'male').length;
  const femaleCount = allContestants.filter((c) => c.division === 'female').length;
  const schoolCount = Math.ceil(allContestants.length / 2);
  const totalJudges = judgesQuery.data?.length ?? 0;
  const atCapacity = maleCount >= 5 && femaleCount >= 5;

  useEffect(() => {
    const numbers = allContestants.map((c) => c.number);
    const nextNumber = numbers.length ? Math.max(...numbers) + 1 : 1;
    contestantForm.setValue('number', nextNumber);
  }, [allContestants, contestantForm]);

  const contestantMutation = useMutation({
    mutationFn: async (values: z.infer<typeof contestantSchema>) => {
      const exists = allContestants.find((c) => c.number === values.number);
      if (exists) {
        contestantForm.setError('number', {
          type: 'manual',
          message: 'This number is already assigned'
        });
        throw new Error('duplicate');
      }
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
      await supabaseAuth.signUpWithPassword({
        email: values.email,
        password: values.password,
        full_name: values.full_name,
        division: values.division
      });
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
    mutationFn: async ({
      id,
      full_name,
      email,
      division
    }: {
      id: string;
      full_name: string;
      email: string;
      division: Division;
    }) => {
      await updateJudge(id, {
        full_name,
        email,
        division
      });
    },
    onSuccess: () => {
      setEditingJudgeId(null);
      setEditingValues(null);
      queryClient.invalidateQueries({ queryKey: ['judges'] });
    }
  });

  const deleteJudgeMutation = useMutation({
    mutationFn: async (id: string) => deleteJudge(id),
    onSuccess: () => {
      if (editingJudgeId) {
        setEditingJudgeId(null);
        setEditingValues(null);
      }
      queryClient.invalidateQueries({ queryKey: ['judges'] });
    }
  });

  const refreshMutation = useMutation({
    mutationFn: refreshLeaderboard,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leaderboard'] })
  });

  const handleExport = async () => {
    const rows = await fetchScoresForExport();
    downloadCsv('scores.csv', toCsv(rows));
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      const role = await supabaseAuth.getCurrentRole();
      if (!mounted) return;
      setIsAdmin(role === 'admin');
      setRoleChecked(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (!roleChecked) {
    return (
      <AppShell title="Admin Dashboard" showAdminLink={false}>
        <p className="text-sm text-slate-600 dark:text-slate-400">Verifying access…</p>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell title="Admin Dashboard" showAdminLink={false}>
        <p className="text-sm text-rose-600 dark:text-rose-300">You are not authorized to view this page.</p>
      </AppShell>
    );
  }

  const summary = [
    { label: 'Schools', value: schoolCount },
    { label: 'Male Contestants', value: maleCount },
    { label: 'Female Contestants', value: femaleCount },
    { label: 'Judges', value: totalJudges }
  ];

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
      <div className="space-y-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {summary.map((item) => (
            <Card key={item.label} className="p-5 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">{item.label}</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{item.value}</p>
            </Card>
          ))}
        </div>

        <Card className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="contestants">Contestants</TabsTrigger>
              <TabsTrigger value="judges">Judges</TabsTrigger>
              <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
            </TabsList>

            <TabsContent value="contestants" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="p-5">
                  <CardHeader>
                    <CardTitle>Register School</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form
                      className="space-y-4"
                      onSubmit={contestantForm.handleSubmit((values) =>
                        contestantMutation.mutate(values)
                      )}
                    >
                      <div className="space-y-2">
                        <Label>School / Contingent Name</Label>
                        <Input {...contestantForm.register('full_name')} />
                      </div>
                      <div className="space-y-2">
                        <Label>Assigned Number</Label>
                        <Input type="number" {...contestantForm.register('number', { valueAsNumber: true })} />
                        {contestantForm.formState.errors.number && (
                          <p className="text-xs text-rose-600 dark:text-rose-300">
                            {contestantForm.formState.errors.number.message}
                          </p>
                        )}
                      </div>
                      <Button
                        type="submit"
                        className="w-full rounded-2xl"
                        disabled={contestantMutation.isPending || atCapacity}
                      >
                        {atCapacity
                          ? 'Capacity Reached'
                          : contestantMutation.isPending
                          ? 'Saving…'
                          : 'Add Pair'}
                      </Button>
                      {atCapacity && (
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Maximum of five per division reached. Remove a contestant first.
                        </p>
                      )}
                    </form>
                  </CardContent>
                </Card>

                <Card className="p-5">
                  <CardHeader>
                    <CardTitle>Schools on Record</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      <div className="space-y-3">
                        {schoolCount === 0 && (
                          <p className="text-sm text-slate-600 dark:text-slate-400">No schools registered yet.</p>
                        )}
                        {Array.from(
                          new Map(
                            allContestants.map((contestant) => [
                              contestant.number,
                              contestant.full_name
                            ])
                          ).entries()
                        ).map(([number, name]) => (
                          <div
                            key={number}
                            className="flex items-center justify-between rounded-2xl border border-slate-200 px-3 py-2 dark:border-white/5"
                          >
                            <div>
                              <p className="font-medium text-slate-900 dark:text-white">
                                #{String(number).padStart(2, '0')}
                              </p>
                              <p className="text-sm text-slate-600 dark:text-slate-400">{name}</p>
                            </div>
                            <Badge>Registered</Badge>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="judges" className="space-y-6">
              <Card className="p-5">
                <CardHeader>
                  <CardTitle>Invite Judge</CardTitle>
                </CardHeader>
                <CardContent>
                  <form
                    className="grid gap-4 md:grid-cols-2"
                    onSubmit={judgeForm.handleSubmit((values) => judgeMutation.mutate(values))}
                  >
                    <div className="space-y-2 md:col-span-2">
                      <Label>Full Name</Label>
                      <Input {...judgeForm.register('full_name')} />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input type="email" {...judgeForm.register('email')} />
                    </div>
                    <div className="space-y-2">
                      <Label>Initial Password</Label>
                      <Input type="password" {...judgeForm.register('password')} />
                      {judgeForm.formState.errors.password && (
                        <p className="text-xs text-rose-600 dark:text-rose-300">
                          {judgeForm.formState.errors.password.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Division</Label>
                      <Select
                        value={judgeForm.watch('division')}
                        onValueChange={(value) => judgeForm.setValue('division', value as Division)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select division" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2">
                      <Button
                        type="submit"
                        className="w-full rounded-2xl"
                        disabled={judgeMutation.isPending}
                      >
                        {judgeMutation.isPending ? 'Inviting…' : 'Invite Judge'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              <Card className="p-5">
                <CardHeader>
                  <CardTitle>Judges Roster</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-80">
                    <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-white/5">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">
                          <th className="py-2">Name</th>
                          <th className="py-2">Email</th>
                          <th className="py-2">Division</th>
                          <th className="py-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                        {judgesQuery.data?.map((judgeRow) => {
                          const isEditing = editingJudgeId === judgeRow.id;
                          const currentValues =
                            isEditing && editingValues
                              ? editingValues
                              : {
                                  full_name: judgeRow.full_name,
                                  email: judgeRow.email,
                                  division: judgeRow.division as Division
                                };
                          return (
                            <tr key={judgeRow.id}>
                              <td className="py-3 text-slate-900 dark:text-white">
                                {isEditing ? (
                                  <Input
                                    value={currentValues.full_name}
                                    onChange={(e) =>
                                      setEditingValues((prev) =>
                                        prev
                                          ? { ...prev, full_name: e.target.value }
                                          : {
                                              full_name: e.target.value,
                                              email: judgeRow.email,
                                              division: judgeRow.division as Division
                                            }
                                      )
                                    }
                                  />
                                ) : (
                                  judgeRow.full_name
                                )}
                              </td>
                              <td className="py-3 text-slate-600 dark:text-slate-400">
                                {isEditing ? (
                                  <Input
                                    value={currentValues.email}
                                    onChange={(e) =>
                                      setEditingValues((prev) =>
                                        prev
                                          ? { ...prev, email: e.target.value }
                                          : {
                                              full_name: judgeRow.full_name,
                                              email: e.target.value,
                                              division: judgeRow.division as Division
                                            }
                                      )
                                    }
                                  />
                                ) : (
                                  judgeRow.email
                                )}
                              </td>
                              <td className="py-3 capitalize">
                                {isEditing ? (
                                  <Select
                                    value={currentValues.division}
                                    onValueChange={(value) =>
                                      setEditingValues((prev) =>
                                        prev
                                          ? { ...prev, division: value as Division }
                                          : {
                                              full_name: judgeRow.full_name,
                                              email: judgeRow.email,
                                              division: value as Division
                                            }
                                      )
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="male">Male</SelectItem>
                                      <SelectItem value="female">Female</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  judgeRow.division
                                )}
                              </td>
                              <td className="py-3 text-right space-x-2">
                                {isEditing ? (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        if (!editingValues) return;
                                        updateJudgeMutation.mutate({
                                          id: judgeRow.id,
                                          ...editingValues
                                        });
                                      }}
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setEditingJudgeId(null);
                                        setEditingValues(null);
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setEditingJudgeId(judgeRow.id);
                                      setEditingValues({
                                        full_name: judgeRow.full_name,
                                        email: judgeRow.email,
                                        division: judgeRow.division as Division
                                      });
                                    }}
                                  >
                                    Edit
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteJudgeMutation.mutate(judgeRow.id)}
                                >
                                  Remove
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {judgesQuery.data?.length === 0 && (
                      <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">No judges registered.</p>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="leaderboard" className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <Select
                  value={divisionFilter}
                  onValueChange={(value) => setDivisionFilter(value as Division)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => refreshMutation.mutate()}
                  disabled={refreshMutation.isPending}
                >
                  {refreshMutation.isPending ? 'Refreshing…' : 'Refresh totals'}
                </Button>
              </div>
              <Card className="p-5">
                <ScrollArea className="max-h-[420px]">
                  <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-white/5">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">
                        <th className="py-2">Rank</th>
                        <th className="py-2">Contestant</th>
                        <th className="py-2">Total score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                      {leaderboardQuery.data?.map((row) => (
                        <tr key={row.contestant_id}>
                          <td className="py-3 text-slate-900 dark:text-white">{row.rank}</td>
                          <td className="py-3 text-slate-900 dark:text-white">
                            #{row.number?.toString().padStart(2, '0')} {row.full_name}
                          </td>
                          <td className="py-3 text-slate-900 dark:text-white">{row.total_score?.toFixed(3)}</td>
                        </tr>
                      )) ?? (
                        <tr>
                          <td className="py-3 text-sm text-slate-600 dark:text-slate-400" colSpan={3}>
                            No records found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </ScrollArea>
              </Card>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </AppShell>
  );
}


import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../components/ui/select';
import {
  createContestant,
  createJudge,
  deleteJudge,
  fetchAllContestants,
  fetchJudges,
  fetchLeaderboard,
  fetchScoresForExport,
  refreshLeaderboard,
  supabaseAuth,
  updateJudge
} from '../services/supabaseApi';
import type { Division } from '../types/scoring';
import { downloadCsv, toCsv } from '../utils/export';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ScrollArea } from '../components/ui/scroll-area';
import { Badge } from '../components/ui/badge';

const contestantSchema = z.object({
  full_name: z.string().min(2, 'School name is required'),
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
  const [activeTab, setActiveTab] = useState('contestants');
  const [editingJudgeId, setEditingJudgeId] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<{
    full_name: string;
    email: string;
    division: Division;
  } | null>(null);
  const [roleChecked, setRoleChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

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
    defaultValues: { full_name: '', number: 1 }
  });

  const judgeForm = useForm<z.infer<typeof judgeSchema>>({
    resolver: zodResolver(judgeSchema),
    defaultValues: { full_name: '', email: '', password: '', division: 'male' }
  });

  const allContestants = contestantsQuery.data ?? [];
  const maleCount = allContestants.filter((c) => c.division === 'male').length;
  const femaleCount = allContestants.filter((c) => c.division === 'female').length;
  const schoolCount = Math.ceil(allContestants.length / 2);
  const totalJudges = judgesQuery.data?.length ?? 0;
  const atCapacity = maleCount >= 5 && femaleCount >= 5;

  useEffect(() => {
    const numbers = allContestants.map((c) => c.number);
    const nextNumber = numbers.length ? Math.max(...numbers) + 1 : 1;
    contestantForm.setValue('number', nextNumber);
  }, [allContestants, contestantForm]);

  const contestantMutation = useMutation({
    mutationFn: async (values: z.infer<typeof contestantSchema>) => {
      const exists = allContestants.find((c) => c.number === values.number);
      if (exists) {
        contestantForm.setError('number', {
          type: 'manual',
          message: 'This number is already assigned'
        });
        throw new Error('duplicate');
      }
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
      await supabaseAuth.signUpWithPassword({
        email: values.email,
        password: values.password,
        full_name: values.full_name,
        division: values.division
      });
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
    mutationFn: async ({
      id,
      full_name,
      email,
      division
    }: {
      id: string;
      full_name: string;
      email: string;
      division: Division;
    }) => {
      await updateJudge(id, {
        full_name,
        email,
        division
      });
    },
    onSuccess: () => {
      setEditingJudgeId(null);
      setEditingValues(null);
      queryClient.invalidateQueries({ queryKey: ['judges'] });
    }
  });

  const deleteJudgeMutation = useMutation({
    mutationFn: async (id: string) => deleteJudge(id),
    onSuccess: () => {
      if (editingJudgeId) {
        setEditingJudgeId(null);
        setEditingValues(null);
      }
      queryClient.invalidateQueries({ queryKey: ['judges'] });
    }
  });

  const refreshMutation = useMutation({
    mutationFn: refreshLeaderboard,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leaderboard'] })
  });

  const handleExport = async () => {
    const rows = await fetchScoresForExport();
    downloadCsv('scores.csv', toCsv(rows));
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      const role = await supabaseAuth.getCurrentRole();
      if (!mounted) return;
      setIsAdmin(role === 'admin');
      setRoleChecked(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (!roleChecked) {
    return (
      <AppShell title="Admin Dashboard" showAdminLink={false}>
        <p className="text-sm text-slate-600 dark:text-slate-400">Verifying access…</p>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell title="Admin Dashboard" showAdminLink={false}>
        <p className="text-sm text-rose-600 dark:text-rose-300">You are not authorized to view this page.</p>
      </AppShell>
    );
  }

  const summary = [
    { label: 'Schools', value: schoolCount },
    { label: 'Male Contestants', value: maleCount },
    { label: 'Female Contestants', value: femaleCount },
    { label: 'Judges', value: totalJudges }
  ];

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
      <div className="space-y-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {summary.map((item) => (
            <Card key={item.label} className="p-5 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">{item.label}</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{item.value}</p>
            </Card>
          ))}
        </div>

        <Card className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="contestants">Contestants</TabsTrigger>
              <TabsTrigger value="judges">Judges</TabsTrigger>
              <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
            </TabsList>

            <TabsContent value="contestants" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="p-5">
                  <CardHeader>
                    <CardTitle>Register School</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form
                      className="space-y-4"
                      onSubmit={contestantForm.handleSubmit((values) =>
                        contestantMutation.mutate(values)
                      )}
                    >
                      <div className="space-y-2">
                        <Label>School / Contingent Name</Label>
                        <Input {...contestantForm.register('full_name')} />
                      </div>
                      <div className="space-y-2">
                        <Label>Assigned Number</Label>
                        <Input type="number" {...contestantForm.register('number', { valueAsNumber: true })} />
                        {contestantForm.formState.errors.number && (
                          <p className="text-xs text-rose-600 dark:text-rose-300">
                            {contestantForm.formState.errors.number.message}
                          </p>
                        )}
                      </div>
                      <Button
                        type="submit"
                        className="w-full rounded-2xl"
                        disabled={contestantMutation.isPending || atCapacity}
                      >
                        {atCapacity
                          ? 'Capacity Reached'
                          : contestantMutation.isPending
                          ? 'Saving…'
                          : 'Add Pair'}
                      </Button>
                      {atCapacity && (
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Maximum of five per division reached. Remove a contestant first.
                        </p>
                      )}
                    </form>
                  </CardContent>
                </Card>

                <Card className="p-5">
                  <CardHeader>
                    <CardTitle>Schools on Record</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      <div className="space-y-3">
                        {schoolCount === 0 && (
                          <p className="text-sm text-slate-600 dark:text-slate-400">No schools registered yet.</p>
                        )}
                        {Array.from(
                          new Map(
                            allContestants.map((contestant) => [
                              contestant.number,
                              contestant.full_name
                            ])
                          ).entries()
                        ).map(([number, name]) => (
                          <div
                            key={number}
                            className="flex items-center justify-between rounded-2xl border border-slate-200 px-3 py-2 dark:border-white/5"
                          >
                            <div>
                              <p className="font-medium text-slate-900 dark:text-white">
                                #{String(number).padStart(2, '0')}
                              </p>
                              <p className="text-sm text-slate-600 dark:text-slate-400">{name}</p>
                            </div>
                            <Badge>Registered</Badge>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="judges" className="space-y-6">
              <Card className="p-5">
                <CardHeader>
                  <CardTitle>Invite Judge</CardTitle>
                </CardHeader>
                <CardContent>
                  <form
                    className="grid gap-4 md:grid-cols-2"
                    onSubmit={judgeForm.handleSubmit((values) => judgeMutation.mutate(values))}
                  >
                    <div className="space-y-2 md:col-span-2">
                      <Label>Full Name</Label>
                      <Input {...judgeForm.register('full_name')} />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input type="email" {...judgeForm.register('email')} />
                    </div>
                    <div className="space-y-2">
                      <Label>Initial Password</Label>
                      <Input type="password" {...judgeForm.register('password')} />
                      {judgeForm.formState.errors.password && (
                        <p className="text-xs text-rose-600 dark:text-rose-300">
                          {judgeForm.formState.errors.password.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Division</Label>
                      <Select
                        value={judgeForm.watch('division')}
                        onValueChange={(value) => judgeForm.setValue('division', value as Division)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select division" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2">
                      <Button
                        type="submit"
                        className="w-full rounded-2xl"
                        disabled={judgeMutation.isPending}
                      >
                        {judgeMutation.isPending ? 'Inviting…' : 'Invite Judge'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              <Card className="p-5">
                <CardHeader>
                  <CardTitle>Judges Roster</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-80">
                    <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-white/5">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">
                          <th className="py-2">Name</th>
                          <th className="py-2">Email</th>
                          <th className="py-2">Division</th>
                          <th className="py-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                        {judgesQuery.data?.map((judgeRow) => {
                          const isEditing = editingJudgeId === judgeRow.id;
                          const currentValues =
                            isEditing && editingValues
                              ? editingValues
                              : {
                                  full_name: judgeRow.full_name,
                                  email: judgeRow.email,
                                  division: judgeRow.division as Division
                                };
                          return (
                            <tr key={judgeRow.id}>
                              <td className="py-3 text-slate-900 dark:text-white">
                                {isEditing ? (
                                  <Input
                                    value={currentValues.full_name}
                                    onChange={(e) =>
                                      setEditingValues((prev) =>
                                        prev
                                          ? { ...prev, full_name: e.target.value }
                                          : {
                                              full_name: e.target.value,
                                              email: judgeRow.email,
                                              division: judgeRow.division as Division
                                            }
                                      )
                                    }
                                  />
                                ) : (
                                  judgeRow.full_name
                                )}
                              </td>
                              <td className="py-3 text-slate-600 dark:text-slate-400">
                                {isEditing ? (
                                  <Input
                                    value={currentValues.email}
                                    onChange={(e) =>
                                      setEditingValues((prev) =>
                                        prev
                                          ? { ...prev, email: e.target.value }
                                          : {
                                              full_name: judgeRow.full_name,
                                              email: e.target.value,
                                              division: judgeRow.division as Division
                                            }
                                      )
                                    }
                                  />
                                ) : (
                                  judgeRow.email
                                )}
                              </td>
                              <td className="py-3 capitalize">
                                {isEditing ? (
                                  <Select
                                    value={currentValues.division}
                                    onValueChange={(value) =>
                                      setEditingValues((prev) =>
                                        prev
                                          ? { ...prev, division: value as Division }
                                          : {
                                              full_name: judgeRow.full_name,
                                              email: judgeRow.email,
                                              division: value as Division
                                            }
                                      )
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="male">Male</SelectItem>
                                      <SelectItem value="female">Female</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  judgeRow.division
                                )}
                              </td>
                              <td className="py-3 text-right space-x-2">
                                {isEditing ? (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        if (!editingValues) return;
                                        updateJudgeMutation.mutate({
                                          id: judgeRow.id,
                                          ...editingValues
                                        });
                                      }}
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setEditingJudgeId(null);
                                        setEditingValues(null);
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setEditingJudgeId(judgeRow.id);
                                      setEditingValues({
                                        full_name: judgeRow.full_name,
                                        email: judgeRow.email,
                                        division: judgeRow.division as Division
                                      });
                                    }}
                                  >
                                    Edit
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteJudgeMutation.mutate(judgeRow.id)}
                                >
                                  Remove
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {judgesQuery.data?.length === 0 && (
                      <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">No judges registered.</p>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="leaderboard" className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <Select
                  value={divisionFilter}
                  onValueChange={(value) => setDivisionFilter(value as Division)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => refreshMutation.mutate()}
                  disabled={refreshMutation.isPending}
                >
                  {refreshMutation.isPending ? 'Refreshing…' : 'Refresh totals'}
                </Button>
              </div>
              <Card className="p-5">
                <ScrollArea className="max-h-[420px]">
                  <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-white/5">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">
                        <th className="py-2">Rank</th>
                        <th className="py-2">Contestant</th>
                        <th className="py-2">Total score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                      {leaderboardQuery.data?.map((row) => (
                        <tr key={row.contestant_id}>
                          <td className="py-3 text-slate-900 dark:text-white">{row.rank}</td>
                          <td className="py-3 text-slate-900 dark:text-white">
                            #{row.number?.toString().padStart(2, '0')} {row.full_name}
                          </td>
                          <td className="py-3 text-slate-900 dark:text-white">{row.total_score?.toFixed(3)}</td>
                        </tr>
                      )) ?? (
                        <tr>
                          <td className="py-3 text-sm text-slate-600 dark:text-slate-400" colSpan={3}>
                            No records found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </ScrollArea>
              </Card>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </AppShell>
  );
}

