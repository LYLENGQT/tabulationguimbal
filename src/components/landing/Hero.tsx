import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { PenLine, Radio } from 'lucide-react';
import { EASE_OUT, primaryButton, secondaryButton } from '../stage/tokens';
import { SpotlightCrest } from '../stage/SpotlightCrest';
import { usePointerTilt } from '../stage/usePointerTilt';

// One orchestrated entrance: the spotlight comes up, the crest resolves in it,
// then the headline rises line by line. Nothing loops afterwards.
const T = { eyebrow: 0.5, lines: 0.6, body: 0.95, ctas: 1.1 };

function HeadlineLine({ children, delay, reduce }: { children: ReactNode; delay: number; reduce: boolean }) {
  return (
    // pb reserve keeps descenders clear of the overflow mask
    <span className="block overflow-hidden pb-[0.12em]">
      <motion.span
        className="block"
        initial={reduce ? false : { y: '105%' }}
        animate={{ y: 0 }}
        transition={{ duration: 0.9, delay, ease: EASE_OUT }}
      >
        {children}
      </motion.span>
    </span>
  );
}

export function Hero() {
  const reduce = useReducedMotion() ?? false;
  const tilt = usePointerTilt();

  const fade = (delay: number) =>
    reduce
      ? { initial: false as const }
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.7, delay, ease: EASE_OUT }
        };

  return (
    <section
      {...tilt.bind}
      // bg must live inside the isolated group: blend modes only see backdrops in their own group
      className="relative isolate overflow-hidden bg-stage-night"
    >
      {/* Ambient sunset wash behind the crest */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(55%_45%_at_72%_58%,rgba(239,122,43,0.16),transparent_70%),radial-gradient(40%_30%_at_15%_10%,rgba(242,179,61,0.06),transparent_70%)]"
      />

      <div className="mx-auto grid min-h-[100dvh] max-w-7xl items-center gap-8 px-4 pb-14 pt-24 sm:px-6 lg:grid-cols-12 lg:gap-6 lg:px-10 lg:pb-16">
        <div className="order-2 lg:order-1 lg:col-span-6">
          <motion.p {...fade(T.eyebrow)} className="text-sm font-semibold text-stage-gold sm:text-base">
            Disyembre sa Guimbal 2025
          </motion.p>

          <h1 className="mt-4 font-crown text-[2.5rem] font-semibold leading-[1.05] text-stage-ivory sm:text-6xl lg:text-[4.4rem]">
            <HeadlineLine delay={T.lines} reduce={reduce}>
              Scored fairly.
            </HeadlineLine>
            <HeadlineLine delay={T.lines + 0.12} reduce={reduce}>
              Crowned live.
            </HeadlineLine>
          </h1>

          <motion.p
            {...fade(T.body)}
            className="mt-6 max-w-[46ch] text-base leading-relaxed text-stage-muted sm:text-lg"
          >
            Official tabulation for Mr &amp; Miss Teen Guimbal 2025. Judges score from their seats, and
            every total follows the official rubric.
          </motion.p>

          <motion.div {...fade(T.ctas)} className="mt-9 flex flex-wrap items-center gap-3">
            <Link to="/login" className={primaryButton}>
              <PenLine className="h-4 w-4" aria-hidden />
              Judge sign in
            </Link>
            <Link to="/live" className={secondaryButton}>
              <Radio className="h-4 w-4 text-stage-gold" aria-hidden />
              Watch live results
            </Link>
          </motion.div>
        </div>

        <div className="order-1 lg:order-2 lg:col-span-6">
          <SpotlightCrest
            px={tilt.px}
            py={tilt.py}
            className="mx-auto max-w-[220px] sm:max-w-[340px] lg:max-w-[540px]"
          />
        </div>
      </div>
    </section>
  );
}
