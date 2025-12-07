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
  ShieldCheck,
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
  fetchOverallRankings,
  fetchScoresForExport,
  resetSystem,
  supabaseAuth,
  updateJudge
} from '../services/supabaseApi';
import type { CategoryScoreSummary } from '../services/supabaseApi';
import type { Category } from '../types/scoring';
import type { Division } from '../types/scoring';
import { downloadCsv, downloadExcelMultiSheet, toCsv } from '../utils/export';
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

  const handleExportExcel = async () => {
    try {
      // Fetch all data for multi-sheet export
      const [scores, judges, contestants, categories, maleRankings, femaleRankings] = await Promise.all([
        fetchScoresForExport(),
        fetchJudges(),
        fetchAllContestants(),
        fetchCategories(),
        fetchOverallRankings('male'),
        fetchOverallRankings('female')
      ]);

      // Format data for Excel
      const scoresData = scores.map((score: any) => ({
        'Judge ID': score.judge_id,
        'Contestant ID': score.contestant_id,
        'Category ID': score.category_id,
        'Criterion ID': score.criterion_id,
        'Raw Score': score.raw_score,
        'Weighted Score': score.weighted_score,
        'Created At': score.created_at ? new Date(score.created_at).toLocaleString() : ''
      }));

      const judgesData = judges.map((judge: any) => ({
        'ID': judge.id,
        'Full Name': judge.full_name,
        'Email': judge.email || '',
        'Division': judge.division,
        'Active': judge.is_active !== false ? 'Yes' : 'No'
      }));

      const contestantsData = contestants.map((contestant: any) => ({
        'ID': contestant.id,
        'Number': contestant.number,
        'Full Name': contestant.full_name,
        'Division': contestant.division,
        'Active': contestant.is_active !== false ? 'Yes' : 'No'
      }));

      const categoriesData = categories.map((category: any) => ({
        'ID': category.id,
        'Slug': category.slug,
        'Label': category.label,
        'Weight': category.weight,
        'Sort Order': category.sort_order,
        'Active': category.is_active !== false ? 'Yes' : 'No'
      }));

      const maleRankingsData = maleRankings.map((rank: any) => ({
        'Rank': rank.final_placement,
        'Candidate Number': rank.number,
        'Full Name': rank.full_name,
        'Total Points': rank.total_points
      }));

      const femaleRankingsData = femaleRankings.map((rank: any) => ({
        'Rank': rank.final_placement,
        'Candidate Number': rank.number,
        'Full Name': rank.full_name,
        'Total Points': rank.total_points
      }));

      // Create multi-sheet Excel file
      downloadExcelMultiSheet('pageant-data.xlsx', [
        { name: 'Scores', data: scoresData },
        { name: 'Male Rankings', data: maleRankingsData },
        { name: 'Female Rankings', data: femaleRankingsData },
        { name: 'Judges', data: judgesData },
        { name: 'Candidates', data: contestantsData },
        { name: 'Categories', data: categoriesData }
      ]);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export Excel file. Please try again.');
    }
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
    { label: 'Candidates', value: candidateCount, icon: Users, color: 'text-indigo-600 dark:text-indigo-400' },
    { label: 'Male Contestants', value: maleCount, icon: UserRound, color: 'text-blue-600 dark:text-blue-400' },
    { label: 'Female Contestants', value: femaleCount, icon: UserRound, color: 'text-pink-600 dark:text-pink-400' },
    { label: 'Judges', value: totalJudges, icon: ShieldCheck, color: 'text-emerald-600 dark:text-emerald-400' }
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
          <Button variant="outline" onClick={handleExportExcel} className="rounded-xl border-slate-200 dark:border-white/10">
            <Download className="mr-2 h-4 w-4" />
            Export Excel
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
      <div className="space-y-6 w-full">
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {summary.map((item) => (
            <Card key={item.label} className="border p-5">
              <div className="flex items-center gap-3">
                <div className={`${item.color}`}>
                  <item.icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-slate-500 dark:text-slate-400">{item.label}</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{item.value}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Card className="border p-6 w-full">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-6 grid w-full grid-cols-3">
              <TabsTrigger value="contestants">Contestants</TabsTrigger>
              <TabsTrigger value="judges">Judges</TabsTrigger>
              <TabsTrigger value="scoring-summary">Scoring Summary</TabsTrigger>
            </TabsList>

            <TabsContent value="contestants" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="border p-5">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2">
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
                        <Label>Number of Candidates</Label>
                        <Input 
                          type="number" 
                          {...contestantForm.register('numberOfCandidates', { valueAsNumber: true })} 
                          min={1}
                          max={20}
                        />
                        {contestantForm.formState.errors.numberOfCandidates && (
                          <p className="text-xs text-rose-600 dark:text-rose-300">
                            {contestantForm.formState.errors.numberOfCandidates.message}
                          </p>
                        )}
                      </div>
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={contestantMutation.isPending}
                      >
                        {contestantMutation.isPending ? 'Generating…' : 'Generate'}
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                <Card className="border p-5">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2">
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
                             className="flex items-center justify-between rounded-lg border px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-900/50"
                           >
                             <div>
                               <p className="font-medium text-slate-900 dark:text-white">
                                     Candidate #{String(number).padStart(2, '0')}
                               </p>
                                   <p className="text-xs text-slate-500 dark:text-slate-400">
                                     {male && female ? 'Male & Female' : male ? 'Male only' : 'Female only'}
                                   </p>
                             </div>
                             <Badge className="text-xs border">
                               Active
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

            <TabsContent value="judges" className="space-y-6 w-full">
              <Card className="border p-5 w-full">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
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
                      <Label>Full Name</Label>
                      <Input {...judgeForm.register('full_name')} />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input type="email" {...judgeForm.register('email')} />
                    </div>
                    <div className="space-y-2">
                      <Label>Password</Label>
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
                        className="w-full"
                        disabled={judgeMutation.isPending}
                      >
                        {judgeMutation.isPending ? 'Inviting…' : 'Invite Judge'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              <Card className="border p-5">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <UserRound className="h-5 w-5 text-slate-500" />
                    Judges Roster
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-96">
                    <table className="min-w-full divide-y text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600 dark:bg-slate-900 dark:text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Name</th>
                          <th className="px-4 py-3">Email</th>
                          <th className="px-4 py-3">Division</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y bg-white dark:bg-slate-950">
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
                           return (
                             <tr key={judgeRow.id} className={idx % 2 === 0 ? 'bg-white dark:bg-slate-950' : 'bg-slate-50 dark:bg-slate-900/50'}>
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
                                   />
                                 ) : (
                                   judgeRow.full_name
                                 )}
                               </td>
                               <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
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
                                   judgeRow.email ?? 'No email'
                                 )}
                               </td>
                               <td className="px-4 py-3 capitalize">
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
                               <td className="px-4 py-3 text-right space-x-2">
                                 {isEditing ? (
                                   <>
                                     <Button
                                       variant="outline"
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
                                   className="text-rose-600 hover:text-rose-700 dark:text-rose-300"
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

            <TabsContent value="scoring-summary" className="space-y-6 w-full">
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
      <Card className="border p-5 w-full">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-white/10 mb-4">
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
          <div className="overflow-x-auto w-full">
            <table className="w-full divide-y divide-slate-200 text-sm dark:divide-white/10">
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
    <div className={printMode ? 'space-y-6 printing w-full' : 'space-y-6 w-full'}>
      <Card className="border p-5 w-full">
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


