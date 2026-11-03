import { Link } from 'react-router-dom';

const darkPill =
  'inline-flex h-12 shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-stage-night px-6 text-sm font-semibold text-stage-ivory transition-[transform,background-color] duration-200 ease-out hover:bg-stage-velvet active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stage-night focus-visible:ring-offset-2 focus-visible:ring-offset-stage-gold';

const darkLink =
  'rounded-full px-2 py-1 text-sm font-semibold text-stage-night underline decoration-stage-night/40 underline-offset-4 transition-colors hover:decoration-stage-night focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stage-night';

// Closing band in the logo's sunset arch colors. Same CTA labels as the rest of the page.
export function Curtain() {
  return (
    <section aria-labelledby="curtain-title" className="px-4 pb-16 sm:px-6 lg:px-10">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-[linear-gradient(120deg,#f2b33d_0%,#ef7a2b_58%,#d8461f_100%)] px-6 py-14 sm:px-12 sm:py-20">
        <div className="relative grid items-end gap-10 md:grid-cols-[1fr_auto]">
          <div>
            <h2
              id="curtain-title"
              className="max-w-xl font-crown text-3xl font-semibold leading-[1.1] text-stage-night sm:text-5xl"
            >
              Ready when the curtain rises.
            </h2>
            <p className="mt-4 max-w-[48ch] text-base font-medium leading-relaxed text-stage-night/80 sm:text-lg">
              Judges and organizers sign in with the accounts set up by the tabulation team.
            </p>
          </div>
          <div className="flex flex-col items-start gap-4 md:items-end">
            <Link to="/login" className={darkPill}>
              Judge sign in
            </Link>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              <Link to="/admin/login" className={darkLink}>
                Admin sign in
              </Link>
              <Link to="/live" className={darkLink}>
                Watch live results
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
