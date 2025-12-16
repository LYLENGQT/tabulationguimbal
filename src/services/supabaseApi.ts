import { getSupabaseClient } from '../lib/supabaseClient';
import type {
  ActivityLog,
  Category,
  CategoryRankingRow,
  Contestant,
  Criterion,
  Division,
  Judge,
  LeaderboardRow,
  OverallRankingRow,
  ScoreHistory,
  ScorePayload
} from '../types/scoring';

const supabase = getSupabaseClient();

export const supabaseAuth = {
  async signInWithOtp(email: string) {
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) throw error;
    return true;
  },
  async signInWithPassword(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return true;
  },
  async signUpWithPassword(params: {
    email: string;
    password: string;
    full_name: string;
    username?: string;
    division: Division;
  }) {
    const { email, password, full_name, division, username } = params;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name,
          division,
          username
        }
      }
    });
    if (error) throw error;
    return data;
  },
  async signInWithUsername(username: string, password: string) {
    // Look up judge by username to get their email (case-insensitive)
    const { data: judge, error: lookupError } = await supabase
      .from('judges')
      .select('email')
      .ilike('username', username)
      .single();
    
    if (lookupError || !judge) {
      throw new Error('Invalid username or password');
    }
    
    // Sign in with the email (lowercase to match Supabase Auth normalization)
    const { error } = await supabase.auth.signInWithPassword({ 
      email: judge.email.toLowerCase(), 
      password 
    });
    if (error) throw error;
    return true;
  },
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
  async getCurrentRole(): Promise<'admin' | 'judge' | 'unknown'> {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return 'unknown';

    // Hard-coded admin account based on email.
    // You can add more admin emails here if needed.
    const email = (user.email ?? '').toLowerCase();
    if (email === 'admin@mrmsteen2025.com') {
      return 'admin';
    }

    // Everyone else is treated as judge by default.
    return 'judge';
  },
  async getUserJudge(): Promise<Judge | null> {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return null;
    // Use ilike for case-insensitive email matching
    const { data, error } = await supabase
      .from('judges')
      .select('*')
      .ilike('email', user.user.email ?? '')
      .single();
    if (error) {
      console.error(error);
      return null;
    }
    return data as Judge;
  },
  async getJudgeByUsername(username: string): Promise<Judge | null> {
    const { data, error } = await supabase
      .from('judges')
      .select('*')
      .eq('username', username)
      .single();
    if (error) {
      console.error(error);
      return null;
    }
    return data as Judge;
  },
  async deleteAuthUser(email: string): Promise<boolean> {
    // Delete authentication user via Edge Function
    const { error } = await supabase.functions.invoke('delete-auth-users', {
      body: { emails: [email] }
    });
    if (error) {
      console.error('Failed to delete auth user:', error);
      throw error;
    }
    return true;
  }
};

export const fetchCategories = async (): Promise<Category[]> => {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return data as Category[];
};

export const fetchCriteria = async (categoryId: string): Promise<Criterion[]> => {
  const { data, error } = await supabase
    .from('criteria')
    .select('*')
    .eq('category_id', categoryId)
    .order('sort_order');
  if (error) throw error;
  return data as Criterion[];
};

export const fetchContestants = async (division: Division): Promise<Contestant[]> => {
  const { data, error } = await supabase
    .from('contestants')
    .select('*')
    .eq('division', division)
    .eq('is_active', true)
    .order('number');
  if (error) throw error;
  return data as Contestant[];
};

export const fetchAllContestants = async (): Promise<Contestant[]> => {
  const { data, error } = await supabase
    .from('contestants')
    .select('*')
    .order('division')
    .order('number');
  if (error) throw error;
  return data as Contestant[];
};

export const fetchJudges = async (): Promise<Judge[]> => {
  const { data, error } = await supabase.from('judges').select('*').order('division');
  if (error) throw error;
  return data as Judge[];
};

export const updateJudge = async (
  id: string,
  payload: Partial<Pick<Judge, 'full_name' | 'email' | 'username' | 'division'>>
) => {
  const { data, error } = await supabase
    .from('judges')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Judge;
};

