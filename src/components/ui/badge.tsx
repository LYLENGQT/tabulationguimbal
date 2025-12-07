import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-white',
        success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-200',
        warning: 'bg-amber-100 text-amber-700 dark:bg-amber-400/20 dark:text-amber-200',
        danger: 'bg-rose-100 text-rose-700 dark:bg-rose-400/20 dark:text-rose-200'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

