-- Add auto_connections_enabled column to components table
ALTER TABLE public.components 
ADD COLUMN auto_connections_enabled boolean DEFAULT false;