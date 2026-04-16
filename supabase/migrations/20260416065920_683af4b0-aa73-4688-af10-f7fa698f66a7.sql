
-- Temporary public read policy for component_groups
CREATE POLICY "Temporary public read access to component_groups"
ON public.component_groups
FOR SELECT
USING (true);

-- Temporary public read policy for saved_plans
CREATE POLICY "Temporary public read access to saved_plans"
ON public.saved_plans
FOR SELECT
USING (true);

-- Temporary public read policy for group_categories
CREATE POLICY "Temporary public read access to group_categories"
ON public.group_categories
FOR SELECT
USING (true);

-- Temporary public read policy for projects
CREATE POLICY "Temporary public read access to projects"
ON public.projects
FOR SELECT
USING (true);
