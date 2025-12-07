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


