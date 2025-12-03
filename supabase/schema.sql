-- Database schema for Mr & Ms Teen Pageant Tabulation
-- Run inside Supabase SQL editor or via CLI

-- Drop existing tables (optional, uncomment during local resets)
-- drop table if exists final_rankings cascade;
-- drop table if exists computed_scores cascade;
-- drop table if exists scores cascade;
-- drop table if exists criteria cascade;
-- drop table if exists categories cascade;
-- drop table if exists contestants cascade;
-- drop table if exists judges cascade;

create table if not exists judges (
  id uuid primary key default uuid_generate_v4(),
  full_name text not null,
  email text unique not null,
  division text not null check (division in ('male', 'female')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists contestants (
  id uuid primary key default uuid_generate_v4(),
  number integer not null,
  full_name text not null,
  division text not null check (division in ('male', 'female')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (division, number)
);

create table if not exists categories (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  label text not null,
  weight numeric not null default 1 check (weight > 0),
  is_active boolean not null default true,
  sort_order integer not null default 0
);

create table if not exists criteria (
  id uuid primary key default uuid_generate_v4(),
  category_id uuid references categories(id) on delete cascade,
  slug text not null,
  label text not null,
  percentage numeric not null check (percentage > 0 and percentage <= 1),
  sort_order integer not null default 0,
  unique (category_id, slug)
);

create table if not exists scores (
  id uuid primary key default uuid_generate_v4(),
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
  id uuid primary key default uuid_generate_v4(),
  judge_id uuid references judges(id) on delete cascade,
  category_id uuid references categories(id) on delete cascade,
  contestant_id uuid references contestants(id) on delete cascade,
  locked_at timestamptz not null default now(),
  unique (judge_id, category_id, contestant_id)
);

create table if not exists computed_scores (
  id uuid primary key default uuid_generate_v4(),
  contestant_id uuid references contestants(id) on delete cascade,
  category_id uuid references categories(id) on delete cascade,
  judge_average numeric not null,
  category_score numeric not null,
  total_score numeric not null,
  calculated_at timestamptz not null default now(),
  unique (contestant_id, category_id)
);

create table if not exists final_rankings (
  id uuid primary key default uuid_generate_v4(),
  contestant_id uuid references contestants(id) on delete cascade,
  division text not null check (division in ('male', 'female')),
  total_score numeric not null,
  rank integer not null,
  tie_breaker numeric,
  calculated_at timestamptz not null default now(),
  unique (division, rank)
);

create materialized view if not exists category_averages as
select
  c.id as category_id,
  cr.contestant_id,
  avg(cr.weighted_sum) as avg_weighted
from (
  select
    s.category_id,
    s.contestant_id,
    s.judge_id,
    sum(s.weighted_score) as weighted_sum
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

-- Per-category ranking by weighted score (pageant ranking method input)
create view category_rankings as
select
  cat.id as category_id,
  cat.slug as category_slug,
  cat.label as category_label,
  ct.division,
  ca.contestant_id,
  ct.full_name,
  ct.number,
  ca.avg_weighted as category_score,
  row_number() over (
    partition by cat.id, ct.division
    order by ca.avg_weighted desc, ca.contestant_id
  ) as rank
from category_averages ca
join contestants ct on ct.id = ca.contestant_id
join categories cat on cat.id = ca.category_id;

-- Overall ranking using ranking points (sum of category ranks, lower is better)
create view overall_rankings as
select
  cr.contestant_id,
  cr.division,
  ct.full_name,
  ct.number,
  sum(cr.rank) as total_points,
  row_number() over (
    partition by cr.division
    order by sum(cr.rank), cr.contestant_id
  ) as final_placement
from category_rankings cr
join contestants ct on ct.id = cr.contestant_id
group by cr.contestant_id, cr.division, ct.full_name, ct.number;

-- Keep legacy leaderboard based on total_score (not used for final placements but handy for reference)
create view leaderboard as
select
  row_number() over (partition by division order by total_score desc, contestant_id) as rank,
  contestant_id,
  division,
  total_score
from contestant_totals;

-- Seed master data for categories & criteria using exact guidelines
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
    -- Production
    ('production', 'poise-bearing', 'Poise and Bearing', 0.30, 1),
    ('production', 'stage-deportment', 'Stage Deportment', 0.35, 2),
    ('production', 'mastery', 'Mastery of the Choreography', 0.30, 3),
    ('production', 'audience-impact', 'Audience Impact', 0.05, 4),
    -- Runway
    ('runway', 'creativity', 'Creativity and Style', 0.30, 1),
    ('runway', 'personality', 'Personality and Stage Presence', 0.20, 2),
    ('runway', 'costume', 'Suitability of the Costume', 0.30, 3),
    ('runway', 'projection', 'Poise, Bearing, and Projection', 0.20, 4),
    -- Street Wear
    ('streetwear', 'beauty-physique', 'Beauty and Physique', 0.30, 1),
    ('streetwear', 'stage-deportment', 'Stage Deportment', 0.30, 2),
    ('streetwear', 'poise-bearing', 'Poise and Bearing', 0.30, 3),
    ('streetwear', 'audience-impact', 'Audience Impact', 0.10, 4),
    -- Free Speech
    ('free-speech', 'content', 'Content & Substance', 0.40, 1),
    ('free-speech', 'delivery', 'Delivery & Presence', 0.30, 2),
    ('free-speech', 'theme', 'Alignment to “Ascend” Theme', 0.20, 3),
    ('free-speech', 'respect', 'Respectfulness & Positivity', 0.10, 4),
    -- Modern Barong & Long Gown
    ('formal', 'fitness-style', 'Fitness and Style', 0.20, 1),
    ('formal', 'beauty-elegance', 'Beauty and Elegance', 0.30, 2),
    ('formal', 'stage-deportment', 'Stage Deportment', 0.25, 3),
    ('formal', 'projection', 'Poise, Bearing, and Projection', 0.25, 4),
    -- Interview
    ('interview', 'wit', 'Wit and Content', 0.50, 1),
    ('interview', 'delivery', 'Delivery & Choice of Words', 0.25, 2),
    ('interview', 'poise', 'Poise and Bearing', 0.15, 3),
    ('interview', 'audience-impact', 'Audience Impact', 0.10, 4)
) as data(category_slug, slug, label, percentage, sort_order)
  on cat.slug = data.category_slug
on conflict (category_id, slug) do nothing;

-- Helper function to refresh leaderboards after new scores
create or replace function refresh_leaderboards()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view concurrently category_averages;
  refresh materialized view concurrently contestant_totals;
end;
$$;


