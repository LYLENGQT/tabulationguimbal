// Shared tokens for the landing page.
// Shape rule: interactive controls are full pills, panels use rounded-3xl.

export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

export const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stage-gold focus-visible:ring-offset-2 focus-visible:ring-offset-stage-night';

export const primaryButton = `inline-flex h-12 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-stage-gold px-6 text-sm font-semibold text-stage-night transition-[transform,background-color] duration-200 ease-out hover:bg-[#f6c25c] active:scale-[0.97] ${focusRing}`;

export const secondaryButton = `inline-flex h-12 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-6 text-sm font-semibold text-stage-ivory ring-1 ring-inset ring-stage-ivory/25 transition-[transform,background-color,box-shadow] duration-200 ease-out hover:bg-stage-ivory/5 hover:ring-stage-ivory/45 active:scale-[0.97] ${focusRing}`;

// Brand sunset ramp, used for criterion segments (crown gold down to ember).
export const SUNSET_RAMP = ['#f2b33d', '#f0972f', '#ef7a2b', '#d8461f'];

const logoModules = import.meta.glob('../../../logos/*.{jpg,jpeg,png,webp}', {
  eager: true,
  as: 'url'
});

export const SCHOOLS = Object.entries(logoModules)
  .map(([path, src]) => ({
    name: path.split('/').pop()?.replace(/\.[^/.]+$/, '') ?? '',
    src
  }))
  .sort((a, b) => a.name.localeCompare(b.name));