export const deleteJudge = async (id: string) => {
  // First, fetch the judge's email before deleting
  const { data: judge, error: fetchError } = await supabase
    .from('judges')
    .select('email')
    .eq('id', id)
    .single();

  if (fetchError) throw fetchError;

  // Clean up related data first to avoid FK conflicts
  // (even though FKs are set to cascade, explicit deletes prevent conflicts if any cascades are missing)
  await supabase.from('judge_category_locks').delete().eq('judge_id', id);
  await supabase.from('scores').delete().eq('judge_id', id);

  // Delete from judges table
  const { error } = await supabase.from('judges').delete().eq('id', id);
  if (error) throw error;

  // Delete authentication user via Edge Function
  if (judge?.email) {
    try {
      const { error: functionError } = await supabase.functions.invoke('delete-auth-users', {
        body: { emails: [judge.email] }
      });

      if (functionError) {
        console.error('Failed to delete auth user:', functionError);
        // Don't throw - judge record is already deleted, but log the error
      }
    } catch (error) {
      console.error('Error calling delete-auth-users function:', error);
      // Don't throw - judge record is already deleted
    }
  }

  return true;
};

export const logActivity = async (activity: {
  user_id?: string;
  user_type: 'judge' | 'admin';
  user_name: string;
  action_type: ActivityLog['action_type'];
  entity_type?: string;
  entity_id?: string;
  description: string;
  metadata?: Record<string, any>;
}) => {
  const { data: user } = await supabase.auth.getUser();
  const { error } = await supabase.from('activity_log').insert({
    ...activity,
    user_id: activity.user_id || user.user?.id
  });
  if (error) {
    console.error('Failed to log activity:', error);
    // Don't throw - activity logging should not break the main flow
  }
};

export const clearActivityLog = async () => {
  // Supabase requires a filter for deletes; use a non-restrictive filter that keeps type integrity.
  // Delete all rows by ensuring id IS NOT NULL (valid for uuid column).
  const { error } = await supabase.from('activity_log').delete().not('id', 'is', null);
  if (error) throw error;
};

export const updateJudgeLastActive = async (judgeId: string) => {
  const { error } = await supabase
    .from('judges')
    .update({ last_active: new Date().toISOString() })
    .eq('id', judgeId);
  if (error) {
    console.error('Failed to update judge last active:', error);
  }
};

export const upsertScores = async (payload: ScorePayload[]) => {
  const { error } = await supabase.from('scores').upsert(payload, {
    onConflict: 'judge_id,contestant_id,criterion_id'
  });
  if (error) throw error;

  // Log activity for score submission
  if (payload.length > 0) {
    const firstScore = payload[0];
    const { data: judge } = await supabase
      .from('judges')
      .select('full_name')
      .eq('id', firstScore.judge_id)
      .single();
    const { data: contestant } = await supabase
      .from('contestants')
      .select('full_name, number')
      .eq('id', firstScore.contestant_id)
      .single();
    const { data: category } = await supabase
      .from('categories')
      .select('label')
      .eq('id', firstScore.category_id)
      .single();

    await logActivity({
      user_id: firstScore.judge_id,
      user_type: 'judge',
      user_name: judge?.full_name || 'Unknown Judge',
      action_type: 'score_submitted',
      entity_type: 'score',
      description: `Submitted scores for ${contestant?.full_name || 'Contestant'} in ${category?.label || 'Category'}`,
      metadata: {
        contestant_id: firstScore.contestant_id,
        contestant_name: contestant?.full_name,
        contestant_number: contestant?.number,
        category_id: firstScore.category_id,
        category_label: category?.label,
        criteria_count: payload.length
      }
    });

    // Update judge last active
    await updateJudgeLastActive(firstScore.judge_id);
  }

  // Keep materialized leaderboard views in sync so rankings update in near real-time.
  // This pageant has a small dataset, so refreshing on each scoring submission is acceptable.
  const { error: refreshError } = await supabase.rpc('refresh_leaderboards');
  if (refreshError) {
    // Log but do not block the judge's scoring flow if refresh fails.
    console.warn('Failed to refresh leaderboards', refreshError);
  }

  return true;
};

