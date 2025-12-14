import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Crown, Medal, Printer, Sparkles, Trophy } from 'lucide-react';
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
  if (rank === 1) return 'bg-gradient-to-r from-amber-100/80 to-amber-50/60 text-amber-700 dark:from-amber-500/20 dark:to-amber-500/10 dark:text-amber-50';
  if (rank === 2) return 'bg-gradient-to-r from-slate-200/80 to-slate-100/60 text-slate-700 dark:from-slate-400/20 dark:to-slate-400/10 dark:text-slate-50';
  if (rank === 3) return 'bg-gradient-to-r from-orange-100/80 to-orange-50/60 text-orange-700 dark:from-orange-500/20 dark:to-orange-500/10 dark:text-orange-50';
  return '';
};

const logoModules = import.meta.glob('../../logos/*.{jpg,jpeg,png,webp}', {
  eager: true,
  as: 'url'
});

const SCHOOL_LOGOS = Object.entries(logoModules).map(([path, src]) => {
  const filename = path.split('/').pop()?.replace(/\.[^/.]+$/, '') ?? '';
  return { name: filename, src };
});

export function RankingsPage() {
  const [selectedCategorySlug, setSelectedCategorySlug] =
    useState<CategorySlug>('production');
  const [roleChecked, setRoleChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [printMode, setPrintMode] = useState(false);

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

  const handlePrint = () => {
    setPrintMode(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setPrintMode(false);
      }, 300);
    }, 300);
  };

  const formatPlacement = (placement: number, division: string) => {
    if (placement === 1) {
      return division.toLowerCase() === 'male' ? 'Mr Teen' : 'Ms Teen';
    } else {
      const runnerUpNumber = placement - 1;
      const suffixes: Record<number, string> = {
        1: 'st',
        2: 'nd',
        3: 'rd'
      };
      const suffix = suffixes[runnerUpNumber] || 'th';
      return `${runnerUpNumber}${suffix} Runner Up`;
    }
  };

  const renderPrintTable = (label: string, rows?: any[]) => {
    if (!rows || rows.length === 0) return null;
    const division = label.toLowerCase();
    return (
      <div style={{ marginBottom: '0.5cm' }}>
        <div className="print-header" style={{ textAlign: 'center', marginBottom: '0.3cm' }}>
          <h1 className="print-main-title" style={{ color: 'black', fontSize: '16px', fontWeight: 'bold', margin: 0 }}>
            Mr & Ms Teen Tabulation
          </h1>
          <h2 className="print-category-title" style={{ color: 'black', fontSize: '14px', fontWeight: 'bold', margin: '0.2cm 0' }}>
            Overall Ranking - <span style={{ textTransform: 'uppercase' }}>{label}</span>
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
                  Place
                </th>
                <th style={{ border: '1px solid #000', padding: '6px 4px', color: 'black', backgroundColor: 'white', fontWeight: 'bold' }}>
                  Contestant
                </th>
                <th style={{ border: '1px solid #000', padding: '6px 4px', color: 'black', backgroundColor: 'white', fontWeight: 'bold' }}>
                  Total Points
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.contestant_id}>
                  <td style={{ border: '1px solid #000', padding: '6px 4px', color: 'black', backgroundColor: 'white', textAlign: 'center' }}>
                    {formatPlacement(row.final_placement, division)}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '6px 4px', color: 'black', backgroundColor: 'white', textAlign: 'center' }}>
                    Candidate #{row.number}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '6px 4px', color: 'black', backgroundColor: 'white', textAlign: 'center', fontWeight: 'bold' }}>
                    {row.total_points?.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (!roleChecked) {
    return (
      <AppShell title="Live Rankings" showAdminLink={false} fullWidth={true}>
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
      fullWidth={true}
      actions={
        <Link to={backHref}>
          <Button variant="outline" size="sm" className="rounded-xl">
            {backLabel}
          </Button>
        </Link>
      }
    >
      <div className="space-y-8">
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-r from-white via-slate-50 to-slate-100 p-6 shadow-sm dark:border-white/10 dark:from-slate-900 dark:via-slate-900/80 dark:to-slate-950">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white shadow-sm dark:bg-white dark:text-slate-900">
                <Sparkles className="h-4 w-4" />
                Live Rankings
              </div>
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
                Real-time placements with visual highlights for the top scorers.
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Totals refresh automatically. Top 3 placements are emphasized for quick visibility.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
              <Crown className="h-4 w-4 text-amber-500" />
              Overall + per-category standings
            </div>
          </div>

          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
              Participating Schools
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
              {SCHOOL_LOGOS.map((logo) => (
                <div
                  key={logo.name}
                  className="flex items-center gap-3 rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-white/10"
                >
                  <img
                    src={logo.src}
                    alt={logo.name}
                    className="h-10 w-10 rounded-lg object-cover ring-1 ring-slate-200 dark:ring-white/10"
                  />
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{logo.name}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={printMode ? 'space-y-6 printing' : 'rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-slate-900/80'}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Overall Ranking (Ranking Method)</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Lowest total points wins. Rank 1 = 1 pt, Rank 2 = 2 pts, etc.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
              <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-200">
                <Trophy className="h-4 w-4 text-amber-500" />
                Auto-refreshing
              </div>
            </div>
          </div>
          {printMode &&
            createPortal(
              <div className="print-mode" style={{ padding: '0.5cm' }}>
                {renderPrintTable('male', maleOverall.data)}
                {renderPrintTable('female', femaleOverall.data)}
              </div>,
              document.body
            )}

          {!printMode && (
            <div className="mt-4 grid gap-6 md:grid-cols-2">
              {[
                { title: 'Male Division', rows: maleOverall.data },
                { title: 'Female Division', rows: femaleOverall.data }
              ].map(({ title, rows }) => (
              <div
                key={title}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-950/40"
              >
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 dark:border-white/10 dark:text-white">
                  <span>{title}</span>
                  <Medal className="h-4 w-4 text-amber-500" />
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-xs dark:divide-white/10">
                    <thead className="sticky top-0 bg-slate-50 text-left uppercase tracking-wide text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
                      <tr>
                        <th className="px-4 py-3">Place</th>
                        <th className="px-4 py-3">Contestant</th>
                        <th className="px-4 py-3 text-center">Total Points</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white dark:divide-white/10 dark:bg-slate-950/30">
                      {rows && rows.length > 0 ? (
                        rows.map((row, idx) => {
                          const cls = highlightClassForRank(row.final_placement);
                          const zebra = idx % 2 === 0 ? 'bg-white/80 dark:bg-white/5' : 'bg-slate-50 dark:bg-slate-950/40';
                          return (
                            <tr key={row.contestant_id} className={`${cls} ${zebra} transition hover:bg-slate-100 dark:hover:bg-white/10`}>
                              <td className="px-4 py-3 text-sm font-semibold">{row.final_placement}</td>
                              <td className="px-4 py-3">
                                <div className="font-semibold text-slate-900 dark:text-white">
                                  #{row.number?.toString().padStart(2, '0')} {row.full_name}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center font-mono">
                                {row.total_points?.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td className="px-4 py-3 text-xs" colSpan={3}>
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
          )}
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-slate-900/80">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Per-Category Rankings</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Scores are ranked within each category and division. Top 3 are highlighted.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_CONFIG.map((cat) => (
                <button
                  key={cat.slug}
                  onClick={() => setSelectedCategorySlug(cat.slug)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    selectedCategorySlug === cat.slug
                      ? 'border-slate-900 bg-slate-900 text-white shadow-sm dark:border-white dark:bg-white dark:text-slate-900'
                      : 'border-slate-200 text-slate-600 hover:border-slate-400 hover:text-slate-900 dark:border-white/10 dark:text-slate-200 dark:hover:border-white/40'
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
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-950/40"
              >
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 dark:border-white/10 dark:text-white">
                  <span>{title}</span>
                  <Medal className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-xs dark:divide-white/10">
                    <thead className="sticky top-0 bg-slate-50 text-left uppercase tracking-wide text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
                      <tr>
                        <th className="px-4 py-3">Rank</th>
                        <th className="px-4 py-3">Contestant</th>
                        <th className="px-4 py-3 text-center">Category Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white dark:divide-white/10 dark:bg-slate-950/30">
                      {rows && rows.length > 0 ? (
                        rows.map((row, idx) => {
                          const cls = highlightClassForRank(row.rank);
                          const zebra = idx % 2 === 0 ? 'bg-white/80 dark:bg-white/5' : 'bg-slate-50 dark:bg-slate-950/40';
                          return (
                            <tr key={row.contestant_id} className={`${cls} ${zebra} transition hover:bg-slate-100 dark:hover:bg-white/10`}>
                              <td className="px-4 py-3 text-sm font-semibold">{row.rank}</td>
                              <td className="px-4 py-3">
                                <div className="font-semibold text-slate-900 dark:text-white">
                                  #{row.number?.toString().padStart(2, '0')} {row.full_name}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center font-mono">
                                {row.category_score?.toFixed(3)}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td className="px-4 py-3 text-xs" colSpan={3}>
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

