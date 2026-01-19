-- Fix: Restrict company creation to authenticated users only during signup
-- This prevents unauthenticated users from creating unlimited company records

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Allow company creation during signup" ON public.companies;

-- Create a new policy that only allows authenticated users to create companies
CREATE POLICY "Allow company creation during signup"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);