import { useState, useCallback, useEffect } from 'react';
import { Component, Shape, TileSize, TILE_SIZES, ComponentVariation } from '@/types/schematic';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Default company_id used when running without auth
const DEFAULT_COMPANY_ID = '83ccf558-e5ad-4b01-8125-23fb4e92c64e';

function mapDbToComponent(row: any): Component {
  return {
    id: row.id,
    name: row.name,
    shapes: (row.shapes || []) as Shape[],
    width: row.width,
    height: row.height,
    tileSize: (row.tile_size || '1x1') as TileSize,
    category: row.category || '',
    variations: (row.variations || []) as ComponentVariation[],
    labelingEnabled: row.labeling_enabled || false,
    labelingPriority: row.labeling_priority || 1,
    labelingColor: row.labeling_color || '#000000',
    autoConnectionsEnabled: row.auto_connections_enabled || false,
  };
}

export function useComponents() {
  const [components, setComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchComponents = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('components')
      .select('*')
      .order('name');
    
    if (error) {
      console.error('Error loading components:', error);
      toast.error('Fehler beim Laden der Komponenten');
      setLoading(false);
      return;
    }
    
    setComponents((data || []).map(mapDbToComponent));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchComponents();
  }, [fetchComponents]);

  const saveComponent = useCallback(async (
    name: string, shapes: Shape[], tileSize: TileSize,
    category?: string, labelingEnabled?: boolean, labelingPriority?: number,
    labelingColor?: string, autoConnectionsEnabled?: boolean
  ): Promise<Component | null> => {
    const config = TILE_SIZES[tileSize];
    const { data, error } = await supabase
      .from('components')
      .insert({
        name,
        shapes: shapes as any,
        width: config.cols,
        height: config.rows,
        tile_size: tileSize,
        category: category || '',
        variations: [] as any,
        labeling_enabled: labelingEnabled || false,
        labeling_priority: labelingPriority || 1,
        labeling_color: labelingColor || '#000000',
        auto_connections_enabled: autoConnectionsEnabled || false,
        company_id: DEFAULT_COMPANY_ID,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving component:', error);
      toast.error('Fehler beim Speichern');
      return null;
    }

    const newComp = mapDbToComponent(data);
    setComponents(prev => [...prev, newComp]);
    return newComp;
  }, []);

  const updateComponent = useCallback(async (
    id: string, name: string, shapes: Shape[], tileSize: TileSize,
    category?: string, labelingEnabled?: boolean, labelingPriority?: number,
    labelingColor?: string, autoConnectionsEnabled?: boolean
  ): Promise<boolean> => {
    const config = TILE_SIZES[tileSize];
    const { error } = await supabase
      .from('components')
      .update({
        name,
        shapes: shapes as any,
        width: config.cols,
        height: config.rows,
        tile_size: tileSize,
        category: category || '',
        labeling_enabled: labelingEnabled || false,
        labeling_priority: labelingPriority || 1,
        labeling_color: labelingColor || '#000000',
        auto_connections_enabled: autoConnectionsEnabled || false,
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating component:', error);
      toast.error('Fehler beim Aktualisieren');
      return false;
    }

    setComponents(prev => prev.map(c =>
      c.id === id ? { ...c, name, shapes, width: config.cols, height: config.rows, tileSize, category: category || '', labelingEnabled: labelingEnabled || false, labelingPriority: labelingPriority || 1, labelingColor: labelingColor || '#000000', autoConnectionsEnabled: autoConnectionsEnabled || false } : c
    ));
    return true;
  }, []);

  const updateComponentFull = useCallback(async (updatedComponent: Component): Promise<boolean> => {
    const { error } = await supabase
      .from('components')
      .update({
        name: updatedComponent.name,
        shapes: updatedComponent.shapes as any,
        width: updatedComponent.width,
        height: updatedComponent.height,
        tile_size: updatedComponent.tileSize || '1x1',
        category: updatedComponent.category || '',
        variations: (updatedComponent.variations || []) as any,
        labeling_enabled: updatedComponent.labelingEnabled || false,
        labeling_priority: updatedComponent.labelingPriority || 1,
        labeling_color: updatedComponent.labelingColor || '#000000',
        auto_connections_enabled: updatedComponent.autoConnectionsEnabled || false,
      })
      .eq('id', updatedComponent.id);

    if (error) {
      console.error('Error updating component:', error);
      return false;
    }

    setComponents(prev => prev.map(c => c.id === updatedComponent.id ? updatedComponent : c));
    return true;
  }, []);

  const deleteComponent = useCallback(async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('components')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting component:', error);
      toast.error('Fehler beim Löschen');
      return false;
    }

    setComponents(prev => prev.filter(c => c.id !== id));
    return true;
  }, []);

  const clearAllComponents = useCallback(async (): Promise<boolean> => {
    const { error } = await supabase
      .from('components')
      .delete()
      .eq('company_id', DEFAULT_COMPANY_ID);

    if (error) {
      console.error('Error clearing components:', error);
      return false;
    }

    setComponents([]);
    return true;
  }, []);

  const reloadComponents = useCallback(() => {
    fetchComponents();
  }, [fetchComponents]);

  return {
    components,
    loading,
    saveComponent,
    updateComponent,
    updateComponentFull,
    deleteComponent,
    clearAllComponents,
    reloadComponents,
    importFromLocalStorage: async () => false,
    hasLocalStorageComponents: false
  };
}
