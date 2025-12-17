import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  Target,
  Users,
  ArrowLeftRight,
  ChevronDown,
  Medal,
  Minus,
  BarChart3,
  Zap
} from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../components/ui/select';
import {
  fetchContestantInsights,
  fetchHeadToHead,
  fetchContestants,
  type ContestantInsight,
  type HeadToHeadComparison
} from '../services/supabaseApi';
import type { Division } from '../types/scoring';
import { CATEGORY_CONFIG } from '../constants/scoring';

const formatRank = (rank: number) => {
  return rank % 1 !== 0 ? rank.toFixed(1) : rank.toString();
};

const getRankBadgeColor = (rank: number) => {
  if (rank <= 1) return 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300';
  if (rank <= 2) return 'bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-200';
  if (rank <= 3) return 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300';
  return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
};

export function ContestantInsightsPage() {
  const [division, setDivision] = useState<Division>('male');
  const [selectedContestant, setSelectedContestant] = useState<string | null>(null);
  const [compareContestant1, setCompareContestant1] = useState<string>('');
  const [compareContestant2, setCompareContestant2] = useState<string>('');

  const insightsQuery = useQuery({
    queryKey: ['contestant-insights', division],
    queryFn: () => fetchContestantInsights(division),
    refetchInterval: 10000
  });

  const contestantsQuery = useQuery({
    queryKey: ['contestants', division],
    queryFn: () => fetchContestants(division)
  });

  const headToHeadQuery = useQuery({
    queryKey: ['head-to-head', compareContestant1, compareContestant2, division],
    queryFn: () => fetchHeadToHead(compareContestant1, compareContestant2, division),
    enabled: Boolean(compareContestant1 && compareContestant2 && compareContestant1 !== compareContestant2)
  });

  const insights = insightsQuery.data || [];
  const contestants = contestantsQuery.data || [];
  const selectedInsight = insights.find(i => i.contestantId === selectedContestant);
  const headToHead = headToHeadQuery.data;

  // Calculate top performers
  const topPerformers = useMemo(() => {
    if (insights.length === 0) return { mostConsistent: null, biggestImprover: null, topRanked: null };
    
    const sorted = [...insights].sort((a, b) => a.consistency - b.consistency);
    const mostConsistent = sorted[0];
    
    const topRanked = insights.find(i => i.overallRank === 1);
    
    return { mostConsistent, topRanked };
  }, [insights]);

  return (
    <AppShell
      title="Contestant Insights"
      showAdminLink={true}
      fullWidth={true}
      actions={
        <Link to="/admin">
          <Button variant="outline" size="sm" className="rounded-xl">
            Back to Dashboard
          </Button>
        </Link>
      }
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white font-display">
              Contestant Analytics
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Deep insights into contestant performance across all categories
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600 dark:text-slate-400">Division:</span>
            <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <button
                onClick={() => setDivision('male')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  division === 'male'
                    ? 'bg-sky-500 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                Male
              </button>
              <button
                onClick={() => setDivision('female')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  division === 'female'
                    ? 'bg-rose-500 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                Female
              </button>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        {insights.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {topPerformers.topRanked && (
              <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100 dark:border-amber-800 dark:from-amber-950/30 dark:to-amber-900/20">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Current Leader</p>
                      <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                        #{topPerformers.topRanked.contestantNumber.toString().padStart(2, '0')}
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        {topPerformers.topRanked.overallPoints} total points
                      </p>
                    </div>
                    <Medal className="h-8 w-8 text-amber-500" />
                  </div>
                </CardContent>
              </Card>
            )}

            {topPerformers.mostConsistent && (
              <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:border-emerald-800 dark:from-emerald-950/30 dark:to-emerald-900/20">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Most Consistent</p>
                      <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                        #{topPerformers.mostConsistent.contestantNumber.toString().padStart(2, '0')}
                      </p>
                      <p className="text-sm text-emerald-700 dark:text-emerald-300">
                        σ = {topPerformers.mostConsistent.consistency} variance
                      </p>
                    </div>
                    <Target className="h-8 w-8 text-emerald-500" />
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="border-slate-200 dark:border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Contestants</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {insights.length}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {division === 'male' ? 'MR TEEN' : 'MS TEEN'} 2025
                    </p>
                  </div>
                  <Users className="h-8 w-8 text-slate-400" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Contestant List */}
          <Card className="lg:col-span-1 border-slate-200 dark:border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Contestant Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[500px] overflow-y-auto">
                {insights.map((insight) => (
                  <button
                    key={insight.contestantId}
                    onClick={() => setSelectedContestant(insight.contestantId)}
                    className={`w-full flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 transition-colors text-left ${
                      selectedContestant === insight.contestantId
                        ? 'bg-slate-100 dark:bg-slate-800'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Badge className={getRankBadgeColor(insight.overallRank)}>
                        #{formatRank(insight.overallRank)}
                      </Badge>
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">
                          Candidate #{insight.contestantNumber.toString().padStart(2, '0')}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {insight.overallPoints} pts · Avg rank: {insight.averageRank}
                        </p>
                      </div>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${
                      selectedContestant === insight.contestantId ? 'rotate-180' : ''
                    }`} />
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Detailed View */}
          <Card className="lg:col-span-2 border-slate-200 dark:border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4" />
                {selectedInsight 
                  ? `Candidate #${selectedInsight.contestantNumber.toString().padStart(2, '0')} Breakdown`
                  : 'Select a Contestant'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedInsight ? (
                <div className="space-y-6">
                  {/* Key Metrics */}
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                      <p className="text-xs text-slate-500 dark:text-slate-400">Overall Rank</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">
                        #{formatRank(selectedInsight.overallRank)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                      <p className="text-xs text-slate-500 dark:text-slate-400">Gap to Leader</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">
                        {selectedInsight.gapToLeader === 0 ? (
                          <span className="text-emerald-600">Leader</span>
                        ) : (
                          `+${selectedInsight.gapToLeader} pts`
                        )}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                      <p className="text-xs text-slate-500 dark:text-slate-400">Consistency (σ)</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">
                        {selectedInsight.consistency}
                      </p>
                    </div>
                  </div>

                  {/* Strongest/Weakest */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/30">
                      <TrendingUp className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                      <div>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400">Strongest Category</p>
                        <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                          {selectedInsight.strongestCategory}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/30">
                      <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" />
                      <div>
                        <p className="text-xs text-red-600 dark:text-red-400">Needs Improvement</p>
                        <p className="font-semibold text-red-900 dark:text-red-100">
                          {selectedInsight.weakestCategory}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Category Breakdown */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                      Performance by Category
                    </h4>
                    <div className="space-y-2">
                      {selectedInsight.categoryRanks.map((cat) => (
                        <div 
                          key={cat.categorySlug}
                          className={`flex items-center justify-between rounded-lg border p-3 ${
                            cat.isStrongest 
                              ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20'
                              : cat.isWeakest
                              ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20'
                              : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {cat.isStrongest && <TrendingUp className="h-4 w-4 text-emerald-500" />}
                            {cat.isWeakest && <TrendingDown className="h-4 w-4 text-red-500" />}
                            {!cat.isStrongest && !cat.isWeakest && <Minus className="h-4 w-4 text-slate-400" />}
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                              {cat.categoryLabel}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {cat.totalPoints} pts
                            </span>
                            <Badge className={getRankBadgeColor(cat.rank)}>
                              Rank #{formatRank(cat.rank)}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Rank Progression Chart */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                      Rank Progression Across Categories
                    </h4>
                    <div className="flex items-end gap-2 h-32">
                      {selectedInsight.categoryRanks.map((cat, idx) => {
                        const maxRank = Math.max(...insights.map(i => i.categoryRanks.length));
                        const height = ((maxRank - cat.rank + 1) / maxRank) * 100;
                        return (
                          <div key={cat.categorySlug} className="flex-1 flex flex-col items-center gap-1">
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                              #{formatRank(cat.rank)}
                            </span>
                            <div 
                              className={`w-full rounded-t transition-all ${
                                cat.isStrongest 
                                  ? 'bg-emerald-500' 
                                  : cat.isWeakest 
                                  ? 'bg-red-400' 
                                  : 'bg-slate-400 dark:bg-slate-600'
                              }`}
                              style={{ height: `${height}%` }}
                            />
                            <span className="text-[9px] text-slate-500 dark:text-slate-400 truncate w-full text-center">
                              {CATEGORY_CONFIG[idx]?.label.substring(0, 8) || cat.categorySlug}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <BarChart3 className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-4" />
                  <p className="text-slate-500 dark:text-slate-400">
                    Select a contestant from the list to view detailed analytics
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Head-to-Head Comparison */}
        <Card className="border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4" />
              Head-to-Head Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-6">
              <Select value={compareContestant1} onValueChange={setCompareContestant1}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Contestant 1" />
                </SelectTrigger>
                <SelectContent>
                  {contestants.map((c) => (
                    <SelectItem key={c.id} value={c.id} disabled={c.id === compareContestant2}>
                      #{c.number.toString().padStart(2, '0')} - {c.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="hidden sm:flex items-center justify-center">
                <span className="text-slate-400 font-bold">VS</span>
              </div>

              <Select value={compareContestant2} onValueChange={setCompareContestant2}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Contestant 2" />
                </SelectTrigger>
                <SelectContent>
                  {contestants.map((c) => (
                    <SelectItem key={c.id} value={c.id} disabled={c.id === compareContestant1}>
                      #{c.number.toString().padStart(2, '0')} - {c.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {headToHead ? (
              <div className="space-y-4">
                {/* Overall Comparison */}
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className={`rounded-lg p-4 text-center ${
                    headToHead.contestant1.overallRank < headToHead.contestant2.overallRank
                      ? 'bg-emerald-100 dark:bg-emerald-950/30'
                      : 'bg-slate-100 dark:bg-slate-800'
                  }`}>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Contestant #{headToHead.contestant1.number}</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      Rank #{formatRank(headToHead.contestant1.overallRank)}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {headToHead.contestant1.overallPoints} points
                    </p>
                  </div>

                  <div className="flex flex-col items-center justify-center">
                    <div className="text-center">
                      <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        #{headToHead.contestant1.number} wins: {headToHead.categoriesWonBy1.length}
                      </p>
                      <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                        #{headToHead.contestant2.number} wins: {headToHead.categoriesWonBy2.length}
                      </p>
                      <p className="text-sm font-medium text-slate-500">
                        Ties: {headToHead.tiedCategories.length}
                      </p>
                    </div>
                  </div>

                  <div className={`rounded-lg p-4 text-center ${
                    headToHead.contestant2.overallRank < headToHead.contestant1.overallRank
                      ? 'bg-emerald-100 dark:bg-emerald-950/30'
                      : 'bg-slate-100 dark:bg-slate-800'
                  }`}>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Contestant #{headToHead.contestant2.number}</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      Rank #{formatRank(headToHead.contestant2.overallRank)}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {headToHead.contestant2.overallPoints} points
                    </p>
                  </div>
                </div>

                {/* Category Breakdown */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800">
                      <tr>
                        <th className="px-4 py-2 text-left">Category</th>
                        <th className="px-4 py-2 text-center">#{headToHead.contestant1.number}</th>
                        <th className="px-4 py-2 text-center">#{headToHead.contestant2.number}</th>
                        <th className="px-4 py-2 text-center">Winner</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {headToHead.contestant1.categoryRanks.map((cat) => {
                        const cat2 = headToHead.contestant2.categoryRanks.find(c => c.category === cat.category);
                        const winner = cat.rank < (cat2?.rank || Infinity) 
                          ? 1 
                          : cat.rank > (cat2?.rank || 0) 
                          ? 2 
                          : 0;
                        return (
                          <tr key={cat.category}>
                            <td className="px-4 py-2 font-medium">{cat.category}</td>
                            <td className={`px-4 py-2 text-center ${winner === 1 ? 'text-emerald-600 font-bold' : ''}`}>
                              #{formatRank(cat.rank)}
                            </td>
                            <td className={`px-4 py-2 text-center ${winner === 2 ? 'text-emerald-600 font-bold' : ''}`}>
                              #{formatRank(cat2?.rank || 0)}
                            </td>
                            <td className="px-4 py-2 text-center">
                              {winner === 0 ? (
                                <Badge variant="outline">Tie</Badge>
                              ) : (
                                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                                  #{winner === 1 ? headToHead.contestant1.number : headToHead.contestant2.number}
                                </Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                {compareContestant1 && compareContestant2 ? (
                  <p>Loading comparison...</p>
                ) : (
                  <p>Select two contestants to compare their performance</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
