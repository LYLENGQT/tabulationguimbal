-- =====================================================================
-- Mr & Ms Teen Pageant Tabulation: full bootstrap for a FRESH Supabase project
--
-- Consolidates schema.sql + every file in migrations/ into their final state.
-- Idempotent: safe to run more than once in the SQL editor.
--
-- After running:
--   1. Auth > Sign In / Providers: turn OFF "Allow new users to sign up"
--      (judge accounts are created by the create-judge Edge Function)
--   2. Create the admin auth user admin@mrmsteen2025.com
--   3. Deploy the create-judge and delete-auth-users Edge Functions
-- =====================================================================

-- ---------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------
create table if not exists judges (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text unique not null,
  username text unique,
  division text not null check (division in ('male', 'female')),
  is_active boolean not null default true,
  last_active timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_judges_username on judges(username);

create table if not exists contestants (
  id uuid primary key default gen_random_uuid(),
  number integer not null,
  full_name text not null,
  division text not null check (division in ('male', 'female')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (division, number)
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  label text not null,
  weight numeric not null default 1 check (weight > 0),
  is_active boolean not null default true,
  sort_order integer not null default 0
);

create table if not exists criteria (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id) on delete cascade,
  slug text not null,
  label text not null,
  percentage numeric not null check (percentage > 0 and percentage <= 1),
  sort_order integer not null default 0,
  unique (category_id, slug)
);

create table if not exists scores (
  id uuid primary key default gen_random_uuid(),
  judge_id uuid references judges(id) on delete cascade,
  contestant_id uuid references contestants(id) on delete cascade,
  category_id uuid references categories(id) on delete cascade,
  criterion_id uuid references criteria(id) on delete cascade,
  raw_score numeric not null check (raw_score >= 0 and raw_score <= 100),
  -- weighted_score is computed in the application using the criterion's percentage
  weighted_score numeric not null check (weighted_score >= 0),
  created_at timestamptz not null default now(),
  unique (judge_id, contestant_id, criterion_id)
);

create table if not exists judge_category_locks (
  id uuid primary key default gen_random_uuid(),
  judge_id uuid references judges(id) on delete cascade,
  category_id uuid references categories(id) on delete cascade,
  contestant_id uuid references contestants(id) on delete cascade,
  locked_at timestamptz not null default now(),
  unique (judge_id, category_id, contestant_id)
);

create table if not exists computed_scores (
  id uuid primary key default gen_random_uuid(),
  contestant_id uuid references contestants(id) on delete cascade,
  category_id uuid references categories(id) on delete cascade,
  judge_average numeric not null,
  category_score numeric not null,
  total_score numeric not null,
  calculated_at timestamptz not null default now(),
  unique (contestant_id, category_id)
);

create table if not exists final_rankings (
  id uuid primary key default gen_random_uuid(),
  contestant_id uuid references contestants(id) on delete cascade,
  division text not null check (division in ('male', 'female')),
  total_score numeric not null,
  rank integer not null,
  tie_breaker numeric,
  calculated_at timestamptz not null default now(),
  unique (division, rank)
);

-- ---------------------------------------------------------------------
-- Activity feed + score audit trail (from add_realtime_features + fixes)
-- ---------------------------------------------------------------------
create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  user_type text not null check (user_type in ('judge', 'admin')),
  user_name text not null,
  action_type text not null check (action_type in (
    'score_submitted', 'score_updated', 'lock_created', 'lock_removed',
    'judge_logged_in', 'judge_logged_out', 'contestant_created', 'judge_created', 'system_reset'
  )),
  entity_type text,
  entity_id uuid,
  description text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_activity_log_created_at on activity_log(created_at desc);
create index if not exists idx_activity_log_action_type on activity_log(action_type);
create index if not exists idx_activity_log_user_id on activity_log(user_id);

create table if not exists score_history (
  id uuid primary key default gen_random_uuid(),
  score_id uuid references scores(id) on delete set null,
  judge_id uuid references judges(id) on delete cascade,
  contestant_id uuid references contestants(id) on delete cascade,
  category_id uuid references categories(id) on delete cascade,
  criterion_id uuid references criteria(id) on delete cascade,
  old_raw_score numeric,
  new_raw_score numeric,
  old_weighted_score numeric,
  new_weighted_score numeric,
  changed_by uuid,
  change_type text not null check (change_type in ('created', 'updated', 'deleted')),
  created_at timestamptz not null default now()
);
create index if not exists idx_score_history_score_id on score_history(score_id);
create index if not exists idx_score_history_judge_id on score_history(judge_id);
create index if not exists idx_score_history_contestant_id on score_history(contestant_id);
create index if not exists idx_score_history_created_at on score_history(created_at desc);

create or replace function log_score_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into score_history (
      score_id, judge_id, contestant_id, category_id, criterion_id,
      new_raw_score, new_weighted_score, changed_by, change_type
    ) values (
      new.id, new.judge_id, new.contestant_id, new.category_id, new.criterion_id,
      new.raw_score, new.weighted_score, auth.uid(), 'created'
    );
    return new;
  elsif tg_op = 'UPDATE' then
    insert into score_history (
      score_id, judge_id, contestant_id, category_id, criterion_id,
      old_raw_score, new_raw_score, old_weighted_score, new_weighted_score,
      changed_by, change_type
    ) values (
      new.id, new.judge_id, new.contestant_id, new.category_id, new.criterion_id,
      old.raw_score, new.raw_score, old.weighted_score, new.weighted_score,
      auth.uid(), 'updated'
    );
    return new;
  elsif tg_op = 'DELETE' then
    -- score_id is NULL because the score row is going away
    insert into score_history (
      score_id, judge_id, contestant_id, category_id, criterion_id,
      old_raw_score, new_raw_score, old_weighted_score, new_weighted_score, changed_by, change_type
    ) values (
      null, old.judge_id, old.contestant_id, old.category_id, old.criterion_id,
      old.raw_score, null, old.weighted_score, null, auth.uid(), 'deleted'
    );
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trigger_log_score_change on scores;
create trigger trigger_log_score_change
  after insert or update or delete on scores
  for each row execute function log_score_change();

-- ---------------------------------------------------------------------
-- Ranking views
-- ---------------------------------------------------------------------
create materialized view if not exists category_averages as
select
  c.id as category_id,
  cr.contestant_id,
  avg(cr.weighted_sum) as avg_weighted
from (
  select s.category_id, s.contestant_id, s.judge_id, sum(s.weighted_score) as weighted_sum
  from scores s
  group by s.category_id, s.contestant_id, s.judge_id
) cr
join categories c on c.id = cr.category_id
group by c.id, cr.contestant_id;

create materialized view if not exists contestant_totals as
select
  ca.contestant_id,
  ct.division,
  sum(ca.avg_weighted * cat.weight) as total_score
from category_averages ca
join contestants ct on ct.id = ca.contestant_id
join categories cat on cat.id = ca.category_id
group by ca.contestant_id, ct.division;

-- Per-category ranking by weighted score
create or replace view category_rankings as
select
  cat.id as category_id,
  cat.slug as category_slug,
  cat.label as category_label,
  ct.division,
  ca.contestant_id,
  ct.full_name,
  ct.number,
  ca.avg_weighted as category_score,
  row_number() over (partition by cat.id, ct.division order by ca.avg_weighted desc, ca.contestant_id) as rank
from category_averages ca
join contestants ct on ct.id = ca.contestant_id
join categories cat on cat.id = ca.category_id;

-- Overall ranking by ranking points (sum of category ranks, lower is better)
create or replace view overall_rankings as
select
  cr.contestant_id,
  cr.division,
  ct.full_name,
  ct.number,
  sum(cr.rank) as total_points,
  row_number() over (partition by cr.division order by sum(cr.rank), cr.contestant_id) as final_placement
from category_rankings cr
join contestants ct on ct.id = cr.contestant_id
group by cr.contestant_id, cr.division, ct.full_name, ct.number;

-- Legacy leaderboard by total_score (reference only)
create or replace view leaderboard as
select
  row_number() over (partition by division order by total_score desc, contestant_id) as rank,
  contestant_id,
  division,
  total_score
from contestant_totals;

-- Run views with the caller's permissions so RLS applies (Postgres default is the owner's)
alter view category_rankings set (security_invoker = true);
alter view overall_rankings set (security_invoker = true);
alter view leaderboard set (security_invoker = true);

