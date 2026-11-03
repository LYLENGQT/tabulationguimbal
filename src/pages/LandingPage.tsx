import { LandingNav } from '../components/landing/LandingNav';
import { Hero } from '../components/landing/Hero';
import { RoundsExplorer } from '../components/landing/RoundsExplorer';
import { ScoreJourney } from '../components/landing/ScoreJourney';
import { Schools } from '../components/landing/Schools';
import { Curtain } from '../components/landing/Curtain';

// Public front door. Always dark: the brand crest is drawn on a black field,
// so the page is locked to its stage palette regardless of the app theme toggle.
export function LandingPage() {
  return (
    <div className="min-h-[100dvh] bg-stage-night font-stage text-stage-ivory antialiased selection:bg-stage-gold selection:text-stage-night">
      <LandingNav />
      <main>
        <Hero />
        <RoundsExplorer />
        <ScoreJourney />
        <Schools />
        <Curtain />
      </main>
      <footer className="border-t border-stage-line/70">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-8 text-sm text-stage-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
          <p className="font-crown font-semibold text-stage-ivory">Mr &amp; Miss Teen Guimbal 2025</p>
          <p>Disyembre sa Guimbal 2025</p>
        </div>
      </footer>
    </div>
  );
}
