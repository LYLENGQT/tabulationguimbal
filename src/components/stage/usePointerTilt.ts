import type { PointerEvent } from 'react';
import { useMotionValue, useReducedMotion } from 'framer-motion';

/**
 * Tracks the mouse over an area as -0.5..0.5 motion values (never React state,
 * so pointer movement causes zero re-renders). Touch and reduced-motion users get 0.
 */
export function usePointerTilt() {
  const reduce = useReducedMotion() ?? false;
  const px = useMotionValue(0);
  const py = useMotionValue(0);

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    if (reduce || e.pointerType !== 'mouse') return;
    const rect = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - rect.left) / rect.width - 0.5);
    py.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const onPointerLeave = () => {
    px.set(0);
    py.set(0);
  };

  return { px, py, bind: { onPointerMove, onPointerLeave } };
}
