# Mr & Ms Teen Pageant Tabulation

Full-stack tabulation suite built with Vite + React + TypeScript, TailwindCSS, React Query, Zustand, React Hook Form + Zod, and Supabase (auth + Postgres).

## Getting started

1. Copy env values:
   ```
   cp env.example .env
   ```
   Fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
2. Install dependencies:
   ```
   npm install
   ```
3. Run locally:
   ```
   npm run dev
   ```
4. Deploy frontend to Vercel; set the same env vars there.

## Database

`supabase/schema.sql` defines:

- `judges`, `contestants`, `categories`, `criteria`, `scores`, `judge_category_locks`
- materialized views for `category_averages`, `contestant_totals`, and `leaderboard`
- helper RPC `refresh_leaderboards`
- seed inserts that mirror the official criteria/percentages

Run the file in Supabase SQL editor or `supabase db push`.

## Frontend structure

- `src/lib/supabaseClient.ts` bootstraps the browser client (auto auth refresh).
- `src/services/supabaseApi.ts` centralizes CRUD + exports + locks.
- `src/store/useScoringStore.ts` keeps judge/session state in Zustand.
- `src/constants/scoring.ts` mirrors the rulebook for offline fallbacks.
- `src/utils/scoring.ts` holds weighted score, averages, totals, and sorting helpers.
- `src/utils/export.ts` provides CSV download utilities.

## Pages

- `JudgeLoginPage`: OTP login flow for judges (email magic link).
- `JudgeScoringPage`: division-aware scoring console with contestant/category selectors, React Hook Form validation (0–100 only), per-category submission locks, and Supabase persistence.
- `AdminDashboardPage`: manage contestants + judges, trigger leaderboard refresh, view rosters, and export raw scores to CSV.
- `RankingsPage`: live leaderboard for male & female divisions (separate tables).

## Computation logic

- Weighted score = `raw_score × criterion_percentage` (all values 0–1, exact to guidelines).
- Judge totals per category = sum of weighted criteria.
- Category average = `avg(judge_total)` per contestant/category.
- Overall contestant score = sum of `category_average × category.weight`.
- Supabase materialized views + `leaderboard` view keep rankings server-side, while `utils/scoring.ts` mirrors the math for client-side previews.

## Submission locking

- After saving scores for a contestant/category, the UI calls `judge_category_locks` to freeze further edits (per guidelines). Locked states are shown in the scoring header.

## Exporting

- Admin CSV export pulls the raw `scores` table with timestamps so organizers can audit judging.

## Seeding an admin user

Auth users (including admins) are created via Supabase Auth, not regular SQL.

To seed a one-time admin account:

1. Set the following env vars in your shell (or a local, uncommitted env file) using values from Supabase **Settings → API**:
   ```bash
   # Powershell example
   $env:SUPABASE_URL="https://your-project-ref.supabase.co"
   $env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
   $env:SEED_ADMIN_EMAIL="admin@example.com"
   $env:SEED_ADMIN_PASSWORD="ChangeMe123!"
   ```
2. Run the seeder:
   ```bash
   npm run seed:admin
   ```
3. Log in with that email/password. The user has `user_metadata.role = "admin"` and will be redirected to the Admin dashboard.

