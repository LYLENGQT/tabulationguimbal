import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { EASE_OUT, focusRing } from '../stage/tokens';
import { SpotlightCrest } from '../stage/SpotlightCrest';
import { usePointerTilt } from '../stage/usePointerTilt';

type Props = {
  title: string;
  description: string;
  /** Short guidance shown beside the crest on wide screens. */
  note: { title: string; body: string };
  switchTo: { to: string; label: string };
  children: ReactNode;
};

function BrandLink() {
  return (
    <Link to="/" className={`inline-flex items-center gap-3 rounded-full ${focusRing}`}>
      <img src="/mrmsteenlogo.jpg" alt="" className="h-9 w-9 rounded-full object-cover ring-1 ring-stage-gold/30" />
      <span className="font-crown text-sm font-semibold text-stage-ivory sm:text-base">Mr &amp; Miss Teen</span>
    </Link>
  );
}

// Shared shell for judge and admin sign-in: the lit crest on the left, the form on the right.
export function AuthStage({ title, description, note, switchTo, children }: Props) {
  const reduce = useReducedMotion() ?? false;
  const tilt = usePointerTilt();

  return (
    <div className="min-h-[100dvh] bg-stage-night font-stage text-stage-ivory antialiased selection:bg-stage-gold selection:text-stage-night lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* isolate + own bg: required by SpotlightCrest's blend */}
      <aside
        {...tilt.bind}
        className="relative isolate hidden overflow-hidden border-r border-stage-line/70 bg-stage-night p-12 lg:flex lg:flex-col lg:justify-between"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_52%,rgba(239,122,43,0.15),transparent_70%)]"
        />
        <BrandLink />
        <SpotlightCrest px={tilt.px} py={tilt.py} className="mx-auto max-w-[420px]" />
        <div className="max-w-md">
          <p className="font-crown text-2xl font-semibold text-stage-ivory">{note.title}</p>
          <p className="mt-2 leading-relaxed text-stage-muted">{note.body}</p>
        </div>
      </aside>

      <main className="flex min-h-[100dvh] flex-col px-4 py-6 sm:px-8 lg:px-12">
        <div className="flex items-center justify-between gap-4">
          <span className="lg:invisible">
            <BrandLink />
          </span>
          <Link
            to="/"
            className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-stage-muted transition-colors hover:text-stage-ivory ${focusRing}`}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Home
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center py-12">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: EASE_OUT }}
            className="w-full max-w-sm"
          >
            <h1 className="font-crown text-3xl font-semibold leading-[1.1] text-stage-ivory sm:text-4xl">{title}</h1>
            <p className="mt-3 leading-relaxed text-stage-muted">{description}</p>
            <div className="mt-10">{children}</div>
            <p className="mt-10 text-sm text-stage-muted">
              Not your role?{' '}
              <Link
                to={switchTo.to}
                className={`rounded font-semibold text-stage-gold underline decoration-stage-gold/40 underline-offset-4 transition-colors hover:decoration-stage-gold ${focusRing}`}
              >
                {switchTo.label}
              </Link>
            </p>
          </motion.div>
        </div>

        <p className="text-center text-xs text-stage-muted/80">Built by Lyle Denver Lague (codewithlyle)</p>
      </main>
    </div>
  );
}

export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="rounded-2xl bg-stage-ember/10 p-4 text-sm leading-relaxed text-stage-alert ring-1 ring-inset ring-stage-ember/40">
      {children}
    </div>
  );
}

export function SessionCheck() {
  return (
    <p role="status" className="flex items-center gap-3 text-sm text-stage-muted">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-stage-line border-t-stage-gold motion-reduce:animate-none" />
      Checking your session
    </p>
  );
}
