import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ChevronDown, Crown, Maximize, Minimize, WifiOff } from 'lucide-react';
import { fetchOverallRankings, fetchCategoryRankings } from '../services/supabaseApi';
import type { Division, CategorySlug } from '../types/scoring';
import { CATEGORY_CONFIG } from '../constants/scoring';
import { EASE_OUT, focusRing } from '../components/stage/tokens';

const REFRESH_MS = 3000;
const ROTATE_MS = 10_000;
const DIVISION_LABEL: Record<Division, string> = { male: 'Mr Teen', female: 'Miss Teen' };

type Mode = 'overall' | 'category';
type View = { division: Division; mode: Mode; category: CategorySlug };
type Ranked = { id: string; number: number; rank: number; points: number };

// Auto-rotate order: both overall boards, then every round for Mr then Miss.
const ROTATION: View[] = [
  { division: 'male', mode: 'overall', category: CATEGORY_CONFIG[0].slug },
  { division: 'female', mode: 'overall', category: CATEGORY_CONFIG[0].slug },
  ...CATEGORY_CONFIG.flatMap((c) =>
    (['male', 'female'] as Division[]).map((division) => ({ division, mode: 'category' as const, category: c.slug }))
  )
];

const sameView = (a: View, b: View) =>
  a.division === b.division && a.mode === b.mode && (a.mode === 'overall' || a.category === b.category);

const formatRank = (rank: number) => (rank % 1 !== 0 ? rank.toFixed(1) : rank.toString());
const formatPoints = (n: number) => Number(n.toFixed(2)).toString();
const candidateNo = (n: number) => n.toString().padStart(2, '0');

const placeTitle = (rank: number, division: Division) => {
  if (rank <= 1) return `${DIVISION_LABEL[division]} 2025`;
  if (rank <= 2) return '1st runner-up';
  if (rank <= 3) return '2nd runner-up';
  return null;
};

// Dev-only rehearsal data (`/live?demo`), stripped from production builds by import.meta.env.DEV.
function demoRows(view: View): Ranked[] {
  const numbers = view.division === 'male' ? [7, 3, 11, 1, 9, 5, 12, 2] : [4, 10, 6, 8, 1, 12, 3, 9];
  return numbers.map((number, i) => ({
    id: `demo-${view.division}-${number}`,
    number,
    rank: i + 1,
    points: Number((92.4 - i * 2.37 - (view.mode === 'category' ? 1.1 : 0)).toFixed(2))
  }));
}

