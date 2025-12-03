import { create } from 'zustand';
import type { Category, Contestant, Division, Judge } from '../types/scoring';

type State = {
  judge: Judge | null;
  division: Division | null;
  categories: Category[];
  contestants: Contestant[];
};

type Actions = {
  setJudge: (judge: Judge | null) => void;
  setDivision: (division: Division | null) => void;
  setCategories: (categories: Category[]) => void;
  setContestants: (contestants: Contestant[]) => void;
};

export const useScoringStore = create<State & Actions>((set) => ({
  judge: null,
  division: null,
  categories: [],
  contestants: [],
  setJudge: (judge) => set({ judge, division: judge?.division ?? null }),
  setDivision: (division) => set({ division }),
  setCategories: (categories) => set({ categories }),
  setContestants: (contestants) => set({ contestants })
}));


