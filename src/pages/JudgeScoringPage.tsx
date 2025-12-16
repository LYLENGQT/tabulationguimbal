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
  upsertScores,
  updateJudgeLastActive
} from '../services/supabaseApi';
import { useRealtimeScores } from '../hooks/useRealtimeScores';
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

  // Real-time score updates
  useRealtimeScores();

  // Update judge last active on mount and periodically (only when page is active)
  useEffect(() => {
    if (judge?.id) {
      // Update immediately on mount
      updateJudgeLastActive(judge.id);
      
      // Update every 30 seconds to keep status fresh
      const interval = setInterval(() => {
        updateJudgeLastActive(judge.id);
      }, 30000); // Update every 30 seconds
      
      // Also update when page becomes visible (user switches back to tab)
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible' && judge?.id) {
          updateJudgeLastActive(judge.id);
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      return () => {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [judge?.id]);

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
    <AppShell title="Judge Scoring Panel" showAdminLink={false} fullWidth={true}>
      {judgeQuery.isLoading ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">Loading judge profile…</p>
      ) : !judge ? (
        <p className="text-sm text-rose-600 dark:text-rose-300">
          No judge profile was found for this account. Please contact the administrative team.
        </p>
      ) : (
        <div className="space-y-4 sm:space-y-6 lg:space-y-8">
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            <Card className="rounded-xl sm:rounded-2xl border border-slate-200/80 bg-white/90 p-3 sm:p-4 lg:p-6 shadow-sm dark:border-white/10 dark:bg-slate-900/80">
              <div className="flex items-start justify-between gap-3 sm:gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs uppercase tracking-[0.25em] sm:tracking-[0.35em] text-slate-500 dark:text-slate-400">
                    Current Judge
                  </p>
                  <h2 className="mt-1 sm:mt-2 text-xl sm:text-2xl lg:text-3xl font-semibold text-slate-900 dark:text-white truncate">
                    {judge.full_name}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 capitalize">
                    {judge.division} division
                  </p>
                </div>
                <div className="flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-lg sm:rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 text-white shadow-sm dark:from-white dark:to-slate-200 dark:text-slate-900 flex-shrink-0">
                  <Crown className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
              </div>
              <div className="mt-4 sm:mt-6 grid grid-cols-3 gap-2 sm:gap-4 text-center text-xs sm:text-sm">
                <div className="rounded-lg sm:rounded-xl bg-slate-100/70 p-2 sm:p-3 dark:bg-white/5">
                  <p className="text-lg sm:text-xl lg:text-2xl font-semibold text-slate-900 dark:text-white">
                    {contestants.length}
                  </p>
                  <p className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-400">Contestants</p>
                </div>
                <div className="rounded-lg sm:rounded-xl bg-slate-100/70 p-2 sm:p-3 dark:bg-white/5">
                  <p className="text-lg sm:text-xl lg:text-2xl font-semibold text-slate-900 dark:text-white">
                    {categories.length}
                  </p>
                  <p className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-400">Categories</p>
                </div>
                <div className="rounded-lg sm:rounded-xl bg-slate-100/70 p-2 sm:p-3 dark:bg-white/5">
                  <p className="text-lg sm:text-xl lg:text-2xl font-semibold text-slate-900 dark:text-white">
                    {totalLocked}
                  </p>
                  <p className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-400">Locked</p>
                </div>
              </div>
            </Card>
            <Card className="rounded-xl sm:rounded-2xl border border-slate-200/80 bg-white/90 p-3 sm:p-4 lg:p-6 shadow-sm dark:border-white/10 dark:bg-slate-900/80">
              <p className="text-[10px] sm:text-xs uppercase tracking-[0.25em] sm:tracking-[0.35em] text-slate-500 dark:text-slate-400">
                Instructions
              </p>
              <div className="mt-3 sm:mt-4 space-y-2 sm:space-y-3 text-xs sm:text-sm text-slate-700 dark:text-slate-200">
                {[
                  'Enter points exactly as indicated per criterion.',
                  'Scores save per contestant row; saving locks the row.',
                  'Contact the admin if any row needs to be reopened.'
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2 sm:gap-3 rounded-lg sm:rounded-xl border border-slate-200 bg-white/70 px-2 sm:px-3 py-1.5 sm:py-2 shadow-sm dark:border-white/10 dark:bg-white/5">
                    <Info className="mt-0.5 h-3 w-3 sm:h-4 sm:w-4 text-slate-500 dark:text-slate-300 flex-shrink-0" />
                    <p className="text-[11px] sm:text-sm">{item}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card className="rounded-xl sm:rounded-2xl border border-slate-200/80 bg-white/90 p-0 shadow-sm dark:border-white/10 dark:bg-slate-900/80">
            <div className="border-b border-slate-200 px-3 sm:px-6 py-3 sm:py-4 dark:border-white/10">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div>
                  <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.3em] text-slate-500 dark:text-slate-400">
                    Categories
                  </p>
                  <h3 className="text-sm sm:text-lg font-semibold text-slate-900 dark:text-white">
                    {currentCategory?.label ?? 'Choose a category'}
                  </h3>
                </div>
                <Tabs
                  value={selectedCategoryId ?? ''}
                  onValueChange={(val) => setSelectedCategoryId(val)}
                >
                  <ScrollArea className="max-w-full -mx-3 px-3 sm:mx-0 sm:px-0">
                    <TabsList className="inline-flex gap-1 sm:gap-2 rounded-full bg-slate-100 p-0.5 sm:p-1 dark:bg-white/5">
                      {categories.map((category) => (
                        <TabsTrigger
                          key={category.id}
                          value={category.id}
                          className="rounded-full px-2 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-medium text-slate-600 data-[state=active]:bg-white data-[state=active]:text-slate-900 dark:text-slate-300 dark:data-[state=active]:bg-white dark:data-[state=active]:text-slate-900 whitespace-nowrap"
                        >
                          {category.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </ScrollArea>
                </Tabs>
              </div>
            </div>

            <div className="p-3 sm:p-6">
              {!selectedCategoryId ? (
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                  Select a category to start judging.
                </p>
              ) : contestants.length === 0 ? (
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                  Contestants for this division are not yet available.
                </p>
              ) : (
                <ScrollArea className="max-h-[500px] sm:max-h-[620px] overflow-auto rounded-lg sm:rounded-xl border border-slate-200/80 shadow-sm dark:border-white/10 -mx-3 sm:mx-0">
                  <table className="min-w-full divide-y divide-slate-200 text-xs sm:text-sm dark:divide-white/10">
                    <thead className="sticky top-0 bg-slate-50 text-left text-[10px] sm:text-xs uppercase tracking-wide text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
                      <tr>
                        <th className="px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap">Contestant</th>
                        {criteria.map((criterion) => (
                          <th key={criterion.id} className="px-1.5 sm:px-3 py-2 sm:py-3 text-center">
                            <div className="font-medium truncate max-w-[60px] sm:max-w-none">{criterion.label}</div>
                            <div className="mt-0.5 sm:mt-1 text-[9px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300">
                              {Math.round(criterion.percentage * 100)}%
                            </div>
                          </th>
                        ))}
                        <th className="px-2 sm:px-3 py-2 sm:py-3 text-center whitespace-nowrap">Total</th>
                        <th className="px-2 sm:px-3 py-2 sm:py-3 text-center whitespace-nowrap">Rank</th>
                        <th className="px-2 sm:px-3 py-2 sm:py-3 text-center whitespace-nowrap">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white dark:divide-white/10 dark:bg-slate-950/40">
                      {(() => {
                        // Calculate totals and ranks for all locked contestants
                        const contestantTotals = contestants.map((contestant) => {
                          const isLocked = Boolean(
                            locksQuery.data?.some((lock) => lock.contestant_id === contestant.id)
                          );
                          const rowValues = sheetValues[contestant.id] ?? {};
                          const total = criteria.reduce((sum, criterion) => {
                            const raw = rowValues[criterion.id];
                            if (raw === undefined || raw === '') return sum;
                            const n = Number(raw);
                            if (Number.isNaN(n)) return sum;
                            return sum + n;
                          }, 0);
                          return { id: contestant.id, total, isLocked };
                        });

                        // Sort by total (descending) to compute ranks, only for locked contestants
                        const lockedTotals = contestantTotals
                          .filter((c) => c.isLocked)
                          .sort((a, b) => b.total - a.total);

                        // Assign ranks with fractional ranks for ties (e.g., 2.5 for tie between 2nd and 3rd)
                        const rankMap = new Map<string, number>();
                        let i = 0;
                        while (i < lockedTotals.length) {
                          // Find all contestants with the same score
                          const currentScore = lockedTotals[i].total;
                          let tieCount = 1;
                          while (i + tieCount < lockedTotals.length && lockedTotals[i + tieCount].total === currentScore) {
                            tieCount++;
                          }
                          // Calculate average rank for tied contestants
                          // Positions are i+1, i+2, ..., i+tieCount
                          // Average = (sum of positions) / tieCount = ((i+1) + (i+tieCount)) / 2
                          const avgRank = tieCount === 1 ? i + 1 : (2 * i + tieCount + 1) / 2;
                          for (let j = 0; j < tieCount; j++) {
                            rankMap.set(lockedTotals[i + j].id, avgRank);
                          }
                          i += tieCount;
                        }

                        return contestants.map((contestant, idx) => {
                          const isLockedForContestant = Boolean(
                            locksQuery.data?.some(
                              (lock) => lock.contestant_id === contestant.id
                            )
                          );
                          const contestantData = contestantTotals.find((c) => c.id === contestant.id);
                          const total = contestantData?.total ?? 0;
                          const rank = rankMap.get(contestant.id);
                          const zebra = idx % 2 === 0 ? 'bg-white/80 dark:bg-white/5' : 'bg-slate-50 dark:bg-slate-950/50';
                          return (
                            <motion.tr
                              key={contestant.id}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={`${zebra} transition hover:bg-slate-100 dark:hover:bg-white/10`}
                            >
                              <td className="px-2 sm:px-3 py-2 sm:py-3">
                                <div className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-white whitespace-nowrap">
                                  #{contestant.number.toString().padStart(2, '0')}{' '}
                                  <span className="hidden sm:inline">{contestant.full_name}</span>
                                </div>
                                <p className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-500 capitalize">
                                  {contestant.division}
                                </p>
                              </td>
                              {criteria.map((criterion) => {
                                const value =
                                  sheetValues[contestant.id]?.[criterion.id] ?? '';
                                const max = Math.round(criterion.percentage * 100);
                                return (
                                  <td key={criterion.id} className="px-1 sm:px-2 py-1.5 sm:py-2 text-center">
                                    <input
                                      type="number"
                                      min={0}
                                      max={max}
                                      step={0.1}
                                      className="h-8 sm:h-10 w-14 sm:w-24 rounded-md sm:rounded-lg border border-slate-200 bg-white px-1 sm:px-2 text-center text-xs sm:text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-white/30 dark:focus:ring-white/10"
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
                              <td className="px-2 sm:px-3 py-2 sm:py-3 text-center">
                                {isLockedForContestant ? (
                                  <span className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                                    {total.toFixed(1)}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 dark:text-slate-600">—</span>
                                )}
                              </td>
                              <td className="px-2 sm:px-3 py-2 sm:py-3 text-center">
                                {isLockedForContestant && rank !== undefined ? (
                                  (() => {
                                    const isTie = rank % 1 !== 0;
                                    const displayRank = isTie ? rank.toFixed(1) : rank.toString();
                                    const colorClass = 
                                      rank <= 1.5
                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                                        : rank <= 2.5
                                        ? 'bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300'
                                        : rank <= 3.5
                                        ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300'
                                        : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400';
                                    return (
                                      <span className={`inline-flex items-center justify-center ${isTie ? 'min-w-[2rem] sm:min-w-[2.5rem] px-1.5' : 'h-6 w-6 sm:h-7 sm:w-7'} h-6 sm:h-7 rounded-full text-[10px] sm:text-xs font-bold ${colorClass}`}>
                                        {displayRank}
                                        {isTie && <span className="text-[8px] sm:text-[10px] ml-0.5 opacity-70">T</span>}
                                      </span>
                                    );
                                  })()
                                ) : (
                                  <span className="text-slate-400 dark:text-slate-600">—</span>
                                )}
                              </td>
                              <td className="px-2 sm:px-3 py-2 sm:py-3 text-center">
                                {isLockedForContestant ? (
                                  <Badge variant="success" className="rounded-full bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100 text-[10px] sm:text-xs">
                                    <Lock className="mr-0.5 sm:mr-1 h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                    <span className="hidden sm:inline">Locked</span>
                                  </Badge>
                                ) : (
                                  <Button
                                    size="sm"
                                    className="rounded-full px-2 sm:px-4 text-[10px] sm:text-xs shadow-sm h-7 sm:h-8"
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
                                    <Save className="h-3 w-3 sm:h-3.5 sm:w-3.5 sm:mr-1.5" />
                                    <span className="hidden sm:inline">Save</span>
                                  </Button>
                                )}
                              </td>
                            </motion.tr>
                          );
                        });
                      })()}
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