grant select on category_rankings, overall_rankings, leaderboard to anon, authenticated;

-- Trigger-only function: not callable over the API (triggers still fire)
revoke execute on function log_score_change() from public, anon, authenticated;
grant select on category_averages, contestant_totals to anon, authenticated;

create or replace function refresh_leaderboards()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view category_averages;
  refresh materialized view contestant_totals;
end;
$$;

-- ---------------------------------------------------------------------
-- Rubric seed (exact guideline weights; mirrors src/constants/scoring.ts)
-- ---------------------------------------------------------------------
insert into categories (slug, label, sort_order) values
  ('production', 'Production Number', 1),
  ('runway', 'Runway', 2),
  ('streetwear', 'Street Wear', 3),
  ('free-speech', 'Free Speech', 4),
  ('formal', 'Modern Barong & Long Gown', 5),
  ('interview', 'Interview', 6)
on conflict (slug) do nothing;

insert into criteria (category_id, slug, label, percentage, sort_order)
select cat.id, data.slug, data.label, data.percentage, data.sort_order
from categories cat
join (
  values
    ('production', 'poise-bearing', 'Poise and Bearing', 0.30, 1),
    ('production', 'stage-deportment', 'Stage Deportment', 0.35, 2),
    ('production', 'mastery', 'Mastery of the Choreography', 0.30, 3),
    ('production', 'audience-impact', 'Audience Impact', 0.05, 4),
    ('runway', 'creativity', 'Creativity and Style', 0.30, 1),
    ('runway', 'personality', 'Personality and Stage Presence', 0.20, 2),
    ('runway', 'costume', 'Suitability of the Costume', 0.30, 3),
    ('runway', 'projection', 'Poise, Bearing, and Projection', 0.20, 4),
    ('streetwear', 'beauty-physique', 'Beauty and Physique', 0.30, 1),
    ('streetwear', 'stage-deportment', 'Stage Deportment', 0.30, 2),
    ('streetwear', 'poise-bearing', 'Poise and Bearing', 0.30, 3),
    ('streetwear', 'audience-impact', 'Audience Impact', 0.10, 4),
    ('free-speech', 'content', 'Content & Substance', 0.40, 1),
    ('free-speech', 'delivery', 'Delivery & Presence', 0.30, 2),
    ('free-speech', 'theme', 'Alignment to “Ascend” Theme', 0.20, 3),
    ('free-speech', 'respect', 'Respectfulness & Positivity', 0.10, 4),
    ('formal', 'fitness-style', 'Fitness and Style', 0.20, 1),
    ('formal', 'beauty-elegance', 'Beauty and Elegance', 0.30, 2),
    ('formal', 'stage-deportment', 'Stage Deportment', 0.25, 3),
    ('formal', 'projection', 'Poise, Bearing, and Projection', 0.25, 4),
    ('interview', 'wit', 'Wit and Content', 0.50, 1),
    ('interview', 'delivery', 'Delivery & Choice of Words', 0.25, 2),
    ('interview', 'poise', 'Poise and Bearing', 0.15, 3),
    ('interview', 'audience-impact', 'Audience Impact', 0.10, 4)
) as data(category_slug, slug, label, percentage, sort_order)
  on cat.slug = data.category_slug
