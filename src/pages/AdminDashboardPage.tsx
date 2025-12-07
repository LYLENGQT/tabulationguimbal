import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

