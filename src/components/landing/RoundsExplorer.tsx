import { useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CATEGORY_CONFIG } from '../../constants/scoring';
import { EASE_OUT, SUNSET_RAMP, focusRing } from '../stage/tokens';

// Shows the real rubric from src/constants/scoring.ts, the same weights the
// tabulation uses, so this section can never drift from the rulebook.
const COUNT_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
const roundCount = COUNT_WORDS[CATEGORY_CONFIG.length] ?? String(CATEGORY_CONFIG.length);
export function RoundsExplorer() {
  const reduce = useReducedMotion() ?? false;
  const [active, setActive] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const round = CATEGORY_CONFIG[active];

  const onTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const last = CATEGORY_CONFIG.length - 1;
    const moves: Record<string, number> = {
      ArrowDown: active === last ? 0 : active + 1,
      ArrowRight: active === last ? 0 : active + 1,
      ArrowUp: active === 0 ? last : active - 1,
      ArrowLeft: active === 0 ? last : active - 1,
      Home: 0,
      End: last
    };
    const next = moves[e.key];
    if (next === undefined) return;
    e.preventDefault();
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <section id="rounds" aria-labelledby="rounds-title" className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
        <h2
          id="rounds-title"
          className="max-w-3xl font-crown text-3xl font-semibold leading-[1.1] text-stage-ivory sm:text-5xl"
        >
          {roundCount} rounds, each weighted by the rulebook.
        </h2>
        <p className="mt-5 max-w-[60ch] text-base leading-relaxed text-stage-muted sm:text-lg">
          Choose a round to see how judges score it. These are the exact weights the system uses for
          every total.
        </p>

        <div className="mt-12 grid gap-6 lg:mt-16 lg:grid-cols-12 lg:gap-10">
          <div
            role="tablist"
            aria-label="Pageant rounds"
            aria-orientation="vertical"
            className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:col-span-4 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0"
          >
            {CATEGORY_CONFIG.map((c, i) => {
              const selected = i === active;
              return (
                <button
                  key={c.slug}
                  ref={(el) => (tabRefs.current[i] = el)}
                  role="tab"
                  id={`round-tab-${c.slug}`}
                  aria-selected={selected}
                  aria-controls="round-panel"
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActive(i)}
                  onKeyDown={onTabKeyDown}
                  className={`relative shrink-0 snap-start rounded-full px-5 py-3 text-left text-sm font-semibold transition-colors duration-200 sm:text-base ${focusRing} ${
                    selected ? 'text-stage-ivory' : 'text-stage-muted hover:text-stage-ivory'
                  }`}
                >
                  {selected && (
                    <motion.span
                      layoutId="round-highlight"
                      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 34 }}
                      className="absolute inset-0 rounded-full bg-stage-velvet ring-1 ring-inset ring-stage-gold/40"
                    />
                  )}
                  <span className="relative whitespace-nowrap">{c.label}</span>
                </button>
              );
            })}
          </div>

          <div
            role="tabpanel"
            id="round-panel"
            aria-labelledby={`round-tab-${round.slug}`}
            className="relative overflow-hidden rounded-3xl bg-stage-velvet p-6 ring-1 ring-inset ring-stage-line sm:p-10 lg:col-span-8"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-stage-sunset/10 blur-3xl"
            />
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={round.slug}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -6 }}
                transition={{ duration: 0.25, ease: EASE_OUT }}
                className="relative"
              >
                <h3 className="font-crown text-2xl font-semibold text-stage-ivory sm:text-4xl">
                  {round.label}
                </h3>

                {/* Proportional rubric bar: segment widths are the criterion weights */}
                <div
                  className="mt-8 flex h-3 gap-1"
                  role="img"
                  aria-label={round.criteria
                    .map((c) => `${c.label} ${Math.round(c.percentage * 100)} percent`)
                    .join(', ')}
                >
                  {round.criteria.map((c, i) => (
                    <motion.span
                      key={c.slug}
                      className="block h-full origin-left rounded-full"
                      style={{ flex: `${c.percentage} 1 0%`, backgroundColor: SUNSET_RAMP[i % SUNSET_RAMP.length] }}
                      initial={reduce ? false : { scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.6, delay: 0.08 + i * 0.07, ease: EASE_OUT }}
                    />
                  ))}
                </div>

                <dl className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2">
                  {round.criteria.map((c, i) => (
                    <div key={c.slug} className="flex items-start gap-4">
                      <span
                        aria-hidden
                        className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: SUNSET_RAMP[i % SUNSET_RAMP.length] }}
                      />
                      <div className="flex flex-col-reverse">
                        <dt className="mt-1 text-sm leading-snug text-stage-muted sm:text-base">{c.label}</dt>
                        <dd className="font-crown text-4xl font-semibold tabular-nums text-stage-ivory sm:text-5xl">
                          {Math.round(c.percentage * 100)}%
                        </dd>
                      </div>
                    </div>
                  ))}
                </dl>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
