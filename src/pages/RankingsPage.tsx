import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/ui/button';
import {
  fetchCategoryRankings,
  fetchOverallRankings,
  supabaseAuth
} from '../services/supabaseApi';
import type { CategorySlug } from '../types/scoring';
import { CATEGORY_CONFIG } from '../constants/scoring';

const highlightClassForRank = (rank: number) => {
  if (rank === 1) return 'bg-amber-500/10 text-amber-200';
  if (rank === 2) return 'bg-slate-300/10 text-slate-100';
  if (rank === 3) return 'bg-orange-500/10 text-orange-200';
  return '';
};

export function RankingsPage() {
  const [selectedCategorySlug, setSelectedCategorySlug] =
    useState<CategorySlug>('production');
  const [roleChecked, setRoleChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const role = await supabaseAuth.getCurrentRole();
        if (!isMounted) return;
        setIsAdmin(role === 'admin');
      } catch {
        if (!isMounted) return;
        setIsAdmin(false);
      } finally {
        if (isMounted) setRoleChecked(true);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const maleOverall = useQuery({
    queryKey: ['overall-rankings', 'male'],
    queryFn: () => fetchOverallRankings('male'),
    refetchInterval: 5000
  });
  const femaleOverall = useQuery({
    queryKey: ['overall-rankings', 'female'],
    queryFn: () => fetchOverallRankings('female'),
    refetchInterval: 5000
  });

  const maleCategory = useQuery({
    queryKey: ['category-rankings', 'male', selectedCategorySlug],
    queryFn: () => fetchCategoryRankings('male', selectedCategorySlug),
    refetchInterval: 5000
  });
  const femaleCategory = useQuery({
    queryKey: ['category-rankings', 'female', selectedCategorySlug],
    queryFn: () => fetchCategoryRankings('female', selectedCategorySlug),
    refetchInterval: 5000
  });

  const categoryLabel =
    CATEGORY_CONFIG.find((c) => c.slug === selectedCategorySlug)?.label ??
    'Category';

  if (!roleChecked) {
    return (
      <AppShell title="Live Rankings" showAdminLink={false}>
        <p className="text-sm text-slate-400 px-6 py-8">Loading access…</p>
      </AppShell>
    );
  }

  const backHref = isAdmin ? '/admin' : '/judge';
  const backLabel = isAdmin ? 'Back to Dashboard' : 'Back to Scoring';

  return (
    <AppShell
      title="Live Rankings"
      showAdminLink={isAdmin}
      actions={
        <Link to={backHref}>
          <Button variant="outline" size="sm">
            {backLabel}
          </Button>
        </Link>
      }
    >
      <div className="space-y-8">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-lg font-semibold">Overall Ranking (Ranking Method)</h2>
          <p className="mt-1 text-xs text-slate-400">
            Lowest total points wins. Rank 1 = 1 pt, Rank 2 = 2 pts, etc.
          </p>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            {[
              { title: 'Male Division', rows: maleOverall.data },
              { title: 'Female Division', rows: femaleOverall.data }
            ].map(({ title, rows }) => (
              <div
                key={title}
                className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
              >
                <h3 className="text-sm font-semibold">{title}</h3>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-800 text-xs">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                        <th className="py-2">Place</th>
                        <th className="py-2">Contestant</th>
                        <th className="py-2 text-center">Total Points</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {rows && rows.length > 0 ? (
                        rows.map((row) => {
                          const cls = highlightClassForRank(row.final_placement);
                          return (
                            <tr key={row.contestant_id} className={cls}>
                              <td className="py-2 text-sm">{row.final_placement}</td>
                              <td className="py-2">
                                #{row.number?.toString().padStart(2, '0')}{' '}
                                {row.full_name}
                              </td>
                              <td className="py-2 text-center">
                                {row.total_points?.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td className="py-2 text-xs" colSpan={3}>
                            No records found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Per-Category Rankings</h2>
              <p className="text-xs text-slate-400">
                Scores are ranked within each category and division. Top 3 are highlighted.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_CONFIG.map((cat) => (
                <button
                  key={cat.slug}
                  onClick={() => setSelectedCategorySlug(cat.slug)}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    selectedCategorySlug === cat.slug
                      ? 'border-slate-100 bg-slate-100/10 text-white'
                      : 'border-slate-700 text-slate-300 hover:border-slate-400'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-2 grid gap-6 md:grid-cols-2">
            {[
              { title: `Male – ${categoryLabel}`, rows: maleCategory.data },
              { title: `Female – ${categoryLabel}`, rows: femaleCategory.data }
            ].map(({ title, rows }) => (
              <div
                key={title}
                className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
              >
                <h3 className="text-sm font-semibold">{title}</h3>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-800 text-xs">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                        <th className="py-2">Rank</th>
                        <th className="py-2">Contestant</th>
                        <th className="py-2 text-center">Category Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {rows && rows.length > 0 ? (
                        rows.map((row) => {
                          const cls = highlightClassForRank(row.rank);
                          return (
                            <tr key={row.contestant_id} className={cls}>
                              <td className="py-2 text-sm">{row.rank}</td>
                              <td className="py-2">
                                #{row.number?.toString().padStart(2, '0')}{' '}
                                {row.full_name}
                              </td>
                              <td className="py-2 text-center">
                                {row.category_score?.toFixed(3)}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td className="py-2 text-xs" colSpan={3}>
                            No records found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