export const fetchLeaderboard = async (
  division: Division
): Promise<LeaderboardRow[]> => {
  const { data, error } = await supabase
    .from('leaderboard')
    .select('contestant_id, division, total_score, rank')
    .eq('division', division);
  if (error) throw error;

  const contestantIds = data.map((row) => row.contestant_id);
  const { data: contestants, error: cErr } = await supabase
    .from('contestants')
    .select('id, full_name, number')
    .in('id', contestantIds);
  if (cErr) throw cErr;

  const map = new Map(contestants.map((c) => [c.id, c]));

  return data.map((row) => ({
    ...row,
    ...map.get(row.contestant_id)
  })) as LeaderboardRow[];
};

export const lockSubmission = async (
  judgeId: string,
  categoryId: string,
  contestantId: string
) => {
  const { error } = await supabase.from('judge_category_locks').upsert(
    {
      judge_id: judgeId,
      category_id: categoryId,
      contestant_id: contestantId
    },
    { onConflict: 'judge_id,category_id,contestant_id' }
  );
  if (error) throw error;

  // Log activity
  const { data: judge } = await supabase
    .from('judges')
    .select('full_name')
    .eq('id', judgeId)
    .single();
  const { data: contestant } = await supabase
    .from('contestants')
    .select('full_name, number')
    .eq('id', contestantId)
    .single();
  const { data: category } = await supabase
    .from('categories')
    .select('label')
    .eq('id', categoryId)
    .single();

  await logActivity({
    user_id: judgeId,
    user_type: 'judge',
    user_name: judge?.full_name || 'Unknown Judge',
    action_type: 'lock_created',
    entity_type: 'lock',
    description: `Locked submission for ${contestant?.full_name || 'Contestant'} in ${category?.label || 'Category'}`,
    metadata: {
      contestant_id: contestantId,
      contestant_name: contestant?.full_name,
      contestant_number: contestant?.number,
      category_id: categoryId,
      category_label: category?.label
    }
  });

  return true;
};

export const isCategoryLocked = async (
  judgeId: string,
  categoryId: string,
  contestantId: string
) => {
  const { data, error } = await supabase
    .from('judge_category_locks')
    .select('id')
    .eq('judge_id', judgeId)
    .eq('category_id', categoryId)
    .eq('contestant_id', contestantId)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') throw error;
  return Boolean(data);
};

export const fetchLocksForCategory = async (
  judgeId: string,
  categoryId: string
): Promise<{ contestant_id: string }[]> => {
  const { data, error } = await supabase
    .from('judge_category_locks')
    .select('contestant_id')
    .eq('judge_id', judgeId)
    .eq('category_id', categoryId);
  if (error) throw error;
  return data as { contestant_id: string }[];
};

export const fetchAllLocksForCategory = async (
  categoryId: string
): Promise<{ judge_id: string; contestant_id: string; judge_name: string }[]> => {
  const { data, error } = await supabase
    .from('judge_category_locks')
    .select(`
      judge_id,
      contestant_id,
      judges(full_name)
    `)
    .eq('category_id', categoryId);
  if (error) throw error;
  return (data as any[]).map((lock) => ({
    judge_id: lock.judge_id,
    contestant_id: lock.contestant_id,
    judge_name: (lock.judges as any)?.full_name ?? 'Unknown'
  }));
};

