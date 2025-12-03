import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
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
  supabaseAuth,
  upsertScores
} from '../services/supabaseApi';
import { useJudgeSession } from '../hooks/useJudgeSession';
import { useScoringStore } from '../store/useScoringStore';
import { mapScoresToPayload } from '../utils/scoring';
import type { Category, Contestant, Criterion } from '../types/scoring';
import { CATEGORY_CONFIG } from '../constants/scoring';

export function JudgeScoringPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const judge = useScoringStore((state) => state.judge);
  const setCategories = useScoringStore((state) => state.setCategories);
  const setContestants = useScoringStore((state) => state.setContestants);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [sheetValues, setSheetValues] = useState<
    Record<string, Record<string, string>>
  >({});

  const judgeQuery = useJudgeSession();

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    staleTime: 5 * 60 * 1000,
    onSuccess: (categories) => setCategories(categories)
  });

  const contestantsQuery = useQuery({
    queryKey: ['contestants', judge?.division],
    queryFn: () => fetchContestants(judge?.division ?? 'male'),
    enabled: Boolean(judge?.division),
    onSuccess: (contestants) => {
      setContestants(contestants);
    }
  });

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
    CATEGORY_CONFIG.map((cat, idx) => ({
      id: cat.slug,
      slug: cat.slug,
      label: cat.label,
      sort_order: idx,
      weight: cat.weight
    }));

  const contestants: Contestant[] = contestantsQuery.data ?? [];

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

  const ready = !judgeQuery.isLoading && Boolean(judge);

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

  const handleSignOut = async () => {
    await supabaseAuth.signOut();
    navigate('/login');
  };

  const totalLocked = useMemo(() => locksQuery.data?.length ?? 0, [locksQuery.data]);

  return (
    <AppShell
      title="Judge Scoring Panel"
      showAdminLink={false}
      actions={
        <Button variant="outline" onClick={handleSignOut}>
          Sign Out
        </Button>
      }
    >
      {judgeQuery.isLoading ? (
        <p className="text-sm text-slate-400">Loading judge profile…</p>
      ) : !judge ? (
        <p className="text-sm text-rose-300">
          No judge profile was found for this account. Please contact the administrative team.
        </p>
      ) : (
        <div className="space-y-8">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-6">
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Current Judge</p>
              <h2 className="mt-2 text-3xl font-semibold text-white">{judge.full_name}</h2>
              <p className="text-sm text-slate-400 capitalize">{judge.division} Division</p>
              <div className="mt-6 grid grid-cols-3 gap-4 text-center text-sm">
                <div>
                  <p className="text-2xl font-semibold text-white">{contestants.length}</p>
                  <p className="text-slate-400">Contestants</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-white">{categories.length}</p>
                  <p className="text-slate-400">Categories</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-white">{totalLocked}</p>
                  <p className="text-slate-400">Locked Rows</p>
                </div>
              </div>
            </Card>
            <Card className="p-6">
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Instructions</p>
              <ul className="mt-4 space-y-3 text-sm text-slate-300">
                <li>• Enter points exactly as indicated per criterion.</li>
                <li>• Scores save per contestant row; saving locks the row.</li>
                <li>• Contact the admin if any row needs to be reopened.</li>
              </ul>
            </Card>
          </div>

          <Card className="p-0">
            <div className="border-b border-white/5 px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Categories</p>
                  <h3 className="text-lg font-semibold text-white">
                    {currentCategory?.label ?? 'Choose a category'}
                  </h3>
                </div>
                <Tabs
                  value={selectedCategoryId ?? ''}
                  onValueChange={(val) => setSelectedCategoryId(val)}
                >
                  <ScrollArea className="max-w-full">
                    <TabsList className="inline-flex gap-2 rounded-full bg-white/5 p-1">
                      {categories.map((category) => (
                        <TabsTrigger
                          key={category.id}
                          value={category.id}
                          className="rounded-full px-4 py-2 text-xs font-medium text-slate-300 data-[state=active]:bg-white data-[state=active]:text-slate-900"
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
                <p className="text-sm text-slate-400">Select a category to start judging.</p>
              ) : contestants.length === 0 ? (
                <p className="text-sm text-slate-400">
                  Contestants for this division are not yet available.
                </p>
              ) : (
                <ScrollArea className="max-h-[600px] overflow-auto">
                  <table className="min-w-full divide-y divide-white/5 text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                        <th className="px-3 py-2">Contestant</th>
                        {criteria.map((criterion) => (
                          <th key={criterion.id} className="px-3 py-2 text-center">
                            <div>{criterion.label}</div>
                            <div className="text-[10px] text-slate-500">
                              max {Math.round(criterion.percentage * 100)}
                            </div>
                          </th>
                        ))}
                        <th className="px-3 py-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {contestants.map((contestant) => {
                        const isLockedForContestant = Boolean(
                          locksQuery.data?.some(
                            (lock) => lock.contestant_id === contestant.id
                          )
                        );
                        return (
                          <motion.tr
                            key={contestant.id}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="transition hover:bg-white/5"
                          >
                            <td className="px-3 py-3">
                              <div className="font-medium text-white">
                                #{contestant.number.toString().padStart(2, '0')}{' '}
                                {contestant.full_name}
                              </div>
                              <p className="text-xs text-slate-500">
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
                                    className="w-20 rounded-2xl border border-white/10 bg-white/5 px-2 py-1 text-center text-sm text-white focus:border-white/40 focus:outline-none"
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
                              {isLockedForContestant ? (
                                <Badge variant="success">Locked</Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  className="rounded-full px-4 text-xs"
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


