-- Add UPDATE policy to companies table for defense-in-depth
CREATE POLICY "Users can update their own company"
ON public.companies
FOR UPDATE
USING (id = get_user_company_id(auth.uid()))
WITH CHECK (id = get_user_company_id(auth.uid()));

-- Add security documentation comment to the SECURITY DEFINER function
COMMENT ON FUNCTION public.get_user_company_id(UUID) IS 
'SECURITY DEFINER function used in RLS policies. DO NOT MODIFY without security review. Must maintain: fixed search_path, parameterized queries only, no dynamic SQL.';