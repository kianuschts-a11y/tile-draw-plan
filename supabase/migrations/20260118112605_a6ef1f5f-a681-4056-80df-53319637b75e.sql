-- Allow company creation during signup (before user is authenticated)
CREATE POLICY "Allow company creation during signup"
ON public.companies
FOR INSERT
WITH CHECK (true);

-- Allow profile creation during signup
CREATE POLICY "Users can create their own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = user_id);