import type {
  Category,
  Criterion,
  LeaderboardRow,
  ScorePayload
} from '../types/scoring';

export const computeWeightedScore = (
  rawScore: number,
  criterion: Pick<Criterion, 'percentage'>
) => Number(rawScore.toFixed(3));

export const aggregateCategoryScore = (
  scores: Array<{ weightedScore: number }>
) => {
  const sum = scores.reduce((acc, curr) => acc + curr.weightedScore, 0);
  return Number(sum.toFixed(3));
};

export const averageJudgeScores = (
  judgeTotals: number[]
): number => {
  if (!judgeTotals.length) return 0;
  const avg = judgeTotals.reduce((acc, val) => acc + val, 0) / judgeTotals.length;
  return Number(avg.toFixed(3));
};

export const computeContestantTotal = (
  categoryAverages: Record<string, number>,
  categories: Category[]
) => {
  const total = categories.reduce((acc, category) => {
    const categoryAvg = categoryAverages[category.id] ?? 0;
    return acc + categoryAvg * category.weight;
  }, 0);
  return Number(total.toFixed(3));
};

export const sortLeaderboard = (rows: LeaderboardRow[]) =>
  [...rows].sort((a, b) => {
    if (b.total_score !== a.total_score) {
      return b.total_score - a.total_score;
    }
    if ((b.tie_breaker ?? 0) !== (a.tie_breaker ?? 0)) {
      return (b.tie_breaker ?? 0) - (a.tie_breaker ?? 0);
    }
    return a.number - b.number;
  });

export const mapScoresToPayload = (args: {
  judgeId: string;
  contestantId: string;
  categoryId: string;
  formData: Record<string, number>;
  criteria: Criterion[];
}): ScorePayload[] => {
  const { judgeId, contestantId, categoryId, formData, criteria } = args;
  return criteria.map((criterion) => ({
    judge_id: judgeId,
    contestant_id: contestantId,
    category_id: categoryId,
    criterion_id: criterion.id,
    raw_score: Number(formData[criterion.id] ?? 0),
    weighted_score: computeWeightedScore(
      Number(formData[criterion.id] ?? 0),
      criterion
    )
  }));
};