export const unlockSubmission = async (
  judgeId: string,
  categoryId: string,
  contestantId: string
) => {
  const { error } = await supabase
    .from('judge_category_locks')
    .delete()
    .eq('judge_id', judgeId)
    .eq('category_id', categoryId)
    .eq('contestant_id', contestantId);
  if (error) throw error;

  // Log activity
  const { data: judge } = await supabase
    .from('judges')
    .select('full_name')
    .eq('id', judgeId)
    .single();
  const { data: contestant } = await supabase
    .from('contestants')
    .select('full_name, number')
    .eq('id', contestantId)
    .single();
  const { data: category } = await supabase
    .from('categories')
    .select('label')
    .eq('id', categoryId)
    .single();

  await logActivity({
    user_type: 'admin',
    user_name: 'Admin',
    action_type: 'lock_removed',
    entity_type: 'lock',
    description: `Unlocked submission for ${contestant?.full_name || 'Contestant'} in ${category?.label || 'Category'}`,
    metadata: {
      judge_id: judgeId,
      judge_name: judge?.full_name,
      contestant_id: contestantId,
      contestant_name: contestant?.full_name,
      category_id: categoryId,
      category_label: category?.label
    }
  });

  return true;
};

export const fetchScoresForJudgeCategory = async (
  judgeId: string,
  categoryId: string
) => {
  const { data, error } = await supabase
    .from('scores')
    .select('contestant_id,criterion_id,raw_score')
    .eq('judge_id', judgeId)
    .eq('category_id', categoryId);
  if (error) throw error;
  return data as { contestant_id: string; criterion_id: string; raw_score: number }[];
};

export const fetchCategoryRankings = async (
  division: Division,
  categorySlug: string
): Promise<CategoryRankingRow[]> => {
  // Get category info
  const { data: category, error: catError } = await supabase
    .from('categories')
    .select('id, label')
    .eq('slug', categorySlug)
    .single();
  if (catError) throw catError;
  if (!category) return [];

  // Fetch all scores for this category
  const { data: scores, error: scoresError } = await supabase
    .from('scores')
    .select(`
      judge_id,
      contestant_id,
      weighted_score,
      contestants!inner(id, number, full_name, division)
    `)
    .eq('category_id', category.id);
  if (scoresError) throw scoresError;
  if (!scores || scores.length === 0) return [];

  // Filter by division
  const filteredScores = scores.filter((s: any) => s.contestants?.division === division);
  if (filteredScores.length === 0) return [];

  // Group scores by judge and contestant to get totals
  const judgeContestantTotals = new Map<string, Map<string, number>>(); // judgeId -> contestantId -> total
  const contestantInfo = new Map<string, { full_name: string; number: number }>();

  filteredScores.forEach((score: any) => {
    const judgeId = score.judge_id;
    const contestantId = score.contestant_id;
    
    if (!judgeContestantTotals.has(judgeId)) {
      judgeContestantTotals.set(judgeId, new Map());
    }
    const judgeMap = judgeContestantTotals.get(judgeId)!;
    judgeMap.set(contestantId, (judgeMap.get(contestantId) ?? 0) + score.weighted_score);
    
    if (!contestantInfo.has(contestantId)) {
      contestantInfo.set(contestantId, {
        full_name: score.contestants.full_name,
        number: score.contestants.number
      });
    }
  });

  // Calculate per-judge ranks for each contestant
  const judgeRanks = new Map<string, Map<string, number>>(); // judgeId -> contestantId -> rank

  judgeContestantTotals.forEach((contestantTotals, judgeId) => {
    // Sort contestants by this judge's scores (descending)
    const sorted = Array.from(contestantTotals.entries())
      .sort((a, b) => b[1] - a[1]);
    
    // Assign ranks with tie handling (.5 for ties)
    const rankMap = new Map<string, number>();
    let i = 0;
    while (i < sorted.length) {
      const currentScore = sorted[i][1];
      let tieCount = 1;
      while (i + tieCount < sorted.length && sorted[i + tieCount][1] === currentScore) {
        tieCount++;
      }
      const avgRank = tieCount === 1 ? i + 1 : (2 * i + tieCount + 1) / 2;
      for (let j = 0; j < tieCount; j++) {
        rankMap.set(sorted[i + j][0], avgRank);
      }
      i += tieCount;
    }
    judgeRanks.set(judgeId, rankMap);
  });

  // Sum ranks for each contestant across all judges
  const contestantRankTotals = new Map<string, number>();
  contestantInfo.forEach((_, contestantId) => {
    let totalRankPoints = 0;
    judgeRanks.forEach((rankMap) => {
      const rank = rankMap.get(contestantId);
      if (rank !== undefined) {
        totalRankPoints += rank;
      }
    });
    contestantRankTotals.set(contestantId, totalRankPoints);
  });

  // Sort by total rank points (lowest = best) and assign final placement
  const sortedContestants = Array.from(contestantRankTotals.entries())
    .sort((a, b) => a[1] - b[1]);

  // Assign final placement with tie handling
  const results: CategoryRankingRow[] = [];
  let i = 0;
  while (i < sortedContestants.length) {
    const currentPoints = sortedContestants[i][1];
    let tieCount = 1;
    while (i + tieCount < sortedContestants.length && sortedContestants[i + tieCount][1] === currentPoints) {
      tieCount++;
    }
    const avgPlacement = tieCount === 1 ? i + 1 : (2 * i + tieCount + 1) / 2;
    
    for (let j = 0; j < tieCount; j++) {
      const [contestantId, totalPoints] = sortedContestants[i + j];
      const info = contestantInfo.get(contestantId)!;
      results.push({
        contestant_id: contestantId,
        full_name: info.full_name,
        number: info.number,
        division,
        category_id: category.id,
        category_slug: categorySlug as CategoryRankingRow['category_slug'],
        category_label: category.label,
        category_score: totalPoints, // Now this is total rank points (lower = better)
        rank: avgPlacement
      });
    }
    i += tieCount;
  }

  return results;
};

