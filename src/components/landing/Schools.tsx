import { SCHOOLS } from '../stage/tokens';

export function Schools() {
  if (SCHOOLS.length === 0) return null;

  return (
    <section aria-labelledby="schools-title" className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
        <h2
          id="schools-title"
          className="max-w-3xl font-crown text-3xl font-semibold leading-[1.1] text-stage-ivory sm:text-5xl"
        >
          {SCHOOLS.length === 6 ? 'Six schools, one stage.' : 'The competing schools.'}
        </h2>

        <ul className="mt-14 grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 lg:grid-cols-6">
          {SCHOOLS.map((school) => (
            <li key={school.name} className="flex flex-col items-center text-center">
              <img
                src={school.src}
                alt={`${school.name} logo`}
                loading="lazy"
                className="aspect-square w-24 rounded-full bg-stage-ivory object-cover ring-1 ring-stage-line sm:w-28"
              />
              <p className="mt-4 max-w-[18ch] text-sm leading-snug text-stage-muted">{school.name}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
