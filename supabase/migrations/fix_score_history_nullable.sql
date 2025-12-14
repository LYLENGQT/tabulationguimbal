-- Migration: Fix score_history table to allow NULL values for new_raw_score and new_weighted_score
-- This is needed for DELETE operations where there is no "new" value
-- Run this in Supabase SQL editor

-- Make new_raw_score and new_weighted_score nullable
ALTER TABLE score_history 
ALTER COLUMN new_raw_score DROP NOT NULL,
ALTER COLUMN new_weighted_score DROP NOT NULL;

-- Fix foreign key constraint to allow score_id to be NULL when score is deleted
-- First, drop the existing foreign key constraint
ALTER TABLE score_history 
DROP CONSTRAINT IF EXISTS score_history_score_id_fkey;

-- Recreate with ON DELETE SET NULL to preserve history when scores are deleted
ALTER TABLE score_history 
ADD CONSTRAINT score_history_score_id_fkey 
FOREIGN KEY (score_id) REFERENCES scores(id) ON DELETE SET NULL;

-- Update the trigger function to handle DELETE properly
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