export const fetchOverallRankings = async (
  division: Division
): Promise<OverallRankingRow[]> => {
  const { data, error } = await supabase
    .from('overall_rankings')
    .select('*')
    .eq('division', division)
    .order('final_placement');
  if (error) throw error;
  return data as OverallRankingRow[];
};

export const createContestant = async (payload: {
  full_name: string;
  number: number;
  division: Division;
}) => {
  const { data, error } = await supabase
    .from('contestants')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as Contestant;
};

export const createJudge = async (payload: {
  full_name: string;
  email: string;
  username?: string;
  division: Division;
}) => {
  const { data, error } = await supabase
    .from('judges')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as Judge;
};

export const refreshLeaderboard = async () => {
  const { error } = await supabase.rpc('refresh_leaderboards');
  if (error) throw error;
  return true;
};

export const fetchScoresForExport = async () => {
  // Fetch scores with IDs
  const { data: scores, error: scoresError } = await supabase
    .from('scores')
    .select('judge_id, contestant_id, category_id, criterion_id, raw_score, weighted_score, created_at');
  
  if (scoresError) {
    console.error('Export scores error:', scoresError);
    throw scoresError;
  }
  
  if (!scores || scores.length === 0) {
    return [];
  }
  
  // Get unique IDs
  const judgeIds = [...new Set(scores.map((s: any) => s.judge_id))];
  const contestantIds = [...new Set(scores.map((s: any) => s.contestant_id))];
  const categoryIds = [...new Set(scores.map((s: any) => s.category_id))];
  const criterionIds = [...new Set(scores.map((s: any) => s.criterion_id))];
  
  // Fetch all related data
  const [judgesResult, contestantsResult, categoriesResult, criteriaResult] = await Promise.all([
    supabase.from('judges').select('id, full_name, email').in('id', judgeIds),
    supabase.from('contestants').select('id, full_name, number, division').in('id', contestantIds),
    supabase.from('categories').select('id, label, slug').in('id', categoryIds),
    supabase.from('criteria').select('id, label, slug').in('id', criterionIds)
  ]);
  
  if (judgesResult.error) throw judgesResult.error;
  if (contestantsResult.error) throw contestantsResult.error;
  if (categoriesResult.error) throw categoriesResult.error;
  if (criteriaResult.error) throw criteriaResult.error;
  
  // Create lookup maps
  const judgesMap = new Map((judgesResult.data || []).map((j: any) => [j.id, j]));
  const contestantsMap = new Map((contestantsResult.data || []).map((c: any) => [c.id, c]));
  const categoriesMap = new Map((categoriesResult.data || []).map((cat: any) => [cat.id, cat]));
  const criteriaMap = new Map((criteriaResult.data || []).map((crit: any) => [crit.id, crit]));
  
  // Transform scores to use names instead of IDs
  return (scores as any[]).map((row) => {
    const judge = judgesMap.get(row.judge_id);
    const contestant = contestantsMap.get(row.contestant_id);
    const category = categoriesMap.get(row.category_id);
    const criterion = criteriaMap.get(row.criterion_id);
    
    return {
      judge_name: judge?.full_name ?? 'Unknown',
      judge_email: judge?.email ?? '',
      contestant_name: contestant?.full_name ?? 'Unknown',
      contestant_number: contestant?.number ?? 0,
      contestant_division: contestant?.division ?? '',
      category_label: category?.label ?? 'Unknown',
      category_slug: category?.slug ?? '',
      criterion_label: criterion?.label ?? 'Unknown',
      criterion_slug: criterion?.slug ?? '',
      raw_score: row.raw_score,
      weighted_score: row.weighted_score,
      created_at: row.created_at
    };
  });
};

