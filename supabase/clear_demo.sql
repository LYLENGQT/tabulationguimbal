-- Removes everything added by supabase/seed_demo.sql and leaves real data alone.
-- Run this in the SQL editor before the real event.

delete from scores
where judge_id in (select id from judges where username like 'demo\_judge\_%');

delete from judge_category_locks
where judge_id in (select id from judges where username like 'demo\_judge\_%');

delete from score_history
where judge_id in (select id from judges where username like 'demo\_judge\_%');

delete from judges where username like 'demo\_judge\_%';

-- Sample contestants, matched on number + name + division so a real
-- contestant who happens to share a number is never removed
delete from contestants c
using (values
  (1, 'Miguel Santos', 'male'), (2, 'Joshua Villanueva', 'male'),
  (3, 'Carlo Dela Cruz', 'male'), (4, 'Paolo Gonzaga', 'male'),
  (5, 'Rafael Tolentino', 'male'), (6, 'Adrian Sumagaysay', 'male'),
  (1, 'Andrea Lim', 'female'), (2, 'Bea Gallego', 'female'),
  (3, 'Kristine Taruc', 'female'), (4, 'Sofia Benedicto', 'female'),
  (5, 'Jasmine Palmares', 'female'), (6, 'Ella Mae Sorrosa', 'female')
) as demo(number, full_name, division)
where c.number = demo.number and c.full_name = demo.full_name and c.division = demo.division;

select refresh_leaderboards();
