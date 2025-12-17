import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock, AlertCircle, Users, BarChart3, Loader2 } from 'lucide-react';
import { fetchScoringProgress, type ScoringProgress } from '../services/supabaseApi';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

interface ProgressTrackerProps {
  compact?: boolean;
  refreshInterval?: number;
}

export function ProgressTracker({ compact = false, refreshInterval = 5000 }: ProgressTrackerProps) {
  const { data: progress, isLoading, error } = useQuery({
    queryKey: ['scoring-progress'],
    queryFn: fetchScoringProgress,
    refetchInterval: refreshInterval
  });

  if (isLoading) {
    return (
      <Card className="border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          <span className="ml-2 text-sm text-slate-500">Loading progress...</span>
        </CardContent>
      </Card>
    );
  }

  if (error || !progress) {
    return (
      <Card className="border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20">
        <CardContent className="py-4">
          <p className="text-sm text-red-600 dark:text-red-400">Failed to load progress data</p>
        </CardContent>
      </Card>
    );
  }

  const getProgressColor = (percent: number) => {
    if (percent >= 100) return 'bg-emerald-500';
    if (percent >= 75) return 'bg-blue-500';
    if (percent >= 50) return 'bg-amber-500';
    return 'bg-slate-400';
  };

  const getStatusIcon = (percent: number) => {
    if (percent >= 100) return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    if (percent >= 50) return <Clock className="h-4 w-4 text-amber-500" />;
    return <AlertCircle className="h-4 w-4 text-slate-400" />;
  };

  if (compact) {
    return (
      <Card className="border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Scoring Progress</span>
            </div>
            <Badge className={`${progress.percentComplete >= 100 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'}`}>
              {progress.percentComplete}%
            </Badge>
          </div>
          
          <div className="w-full h-2 bg-slate-200 rounded-full dark:bg-slate-700 overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${getProgressColor(progress.percentComplete)}`}
              style={{ width: `${progress.percentComplete}%` }}
            />
          </div>
          
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{progress.totalSubmitted} / {progress.totalExpected} scores</span>
            {progress.waitingOn.length > 0 && (
              <span className="text-amber-600 dark:text-amber-400">
                Waiting on {progress.waitingOn.length} judge{progress.waitingOn.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Progress */}
      <Card className="border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5" />
            Real-Time Scoring Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-4xl font-bold text-slate-900 dark:text-white">
                  {progress.percentComplete}%
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {progress.totalSubmitted} of {progress.totalExpected} scores submitted
                </p>
              </div>
              {progress.percentComplete >= 100 ? (
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 text-sm px-3 py-1">
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Complete
                </Badge>
              ) : (
                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 text-sm px-3 py-1">
                  <Clock className="h-4 w-4 mr-1" />
                  In Progress
                </Badge>
              )}
            </div>
            
            <div className="w-full h-4 bg-slate-200 rounded-full dark:bg-slate-700 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${getProgressColor(progress.percentComplete)}`}
                style={{ width: `${progress.percentComplete}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Judge Progress */}
      <Card className="border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5" />
            Progress by Judge
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {progress.byJudge.map((judge) => (
              <div key={judge.judgeId} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(judge.percentComplete)}
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {judge.judgeName}
                    </span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {judge.division === 'male' ? 'M' : 'F'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {judge.lockedCount > 0 && (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400">
                        {judge.lockedCount} locked
                      </span>
                    )}
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      {judge.percentComplete}%
                    </span>
                  </div>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full dark:bg-slate-700 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ${getProgressColor(judge.percentComplete)}`}
                    style={{ width: `${judge.percentComplete}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Category Progress */}
      <Card className="border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-5 w-5" />
            Progress by Category
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {progress.byCategory.map((cat) => (
              <div key={cat.categoryId} className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                    {cat.categoryLabel}
                  </span>
                  {getStatusIcon(cat.percentComplete)}
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full dark:bg-slate-700 overflow-hidden mb-1">
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ${getProgressColor(cat.percentComplete)}`}
                    style={{ width: `${cat.percentComplete}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {cat.submitted} / {cat.expected} ({cat.percentComplete}%)
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Waiting On */}
      {progress.waitingOn.length > 0 && (
        <Card className="border border-amber-200 bg-amber-50 shadow-sm dark:border-amber-800 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-amber-800 dark:text-amber-300">
              <AlertCircle className="h-5 w-5" />
              Waiting On
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {progress.waitingOn.map((judge) => (
                <div 
                  key={judge.judgeId} 
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 rounded-lg border border-amber-200 bg-white p-3 dark:border-amber-800 dark:bg-amber-950/30"
                >
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span className="font-medium text-slate-900 dark:text-white">
                      {judge.judgeName}
                    </span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {judge.division === 'male' ? 'Male' : 'Female'}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1 ml-6 sm:ml-0">
                    {judge.pendingCategories.map((cat) => (
                      <Badge 
                        key={cat} 
                        className="bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 text-[10px]"
                      >
                        {cat}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
