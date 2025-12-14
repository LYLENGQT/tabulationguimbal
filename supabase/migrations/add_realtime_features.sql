-- Migration: Add real-time features (activity feed, score history, judge status)
-- Run this in Supabase SQL editor

-- Add last_active timestamp to judges table for status tracking
ALTER TABLE judges 
ADD COLUMN IF NOT EXISTS last_active timestamptz;

-- Create activity feed table
CREATE TABLE IF NOT EXISTS activity_log (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid, -- Can be judge_id or admin (from auth.users)
  user_type text NOT NULL CHECK (user_type IN ('judge', 'admin')),
  user_name text NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('score_submitted', 'score_updated', 'lock_created', 'lock_removed', 'judge_logged_in', 'judge_logged_out', 'contestant_created', 'judge_created', 'system_reset')),
  entity_type text, -- 'score', 'lock', 'contestant', 'judge', etc.
  entity_id uuid,
  description text NOT NULL,
  metadata jsonb, -- Store additional context like contestant name, category, etc.
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_action_type ON activity_log(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);

-- Create score history/audit log table
CREATE TABLE IF NOT EXISTS score_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  score_id uuid REFERENCES scores(id) ON DELETE SET NULL, -- Set to NULL when score is deleted to preserve history
  judge_id uuid REFERENCES judges(id) ON DELETE CASCADE,
  contestant_id uuid REFERENCES contestants(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id) ON DELETE CASCADE,
  criterion_id uuid REFERENCES criteria(id) ON DELETE CASCADE,
  old_raw_score numeric,
  new_raw_score numeric, -- Made nullable to handle DELETE operations
  old_weighted_score numeric,
  new_weighted_score numeric, -- Made nullable to handle DELETE operations
  changed_by uuid, -- user_id from auth.users
  change_type text NOT NULL CHECK (change_type IN ('created', 'updated', 'deleted')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for score history
CREATE INDEX IF NOT EXISTS idx_score_history_score_id ON score_history(score_id);
CREATE INDEX IF NOT EXISTS idx_score_history_judge_id ON score_history(judge_id);
CREATE INDEX IF NOT EXISTS idx_score_history_contestant_id ON score_history(contestant_id);
CREATE INDEX IF NOT EXISTS idx_score_history_created_at ON score_history(created_at DESC);

-- Function to log score changes automatically
CREATE OR REPLACE FUNCTION log_score_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO score_history (
      score_id, judge_id, contestant_id, category_id, criterion_id,
      new_raw_score, new_weighted_score, changed_by, change_type
    ) VALUES (
      NEW.id, NEW.judge_id, NEW.contestant_id, NEW.category_id, NEW.criterion_id,
      NEW.raw_score, NEW.weighted_score, auth.uid(), 'created'
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO score_history (
      score_id, judge_id, contestant_id, category_id, criterion_id,
      old_raw_score, new_raw_score, old_weighted_score, new_weighted_score,
      changed_by, change_type
    ) VALUES (
      NEW.id, NEW.judge_id, NEW.contestant_id, NEW.category_id, NEW.criterion_id,
      OLD.raw_score, NEW.raw_score, OLD.weighted_score, NEW.weighted_score,
      auth.uid(), 'updated'
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Insert history record for deleted score
    -- Set score_id to NULL since the score is being deleted (foreign key constraint)
    INSERT INTO score_history (
      score_id, judge_id, contestant_id, category_id, criterion_id,
      old_raw_score, new_raw_score, old_weighted_score, new_weighted_score, changed_by, change_type
    ) VALUES (
      NULL, OLD.judge_id, OLD.contestant_id, OLD.category_id, OLD.criterion_id,
      OLD.raw_score, NULL, OLD.weighted_score, NULL, auth.uid(), 'deleted'
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically log score changes
DROP TRIGGER IF EXISTS trigger_log_score_change ON scores;
CREATE TRIGGER trigger_log_score_change
  AFTER INSERT OR UPDATE OR DELETE ON scores
  FOR EACH ROW
  EXECUTE FUNCTION log_score_change();

-- Enable Row Level Security for activity_log (optional, adjust as needed)
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read activity log
CREATE POLICY "Allow authenticated users to read activity log"
  ON activity_log FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Allow authenticated users to insert activity log
CREATE POLICY "Allow authenticated users to insert activity log"
  ON activity_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Enable RLS for score_history
ALTER TABLE score_history ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read score history
CREATE POLICY "Allow authenticated users to read score history"
  ON score_history FOR SELECT
  TO authenticated
  USING (true);
