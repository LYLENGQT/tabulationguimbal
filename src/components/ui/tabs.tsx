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
      'inline-flex h-12 items-center gap-2 rounded-full bg-white/5 p-1 backdrop-blur',
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
      'inline-flex min-w-[120px] items-center justify-center rounded-full px-4 text-sm font-medium text-slate-300 transition-all focus-visible:outline-none data-[state=active]:bg-white data-[state=active]:text-slate-900',
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

