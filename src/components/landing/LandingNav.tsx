import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { focusRing, primaryButton } from '../stage/tokens';

export function LandingNav() {
  const { scrollY } = useScroll();
  // The bar is transparent over the hero and gains a backdrop once the page moves.
  const backdropOpacity = useTransform(scrollY, [0, 96], [0, 1]);

  return (
    <header className="fixed inset-x-0 top-0 z-30">
      <motion.div
        aria-hidden
        style={{ opacity: backdropOpacity }}
        className="absolute inset-0 border-b border-stage-line/80 bg-stage-night/80 backdrop-blur-md"
      />
      <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
        <Link to="/" className={`flex items-center gap-3 rounded-full ${focusRing}`}>
          <img
            src="/mrmsteenlogo.jpg"
            alt=""
            className="h-9 w-9 rounded-full object-cover ring-1 ring-stage-gold/30"
          />
          <span className="font-crown text-sm font-semibold text-stage-ivory sm:text-base">
            Mr &amp; Miss Teen
          </span>
        </Link>

        <nav aria-label="Primary" className="flex items-center gap-1 sm:gap-2">
          <Link
            to="/live"
            className={`hidden rounded-full px-4 py-2 text-sm font-medium text-stage-muted transition-colors hover:text-stage-ivory md:inline-flex ${focusRing}`}
          >
            Watch live results
          </Link>
          <Link
            to="/admin/login"
            className={`hidden rounded-full px-4 py-2 text-sm font-medium text-stage-muted transition-colors hover:text-stage-ivory sm:inline-flex ${focusRing}`}
          >
            Admin sign in
          </Link>
          <Link to="/login" className={`${primaryButton} h-10 px-5`}>
            Judge sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}
