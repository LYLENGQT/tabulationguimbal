import { Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  text?: string;
  fullPage?: boolean;
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-10 w-10',
  xl: 'h-16 w-16'
};

const textSizeClasses = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
  xl: 'text-lg'
};

export function LoadingSpinner({ 
  size = 'md', 
  className, 
  text,
  fullPage = false 
}: LoadingSpinnerProps) {
  const spinner = (
    <div className={cn(
      'flex flex-col items-center justify-center gap-3',
      fullPage && 'min-h-[60vh]',
      className
    )}>
      <Loader2 
        className={cn(
          'animate-spin text-slate-400 dark:text-slate-500',
          sizeClasses[size]
        )} 
      />
      {text && (
        <p className={cn(
          'text-slate-500 dark:text-slate-400 animate-pulse',
          textSizeClasses[size]
        )}>
          {text}
        </p>
      )}
    </div>
  );

  return spinner;
}

// Skeleton loader for table rows
export function TableRowSkeleton({ columns = 3 }: { columns?: number }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full" />
        </td>
      ))}
    </tr>
  );
}

// Skeleton loader for cards
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn(
      'animate-pulse rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800',
      className
    )}>
      <div className="space-y-3">
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full" />
      </div>
    </div>
  );
}
