-- =====================================================================
-- SAMPLE DATA so the live board, rankings and dashboard aren't empty.
-- Remove before the real event with supabase/clear_demo.sql
-- (or the admin dashboard's system reset, which clears everything).
--
-- 6 contestants per division (numbers 1-6) and 2 sample judges per division
-- (usernames demo_judge_*, no login accounts). Every judge scores every
-- contestant in their division on all 24 criteria; every sheet is locked.
-- Scores are deterministic: a per-contestant strength plus a per-sheet
-- variation, so rankings look realistic and are identical on every re-run.
-- Safe to re-run.
-- =====================================================================

insert into contestants (number, full_name, division) values
  (1, 'Miguel Santos', 'male'),
  (2, 'Joshua Villanueva', 'male'),
  (3, 'Carlo Dela Cruz', 'male'),
  (4, 'Paolo Gonzaga', 'male'),
  (5, 'Rafael Tolentino', 'male'),
  (6, 'Adrian Sumagaysay', 'male'),
  (1, 'Andrea Lim', 'female'),
  (2, 'Bea Gallego', 'female'),
  (3, 'Kristine Taruc', 'female'),
  (4, 'Sofia Benedicto', 'female'),
  (5, 'Jasmine Palmares', 'female'),
  (6, 'Ella Mae Sorrosa', 'female')
on conflict (division, number) do nothing;

insert into judges (full_name, email, username, division) values
  ('Sample Judge Reyes', 'demo_judge_m1@judge.mrmsteen2025.com', 'demo_judge_m1', 'male'),
  ('Sample Judge Navarro', 'demo_judge_m2@judge.mrmsteen2025.com', 'demo_judge_m2', 'male'),
  ('Sample Judge Castillo', 'demo_judge_f1@judge.mrmsteen2025.com', 'demo_judge_f1', 'female'),
  ('Sample Judge Aquino', 'demo_judge_f2@judge.mrmsteen2025.com', 'demo_judge_f2', 'female')
on conflict (email) do nothing;

with sheets as (
  select
    j.id as judge_id,
    ct.id as contestant_id,
    cr.category_id,
    cr.id as criterion_id,
    cr.percentage,
    -- strength 0..12 per contestant, variation 0..13 per judge/criterion
    least(99, 74
      + abs(hashtext('strength:' || ct.division || ct.number)) % 13
      + abs(hashtext(j.username || ':' || ct.number || ':' || cr.id::text)) % 14
    ) as raw_score
  from judges j
  join contestants ct on ct.division = j.division
  cross join criteria cr
  where j.username like 'demo\_judge\_%'
)
insert into scores (judge_id, contestant_id, category_id, criterion_id, raw_score, weighted_score)
select judge_id, contestant_id, category_id, criterion_id, raw_score, round(raw_score * percentage, 4)
from sheets
on conflict (judge_id, contestant_id, criterion_id) do nothing;

insert into judge_category_locks (judge_id, category_id, contestant_id)
select distinct s.judge_id, s.category_id, s.contestant_id
from scores s
join judges j on j.id = s.judge_id
where j.username like 'demo\_judge\_%'
on conflict (judge_id, category_id, contestant_id) do nothing;

select refresh_leaderboards();
