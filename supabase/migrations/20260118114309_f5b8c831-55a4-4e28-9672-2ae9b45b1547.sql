-- Drop the existing policy
DROP POLICY IF EXISTS "Allow company creation during signup" ON public.companies;

-- Recreate with public role (applies to all users including anon and authenticated)
CREATE POLICY "Allow company creation during signup"
ON public.companies
FOR INSERT
TO public
WITH CHECK (true);