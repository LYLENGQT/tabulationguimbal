import { useEffect, useState } from 'react';
import { getSupabaseClient } from '../lib/supabaseClient';
import type { ActivityLog } from '../types/scoring';

export function useRealtimeActivity(onNewActivity?: (activity: ActivityLog) => void) {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const supabase = getSupabaseClient();

  useEffect(() => {
    // Fetch initial activities
    const fetchInitial = async () => {
      const { data, error } = await supabase
        .from('activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (!error && data) {
        setActivities(data as ActivityLog[]);
      }
    };

    fetchInitial();

    // Subscribe to new activities
    const channel = supabase
      .channel('activity_log_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_log'
        },
        (payload) => {
          const newActivity = payload.new as ActivityLog;
          setActivities((prev) => [newActivity, ...prev].slice(0, 50));
          if (onNewActivity) {
            onNewActivity(newActivity);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, onNewActivity]);

  return activities;
}
