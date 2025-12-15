import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Award,
  Download,
  Lock,
  Printer,
  ShieldCheck,
  Unlock,
  UserRound,
  Users,
  LayoutDashboard,
  FileText,
  Gavel
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
  fetchAllLocksForCategory,
  fetchCategories,
  fetchCategoryScoreSummary,
  fetchJudges,
  fetchJudgesWithStatus,
  fetchScoresForExport,
  clearActivityLog,
  resetSystem,
  supabaseAuth,
  unlockSubmission,
  updateJudge,
  updateJudgeLastActive
} from '../services/supabaseApi';
import { ActivityFeed } from '../components/ActivityFeed';
import { useRealtimeActivity } from '../hooks/useRealtimeActivity';
import { useRealtimeScores } from '../hooks/useRealtimeScores';
import { useBrowserNotifications } from '../hooks/useBrowserNotifications';
import type { CategoryScoreSummary } from '../services/supabaseApi';
import type { Category } from '../types/scoring';
import type { Division } from '../types/scoring';
import { downloadCsv, downloadXlsx, toCsv } from '../utils/export';
import { ScrollArea } from '../components/ui/scroll-area';
import { Badge } from '../components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '../components/ui/dropdown-menu';
import { cn } from '../lib/utils';

const contestantSchema = z.object({
  numberOfCandidates: z.number().int().min(1).max(20, 'Maximum 20 candidates allowed')
});

const judgeSchema = z.object({
  full_name: z.string().min(2),
  username: z.string().min(3, 'Username must be at least 3 characters').regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  division: z.enum(['male', 'female'])
});

