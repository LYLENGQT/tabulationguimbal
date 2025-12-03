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
      'inline-flex h-11 items-center gap-1 rounded-2xl bg-white/[0.04] p-1 backdrop-blur-sm',
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
      'inline-flex min-w-[100px] items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-slate-400 transition-all duration-200 hover:text-slate-200 focus-visible:outline-none data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:shadow-sm',
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

