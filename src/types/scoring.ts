export type Division = 'male' | 'female';

export interface Category {
  id: string;
  slug: CategorySlug;
  label: string;
  weight: number;
  sort_order: number;
}

export interface Criterion {
  id: string;
  category_id: string;
  slug: CriterionSlug;
  label: string;
  percentage: number; // 0-1
  sort_order: number;
}

export type CategorySlug =
  | 'production'
  | 'runway'
  | 'streetwear'
  | 'free-speech'
  | 'formal'
  | 'interview';

export type CriterionSlug =
  | 'poise-bearing'
  | 'stage-deportment'
  | 'mastery'
  | 'audience-impact'
  | 'creativity'
  | 'personality'
  | 'costume'
  | 'projection'
  | 'beauty-physique'
  | 'content'
  | 'delivery'
  | 'theme'
  | 'respect'
  | 'fitness-style'
  | 'beauty-elegance'
  | 'wit'
  | 'poise';

export interface Judge {
  id: string;
  full_name: string;
  email?: string;
  username?: string;
  division: Division;
}

export interface Contestant {
  id: string;
  full_name: string;
  number: number;
  division: Division;
}

export interface ScorePayload {
  judge_id: string;
  contestant_id: string;
  category_id: string;
  criterion_id: string;
  raw_score: number;
  weighted_score: number;
}

export interface LeaderboardRow {
  contestant_id: string;
  full_name: string;
  number: number;
  division: Division;
  total_score: number;
  rank: number;
  tie_breaker?: number;
}

export interface CategoryRankingRow {
  contestant_id: string;
  full_name: string;
  number: number;
  division: Division;
  category_id: string;
  category_slug: CategorySlug;
  category_label: string;
  category_score: number;
  rank: number;
}

export interface OverallRankingRow {
  contestant_id: string;
  full_name: string;
  number: number;
  division: Division;
  total_points: number;
  final_placement: number;
}

export interface ActivityLog {
  id: string;
  user_id?: string;
  user_type: 'judge' | 'admin';
  user_name: string;
  action_type: 'score_submitted' | 'score_updated' | 'lock_created' | 'lock_removed' | 'judge_logged_in' | 'judge_logged_out' | 'contestant_created' | 'judge_created' | 'system_reset';
  entity_type?: string;
  entity_id?: string;
  description: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface ScoreHistory {
  id: string;
  score_id: string;
  judge_id: string;
  contestant_id: string;
  category_id: string;
  criterion_id: string;
  old_raw_score?: number;
  new_raw_score: number;
  old_weighted_score?: number;
  new_weighted_score: number;
  changed_by?: string;
  change_type: 'created' | 'updated' | 'deleted';
  created_at: string;
}


