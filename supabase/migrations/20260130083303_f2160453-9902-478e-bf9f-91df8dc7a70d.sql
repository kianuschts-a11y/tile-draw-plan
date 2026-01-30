-- Add labeling fields to components table
ALTER TABLE public.components 
ADD COLUMN IF NOT EXISTS labeling_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS labeling_priority INTEGER DEFAULT 1;