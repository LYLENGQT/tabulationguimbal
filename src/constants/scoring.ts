import type { CategorySlug, Criterion, CriterionSlug } from '../types/scoring';

type CategorySeed = {
  slug: CategorySlug;
  label: string;
  weight: number;
  criteria: Array<{
    slug: CriterionSlug;
    label: string;
    percentage: number;
  }>;
};

export const CATEGORY_CONFIG: CategorySeed[] = [
  {
    slug: 'production',
    label: 'Production Number',
    weight: 1,
    criteria: [
      { slug: 'poise-bearing', label: 'Poise and Bearing', percentage: 0.3 },
      { slug: 'stage-deportment', label: 'Stage Deportment', percentage: 0.35 },
      {
        slug: 'mastery',
        label: 'Mastery of the Choreography',
        percentage: 0.3
      },
      { slug: 'audience-impact', label: 'Audience Impact', percentage: 0.05 }
    ]
  },
  {
    slug: 'runway',
    label: 'Runway',
    weight: 1,
    criteria: [
      { slug: 'creativity', label: 'Creativity and Style', percentage: 0.3 },
      {
        slug: 'personality',
        label: 'Personality and Stage Presence',
        percentage: 0.2
      },
      {
        slug: 'costume',
        label: 'Suitability of the Costume',
        percentage: 0.3
      },
      {
        slug: 'projection',
        label: 'Poise, Bearing, and Projection',
        percentage: 0.2
      }
    ]
  },
  {
    slug: 'streetwear',
    label: 'Street Wear',
    weight: 1,
    criteria: [
      {
        slug: 'beauty-physique',
        label: 'Beauty and Physique',
        percentage: 0.3
      },
      { slug: 'stage-deportment', label: 'Stage Deportment', percentage: 0.3 },
      { slug: 'poise-bearing', label: 'Poise and Bearing', percentage: 0.3 },
      { slug: 'audience-impact', label: 'Audience Impact', percentage: 0.1 }
    ]
  },
  {
    slug: 'free-speech',
    label: 'Free Speech',
    weight: 1,
    criteria: [
      { slug: 'content', label: 'Content & Substance', percentage: 0.4 },
      { slug: 'delivery', label: 'Delivery & Presence', percentage: 0.3 },
      {
        slug: 'theme',
        label: 'Alignment to “Ascend” Theme',
        percentage: 0.2
      },
      {
        slug: 'respect',
        label: 'Respectfulness & Positivity',
        percentage: 0.1
      }
    ]
  },
  {
    slug: 'formal',
    label: 'Modern Barong & Long Gown',
    weight: 1,
    criteria: [
      { slug: 'fitness-style', label: 'Fitness and Style', percentage: 0.2 },
      {
        slug: 'beauty-elegance',
        label: 'Beauty and Elegance',
        percentage: 0.3
      },
      { slug: 'stage-deportment', label: 'Stage Deportment', percentage: 0.25 },
      {
        slug: 'projection',
        label: 'Poise, Bearing, and Projection',
        percentage: 0.25
      }
    ]
  },
  {
    slug: 'interview',
    label: 'Interview',
    weight: 1,
    criteria: [
      { slug: 'wit', label: 'Wit and Content', percentage: 0.5 },
      {
        slug: 'delivery',
        label: 'Delivery & Choice of Words',
        percentage: 0.25
      },
      { slug: 'poise', label: 'Poise and Bearing', percentage: 0.15 },
      { slug: 'audience-impact', label: 'Audience Impact', percentage: 0.1 }
    ]
  }
];

export const fallbackCriteria = (): Criterion[] =>
  CATEGORY_CONFIG.flatMap((category, idx) =>
    category.criteria.map((criterion, cIdx) => ({
      id: `${category.slug}-${criterion.slug}`,
      category_id: category.slug,
      slug: criterion.slug,
      label: criterion.label,
      percentage: criterion.percentage,
      sort_order: cIdx + 1
    }))
  );


