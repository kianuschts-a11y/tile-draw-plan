-- Add layout_data column to component_groups to store positions and connections
ALTER TABLE public.component_groups 
ADD COLUMN layout_data jsonb DEFAULT '{}'::jsonb;

-- Add comment explaining the structure
COMMENT ON COLUMN public.component_groups.layout_data IS 'Stores relative tile positions and connections: { tiles: [{componentId, relativeX, relativeY}], connections: [{fromTileIndex, fromCell, toTileIndex, toCell, color}] }';