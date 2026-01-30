-- Add labeling_color column to components table
ALTER TABLE public.components 
ADD COLUMN IF NOT EXISTS labeling_color TEXT DEFAULT '#000000';