on conflict (category_id, slug) do nothing;

-- ---------------------------------------------------------------------
-- Row level security
--
-- Roles: the admin is the single account admin@mrmsteen2025.com (matches
-- supabaseAuth.getCurrentRole in the app). A judge is a signed-in user whose
-- email matches an active row in judges. Everyone else, signed in or not, is
-- read-only. Public sign-ups should be DISABLED; judge accounts are created
-- server-side by the create-judge Edge Function.
--
-- Reads stay public: the live board and the pre-login username lookup need them.
-- ---------------------------------------------------------------------
create schema if not exists private;
grant usage on schema private to anon, authenticated;

create or replace function private.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(lower(auth.email()), '') = 'admin@mrmsteen2025.com';
$$;

create or replace function private.current_judge_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select j.id from public.judges j
  where lower(j.email) = lower(auth.email()) and j.is_active
  limit 1;
$$;

create or replace function private.is_locked(p_judge uuid, p_category uuid, p_contestant uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.judge_category_locks l
    where l.judge_id = p_judge and l.category_id = p_category and l.contestant_id = p_contestant
  );
$$;

grant execute on function private.is_admin(), private.current_judge_id(),
  private.is_locked(uuid, uuid, uuid) to anon, authenticated;

-- Judges may update their own row, but only last_active. RLS works per row,
-- so this column-level rule is a trigger. Admin and service role are exempt.
create or replace function private.guard_judge_self_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.role() = 'service_role' or private.is_admin() then
    return new;
  end if;
  if (new.full_name, new.email, new.username, new.division, new.is_active)
     is distinct from (old.full_name, old.email, old.username, old.division, old.is_active) then
    raise exception 'Judges may only update their own last_active';
  end if;
  return new;