function Segmented<T extends string>({
  name,
  options,
  value,
  onChange
}: {
  name: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  const reduce = useReducedMotion() ?? false;
  return (
    <div role="group" aria-label={name} className="flex rounded-full bg-stage-velvet p-1 ring-1 ring-inset ring-stage-line">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`relative h-8 rounded-full px-4 text-sm font-semibold transition-colors ${focusRing} ${
              active ? 'text-stage-night' : 'text-stage-muted hover:text-stage-ivory'
            }`}
          >
            {active && (
              <motion.span
                layoutId={`seg-${name}`}
                transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 36 }}
                className="absolute inset-0 rounded-full bg-stage-gold"
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function LiveStatus({ isError, updatedAt }: { isError: boolean; updatedAt: number }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-stage-velvet px-4 py-1.5 text-sm text-stage-muted ring-1 ring-inset ring-stage-line">
      {isError ? (
        <>
          <WifiOff className="h-4 w-4 text-stage-alert" aria-hidden />
          <span className="text-stage-alert">Reconnecting</span>
        </>
      ) : (
        <>
          <span className="relative flex h-2 w-2" aria-hidden>
            <span className="absolute inline-flex h-full w-full rounded-full bg-stage-gold opacity-75 motion-safe:animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-stage-gold" />
          </span>
          <span className="font-semibold text-stage-ivory">Live</span>
          {updatedAt > 0 && (
            <span>
              updated {new Date(updatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </>
      )}
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div aria-hidden className="motion-safe:animate-pulse">
      <div className="grid gap-4 md:grid-cols-3 md:items-end">
        <div className="h-56 rounded-3xl bg-stage-velvet md:order-1 md:h-[300px]" />
        <div className="h-64 rounded-3xl bg-stage-velvet md:order-2 md:h-[370px]" />
        <div className="h-52 rounded-3xl bg-stage-velvet md:order-3 md:h-[260px]" />
      </div>
      <div className="mt-6 flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 rounded-2xl bg-stage-velvet" />
        ))}
      </div>
    </div>
  );
}

function BoardMessage({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center py-20 text-center">
      {icon}
      <p className="mt-6 font-crown text-2xl font-semibold text-stage-ivory md:text-3xl">{title}</p>
      <p className="mt-3 max-w-[48ch] text-base leading-relaxed text-stage-muted md:text-lg">{body}</p>
    </div>
  );
}

export function LiveDisplayPage() {
  const reduce = useReducedMotion() ?? false;
  const [view, setView] = useState<View>(ROTATION[0]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const demo = import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo');

  // Advance from whatever view is showing, so manual picks and rotation mix cleanly.
  useEffect(() => {
    if (!autoRotate) return;
    const id = setInterval(() => {
      setView((cur) => ROTATION[(ROTATION.findIndex((v) => sameView(v, cur)) + 1) % ROTATION.length]);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [autoRotate]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => undefined);
    } else {
      document.exitFullscreen().catch(() => undefined);
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const overallQuery = useQuery({
    queryKey: ['live-overall', view.division],
    queryFn: () => fetchOverallRankings(view.division),
    refetchInterval: REFRESH_MS,
    enabled: !demo && view.mode === 'overall'
  });

  const categoryQuery = useQuery({
    queryKey: ['live-category', view.division, view.category],
    queryFn: () => fetchCategoryRankings(view.division, view.category),
    refetchInterval: REFRESH_MS,
    enabled: !demo && view.mode === 'category'
  });

  const active = view.mode === 'overall' ? overallQuery : categoryQuery;

  const rows: Ranked[] | undefined = useMemo(() => {
    if (demo) return demoRows(view);
    if (view.mode === 'overall') {
      return overallQuery.data?.map((r) => ({
        id: r.contestant_id,
        number: r.number,
        rank: r.final_placement,
        points: r.total_points
      }));
    }
    return categoryQuery.data?.map((r) => ({
      id: r.contestant_id,
      number: r.number,
      rank: r.rank,
      points: r.category_score
    }));
  }, [demo, view, overallQuery.data, categoryQuery.data]);

  const isLoading = !demo && active.isLoading;
  const isError = !demo && active.isError;
  const updatedAt = demo ? Date.now() : active.dataUpdatedAt;
  const categoryLabel = CATEGORY_CONFIG.find((c) => c.slug === view.category)?.label ?? '';
  const viewKey = `${view.division}-${view.mode}-${view.mode === 'category' ? view.category : 'all'}`;

  const top = rows?.slice(0, 3) ?? [];
  const rest = rows?.slice(3, 10) ?? [];
  const layoutTransition = reduce ? { duration: 0 } : { type: 'spring' as const, stiffness: 260, damping: 32 };

  // Podium sits 2nd, 1st, 3rd on wide screens; plain rank order when stacked.
  const podiumStyle = [
    'md:order-2 md:min-h-[370px] bg-[linear-gradient(180deg,rgba(242,179,61,0.2),rgba(26,18,13,0.92)_62%)] ring-stage-gold/55',
    'md:order-1 md:min-h-[300px] bg-stage-velvet ring-stage-line',
    'md:order-3 md:min-h-[260px] bg-stage-velvet ring-stage-line'
  ];

  return (
    // isolate + own bg so the winner's spotlight can screen-blend
    <div className="relative isolate min-h-[100dvh] overflow-hidden bg-stage-night font-stage text-stage-ivory antialiased">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(50%_40%_at_50%_45%,rgba(239,122,43,0.12),transparent_70%)]"
      />

      {!isFullscreen && (
        <div className="relative z-30 border-b border-stage-line/80 bg-stage-night/85 backdrop-blur-md md:sticky md:top-0">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
            <Link
              to="/"
              className={`inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-medium text-stage-muted transition-colors hover:text-stage-ivory ${focusRing}`}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Home
            </Link>

            <Segmented
              name="division"
              value={view.division}
              onChange={(division) => setView((v) => ({ ...v, division }))}
              options={[
                { value: 'male', label: 'Mr Teen' },
                { value: 'female', label: 'Miss Teen' }
              ]}
            />
            <Segmented
              name="board"
              value={view.mode}
              onChange={(mode) => setView((v) => ({ ...v, mode }))}
              options={[
                { value: 'overall', label: 'Overall' },
                { value: 'category', label: 'By round' }
              ]}
            />

            {view.mode === 'category' && (
              <label className="relative">
                <span className="sr-only">Round</span>
                <select
                  value={view.category}
                  onChange={(e) => setView((v) => ({ ...v, category: e.target.value as CategorySlug }))}
                  className={`h-10 appearance-none rounded-full bg-stage-velvet pl-4 pr-10 text-sm font-semibold text-stage-ivory ring-1 ring-inset ring-stage-line ${focusRing}`}
                >
                  {CATEGORY_CONFIG.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-stage-muted" aria-hidden />
              </label>
            )}

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                role="switch"
                aria-checked={autoRotate}
                onClick={() => setAutoRotate((v) => !v)}
                className={`inline-flex h-10 items-center gap-3 rounded-full pl-2 pr-4 text-sm font-semibold transition-colors ${focusRing} ${
                  autoRotate ? 'text-stage-ivory' : 'text-stage-muted hover:text-stage-ivory'
                }`}
              >
                <span
                  aria-hidden
                  className={`flex h-6 w-10 items-center rounded-full p-0.5 transition-colors ${
                    autoRotate ? 'bg-stage-gold' : 'bg-stage-line'
                  }`}
                >
                  <span
                    className={`h-5 w-5 rounded-full bg-stage-ivory shadow transition-transform duration-200 ${
                      autoRotate ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </span>
                Auto-rotate
              </button>
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label="Enter full screen"
                className={`grid h-10 w-10 place-items-center rounded-full text-stage-muted ring-1 ring-inset ring-stage-line transition-colors hover:text-stage-ivory ${focusRing}`}
              >
                <Maximize className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto flex max-w-6xl flex-col px-4 py-10 sm:px-8 md:py-14">
        <AnimatePresence mode="wait" initial={false}>
          <motion.header
            key={`head-${viewKey}`}
            initial={reduce ? false : { opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.15 } }}
            transition={{ duration: 0.45, ease: EASE_OUT }}
            className="flex flex-col items-center text-center"
          >
            <LiveStatus isError={isError} updatedAt={updatedAt} />
            <h1 className="mt-6 font-crown text-5xl font-semibold leading-[1.05] md:text-7xl lg:text-8xl">
              {DIVISION_LABEL[view.division]} 2025
            </h1>
            <p className="mt-3 text-lg font-semibold text-stage-gold md:text-2xl">
              {view.mode === 'overall' ? 'Overall rankings' : categoryLabel}
            </p>
          </motion.header>
        </AnimatePresence>

        <section aria-label="Rankings" className="mt-12 md:mt-20">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`board-${viewKey}-${isLoading ? 'loading' : 'ready'}`}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.15 } }}
              transition={{ duration: 0.35 }}
            >
              {isLoading ? (
                <BoardSkeleton />
              ) : isError && !rows?.length ? (
                <BoardMessage
                  icon={<WifiOff className="h-12 w-12 text-stage-alert" aria-hidden />}
                  title="Can't reach the results server"
                  body="Retrying every 3 seconds. If this keeps up, check the venue's internet connection."
                />
              ) : !rows?.length ? (
                <BoardMessage
                  icon={<Crown className="h-12 w-12 text-stage-line" aria-hidden />}
                  title="No scores yet"
                  body="Rankings appear here as judges submit their scores."
                />
              ) : (
                <LayoutGroup>
                  <ol className="relative grid gap-4 md:grid-cols-3 md:items-end">
                    {top.map((row, place) => {
                      const title = view.mode === 'overall' ? placeTitle(row.rank, view.division) : null;
                      return (
                        <motion.li
                          key={row.id}
                          layoutId={`c-${row.id}`}
                          transition={{ layout: layoutTransition }}
                          className={`relative flex flex-col items-center justify-end rounded-3xl px-6 pb-8 pt-10 text-center ring-1 ring-inset ${podiumStyle[place]}`}
                        >
                          {place === 0 && (
                            <div
                              aria-hidden
                              className="landing-beam pointer-events-none absolute -top-24 left-[10%] hidden h-40 w-[80%] md:block"
                            />
                          )}
                          {place === 0 && <Crown className="mb-3 h-10 w-10 text-stage-gold" aria-hidden />}
                          <p className="text-sm font-semibold text-stage-muted">Rank {formatRank(row.rank)}</p>
                          <p className="mt-4 text-sm text-stage-muted">Candidate</p>
                          <p
                            className={`font-crown font-semibold leading-none tabular-nums text-stage-ivory ${
                              place === 0 ? 'text-8xl md:text-9xl' : 'text-7xl md:text-8xl'
                            }`}
                          >
                            {candidateNo(row.number)}
                          </p>
                          <p className="mt-5 text-2xl font-semibold tabular-nums text-stage-gold">
                            {formatPoints(row.points)}
                            <span className="ml-1.5 text-base font-medium text-stage-muted">points</span>
                          </p>
                          {title && <p className="mt-2 text-base font-semibold text-stage-ivory">{title}</p>}
                        </motion.li>
                      );
                    })}
                  </ol>

                  {rest.length > 0 && (
                    <ol start={4} className="mt-6 flex flex-col gap-2">
                      {rest.map((row) => (
                        <motion.li
                          key={row.id}
                          layoutId={`c-${row.id}`}
                          transition={{ layout: layoutTransition }}
                          className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-4 rounded-2xl bg-stage-velvet/70 px-5 py-4 ring-1 ring-inset ring-stage-line md:grid-cols-[5rem_1fr_auto] md:px-8"
                        >
                          <span className="font-crown text-2xl font-semibold tabular-nums text-stage-muted md:text-3xl">
                            {formatRank(row.rank)}
                          </span>
                          <span className="text-xl font-semibold md:text-2xl">Candidate {candidateNo(row.number)}</span>
                          <span className="text-xl font-semibold tabular-nums md:text-2xl">
                            {formatPoints(row.points)}
                            <span className="ml-1.5 text-sm font-medium text-stage-muted">points</span>
                          </span>
                        </motion.li>
                      ))}
                    </ol>
                  )}
                </LayoutGroup>
              )}
            </motion.div>
          </AnimatePresence>
        </section>

        <p className="mt-12 text-center text-sm text-stage-muted/80">
          Rankings refresh every 3 seconds{autoRotate ? ' and the board changes every 10 seconds' : ''}.
        </p>
      </main>

      {isFullscreen && (
        <button
          type="button"
          onClick={toggleFullscreen}
          className={`fixed bottom-4 right-4 inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs text-stage-muted/60 transition-colors hover:text-stage-ivory ${focusRing}`}
        >
          <Minimize className="h-3.5 w-3.5" aria-hidden />
          Esc to exit full screen
        </button>
      )}
    </div>
  );
}
