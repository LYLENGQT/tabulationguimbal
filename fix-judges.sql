-- =====================================================
-- FIX FOR JUDGE EMAIL CASE SENSITIVITY ISSUE
-- Run this in Supabase Dashboard → SQL Editor
-- =====================================================

-- STEP 1: Add the missing username column to judges table (if not already done)
ALTER TABLE judges 
ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_judges_username ON judges(username);

-- STEP 2: Fix existing judge emails to be lowercase
-- This ensures they match Supabase Auth (which normalizes emails to lowercase)
UPDATE judges 
SET email = LOWER(email);

-- STEP 3: Check current state (run this to see what judges exist)
SELECT id, full_name, email, username, division FROM judges;

-- =====================================================
-- IF YOU STILL HAVE ISSUES - ALTERNATIVE FIX
-- =====================================================
-- If the judge still doesn't work, delete and recreate:
-- 
-- 1. In Supabase Dashboard → Authentication → Users:
--    Delete all judge users (keep admin@mrmsteen2025.com)
--
-- 2. In SQL Editor, delete judge records:
--    DELETE FROM judges;
--
-- 3. Recreate judges from the admin panel (they will now use lowercase emails)

