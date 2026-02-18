-- Allow public read access to components (app runs without auth)
CREATE POLICY "Allow public read access to components"
ON public.components FOR SELECT
USING (true);

-- Allow public insert to components
CREATE POLICY "Allow public insert to components"
ON public.components FOR INSERT
WITH CHECK (true);

-- Allow public update to components
CREATE POLICY "Allow public update to components"
ON public.components FOR UPDATE
USING (true);

-- Allow public delete to components
CREATE POLICY "Allow public delete to components"
ON public.components FOR DELETE
USING (true);