export interface CategoryScoreSummary {
  categoryId: string;
  categoryLabel: string;
  division: Division;
  contestants: {
    contestantId: string;
    candidateNumber: number;
    judgeScores: { judgeId: string; judgeName: string; totalScore: number }[];
    average: number;
    rank: number;
  }[];
  judges: { id: string; name: string }[];
  totals: {
    judgeTotals: { judgeId: string; total: number }[];
    overallAverage: number;
  };
}

export const fetchCategoryScoreSummary = async (
  categoryId: string,
  division: Division
): Promise<CategoryScoreSummary | null> => {
  // Fetch all scores for this category and division
  const { data: scores, error: scoresError } = await supabase
    .from('scores')
    .select(
      `
      judge_id,
      contestant_id,
      weighted_score,
      contestants!inner(id, number, division),
      judges!inner(id, full_name)
    `
    )
    .eq('category_id', categoryId);

  if (scoresError) throw scoresError;
  if (!scores || scores.length === 0) return null;

  // Filter by division
  const filteredScores = scores.filter((score: any) => score.contestants?.division === division);
  if (filteredScores.length === 0) return null;

  // Fetch category info
  const { data: category, error: catError } = await supabase
    .from('categories')
    .select('id, label')
    .eq('id', categoryId)
    .single();

  if (catError) throw catError;

  // Fetch all judges for this division
  const { data: judges, error: judgesError } = await supabase
    .from('judges')
    .select('id, full_name')
    .eq('division', division)
    .eq('is_active', true);

  if (judgesError) throw judgesError;

  // Group scores by contestant and judge
  const contestantMap = new Map<
    string,
    {
      contestantId: string;
      candidateNumber: number;
      judgeScores: Map<string, number>;
    }
  >();

  filteredScores.forEach((score: any) => {
    const contestantId = score.contestant_id;
    const judgeId = score.judge_id;
    const weightedScore = score.weighted_score;

    if (!contestantMap.has(contestantId)) {
      contestantMap.set(contestantId, {
        contestantId,
        candidateNumber: score.contestants.number,
        judgeScores: new Map()
      });
    }

    const contestant = contestantMap.get(contestantId)!;
    const currentTotal = contestant.judgeScores.get(judgeId) || 0;
    contestant.judgeScores.set(judgeId, currentTotal + weightedScore);
  });

  // Calculate totals per judge per contestant and averages
  const contestants = Array.from(contestantMap.values())
    .map((contestant) => {
      const judgeScores = Array.from(contestant.judgeScores.entries()).map(([judgeId, totalScore]) => {
        const judge = judges?.find((j) => j.id === judgeId);
        return {
          judgeId,
          judgeName: judge?.full_name || 'Unknown',
          totalScore: Number(totalScore.toFixed(2))
        };
      });

      // Calculate average across all judges
      const scores = Array.from(contestant.judgeScores.values());
      const average = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

      return {
        contestantId: contestant.contestantId,
        candidateNumber: contestant.candidateNumber,
        judgeScores,
        average: Number(average.toFixed(2)),
        rank: 0 // Will be set after sorting
      };
    })
    .sort((a, b) => b.average - a.average)
    .map((contestant, index) => ({
      ...contestant,
      rank: index + 1
    }));

  // Calculate totals per judge
  const judgeTotals = (judges || []).map((judge) => {
    const total = contestants.reduce((sum, contestant) => {
      const judgeScore = contestant.judgeScores.find((js) => js.judgeId === judge.id);
      return sum + (judgeScore?.totalScore || 0);
    }, 0);
    return {
      judgeId: judge.id,
      total: Number(total.toFixed(2))
    };
  });

  // Calculate overall average
  const overallAverage =
    judgeTotals.length > 0
      ? judgeTotals.reduce((sum, jt) => sum + jt.total, 0) / judgeTotals.length
      : 0;

  return {
    categoryId: category.id,
    categoryLabel: category.label,
    division,
    contestants,
    judges: (judges || []).map((j) => ({ id: j.id, name: j.full_name })),
    totals: {
      judgeTotals,
      overallAverage: Number(overallAverage.toFixed(2))
    }
  };
};

