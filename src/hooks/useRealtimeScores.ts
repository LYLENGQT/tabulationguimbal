import { useEffect } from 'react';
import { getSupabaseClient } from '../lib/supabaseClient';
import { useQueryClient } from '@tanstack/react-query';

export function useRealtimeScores() {
  const supabase = getSupabaseClient();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Subscribe to score changes
    const channel = supabase
      .channel('scores_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'scores'
        },
        () => {
          // Invalidate relevant queries to refetch data
          queryClient.invalidateQueries({ queryKey: ['scores'] });
          queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
          queryClient.invalidateQueries({ queryKey: ['category-summary'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'judge_category_locks'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['locks'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, queryClient]);
}
