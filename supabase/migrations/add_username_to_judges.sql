-- Migration: Add username column to judges table
-- Run this in Supabase SQL editor

ALTER TABLE judges 
ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- Create index for faster username lookups
CREATE INDEX IF NOT EXISTS idx_judges_username ON judges(username);
