-- Drop the existing policy and recreate with correct permissions for anonymous access
DROP POLICY IF EXISTS "Allow company creation during signup" ON public.companies;

-- Allow anonymous users to insert companies during signup
CREATE POLICY "Allow company creation during signup"
ON public.companies
FOR INSERT
TO anon, authenticated
WITH CHECK (true);