end;
$$;

drop trigger if exists judges_guard_self_update on judges;
create trigger judges_guard_self_update
  before update on judges
  for each row execute function private.guard_judge_self_update();

-- Public read + admin-only write on every core table (also removes the
-- blanket "Signed-in write" policy from earlier drafts of this file)
do $$
declare t text;
begin
  foreach t in array array[
    'judges', 'contestants', 'categories', 'criteria', 'scores',
    'judge_category_locks', 'computed_scores', 'final_rankings'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "Signed-in write" on %I', t);
    execute format('drop policy if exists "Public read" on %I', t);
    execute format('create policy "Public read" on %I for select to anon, authenticated using (true)', t);
    execute format('drop policy if exists "Admin write" on %I', t);
    execute format(
      'create policy "Admin write" on %I for all to authenticated using (private.is_admin()) with check (private.is_admin())', t);
  end loop;
end $$;

-- judges: a judge may touch their own row (trigger above limits it to last_active)
drop policy if exists "Judge updates own row" on judges;
create policy "Judge updates own row" on judges for update to authenticated
  using (id = private.current_judge_id())
  with check (id = private.current_judge_id());

-- scores: a judge writes only their own scores, and only until the round is locked
drop policy if exists "Judge inserts own unlocked scores" on scores;
create policy "Judge inserts own unlocked scores" on scores for insert to authenticated
  with check (
    judge_id = private.current_judge_id()
    and not private.is_locked(judge_id, category_id, contestant_id)
  );
drop policy if exists "Judge updates own unlocked scores" on scores;
create policy "Judge updates own unlocked scores" on scores for update to authenticated
  using (
    judge_id = private.current_judge_id()
    and not private.is_locked(judge_id, category_id, contestant_id)
  )
  with check (
    judge_id = private.current_judge_id()
    and not private.is_locked(judge_id, category_id, contestant_id)
  );

-- locks: a judge may lock their own submissions; only the admin unlocks (delete)
drop policy if exists "Judge creates own locks" on judge_category_locks;
create policy "Judge creates own locks" on judge_category_locks for insert to authenticated
  with check (judge_id = private.current_judge_id());
drop policy if exists "Judge refreshes own locks" on judge_category_locks;
create policy "Judge refreshes own locks" on judge_category_locks for update to authenticated
  using (judge_id = private.current_judge_id())
  with check (judge_id = private.current_judge_id());

-- activity_log: admin and active judges append; only the admin clears
alter table activity_log enable row level security;
drop policy if exists "Allow authenticated users to read activity log" on activity_log;
create policy "Allow authenticated users to read activity log"
  on activity_log for select to authenticated using (true);
drop policy if exists "Allow authenticated users to insert activity log" on activity_log;
drop policy if exists "Staff append activity log" on activity_log;
create policy "Staff append activity log"
  on activity_log for insert to authenticated
  with check (private.is_admin() or private.current_judge_id() is not null);
drop policy if exists "Allow admin to delete activity log" on activity_log;
create policy "Allow admin to delete activity log"
  on activity_log for delete to authenticated using (private.is_admin());

-- score_history: written only by the trigger; readable when signed in; admin clears on reset
alter table score_history enable row level security;
drop policy if exists "Allow authenticated users to read score history" on score_history;
create policy "Allow authenticated users to read score history"
  on score_history for select to authenticated using (true);
drop policy if exists "Admin clears score history" on score_history;
create policy "Admin clears score history"
  on score_history for delete to authenticated using (private.is_admin());

-- Explicit table privileges for the API roles (newer projects may not grant
-- them by default). RLS above still decides which rows each role can touch.
grant select on judges, contestants, categories, criteria, scores,
  judge_category_locks, computed_scores, final_rankings to anon, authenticated;
grant insert, update, delete on judges, contestants, categories, criteria, scores,
  judge_category_locks, computed_scores, final_rankings to authenticated;
grant select, insert, delete on activity_log to authenticated;
grant select, delete on score_history to authenticated;

-- refresh_leaderboards is security definer; callable only when signed in
revoke execute on function refresh_leaderboards() from public, anon;
grant execute on function refresh_leaderboards() to authenticated;

-- ---------------------------------------------------------------------
-- Realtime: the admin dashboard subscribes to these tables
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['scores', 'activity_log'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
