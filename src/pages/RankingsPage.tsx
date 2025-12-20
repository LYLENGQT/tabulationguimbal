import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Medal, Printer, Trophy, Loader2, RefreshCw } from 'lucide-react';
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
  // Handle fractional ranks for ties (e.g., 1.5 should highlight as top 3)
  if (rank <= 1) return 'bg-gradient-to-r from-amber-100/80 to-amber-50/60 text-amber-700 dark:from-amber-500/20 dark:to-amber-500/10 dark:text-amber-50';
  if (rank <= 2) return 'bg-gradient-to-r from-slate-200/80 to-slate-100/60 text-slate-700 dark:from-slate-400/20 dark:to-slate-400/10 dark:text-slate-50';
  if (rank <= 3) return 'bg-gradient-to-r from-orange-100/80 to-orange-50/60 text-orange-700 dark:from-orange-500/20 dark:to-orange-500/10 dark:text-orange-50';
  return '';
};

// Format a number to show decimals only if needed (for ties)
const formatRank = (rank: number) => {
  return rank % 1 !== 0 ? rank.toFixed(1) : rank.toString();
};

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
    // Handle fractional placements for ties (display as numeric rank)
    if (placement % 1 !== 0) {
      return formatRank(placement);
    }
    if (placement === 1) {
      return division.toLowerCase() === 'male' ? 'MR TEEN 2025' : 'MISS TEEN 2025';
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
      <div style={{ marginBottom: '1.5cm', pageBreakInside: 'avoid' }}>
        <div className="print-header" style={{ textAlign: 'center', marginBottom: '0.3cm' }}>
          <h1 className="print-main-title" style={{ color: 'black', fontSize: '16px', fontWeight: 'bold', margin: 0 }}>
            MR & MISS TEEN 2025
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
                    {formatRank(row.total_points)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Signatories Section */}
        <div style={{ marginTop: '1cm' }}>
          <p style={{ color: 'black', fontSize: '11px', fontWeight: 'bold', marginBottom: '0.5cm', textAlign: 'center' }}>
            Certified Correct:
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1cm' }}>
            {[1, 2, 3].map((num) => (
              <div key={num} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ 
                  borderBottom: '1px solid black', 
                  marginBottom: '4px',
                  minHeight: '30px'
                }} />
                <p style={{ color: 'black', fontSize: '10px', fontWeight: 'bold', margin: 0 }}>
                  JUDGE {num}
                </p>
                <p style={{ color: 'black', fontSize: '9px', margin: 0 }}>
                  Signature over Printed Name
                </p>
              </div>
            ))}
          </div>
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
      <div className="space-y-4 sm:space-y-6">
        {/* Overall Rankings Section */}
        <section className={printMode ? 'space-y-4 sm:space-y-6 printing' : 'rounded-xl sm:rounded-2xl border border-slate-200/80 bg-white/90 p-3 sm:p-4 lg:p-6 shadow-sm dark:border-white/10 dark:bg-slate-900/80'}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/25">
                <Trophy className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg lg:text-xl font-semibold text-slate-900 dark:text-white">Overall Rankings</h2>
                <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">
                  Lowest points wins • Updates every 5s
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] sm:text-xs font-medium text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                <RefreshCw className="h-3 w-3 animate-spin" style={{ animationDuration: '3s' }} />
                <span>Live</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="h-8 sm:h-9 rounded-lg border border-slate-200 bg-white px-2 sm:px-4 text-xs sm:text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
              >
                <Printer className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                <span className="hidden sm:inline">Print</span>
              </Button>
            </div>
          </div>
          {printMode &&
            createPortal(
              <div className="print-mode" style={{ padding: '0.5cm' }}>
                <div className="print-watermark">
                  <span className="print-watermark-text">BY</span>
                  <span className="print-watermark-divider"></span>
                  <span className="print-watermark-text">CODEWITHLYLE</span>
                </div>
                {renderPrintTable('male', maleOverall.data)}
                {renderPrintTable('female', femaleOverall.data)}
              </div>,
              document.body
            )}

          {!printMode && (
            <div className="mt-3 sm:mt-4 grid gap-4 sm:gap-6 md:grid-cols-2">
              {[
                { title: 'Male Division', rows: maleOverall.data },
                { title: 'Female Division', rows: femaleOverall.data }
              ].map(({ title, rows }) => (
              <div
                key={title}
                className="overflow-hidden rounded-lg sm:rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-950/40"
              >
                <div className="flex items-center justify-between border-b border-slate-200 px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-slate-800 dark:border-white/10 dark:text-white">
                  <span>{title}</span>
                  <Medal className="h-3 w-3 sm:h-4 sm:w-4 text-amber-500" />
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-[10px] sm:text-xs dark:divide-white/10">
                    <thead className="sticky top-0 bg-slate-50 text-left uppercase tracking-wide text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
                      <tr>
                        <th className="px-2 sm:px-4 py-2 sm:py-3">Place</th>
                        <th className="px-2 sm:px-4 py-2 sm:py-3">Contestant</th>
                        <th className="px-2 sm:px-4 py-2 sm:py-3 text-center whitespace-nowrap">Total Pts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white dark:divide-white/10 dark:bg-slate-950/30">
                      {title === 'Male Division' && maleOverall.isLoading || title === 'Female Division' && femaleOverall.isLoading ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-8">
                            <div className="flex items-center justify-center gap-2">
                              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                              <span className="text-sm text-slate-500">Loading...</span>
                            </div>
                          </td>
                        </tr>
                      ) : rows && rows.length > 0 ? (
                        rows.map((row, idx) => {
                          const cls = highlightClassForRank(row.final_placement);
                          const zebra = idx % 2 === 0 ? 'bg-white/80 dark:bg-white/5' : 'bg-slate-50 dark:bg-slate-950/40';
                          return (
                            <tr key={row.contestant_id} className={`${cls} ${zebra} transition hover:bg-slate-100 dark:hover:bg-white/10`}>
                              <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-semibold">{formatRank(row.final_placement)}</td>
                              <td className="px-2 sm:px-4 py-2 sm:py-3">
                                <div className="font-semibold text-slate-900 dark:text-white text-xs sm:text-sm">
                                  #{row.number?.toString().padStart(2, '0')} <span className="hidden sm:inline">{row.full_name}</span>
                                </div>
                              </td>
                              <td className="px-2 sm:px-4 py-2 sm:py-3 text-center font-mono text-xs sm:text-sm">
                                {formatRank(row.total_points)}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs" colSpan={3}>
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

        {/* Per-Category Rankings Section */}
        <section className="space-y-3 sm:space-y-4 rounded-xl sm:rounded-2xl border border-slate-200/80 bg-white/90 p-3 sm:p-4 lg:p-6 shadow-sm dark:border-white/10 dark:bg-slate-900/80">
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25">
                  <Medal className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg lg:text-xl font-semibold text-slate-900 dark:text-white">Category Rankings</h2>
                  <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">
                    Select a category to view rankings
                  </p>
                </div>
              </div>
            </div>
            
            {/* Category Pills */}
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {CATEGORY_CONFIG.map((cat) => (
                <button
                  key={cat.slug}
                  onClick={() => setSelectedCategorySlug(cat.slug)}
                  className={`rounded-lg border px-3 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold transition whitespace-nowrap ${
                    selectedCategorySlug === cat.slug
                      ? 'border-emerald-500 bg-emerald-500 text-white shadow-sm dark:border-emerald-400 dark:bg-emerald-500'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-emerald-500 dark:hover:text-emerald-400'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-2 grid gap-4 sm:gap-6 md:grid-cols-2">
            {[
              { title: `Male – ${categoryLabel}`, rows: maleCategory.data },
              { title: `Female – ${categoryLabel}`, rows: femaleCategory.data }
            ].map(({ title, rows }) => (
              <div
                key={title}
                className="overflow-hidden rounded-lg sm:rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-950/40"
              >
                <div className="flex items-center justify-between border-b border-slate-200 px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-slate-800 dark:border-white/10 dark:text-white">
                  <span className="truncate">{title}</span>
                  <Medal className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-500 flex-shrink-0 ml-2" />
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-[10px] sm:text-xs dark:divide-white/10">
                    <thead className="sticky top-0 bg-slate-50 text-left uppercase tracking-wide text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
                      <tr>
                        <th className="px-2 sm:px-4 py-2 sm:py-3">Rank</th>
                        <th className="px-2 sm:px-4 py-2 sm:py-3">Contestant</th>
                        <th className="px-2 sm:px-4 py-2 sm:py-3 text-center whitespace-nowrap">Total Pts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white dark:divide-white/10 dark:bg-slate-950/30">
                      {title.includes('Male') && maleCategory.isLoading || title.includes('Female') && femaleCategory.isLoading ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-8">
                            <div className="flex items-center justify-center gap-2">
                              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                              <span className="text-sm text-slate-500">Loading...</span>
                            </div>
                          </td>
                        </tr>
                      ) : rows && rows.length > 0 ? (
                        rows.map((row, idx) => {
                          const cls = highlightClassForRank(row.rank);
                          const zebra = idx % 2 === 0 ? 'bg-white/80 dark:bg-white/5' : 'bg-slate-50 dark:bg-slate-950/40';
                          return (
                            <tr key={row.contestant_id} className={`${cls} ${zebra} transition hover:bg-slate-100 dark:hover:bg-white/10`}>
                              <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-semibold">{formatRank(row.rank)}</td>
                              <td className="px-2 sm:px-4 py-2 sm:py-3">
                                <div className="font-semibold text-slate-900 dark:text-white text-xs sm:text-sm">
                                  #{row.number?.toString().padStart(2, '0')} <span className="hidden sm:inline">{row.full_name}</span>
                                </div>
                              </td>
                              <td className="px-2 sm:px-4 py-2 sm:py-3 text-center font-mono text-xs sm:text-sm">
                                {formatRank(row.category_score)}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs" colSpan={3}>
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

