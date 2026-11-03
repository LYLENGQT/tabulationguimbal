import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useSpring } from 'framer-motion';
import { Calculator, Lock, MonitorPlay, PenLine } from 'lucide-react';

const STEPS = [
  {
    icon: PenLine,
    title: 'Judges score',
    body: 'Each judge rates every contestant, criterion by criterion, from their own seat.'
  },
  {
    icon: Lock,
    title: 'Scores lock',
    body: 'When a judge submits a round, those scores are locked against edits.'
  },
  {
    icon: Calculator,
    title: 'Totals compute',
    body: 'Weighted averages and rankings update the moment scores arrive.'
  },
  {
    icon: MonitorPlay,
    title: 'The stage sees it',
    body: 'Rankings go up on the live display, with Mr and Miss ranked separately.'
  }
];

// The gold line fills as the section scrolls past, tracing a score's path.
export function ScoreJourney() {
  const reduce = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.85', 'end 0.55'] });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });
  const fill = reduce ? 1 : progress;

  return (
    <section aria-labelledby="journey-title" className="relative border-y border-stage-line/70 bg-stage-velvet/40 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
        <h2
          id="journey-title"
          className="max-w-3xl font-crown text-3xl font-semibold leading-[1.1] text-stage-ivory sm:text-5xl"
        >
          From the judges&rsquo; table to the big screen.
        </h2>

        <div ref={ref} className="relative mt-14 lg:mt-20">
          {/* Horizontal track (desktop) */}
          <div aria-hidden className="absolute left-6 right-6 top-6 hidden h-px bg-stage-line lg:block" />
          <motion.div
            aria-hidden
            style={{ scaleX: fill }}
            className="absolute left-6 right-6 top-6 hidden h-px origin-left bg-stage-gold lg:block"
          />
          {/* Vertical track (mobile) */}
          <div aria-hidden className="absolute bottom-6 left-6 top-6 w-px bg-stage-line lg:hidden" />
          <motion.div
            aria-hidden
            style={{ scaleY: fill }}
            className="absolute bottom-6 left-6 top-6 w-px origin-top bg-stage-gold lg:hidden"
          />

          <ol className="relative grid gap-12 lg:grid-cols-4 lg:gap-8">
            {STEPS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-6 lg:flex-col lg:gap-8">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-stage-night ring-1 ring-inset ring-stage-gold/50">
                  <Icon className="h-5 w-5 text-stage-gold" aria-hidden />
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-stage-ivory">{title}</h3>
                  <p className="mt-2 max-w-[32ch] text-base leading-relaxed text-stage-muted">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
