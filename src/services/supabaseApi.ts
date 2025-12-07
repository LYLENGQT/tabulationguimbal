import { getSupabaseClient } from '../lib/supabaseClient';
import type {
  Category,
  CategoryRankingRow,
  Contestant,
  Criterion,
  Division,
  Judge,
  LeaderboardRow,
  OverallRankingRow,
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
    division: Division;
  }) {
    const { email, password, full_name, division } = params;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name,
          division
        }
      }
    });
    if (error) throw error;
    return data;
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
    const { data, error } = await supabase
      .from('judges')
      .select('*')
      .eq('email', user.user.email ?? '')
      .single();
    if (error) {
      console.error(error);
      return null;
    }
    return data as Judge;
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
  payload: Partial<Pick<Judge, 'full_name' | 'email' | 'division' | 'is_active'>>
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
  const { error } = await supabase.from('judges').delete().eq('id', id);
  if (error) throw error;
  return true;
};

export const upsertScores = async (payload: ScorePayload[]) => {
  const { error } = await supabase.from('scores').upsert(payload, {
    onConflict: 'judge_id,contestant_id,criterion_id'
  });
  if (error) throw error;

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
  const { data, error } = await supabase
    .from('category_rankings')
    .select('*')
    .eq('division', division)
    .eq('category_slug', categorySlug)
    .order('rank');
  if (error) throw error;
  return data as CategoryRankingRow[];
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
  const { data, error } = await supabase
    .from('scores')
    .select('judge_id,contestant_id,category_id,criterion_id,raw_score,weighted_score,created_at');
  if (error) throw error;
  return data;
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
  // Fetch all judges before deletion to get their emails
  const { data: judges, error: judgesError } = await supabase
    .from('judges')
    .select('email');

  if (judgesError) throw judgesError;

  const judgeEmails = judges?.map((j) => j.email).filter(Boolean) || [];

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
  if (judgeEmails.length > 0) {
    try {
      const { data, error: functionError } = await supabase.functions.invoke('delete-auth-users', {
        body: { judgeEmails }
      });

      if (functionError) {
        console.error('Failed to delete auth users:', functionError);
        // Don't throw - database records are already deleted
      } else {
        console.log('Auth users deleted:', data);
      }
    } catch (error) {
      console.error('Error calling delete-auth-users function:', error);
      // Don't throw - database records are already deleted
    }
  }

  return true;
};


