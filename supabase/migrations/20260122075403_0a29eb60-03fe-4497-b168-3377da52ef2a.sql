-- Add category column to components table
ALTER TABLE public.components 
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT '';