import { Activity, Lock, Save, User, Unlock, RotateCcw, UserPlus, Crown } from 'lucide-react';
import type { ActivityLog } from '../types/scoring';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

interface ActivityFeedProps {
  activities: ActivityLog[];
  maxHeight?: string;
  onClear?: () => void;
  clearing?: boolean;
  className?: string;
}

const actionIcons: Record<ActivityLog['action_type'], typeof Activity> = {
  score_submitted: Save,
  score_updated: Save,
  lock_created: Lock,
  lock_removed: Unlock,
  judge_logged_in: User,
  judge_logged_out: User,
  contestant_created: UserPlus,
  judge_created: UserPlus,
  system_reset: RotateCcw
};

const actionColors: Record<ActivityLog['action_type'], string> = {
  score_submitted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  score_updated: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  lock_created: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  lock_removed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  judge_logged_in: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  judge_logged_out: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  contestant_created: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  judge_created: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  system_reset: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
};

const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  
  // Get date parts for comparison (ignoring time)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const activityDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const timeStr = date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit'
  });
  
  if (activityDate.getTime() === today.getTime()) {
    return `Today, ${timeStr}`;
  } else if (activityDate.getTime() === yesterday.getTime()) {
    return `Yesterday, ${timeStr}`;
  } else {
    // Format as MM-DD-YYYY
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}-${day}-${year}, ${timeStr}`;
  }
};

const formatActionLabel = (action: ActivityLog['action_type']) =>
  action
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

export function ActivityFeed({ activities, maxHeight = '70vh', onClear, clearing, className }: ActivityFeedProps) {
  if (activities.length === 0) {
    return (
      <Card className={`flex flex-col ${className || ''}`}>
        <CardHeader className="px-3 py-3 sm:px-6 sm:py-4">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <Activity className="h-4 w-4 sm:h-5 sm:w-5" />
            Activity Feed
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 sm:px-6 sm:pb-6 flex-1 flex items-center justify-center">
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 text-center py-4 sm:py-8">
            No activities yet. Activity will appear here as judges submit scores.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`flex flex-col ${className || ''}`}>
      <CardHeader className="px-3 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-2">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <Activity className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="hidden sm:inline">Activity Feed</span>
            <span className="sm:hidden">Activity</span>
            <Badge className="ml-1 sm:ml-auto border border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 text-[10px] sm:text-xs">
              {activities.length}
            </Badge>
          </CardTitle>
          {onClear && (
            <Button
              size="sm"
              variant="outline"
              onClick={onClear}
              disabled={clearing}
              className="ml-auto rounded-lg text-[10px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3"
            >
              {clearing ? 'Clearing…' : 'Clear'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3 sm:px-6 sm:pb-6 flex-1 overflow-hidden">
        <ScrollArea
          className="pr-1 sm:pr-2 h-full activity-scrollbar"
          style={{ maxHeight, overflowY: 'auto' }}
        >
          <div className="space-y-2 sm:space-y-3">
            {activities.map((activity) => {
              const Icon = actionIcons[activity.action_type];
              const colorClass = actionColors[activity.action_type];
              const timeLabel = formatTime(activity.created_at);

              return (
                <div
                  key={activity.id}
                  className="flex items-start gap-2 sm:gap-3 rounded-lg border border-slate-200 bg-white p-2 sm:p-3 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className={`flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-full flex-shrink-0 ${colorClass}`}>
                    <Icon className="h-3 w-3 sm:h-4 sm:w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-0.5 sm:mb-1">
                      <span className="text-xs sm:text-sm font-medium text-slate-900 dark:text-white truncate max-w-[100px] sm:max-w-none">
                        {activity.user_name}
                      </span>
                      {activity.user_type === 'admin' && (
                        <Crown className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-amber-500 flex-shrink-0" />
                      )}
                      <Badge className="text-[8px] sm:text-xs border border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 px-1 sm:px-1.5">
                        {formatActionLabel(activity.action_type)}
                      </Badge>
                    </div>
                    <p className="text-[10px] sm:text-sm text-slate-600 dark:text-slate-300 line-clamp-2">{activity.description}</p>
                    {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                      <div className="mt-0.5 sm:mt-1 text-[9px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
                        {activity.metadata.contestant_name && (
                          <span>Contestant: {activity.metadata.contestant_name}</span>
                        )}
                        {activity.metadata.category_label && (
                          <span className="ml-1 sm:ml-2">Cat: {activity.metadata.category_label}</span>
                        )}
                      </div>
                    )}
                    <p className="mt-0.5 sm:mt-1 text-[9px] sm:text-xs text-slate-400 dark:text-slate-500">{timeLabel}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
