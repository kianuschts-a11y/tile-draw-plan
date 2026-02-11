
-- Add category and tags columns to component_groups
ALTER TABLE public.component_groups ADD COLUMN category text;
ALTER TABLE public.component_groups ADD COLUMN tags text[] DEFAULT '{}';

-- Create group_categories table
CREATE TABLE public.group_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.group_categories ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view categories from their company"
  ON public.group_categories FOR SELECT
  USING (company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.user_id = auth.uid()));

CREATE POLICY "Users can create categories for their company"
  ON public.group_categories FOR INSERT
  WITH CHECK (company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.user_id = auth.uid()));

CREATE POLICY "Users can update categories from their company"
  ON public.group_categories FOR UPDATE
  USING (company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.user_id = auth.uid()));

CREATE POLICY "Users can delete categories from their company"
  ON public.group_categories FOR DELETE
  USING (company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.user_id = auth.uid()));
