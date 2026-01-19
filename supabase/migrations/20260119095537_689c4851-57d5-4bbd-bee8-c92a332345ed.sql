-- Remove redundant email field from profiles table
-- Email is already securely stored in auth.users table
-- This eliminates unnecessary PII exposure risk

ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;