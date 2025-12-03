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