export const resetSystem = async () => {
  // Delete score_history and activity_log first to avoid trigger issues during score deletion
  const { error: historyError } = await supabase.from('score_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (historyError) {
    console.warn('Failed to delete score history:', historyError);
    // Continue anyway - this is not critical
  }

  const { error: activityError } = await supabase.from('activity_log').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (activityError) {
    console.warn('Failed to delete activity log:', activityError);
    // Continue anyway - this is not critical
  }

  // Delete all database records
  // Delete in order to respect foreign key constraints
  const deleteOperations = [
    supabase.from('scores').delete().neq('id', '00000000-0000-0000-0000-000000000000'), // Delete all
    supabase.from('judge_category_locks').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    supabase.from('computed_scores').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    supabase.from('final_rankings').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    supabase.from('contestants').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    supabase.from('judges').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  ];

  for (const operation of deleteOperations) {
    const { error } = await operation;
    if (error) throw error;
  }

  // Refresh materialized views
  const { error: refreshError } = await supabase.rpc('refresh_leaderboards');
  if (refreshError) {
    console.warn('Failed to refresh leaderboards', refreshError);
  }

  // Delete authentication users via Edge Function
  // The function will delete all users except admin
  try {
    const { data, error: functionError } = await supabase.functions.invoke('delete-auth-users', {
      body: {} // No need to pass emails, function deletes all non-admin users
    });

    if (functionError) {
      console.error('Failed to delete auth users:', functionError);
      throw new Error(`Failed to delete auth users: ${functionError.message}`);
    } else {
      console.log('Auth users deleted:', data);
    }
  } catch (error) {
    console.error('Error calling delete-auth-users function:', error);
    throw error; // Re-throw so user knows if auth deletion failed
  }

  // Log system reset activity
  const { data: user } = await supabase.auth.getUser();
  await logActivity({
    user_id: user.user?.id,
    user_type: 'admin',
    user_name: 'Admin',
    action_type: 'system_reset',
    description: 'System reset - all data cleared',
    metadata: {}
  });

  return true;
};

// Fetch activity log
export const fetchActivityLog = async (limit: number = 50): Promise<ActivityLog[]> => {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as ActivityLog[];
};

// Fetch score history for a specific score
export const fetchScoreHistory = async (scoreId: string): Promise<ScoreHistory[]> => {
  const { data, error } = await supabase
    .from('score_history')
    .select('*')
    .eq('score_id', scoreId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as ScoreHistory[];
};

// Fetch judges with status (last_active)
export const fetchJudgesWithStatus = async (): Promise<(Judge & { last_active?: string })[]> => {
  const { data, error } = await supabase
    .from('judges')
    .select('id, full_name, email, username, division, last_active')
    .order('division');
  if (error) throw error;
  return data as (Judge & { last_active?: string })[];
};