export function AdminDashboardPage() {
  const queryClient = useQueryClient();
  const [activeView, setActiveView] = useState<'overview' | 'contestants' | 'judges' | 'scoring-summary'>('overview');
  const [editingJudgeId, setEditingJudgeId] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<{
    full_name: string;
    email: string;
    username?: string;
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

  const judgesWithStatusQuery = useQuery({
    queryKey: ['judges-with-status'],
    queryFn: fetchJudgesWithStatus,
    refetchInterval: 30000 // Refetch every 30 seconds to update status
  });

  // Real-time features
  const { showNotification } = useBrowserNotifications();
  useRealtimeScores();

  const { activities, refresh: refreshActivities, clearLocal: clearLocalActivities } = useRealtimeActivity((newActivity) => {
    // Show browser notification for new activities
    if (newActivity.action_type === 'score_submitted' || newActivity.action_type === 'lock_created') {
      showNotification('New Activity', {
        body: newActivity.description,
        tag: `activity-${newActivity.id}`
      });
    }
  });

  const clearActivityMutation = useMutation({
    mutationFn: clearActivityLog,
    onMutate: () => {
      // Optimistically clear the local feed
      clearLocalActivities();
    },
    onSuccess: () => {
      // Refresh from server to ensure UI matches DB
      refreshActivities();
    },
    onError: (error) => {
      console.error('Failed to clear activity log:', error);
      // Re-fetch to restore if delete failed
      refreshActivities();
    }
  });

  const contestantForm = useForm<z.infer<typeof contestantSchema>>({
    resolver: zodResolver(contestantSchema),
    defaultValues: { numberOfCandidates: 5 }
  });

  const judgeForm = useForm<z.infer<typeof judgeSchema>>({
    resolver: zodResolver(judgeSchema),
    defaultValues: { full_name: '', username: '', password: '', division: 'male' as Division }
  });

  const allContestants = contestantsQuery.data ?? [];
  const maleCount = allContestants.filter((c) => c.division === 'male').length;
  const femaleCount = allContestants.filter((c) => c.division === 'female').length;
  
  const allJudges = judgesQuery.data ?? [];
  const maleJudgesCount = allJudges.filter((j) => j.division === 'male').length;
  const femaleJudgesCount = allJudges.filter((j) => j.division === 'female').length;
  const MAX_JUDGES_PER_DIVISION = 3;
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
      // Check judge limit per division
      const currentCount = values.division === 'male' ? maleJudgesCount : femaleJudgesCount;
      if (currentCount >= MAX_JUDGES_PER_DIVISION) {
        throw new Error(
          `Cannot add more judges. The ${values.division} division already has ${currentCount} judges (maximum: ${MAX_JUDGES_PER_DIVISION}).`
        );
      }
      
      // Generate email from username
      const email = `${values.username}@judge.mrmsteen2025.com`;
      await supabaseAuth.signUpWithPassword({
        email,
        password: values.password,
        full_name: values.full_name,
        username: values.username,
        division: values.division
      });
      await createJudge({
        full_name: values.full_name,
        email,
        username: values.username,
        division: values.division
      });
    },
    onSuccess: () => {
      judgeForm.reset();
      queryClient.invalidateQueries({ queryKey: ['judges'] });
    },
    onError: (error: Error) => {
      alert(`❌ ${error.message}`);
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

  const resetMutation = useMutation({
    mutationFn: resetSystem,
    onSuccess: () => {
      // Invalidate all queries to refresh the UI
      queryClient.invalidateQueries();
    }
  });

  const handleExportCsv = async () => {
    const rows = await fetchScoresForExport();
    downloadCsv('scores.csv', toCsv(rows));
  };

  const handleExportXlsx = async () => {
    const rows = await fetchScoresForExport();
    downloadXlsx('scores.xlsx', rows);
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
      <AppShell title="Admin Dashboard" showAdminLink>
        <p className="text-sm text-slate-600 dark:text-slate-400">Verifying access…</p>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell title="Admin Dashboard" showAdminLink>
        <p className="text-sm text-rose-600 dark:text-rose-300">You are not authorized to view this page.</p>
      </AppShell>
    );
  }

  const summary = [
    { label: 'Candidates', value: candidateCount, icon: Users, accent: 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400' },
    { label: 'Male Contestants', value: maleCount, icon: UserRound, accent: 'bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400' },
    { label: 'Female Contestants', value: femaleCount, icon: UserRound, accent: 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400' },
    { label: 'Judges', value: totalJudges, icon: ShieldCheck, accent: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' }
  ];

  const navItems = [
    { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
    { id: 'contestants' as const, label: 'Contestants', icon: Users },
    { id: 'judges' as const, label: 'Judges', icon: Gavel },
    { id: 'scoring-summary' as const, label: 'Scoring Summary', icon: FileText }
  ];

  return (
    <AppShell
      title="Admin Dashboard"
      showAdminLink
      fullWidth={true}
      actions={
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportCsv}>
                <Download className="mr-2 h-4 w-4" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportXlsx}>
                <Download className="mr-2 h-4 w-4" />
                Export as XLSX
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="destructive"
            onClick={handleReset}
            disabled={resetMutation.isPending}
            className="h-9 rounded-lg bg-red-600 px-4 text-sm font-medium text-white transition-colors hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
          >
            {resetMutation.isPending ? 'Resetting...' : 'Reset System'}
          </Button>
        </>
      }
    >
      <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-8 lg:flex-row">
        {/* Sidebar Navigation */}
        <aside className="w-full flex-shrink-0 lg:w-72">
          <nav className="flex gap-1 overflow-x-auto pb-2 lg:sticky lg:top-8 lg:flex-col lg:space-y-1 lg:overflow-x-visible lg:pb-0">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap lg:w-full lg:text-left',
                    isActive
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                  )}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0">
          {activeView === 'overview' && (
            <div className="space-y-8">
              {/* Header */}
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
                  Dashboard Overview
                </h1>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  Monitor and manage your pageant system at a glance.
                </p>
              </div>

              {/* Summary Cards */}
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {summary.map((item) => (
                  <Card 
                    key={item.label} 
                    className="border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="flex items-center justify-between">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${item.accent}`}>
                        <item.icon className="h-5 w-5" />
                      </div>
                    </div>
                    <p className="mt-4 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {item.label}
                    </p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
                      {item.value}
                    </p>
                  </Card>
                ))}
              </div>

              {/* Judge Status Indicators */}
              {judgesWithStatusQuery.data && judgesWithStatusQuery.data.length > 0 && (
                <Card className="border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5" />
                      Judge Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {judgesWithStatusQuery.data.map((judge) => {
                        // A judge is online if they have a last_active timestamp within the last 2 minutes
                        // This ensures only actively logged-in judges show as online
                        const isOnline = judge.last_active 
                          ? (new Date().getTime() - new Date(judge.last_active).getTime()) < 2 * 60 * 1000 // 2 minutes (reduced from 5)
                          : false;
                        
                        return (
                          <div
                            key={judge.id}
                            className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`h-2 w-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-slate-300'}`} />
                              <div>
                                <p className="text-sm font-medium text-slate-900 dark:text-white">
                                  {judge.full_name}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {judge.division === 'male' ? 'Male' : 'Female'} Division
                                </p>
                              </div>
                            </div>
                            <Badge variant={isOnline ? 'success' : 'default'} className={!isOnline ? 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400' : ''}>
                              {isOnline ? 'Online' : 'Offline'}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Activity Feed */}
              <div className="grid gap-6">
                <ActivityFeed
                  activities={activities}
                  maxHeight="70vh"
                  onClear={() => clearActivityMutation.mutate()}
                  clearing={clearActivityMutation.isPending}
                />
              </div>
            </div>
          )}

          {activeView === 'contestants' && (
            <div className="space-y-8">
              {/* Header */}
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
                  Contestants
                </h1>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  Generate and manage pageant contestants.
                </p>
              </div>

              <div className="grid gap-8 lg:grid-cols-2">
                <Card className="border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl font-semibold text-slate-900 dark:text-white">
                      Generate Candidates
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form
                      className="space-y-6"
                      onSubmit={contestantForm.handleSubmit((values) =>
                        contestantMutation.mutate(values)
                      )}
                    >
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          Number of Candidates
                        </Label>
                        <Input 
                          type="number" 
                          {...contestantForm.register('numberOfCandidates', { valueAsNumber: true })} 
                          min={1}
                          max={20}
                          className="h-11 border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800"
                        />
                        {contestantForm.formState.errors.numberOfCandidates && (
                          <p className="text-xs font-medium text-red-600 dark:text-red-400">
                            {contestantForm.formState.errors.numberOfCandidates.message}
                          </p>
                        )}
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Creates the same count for male and female divisions. Example: 5 = 5 male + 5 female candidates.
                        </p>
                      </div>
                      <Button
                        type="submit"
                        className="w-full h-11 bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-white/90"
                        disabled={contestantMutation.isPending}
                      >
                        {contestantMutation.isPending ? 'Generating…' : 'Generate Candidates'}
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                <Card className="border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl font-semibold text-slate-900 dark:text-white">
                      Candidates on Record
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64 pr-4">
                      <div className="space-y-2">
                        {candidateCount === 0 && (
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center dark:border-slate-800 dark:bg-slate-800/50">
                            <p className="text-sm text-slate-600 dark:text-slate-400">No candidates registered yet.</p>
                          </div>
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
                                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50 dark:hover:bg-slate-800"
                              >
                                <div>
                                  <p className="font-medium text-slate-900 dark:text-white">
                                    Candidate #{String(number).padStart(2, '0')}
                                  </p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {male && female ? 'Male & Female' : male ? 'Male only' : 'Female only'}
                                  </p>
                                </div>
                                <Badge className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-300">
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
            </div>
          )}

          {activeView === 'judges' && (
            <div className="space-y-8">
              {/* Header */}
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
                  Judges
                </h1>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  Invite and manage pageant judges.
                </p>
              </div>

              <div className="grid gap-8 lg:grid-cols-2">
                <Card className="border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl font-semibold text-slate-900 dark:text-white">
                      Invite Judge
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* Judge Limit Notice */}
                    {(maleJudgesCount >= MAX_JUDGES_PER_DIVISION || femaleJudgesCount >= MAX_JUDGES_PER_DIVISION) && (
                      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                        <p className="font-medium">⚠️ Judge Limit Reached</p>
                        <p className="mt-1 text-xs">
                          {maleJudgesCount >= MAX_JUDGES_PER_DIVISION && (
                            <>Male division: {maleJudgesCount}/{MAX_JUDGES_PER_DIVISION} judges (limit reached). </>
                          )}
                          {femaleJudgesCount >= MAX_JUDGES_PER_DIVISION && (
                            <>Female division: {femaleJudgesCount}/{MAX_JUDGES_PER_DIVISION} judges (limit reached). </>
                          )}
                          Maximum {MAX_JUDGES_PER_DIVISION} judges per division allowed.
                        </p>
                      </div>
                    )}
                    
                    <form
                      className="space-y-4"
                      onSubmit={judgeForm.handleSubmit((values) => {
                        const selectedDivisionCount = values.division === 'male' ? maleJudgesCount : femaleJudgesCount;
                        if (selectedDivisionCount >= MAX_JUDGES_PER_DIVISION) {
                          alert(
                            `❌ Cannot add more judges to the ${values.division} division. It already has ${selectedDivisionCount} judges (maximum: ${MAX_JUDGES_PER_DIVISION}).`
                          );
                          return;
                        }
                        judgeMutation.mutate(values);
                      })}
                    >
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Full Name</Label>
                        <Input 
                          {...judgeForm.register('full_name')} 
                          className="h-11 border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Username</Label>
                        <Input 
                          type="text" 
                          {...judgeForm.register('username')} 
                          placeholder="judge_username"
                          className="h-11 border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800"
                        />
                        {judgeForm.formState.errors.username && (
                          <p className="text-xs font-medium text-red-600 dark:text-red-400">
                            {judgeForm.formState.errors.username.message}
                          </p>
                        )}
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Username will be used for login. Only letters, numbers, and underscores allowed.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Initial Password</Label>
                        <Input 
                          type="password" 
                          {...judgeForm.register('password')} 
                          className="h-11 border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800"
                        />
                        {judgeForm.formState.errors.password && (
                          <p className="text-xs font-medium text-red-600 dark:text-red-400">
                            {judgeForm.formState.errors.password.message}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Division</Label>
                        <Select
                          value={judgeForm.watch('division')}
                          onValueChange={(value) => judgeForm.setValue('division', value as Division)}
                        >
                          <SelectTrigger className="h-11 border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800">
                            <SelectValue placeholder="Select division" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem 
                              value="male" 
                              disabled={maleJudgesCount >= MAX_JUDGES_PER_DIVISION}
                            >
                              Male {maleJudgesCount >= MAX_JUDGES_PER_DIVISION && '(Limit Reached)'}
                            </SelectItem>
                            <SelectItem 
                              value="female"
                              disabled={femaleJudgesCount >= MAX_JUDGES_PER_DIVISION}
                            >
                              Female {femaleJudgesCount >= MAX_JUDGES_PER_DIVISION && '(Limit Reached)'}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span>
                            Male: {maleJudgesCount}/{MAX_JUDGES_PER_DIVISION} judges
                          </span>
                          <span>•</span>
                          <span>
                            Female: {femaleJudgesCount}/{MAX_JUDGES_PER_DIVISION} judges
                          </span>
                        </div>
                      </div>
                      <Button
                        type="submit"
                        className="w-full h-11 bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-white/90"
                        disabled={
                          judgeMutation.isPending ||
                          (judgeForm.watch('division') === 'male' && maleJudgesCount >= MAX_JUDGES_PER_DIVISION) ||
                          (judgeForm.watch('division') === 'female' && femaleJudgesCount >= MAX_JUDGES_PER_DIVISION)
                        }
                      >
                        {judgeMutation.isPending 
                          ? 'Inviting…' 
                          : (judgeForm.watch('division') === 'male' && maleJudgesCount >= MAX_JUDGES_PER_DIVISION) ||
                            (judgeForm.watch('division') === 'female' && femaleJudgesCount >= MAX_JUDGES_PER_DIVISION)
                          ? 'Limit Reached'
                          : 'Invite Judge'}
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                <Card className="border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl font-semibold text-slate-900 dark:text-white">
                      Judges Roster
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="max-h-96 pr-4">
                      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
                        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                          <thead className="bg-slate-50 text-left dark:bg-slate-800/50">
                            <tr>
                              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Name</th>
                              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Username</th>
                              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Division</th>
                              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                            {judgesQuery.data?.map((judgeRow, idx) => {
                              const isEditing = editingJudgeId === judgeRow.id;
                              const currentValues =
                                isEditing && editingValues
                                  ? editingValues
                                  : {
                                      full_name: judgeRow.full_name,
                                      email: judgeRow.email ?? '',
                                      username: judgeRow.username ?? '',
                                      division: judgeRow.division as Division
                                    };
                              const zebra = idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800/50';
                              return (
                                <tr key={judgeRow.id} className={`${zebra} transition-colors hover:bg-slate-100 dark:hover:bg-slate-800`}>
                                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
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
                                        className="h-9 border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                                      />
                                    ) : (
                                      judgeRow.full_name
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                    {judgeRow.username ?? <span className="text-slate-400 dark:text-slate-500">—</span>}
                                  </td>
                                  <td className="px-4 py-3">
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
                                        <SelectTrigger className="h-9 border-slate-300 dark:border-slate-700 dark:bg-slate-800">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="male">Male</SelectItem>
                                          <SelectItem value="female">Female</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <Badge className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 capitalize dark:bg-slate-700 dark:text-slate-300">
                                        {judgeRow.division}
                                      </Badge>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      {isEditing ? (
                                        <>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 border-slate-300 dark:border-slate-700"
                                            onClick={() => {
                                              if (!editingValues) return;
                                              updateJudgeMutation.mutate({
                                                id: judgeRow.id,
                                                ...editingValues
                                              });
                                            }}
                                            disabled={updateJudgeMutation.isPending}
                                          >
                                            Save
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8"
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
                                          className="h-8 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                                        onClick={() => {
                                          setEditingJudgeId(judgeRow.id);
                                          setEditingValues({
                                            full_name: judgeRow.full_name,
                                            email: judgeRow.email ?? '',
                                            username: judgeRow.username ?? '',
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
                                        className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/20"
                                        onClick={() => deleteJudgeMutation.mutate(judgeRow.id)}
                                        disabled={deleteJudgeMutation.isPending}
                                      >
                                        Remove
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {judgesQuery.data?.length === 0 && (
                        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-6 text-center dark:border-slate-800 dark:bg-slate-800/50">
                          <p className="text-sm text-slate-600 dark:text-slate-400">No judges registered.</p>
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {activeView === 'scoring-summary' && (
            <div className="space-y-8">
              {/* Header */}
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
                  Scoring Summary
                </h1>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  Review per-judge totals and print-ready tables.
                </p>
              </div>
              <ScoringSummarySection />
            </div>
          )}
        </main>
      </div>
    </AppShell>
  );
}
function ScoringSummarySection() {
  const queryClient = useQueryClient();
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

  const locksQuery = useQuery({
    queryKey: ['all-locks', selectedCategoryId],
    queryFn: () => fetchAllLocksForCategory(selectedCategoryId!),
    enabled: Boolean(selectedCategoryId)
  });

  const unlockMutation = useMutation({
    mutationFn: async ({
      judgeId,
      categoryId,
      contestantId
    }: {
      judgeId: string;
      categoryId: string;
      contestantId: string;
    }) => {
      await unlockSubmission(judgeId, categoryId, contestantId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-locks', selectedCategoryId] });
      queryClient.invalidateQueries({ queryKey: ['category-score-summary'] });
    }
  });

  const categories = categoriesQuery.data ?? [];
  const summaryMale = summaryMaleQuery.data;
  const summaryFemale = summaryFemaleQuery.data;
  const locks = locksQuery.data ?? [];

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
    const isMale = label.toLowerCase() === 'male';
    
    // Get locks for this division's contestants
    const divisionLocks = locks.filter((lock) => {
      const contestant = summary.contestants.find((c) => c.contestantId === lock.contestant_id);
      return contestant !== undefined;
    });

    return (
      <Card className="border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {summary.categoryLabel}
            </p>
            <div className="flex items-center gap-3">
              <p className="text-base font-semibold text-slate-900 dark:text-white">
                Division: <span className="capitalize">{label}</span>
              </p>
              <Badge className={`rounded-full px-2.5 py-1 text-xs font-medium ${isMale ? 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'}`}>
                {label}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {divisionLocks.length > 0 && (
              <Badge className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                <Lock className="mr-1.5 h-3 w-3" />
                {divisionLocks.length} Locked
              </Badge>
            )}
            <Badge className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-300">
              {judgeCount} {judgeCount === 1 ? 'Judge' : 'Judges'}
            </Badge>
          </div>
        </div>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-5 py-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Ranking</th>
                  <th className="px-5 py-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Candidate #</th>
                  {summary.judges.map((judge) => (
                    <th key={judge.id} className="px-5 py-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      {judge.name}
                    </th>
                  ))}
                  <th className="px-5 py-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Average</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                {summary.contestants.map((contestant, idx) => {
                  const isTopThree = contestant.rank <= 3;
                  const rankColors: Record<number, string> = {
                    1: 'bg-amber-50 border-l-4 border-amber-400 dark:bg-amber-950/20 dark:border-amber-500',
                    2: 'bg-slate-50 border-l-4 border-slate-400 dark:bg-slate-800/50 dark:border-slate-500',
                    3: 'bg-orange-50 border-l-4 border-orange-400 dark:bg-orange-950/20 dark:border-orange-500'
                  };
                  const zebra = idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800/50';
                  
                  // Get locks for this contestant
                  const contestantLocks = locks.filter(
                    (lock) => lock.contestant_id === contestant.contestantId
                  );

                  return (
                    <tr
                      key={contestant.contestantId}
                      className={`${isTopThree ? rankColors[contestant.rank] : zebra} transition-colors hover:bg-slate-100 dark:hover:bg-slate-800`}
                    >
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full font-semibold ${
                          contestant.rank === 1 ? 'bg-amber-400 text-amber-900 dark:bg-amber-500 dark:text-amber-950' :
                          contestant.rank === 2 ? 'bg-slate-400 text-slate-900 dark:bg-slate-500 dark:text-slate-950' :
                          contestant.rank === 3 ? 'bg-orange-400 text-orange-900 dark:bg-orange-500 dark:text-orange-950' :
                          'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                        }`}>
                          {contestant.rank}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center font-mono text-base font-medium text-slate-800 dark:text-slate-100">
                        {String(contestant.candidateNumber).padStart(2, '0')}
                      </td>
                      {summary.judges.map((judge) => {
                        const judgeScore = contestant.judgeScores.find((js) => js.judgeId === judge.id);
                        const isLocked = contestantLocks.some((lock) => lock.judge_id === judge.id);
                        const lock = contestantLocks.find((lock) => lock.judge_id === judge.id);
                        return (
                          <td
                            key={judge.id}
                            className="px-5 py-4 text-center font-medium text-slate-800 dark:text-slate-100"
                          >
                            <div className="flex flex-col items-center gap-2">
                              {judgeScore ? (
                                <span className="inline-block rounded-lg bg-slate-100 px-3 py-1.5 font-mono text-sm dark:bg-slate-800">
                                  {judgeScore.totalScore.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-slate-400 dark:text-slate-600">—</span>
                              )}
                              {isLocked && lock && (
                                <div className="flex flex-col items-center gap-1.5">
                                  <Badge className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                                    <Lock className="mr-1 h-2.5 w-2.5" />
                                    Locked
                                  </Badge>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 rounded-lg border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-500/20"
                                    onClick={() => {
                                      if (!selectedCategoryId) return;
                                      const confirmed = window.confirm(
                                        `Unlock ${judge.name}'s submission for Candidate #${String(contestant.candidateNumber).padStart(2, '0')}? This will allow ${judge.name} to edit their scores.`
                                      );
                                      if (!confirmed) return;
                                      
                                      unlockMutation.mutate({
                                        judgeId: lock.judge_id,
                                        categoryId: selectedCategoryId,
                                        contestantId: lock.contestant_id
                                      });
                                    }}
                                    disabled={unlockMutation.isPending}
                                  >
                                    <Unlock className="mr-1 h-3 w-3" />
                                    Unlock
                                  </Button>
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-5 py-4 text-center">
                        <span className="inline-block rounded-lg bg-slate-100 px-4 py-2 font-semibold font-mono text-base text-slate-900 dark:bg-slate-800 dark:text-white">
                          {contestant.average.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
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
      <Card className="border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Select a category to view scoring summary</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={selectedCategoryId || ''} onValueChange={setSelectedCategoryId}>
              <SelectTrigger className="w-64 h-11 border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800">
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
            <Button 
              onClick={handlePrint} 
              variant="outline" 
              className="h-11 border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800"
            >
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          </div>
        </div>
      </Card>

      {(summaryMaleQuery.isLoading || summaryFemaleQuery.isLoading) && (
        <Card className="border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900 dark:border-slate-600 dark:border-t-white" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Loading scores...</p>
          </div>
        </Card>
      )}
      {(summaryMaleQuery.error || summaryFemaleQuery.error) && (
        <Card className="border border-red-200 bg-red-50 p-6 shadow-sm dark:border-red-800 dark:bg-red-950/20">
          <p className="text-sm font-medium text-red-600 dark:text-red-400">Error loading scores. Please try again.</p>
        </Card>
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
        <Card className="border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
              <Award className="h-8 w-8 text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              No scores available for this category yet.
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">
              Scores will appear here once judges submit their evaluations.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}


