import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ClipboardCheck, Crown, Info, Lock, Save } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { ScrollArea } from '../components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import {
  fetchCategories,
  fetchContestants,
  fetchCriteria,
  fetchLocksForCategory,
  fetchScoresForJudgeCategory,
  lockSubmission,
  upsertScores
} from '../services/supabaseApi';
import { useJudgeSession } from '../hooks/useJudgeSession';
import { useScoringStore } from '../store/useScoringStore';
import { mapScoresToPayload } from '../utils/scoring';
import type { Category, Contestant, Criterion } from '../types/scoring';
import { CATEGORY_CONFIG } from '../constants/scoring';

export function JudgeScoringPage() {
  const queryClient = useQueryClient();
  const judge = useScoringStore((state) => state.judge);
  const setCategories = useScoringStore((state) => state.setCategories);
  const setContestants = useScoringStore((state) => state.setContestants);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [sheetValues, setSheetValues] = useState<Record<string, Record<string, string>>>({});

  const judgeQuery = useJudgeSession();

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    staleTime: 5 * 60 * 1000
  });

  const contestantsQuery = useQuery({
    queryKey: ['contestants', judge?.division],
    queryFn: () => fetchContestants(judge?.division ?? 'male'),
    enabled: Boolean(judge?.division)
  });

  useEffect(() => {
    if (categoriesQuery.data) {
      setCategories(categoriesQuery.data);
    }
  }, [categoriesQuery.data, setCategories]);

  useEffect(() => {
    if (contestantsQuery.data) {
      setContestants(contestantsQuery.data);
    }
  }, [contestantsQuery.data, setContestants]);

  const criteriaQuery = useQuery({
    queryKey: ['criteria', selectedCategoryId],
    queryFn: () => fetchCriteria(selectedCategoryId!),
    enabled: Boolean(selectedCategoryId)
  });

  const locksQuery = useQuery({
    queryKey: ['locks', judge?.id, selectedCategoryId],
    queryFn: () => fetchLocksForCategory(judge!.id, selectedCategoryId!),
    enabled: Boolean(judge?.id && selectedCategoryId)
  });

  const scoresSheetQuery = useQuery({
    queryKey: ['scores-sheet', judge?.id, selectedCategoryId],
    queryFn: () => fetchScoresForJudgeCategory(judge!.id, selectedCategoryId!),
    enabled: Boolean(judge?.id && selectedCategoryId)
  });

  const submitMutation = useMutation({
    mutationFn: async (params: { contestantId: string; values: Record<string, number> }) => {
      const { contestantId, values } = params;
      if (!judge || !selectedCategoryId) return;
      const criteria = criteriaQuery.data ?? [];
      const payload = mapScoresToPayload({
        judgeId: judge.id,
        contestantId,
        categoryId: selectedCategoryId,
        formData: values,
        criteria
      });
      await upsertScores(payload);
      await lockSubmission(judge.id, selectedCategoryId, contestantId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locks', judge?.id, selectedCategoryId] });
    }
  });

  const categories: Category[] =
    categoriesQuery.data ??
    (CATEGORY_CONFIG.map((cat, idx) => ({
      id: cat.slug,
      slug: cat.slug,
      label: cat.label,
      sort_order: idx,
      weight: cat.weight
    })) as Category[]);

  const contestants: Contestant[] = contestantsQuery.data ?? ([] as Contestant[]);

  const currentCategory = categories.find((cat) => cat.id === selectedCategoryId);

  const criteria: Criterion[] =
    criteriaQuery.data ??
    (currentCategory
      ? CATEGORY_CONFIG.find((c) => c.slug === currentCategory.slug)?.criteria.map(
          (criterion, idx) => ({
            id: `${currentCategory.slug}-${criterion.slug}`,
            category_id: currentCategory.id,
            slug: criterion.slug,
            label: criterion.label,
            percentage: criterion.percentage,
            sort_order: idx
          })
        ) ?? []
      : []);

  useEffect(() => {
    if (!selectedCategoryId && categories.length) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId]);

  useEffect(() => {
    if (!scoresSheetQuery.data) return;
    const next: Record<string, Record<string, string>> = {};
    scoresSheetQuery.data.forEach((row) => {
      if (!next[row.contestant_id]) {
        next[row.contestant_id] = {};
      }
      next[row.contestant_id][row.criterion_id] = String(row.raw_score);
    });
    setSheetValues(next);
  }, [scoresSheetQuery.data]);

  const totalLocked = useMemo(() => locksQuery.data?.length ?? 0, [locksQuery.data]);

  return (
    <AppShell title="Judge Scoring Panel" showAdminLink={false}>
      {judgeQuery.isLoading ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">Loading judge profile…</p>
      ) : !judge ? (
        <p className="text-sm text-rose-600 dark:text-rose-300">
          No judge profile was found for this account. Please contact the administrative team.
        </p>
      ) : (
        <div className="space-y-8">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-slate-900/80">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">
                    Current Judge
                  </p>
                  <h2 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">
                    {judge.full_name}
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-300 capitalize">
                    {judge.division} division
                  </p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 text-white shadow-sm dark:from-white dark:to-slate-200 dark:text-slate-900">
                  <Crown className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-4 text-center text-sm">
                <div className="rounded-xl bg-slate-100/70 p-3 dark:bg-white/5">
                  <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                    {contestants.length}
                  </p>
                  <p className="text-slate-600 dark:text-slate-400">Contestants</p>
                </div>
                <div className="rounded-xl bg-slate-100/70 p-3 dark:bg-white/5">
                  <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                    {categories.length}
                  </p>
                  <p className="text-slate-600 dark:text-slate-400">Categories</p>
                </div>
                <div className="rounded-xl bg-slate-100/70 p-3 dark:bg-white/5">
                  <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                    {totalLocked}
                  </p>
                  <p className="text-slate-600 dark:text-slate-400">Locked Rows</p>
                </div>
              </div>
            </Card>
            <Card className="rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-slate-900/80">
              <p className="text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">
                Instructions
              </p>
              <div className="mt-4 space-y-3 text-sm text-slate-700 dark:text-slate-200">
                {[
                  'Enter points exactly as indicated per criterion.',
                  'Scores save per contestant row; saving locks the row.',
                  'Contact the admin if any row needs to be reopened.'
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white/70 px-3 py-2 shadow-sm dark:border-white/10 dark:bg-white/5">
                    <Info className="mt-0.5 h-4 w-4 text-slate-500 dark:text-slate-300" />
                    <p>{item}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card className="rounded-2xl border border-slate-200/80 bg-white/90 p-0 shadow-sm dark:border-white/10 dark:bg-slate-900/80">
            <div className="border-b border-slate-200 px-6 py-4 dark:border-white/10">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                    Categories
                  </p>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {currentCategory?.label ?? 'Choose a category'}
                  </h3>
                </div>
                <Tabs
                  value={selectedCategoryId ?? ''}
                  onValueChange={(val) => setSelectedCategoryId(val)}
                >
                  <ScrollArea className="max-w-full">
                    <TabsList className="inline-flex gap-2 rounded-full bg-slate-100 p-1 dark:bg-white/5">
                      {categories.map((category) => (
                        <TabsTrigger
                          key={category.id}
                          value={category.id}
                          className="rounded-full px-4 py-2 text-xs font-medium text-slate-600 data-[state=active]:bg-white data-[state=active]:text-slate-900 dark:text-slate-300 dark:data-[state=active]:bg-white dark:data-[state=active]:text-slate-900"
                        >
                          {category.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </ScrollArea>
                </Tabs>
              </div>
            </div>

            <div className="p-6">
              {!selectedCategoryId ? (
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Select a category to start judging.
                </p>
              ) : contestants.length === 0 ? (
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Contestants for this division are not yet available.
                </p>
              ) : (
                <ScrollArea className="max-h-[620px] overflow-auto rounded-xl border border-slate-200/80 shadow-sm dark:border-white/10">
                  <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-white/10">
                    <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
                      <tr>
                        <th className="px-3 py-3">Contestant</th>
                        {criteria.map((criterion) => (
                          <th key={criterion.id} className="px-3 py-3 text-center">
                            <div className="font-medium">{criterion.label}</div>
                            <div className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                              {Math.round(criterion.percentage * 100)}%
                            </div>
                          </th>
                        ))}
                        <th className="px-3 py-3 text-center">Total</th>
                        <th className="px-3 py-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white dark:divide-white/10 dark:bg-slate-950/40">
                      {contestants.map((contestant, idx) => {
                        const isLockedForContestant = Boolean(
                          locksQuery.data?.some(
                            (lock) => lock.contestant_id === contestant.id
                          )
                        );
                        const zebra = idx % 2 === 0 ? 'bg-white/80 dark:bg-white/5' : 'bg-slate-50 dark:bg-slate-950/50';
                        return (
                          <motion.tr
                            key={contestant.id}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`${zebra} transition hover:bg-slate-100 dark:hover:bg-white/10`}
                          >
                            <td className="px-3 py-3">
                              <div className="font-semibold text-slate-900 dark:text-white">
                                #{contestant.number.toString().padStart(2, '0')}{' '}
                                {contestant.full_name}
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-500">
                                {contestant.division} division
                              </p>
                            </td>
                            {criteria.map((criterion) => {
                              const value =
                                sheetValues[contestant.id]?.[criterion.id] ?? '';
                              const max = Math.round(criterion.percentage * 100);
                              return (
                                <td key={criterion.id} className="px-2 py-2 text-center">
                                  <input
                                    type="number"
                                    min={0}
                                    max={max}
                                    step={0.1}
                                    className="h-10 w-24 rounded-lg border border-slate-200 bg-white px-2 text-center text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-white/30 dark:focus:ring-white/10"
                                    disabled={isLockedForContestant}
                                    value={value}
                                    onChange={(e) => {
                                      const next = e.target.value;
                                      if (next !== '') {
                                        const n = Number(next);
                                        if (!Number.isNaN(n) && (n > max || n < 0)) return;
                                      }
                                      setSheetValues((prev) => ({
                                        ...prev,
                                        [contestant.id]: {
                                          ...(prev[contestant.id] ?? {}),
                                          [criterion.id]: next
                                        }
                                      }));
                                    }}
                                  />
                                </td>
                              );
                            })}
                            <td className="px-3 py-3 text-center">
                              {(() => {
                                const rowValues = sheetValues[contestant.id] ?? {};
                                const total = criteria.reduce((sum, criterion) => {
                                  const raw = rowValues[criterion.id];
                                  if (raw === undefined || raw === '') return sum;
                                  const n = Number(raw);
                                  if (Number.isNaN(n)) return sum;
                                  return sum + n;
                                }, 0);
                                return isLockedForContestant ? (
                                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                                    {total.toFixed(1)}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 dark:text-slate-600">—</span>
                                );
                              })()}
                            </td>
                            <td className="px-3 py-3 text-center">
                              {isLockedForContestant ? (
                                <Badge variant="success" className="rounded-full bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100">
                                  <Lock className="mr-1 h-3.5 w-3.5" />
                                  Locked
                                </Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  className="rounded-full px-4 text-xs shadow-sm"
                                  disabled={submitMutation.isPending}
                                  onClick={async () => {
                                    const rowValues = sheetValues[contestant.id] ?? {};
                                    const numericValues: Record<string, number> = {};
                                    criteria.forEach((criterion) => {
                                      const raw = rowValues[criterion.id];
                                      if (raw !== undefined && raw !== '') {
                                        const n = Number(raw);
                                        if (!Number.isNaN(n)) {
                                          numericValues[criterion.id] = n;
                                        }
                                      }
                                    });
                                    await submitMutation.mutateAsync({
                                      contestantId: contestant.id,
                                      values: numericValues
                                    });
                                  }}
                                >
                                  <Save className="mr-1.5 h-3.5 w-3.5" />
                                  Save
                                </Button>
                              )}
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </ScrollArea>
              )}
            </div>
          </Card>
        </div>
      )}
    </AppShell>
  );
}


