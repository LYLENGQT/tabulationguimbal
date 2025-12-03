import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabaseAuth } from '../services/supabaseApi';
import { useScoringStore } from '../store/useScoringStore';

export const useJudgeSession = () => {
  const setJudge = useScoringStore((state) => state.setJudge);

  const query = useQuery({
    queryKey: ['judge-profile'],
    queryFn: supabaseAuth.getUserJudge
  });

  useEffect(() => {
    if (query.data) {
      setJudge(query.data);
    }
  }, [query.data, setJudge]);

  return query;
};


