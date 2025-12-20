import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Trophy, Medal, Sparkles, Monitor, MonitorOff, Loader2 } from 'lucide-react';
import { fetchOverallRankings, fetchCategoryRankings } from '../services/supabaseApi';
import type { Division, CategorySlug } from '../types/scoring';
import { CATEGORY_CONFIG } from '../constants/scoring';

const formatRank = (rank: number) => {
  return rank % 1 !== 0 ? rank.toFixed(1) : rank.toString();
};

const getRankIcon = (rank: number) => {
  if (rank <= 1) return <Crown className="h-8 w-8 text-amber-400" />;
  if (rank <= 2) return <Medal className="h-8 w-8 text-slate-300" />;
  if (rank <= 3) return <Medal className="h-8 w-8 text-orange-400" />;
  return null;
};

const getRankGradient = (rank: number) => {
  if (rank <= 1) return 'from-amber-500/20 via-amber-400/10 to-transparent border-amber-400/50';
  if (rank <= 2) return 'from-slate-400/20 via-slate-300/10 to-transparent border-slate-400/50';
  if (rank <= 3) return 'from-orange-500/20 via-orange-400/10 to-transparent border-orange-400/50';
  return 'from-slate-800 to-slate-900 border-slate-700';
};

export function LiveDisplayPage() {
  const [division, setDivision] = useState<Division>('male');
  const [viewMode, setViewMode] = useState<'overall' | 'category'>('overall');
  const [selectedCategory, setSelectedCategory] = useState<CategorySlug>('production');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [rotationIndex, setRotationIndex] = useState(0);

  // Auto-rotate through views
  useEffect(() => {
    if (!autoRotate) return;
    
    const interval = setInterval(() => {
      setRotationIndex((prev) => {
        const next = prev + 1;
        const totalViews = 2 + CATEGORY_CONFIG.length * 2; // Overall + categories for both divisions
        
        if (next >= totalViews) return 0;
        
        // Determine what view to show based on index
        if (next === 0) {
          setDivision('male');
          setViewMode('overall');
        } else if (next === 1) {
          setDivision('female');
          setViewMode('overall');
        } else {
          const categoryIndex = Math.floor((next - 2) / 2);
          const isFemale = (next - 2) % 2 === 1;
          setDivision(isFemale ? 'female' : 'male');
          setViewMode('category');
          setSelectedCategory(CATEGORY_CONFIG[categoryIndex]?.slug || 'production');
        }
        
        return next;
      });
    }, 10000); // Change every 10 seconds

    return () => clearInterval(interval);
  }, [autoRotate]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Queries
  const overallQuery = useQuery({
    queryKey: ['live-overall', division],
    queryFn: () => fetchOverallRankings(division),
    refetchInterval: 3000,
    enabled: viewMode === 'overall'
  });

  const categoryQuery = useQuery({
    queryKey: ['live-category', division, selectedCategory],
    queryFn: () => fetchCategoryRankings(division, selectedCategory),
    refetchInterval: 3000,
    enabled: viewMode === 'category'
  });

  const rows = viewMode === 'overall' ? overallQuery.data : categoryQuery.data;
  const isLoading = viewMode === 'overall' ? overallQuery.isLoading : categoryQuery.isLoading;
  const categoryLabel = CATEGORY_CONFIG.find(c => c.slug === selectedCategory)?.label || '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white overflow-hidden">
      {/* Control Bar - Hidden in fullscreen */}
      {!isFullscreen && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-slate-900/90 backdrop-blur-lg border-b border-slate-800 px-4 py-3">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-400" />
              <span className="font-display font-bold text-lg">Live Display</span>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {/* Division Toggle */}
              <div className="flex rounded-lg border border-slate-700 overflow-hidden">
                <button
                  onClick={() => setDivision('male')}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    division === 'male'
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Male
                </button>
                <button
                  onClick={() => setDivision('female')}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    division === 'female'
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Female
                </button>
              </div>

              {/* View Mode Toggle */}
              <div className="flex rounded-lg border border-slate-700 overflow-hidden">
                <button
                  onClick={() => setViewMode('overall')}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    viewMode === 'overall'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Overall
                </button>
                <button
                  onClick={() => setViewMode('category')}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    viewMode === 'category'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Category
                </button>
              </div>

              {/* Category Selector */}
              {viewMode === 'category' && (
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value as CategorySlug)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white"
                >
                  {CATEGORY_CONFIG.map((cat) => (
                    <option key={cat.slug} value={cat.slug}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              )}

              {/* Auto-Rotate Toggle */}
              <button
                onClick={() => setAutoRotate(!autoRotate)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                  autoRotate
                    ? 'border-emerald-500 bg-emerald-600 text-white'
                    : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {autoRotate ? 'Auto: ON' : 'Auto: OFF'}
              </button>

              {/* Fullscreen Toggle */}
              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                {isFullscreen ? <MonitorOff className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Display */}
      <div className={`flex flex-col items-center justify-center min-h-screen px-8 ${!isFullscreen ? 'pt-20' : ''}`}>
        {/* Header */}
        <motion.div
          key={`header-${division}-${viewMode}-${selectedCategory}`}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-3 mb-4">
            <Trophy className={`h-10 w-10 ${division === 'male' ? 'text-sky-400' : 'text-rose-400'}`} />
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold tracking-tight">
              {division === 'male' ? 'MR TEEN' : 'MISS TEEN'} 2025
            </h1>
            <Trophy className={`h-10 w-10 ${division === 'male' ? 'text-sky-400' : 'text-rose-400'}`} />
          </div>
          <h2 className="text-xl md:text-2xl lg:text-3xl font-medium text-slate-300">
            {viewMode === 'overall' ? 'OVERALL RANKINGS' : categoryLabel.toUpperCase()}
          </h2>
          <p className="text-sm text-slate-500 mt-2">
            Disyembre sa Guimbal 2025 • Live Updates
          </p>
        </motion.div>

        {/* Rankings Grid */}
        <div className="w-full max-w-5xl">
          <AnimatePresence mode="popLayout">
            {isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-20"
              >
                <div className="relative">
                  <Loader2 className="h-16 w-16 animate-spin text-amber-400" />
                  <Sparkles className="absolute -top-2 -right-2 h-6 w-6 text-amber-300 animate-pulse" />
                </div>
                <p className="text-xl text-slate-400 mt-6 animate-pulse">Loading rankings...</p>
              </motion.div>
            ) : rows && rows.length > 0 ? (
              <motion.div
                key={`grid-${division}-${viewMode}-${selectedCategory}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid gap-4"
              >
                {rows.slice(0, 10).map((row, index) => {
                  const rank = viewMode === 'overall' 
                    ? (row as any).final_placement 
                    : (row as any).rank;
                  const points = viewMode === 'overall'
                    ? (row as any).total_points
                    : (row as any).category_score;
                  
                  return (
                    <motion.div
                      key={row.contestant_id}
                      initial={{ opacity: 0, x: -50 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-r p-4 md:p-6 ${getRankGradient(rank)}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 md:gap-6">
                          {/* Rank Badge */}
                          <div className={`flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-2xl font-display font-bold text-3xl md:text-4xl ${
                            rank <= 1 ? 'bg-amber-500/30 text-amber-300' :
                            rank <= 2 ? 'bg-slate-400/30 text-slate-200' :
                            rank <= 3 ? 'bg-orange-500/30 text-orange-300' :
                            'bg-slate-700/50 text-slate-400'
                          }`}>
                            {formatRank(rank)}
                          </div>
                          
                          {/* Contestant Info */}
                          <div>
                            <div className="flex items-center gap-3">
                              {getRankIcon(rank)}
                              <span className="text-2xl md:text-3xl font-display font-bold">
                                Candidate #{(row as any).number?.toString().padStart(2, '0')}
                              </span>
                            </div>
                            {rank <= 3 && (
                              <p className="text-slate-400 mt-1">
                                {rank <= 1 ? (division === 'male' ? 'MR TEEN 2025' : 'MISS TEEN 2025') :
                                 rank <= 2 ? '1st Runner Up' : '2nd Runner Up'}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        {/* Points */}
                        <div className="text-right">
                          <p className="text-3xl md:text-4xl font-bold font-mono">
                            {formatRank(points)}
                          </p>
                          <p className="text-sm text-slate-400">points</p>
                        </div>
                      </div>
                      
                      {/* Decorative elements for top 3 */}
                      {rank <= 3 && (
                        <div className="absolute -right-4 -top-4 opacity-10">
                          <Sparkles className="h-32 w-32" />
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-20"
              >
                <Trophy className="h-16 w-16 mx-auto text-slate-600 mb-4" />
                <p className="text-xl text-slate-500">No rankings available yet</p>
                <p className="text-sm text-slate-600 mt-2">Scores will appear here as judges submit</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-slate-600">
            Rankings update automatically every 3 seconds
          </p>
        </div>
      </div>

      {/* Fullscreen Exit Hint */}
      {isFullscreen && (
        <div className="fixed bottom-4 right-4 text-xs text-slate-600">
          Press ESC to exit fullscreen
        </div>
      )}
    </div>
  );
}

