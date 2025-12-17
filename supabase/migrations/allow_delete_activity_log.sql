-- Allow admin to clear the activity feed
-- Run this migration in Supabase to enable the "Clear feed" button.
-- Restricts DELETE to the admin account.

-- Enable RLS if not already
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Policy: allow the admin email to delete all activity log rows
DROP POLICY IF EXISTS "Allow admin to delete activity log" ON activity_log;
CREATE POLICY "Allow admin to delete activity log"
  ON activity_log
  FOR DELETE
  TO authenticated
  USING (lower(auth.email()) = 'admin@mrmsteen2025.com');




