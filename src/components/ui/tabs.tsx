import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '../../lib/utils';

const Tabs = TabsPrimitive.Root;

const TabsList = TabsPrimitive.TabsList;

const TabsTrigger = TabsPrimitive.Trigger;

const ModernTabsList = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsList>) => (
  <TabsList
    className={cn(
      'inline-flex h-11 items-center gap-1 rounded-2xl bg-slate-100 p-1 backdrop-blur-sm dark:bg-white/[0.04]',
      className
    )}
    {...props}
  />
);

const ModernTabsTrigger = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsTrigger>) => (
  <TabsTrigger
    className={cn(
      'inline-flex min-w-[100px] items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition-all duration-200 hover:text-slate-900 focus-visible:outline-none data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm dark:text-slate-400 dark:hover:text-slate-200 dark:data-[state=active]:bg-white/10 dark:data-[state=active]:text-white',
      className
    )}
    {...props}
  />
);

const TabsContent = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>) => (
  <TabsPrimitive.Content
    className={cn('mt-6 focus-visible:outline-none', className)}
    {...props}
  />
);

export { Tabs, TabsContent, ModernTabsList as TabsList, ModernTabsTrigger as TabsTrigger };
