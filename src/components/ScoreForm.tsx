import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Criterion } from '../types/scoring';
import { Button } from './ui/button';

type Props = {
  criteria: Criterion[];
  isLocked?: boolean;
  isSubmitting?: boolean;
  onSubmit: (values: Record<string, number>) => Promise<void>;
};

export function ScoreForm({ criteria, isLocked, isSubmitting, onSubmit }: Props) {
  const schema = useMemo(
    () =>
      z.object(
        criteria.reduce(
          (shape, criterion) => {
            const max = Math.round(criterion.percentage * 100);
            return {
              ...shape,
              [criterion.id]: z
                .string()
                .min(1, 'Required')
                .transform((value) => Number(value))
                .refine((val) => val >= 0 && val <= max, {
                  message: `Score must be between 0 and ${max}`
                })
            };
          },
          {} as Record<string, z.ZodTypeAny>
        )
      ),
    [criteria]
  );

  const form = useForm<Record<string, string>>({
    defaultValues: criteria.reduce(
      (acc, criterion) => ({
        ...acc,
        [criterion.id]: ''
      }),
      {}
    ),
    resolver: zodResolver(schema)
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    const numericValues = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, Number(value)])
    );
    await onSubmit(numericValues);
    form.reset();
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4">
        {criteria.map((criterion) => (
          <div
            key={criterion.id}
            className="rounded-lg border border-slate-800 bg-slate-900/40 p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{criterion.label}</p>
                <p className="text-xs text-slate-400">
                  Weight: {(criterion.percentage * 100).toFixed(0)}%
                </p>
              </div>
              <input
                type="number"
                step="0.1"
                min={0}
                max={Math.round(criterion.percentage * 100)}
                disabled={isLocked}
                className="w-28 rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-right text-sm focus:border-slate-500 focus:outline-none"
                {...form.register(criterion.id)}
              />
            </div>
            {form.formState.errors[criterion.id] && (
              <p className="mt-2 text-xs text-red-400">
                {form.formState.errors[criterion.id]?.message as string}
              </p>
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={isLocked || isSubmitting}>
          {isLocked ? 'Locked' : isSubmitting ? 'Saving…' : 'Submit Scores'}
        </Button>
      </div>
    </form>
  );
}


