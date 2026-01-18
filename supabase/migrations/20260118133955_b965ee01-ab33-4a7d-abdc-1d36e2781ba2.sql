-- Create projects table (component lists with quantities)
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  component_quantities JSONB NOT NULL DEFAULT '[]', -- Array of {componentId: string, quantity: number}
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Create policies for projects
CREATE POLICY "Users can view projects from their company"
ON public.projects FOR SELECT
USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create projects for their company"
ON public.projects FOR INSERT
WITH CHECK (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update projects from their company"
ON public.projects FOR UPDATE
USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete projects from their company"
ON public.projects FOR DELETE
USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create saved_plans table (finished drawings saved as templates)
CREATE TABLE public.saved_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  component_quantities JSONB NOT NULL DEFAULT '[]', -- Exact component quantities from the drawing
  drawing_data JSONB NOT NULL DEFAULT '{}', -- Tiles and connections data
  matched_group_id UUID REFERENCES public.component_groups(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saved_plans ENABLE ROW LEVEL SECURITY;

-- Create policies for saved_plans
CREATE POLICY "Users can view plans from their company"
ON public.saved_plans FOR SELECT
USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create plans for their company"
ON public.saved_plans FOR INSERT
WITH CHECK (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update plans from their company"
ON public.saved_plans FOR UPDATE
USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete plans from their company"
ON public.saved_plans FOR DELETE
USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_saved_plans_updated_at
BEFORE UPDATE ON public.saved_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();