import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/ui/button';
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
  // scores[contestantId][criterionId] = string value from input
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

  const ready = !judgeQuery.isLoading && Boolean(judge);

  // When we load scores from Supabase for this judge + category, seed the local sheet values
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

  return (
    <AppShell
      title="Judge Scoring Panel"
      showAdminLink={false}
      actions={
        <Button variant="outline" onClick={handleSignOut}>
          Sign out
        </Button>
      }
    >
      {judgeQuery.isLoading ? (
        <p className="text-sm text-slate-400">Loading judge profile…</p>
      ) : !judge ? (
        <p className="text-sm text-red-300">
          No judge profile was found for this account. Please ask the tabulation admin
          to add you to the judges list with the same email you used to log in.
        </p>
      ) : (
        <div className="space-y-6">
          <section className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-slate-400">Welcome,</p>
              <p className="text-xl font-semibold">{judge?.full_name}</p>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                {judge?.division} division judge
              </p>
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <h2 className="text-sm font-semibold text-slate-200">Categories</h2>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => {
                const isActive = category.id === selectedCategoryId;
                return (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategoryId(category.id)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      isActive
                        ? 'border-slate-100 bg-slate-100/10 text-white'
                        : 'border-slate-700 text-slate-300 hover:border-slate-400'
                    }`}
                  >
                    {category.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            {!selectedCategoryId ? (
              <p className="text-sm text-slate-400">
                Choose a category above to start scoring contestants.
              </p>
            ) : contestants.length === 0 ? (
              <p className="text-sm text-slate-400">
                No contestants have been added for this division yet.
              </p>
            ) : (
              <>
                <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Category
                    </p>
                    <h2 className="text-lg font-semibold">
                      {currentCategory?.label ?? 'Category'}
                    </h2>
                    <p className="text-xs text-slate-400">
                      Enter scores like a sheet: one row per contestant, one column per
                      criterion.
                    </p>
                  </div>
                </header>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-800 text-xs">
                    <thead>
                      <tr className="bg-slate-900/80 text-slate-300">
                        <th className="px-3 py-2 text-left"># / Contestant</th>
                        {criteria.map((criterion) => (
                          <th key={criterion.id} className="px-3 py-2 text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <span>{criterion.label}</span>
                              <span className="text-[10px] text-slate-500">
                                {(criterion.percentage * 100).toFixed(0)}%
                              </span>
                            </div>
                          </th>
                        ))}
                        <th className="px-3 py-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {contestants.map((contestant) => {
                        const isLockedForContestant = Boolean(
                          locksQuery.data?.some(
                            (lock) => lock.contestant_id === contestant.id
                          )
                        );
                        return (
                          <tr key={contestant.id} className="hover:bg-slate-900/60">
                            <td className="whitespace-nowrap px-3 py-2 text-left text-xs">
                              <div className="font-semibold text-slate-100">
                                #{contestant.number.toString().padStart(2, '0')}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {contestant.full_name}
                              </div>
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
                                    className="w-16 rounded-md border border-slate-700 bg-slate-950 px-1 py-1 text-right text-xs focus:border-slate-400 focus:outline-none"
                                    disabled={isLockedForContestant}
                                    value={value}
                                    onChange={(e) => {
                                      const next = e.target.value;
                                      // Hard limit in UI as well
                                      if (next !== '') {
                                        const n = Number(next);
                                        if (!Number.isNaN(n) && n > max) return;
                                        if (!Number.isNaN(n) && n < 0) return;
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
                            <td className="px-3 py-2 text-center">
                              {isLockedForContestant ? (
                                <span className="rounded-full border border-green-400/40 px-2 py-0.5 text-[10px] font-medium text-green-300">
                                  Locked
                                </span>
                              ) : (
                                <Button
                                  size="sm"
                                  className="text-xs"
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
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}


