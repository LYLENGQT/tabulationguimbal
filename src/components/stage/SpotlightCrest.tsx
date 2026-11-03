import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue
} from 'framer-motion';
import { EASE_OUT } from './tokens';

type Props = {
  /** Pointer position from usePointerTilt; omit for a still crest. */
  px?: MotionValue<number>;
  py?: MotionValue<number>;
  /** Seconds before the spotlight comes up. */
  delay?: number;
  className?: string;
};

/**
 * The pageant crest standing in a stage spotlight.
 *
 * IMPORTANT for callers: the crest JPG has a solid black field that is removed
 * with mix-blend-mode: screen. Blending only sees backdrops inside the nearest
 * isolated group, so the parent must paint its own dark background inside that
 * group (e.g. `relative isolate bg-stage-night`). Otherwise the black square shows.
 */
export function SpotlightCrest({ px, py, delay = 0, className = '' }: Props) {
  const reduce = useReducedMotion() ?? false;
  const still = useMotionValue(0);
  const spring = { stiffness: 90, damping: 18, mass: 0.6 };
  const sx = useSpring(px ?? still, spring);
  const sy = useSpring(py ?? still, spring);
  const rotateY = useTransform(sx, [-0.5, 0.5], [-9, 9]);
  const rotateX = useTransform(sy, [-0.5, 0.5], [7, -7]);
  const beamX = useTransform(sx, [-0.5, 0.5], ['-7%', '7%']);
  const glowX = useTransform(sx, [-0.5, 0.5], ['-4%', '4%']);
  const crestAt = delay + 0.25;

  return (
    <div className={`relative aspect-square w-full ${className}`}>
      <motion.div
        aria-hidden
        style={{ x: glowX }}
        initial={reduce ? false : { opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.6, delay: crestAt, ease: EASE_OUT }}
        className="pointer-events-none absolute inset-[12%] rounded-full bg-[radial-gradient(circle,rgba(239,122,43,0.32),rgba(216,70,31,0.08)_55%,transparent_72%)] blur-2xl"
      />

      {/* Lit stage lip beneath the crest */}
      <motion.div
        aria-hidden
        initial={reduce ? false : { opacity: 0, scaleX: 0.4 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ duration: 1.2, delay: crestAt + 0.3, ease: EASE_OUT }}
        className="pointer-events-none absolute bottom-[1%] left-[14%] h-8 w-[72%] rounded-[50%] bg-stage-gold/25 blur-2xl"
      />

      {/* Flat screen-blended group: Chrome won't blend a 3D-transformed element directly */}
      <div className="relative h-full w-full mix-blend-screen" style={{ perspective: 1200 }}>
        <motion.img
          src="/mrmsteenlogo.jpg"
          alt="Mr & Ms Teen Guimbal 2025 crest: a gold crown above two silhouettes in a sunset arch"
          style={{ rotateX, rotateY }}
          initial={reduce ? false : { opacity: 0, scale: 0.94, filter: 'blur(14px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 1.3, delay: crestAt, ease: EASE_OUT }}
          className="h-full w-full select-none object-contain"
          draggable={false}
        />
      </div>

      <motion.div
        aria-hidden
        style={{ x: beamX }}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.4, delay, ease: EASE_OUT }}
        className="landing-beam pointer-events-none absolute -top-[20%] left-[4%] h-[105%] w-[92%]"
      />
    </div>
  );
}
