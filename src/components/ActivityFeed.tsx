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
  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit'
  });
};

const formatActionLabel = (action: ActivityLog['action_type']) =>
  action
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

export function ActivityFeed({ activities, maxHeight = '70vh', onClear, clearing }: ActivityFeedProps) {
  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Activity Feed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
            No activities yet. Activity will appear here as judges submit scores.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Activity Feed
            <Badge className="ml-auto border border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
              {activities.length}
            </Badge>
          </CardTitle>
          {onClear && (
            <Button
              size="sm"
              variant="outline"
              onClick={onClear}
              disabled={clearing}
              className="ml-auto rounded-lg"
            >
              {clearing ? 'Clearing…' : 'Clear feed'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea
          className="pr-2 max-h-[70vh] activity-scrollbar"
          style={{ maxHeight, overflowY: 'auto' }}
        >
          <div className="space-y-3">
            {activities.map((activity) => {
              const Icon = actionIcons[activity.action_type];
              const colorClass = actionColors[activity.action_type];
              const timeLabel = formatTime(activity.created_at);

              return (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full ${colorClass}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-slate-900 dark:text-white">
                        {activity.user_name}
                      </span>
                      {activity.user_type === 'admin' && (
                        <Crown className="h-3 w-3 text-amber-500" />
                      )}
                      <Badge className="text-xs border border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                        {formatActionLabel(activity.action_type)}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{activity.description}</p>
                    {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {activity.metadata.contestant_name && (
                          <span>Contestant: {activity.metadata.contestant_name}</span>
                        )}
                        {activity.metadata.category_label && (
                          <span className="ml-2">Category: {activity.metadata.category_label}</span>
                        )}
                      </div>
                    )}
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{timeLabel}</p>
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
