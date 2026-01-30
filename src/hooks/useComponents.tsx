import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Component, Shape, TileSize, TILE_SIZES, ComponentVariation } from '@/types/schematic';
import { useAuth } from './useAuth';
import { Json } from '@/integrations/supabase/types';

const LOCAL_STORAGE_KEY = 'schematic-editor-components';

export function useComponents() {
  const { user, companyId, loading: authLoading } = useAuth();
  const [components, setComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrated, setMigrated] = useState(false);
  const [hasLocalStorageComponents, setHasLocalStorageComponents] = useState(false);

  // Check if localStorage has components
  useEffect(() => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      try {
        const localComponents = JSON.parse(stored);
        setHasLocalStorageComponents(Array.isArray(localComponents) && localComponents.length > 0);
      } catch {
        setHasLocalStorageComponents(false);
      }
    }
  }, []);

  // Load components from database
  const loadComponents = useCallback(async () => {
    if (!user || !companyId) {
      setComponents([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('components')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading components:', error);
        return;
      }

      const mappedComponents: Component[] = (data || []).map((c) => ({
        id: c.id,
        name: c.name,
        shapes: (c.shapes as unknown) as Shape[],
        width: c.width,
        height: c.height,
        tileSize: c.tile_size as TileSize,
        category: (c as any).category || '',
        variations: (c.variations as unknown) as ComponentVariation[],
        labelingEnabled: (c as any).labeling_enabled || false,
        labelingPriority: (c as any).labeling_priority || 1
      }));

      setComponents(mappedComponents);
    } catch (error) {
      console.error('Error loading components:', error);
    } finally {
      setLoading(false);
    }
  }, [user, companyId]);

  // Migrate localStorage components for current company (only if company has no components yet)
  const migrateLocalStorageComponents = useCallback(async () => {
    if (!user || !companyId || migrated) return;

    try {
      // Check if THIS COMPANY has any components yet
      const { count } = await supabase
        .from('components')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId);

      if (count === 0) {
        // Load components from localStorage
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (stored) {
          const localComponents: Component[] = JSON.parse(stored);
          
          if (localComponents.length > 0) {
            // Insert each component into the database
            for (const component of localComponents) {
              await supabase.from('components').insert({
                company_id: companyId,
                name: component.name,
                shapes: component.shapes as unknown as Json,
                width: component.width,
                height: component.height,
                tile_size: component.tileSize || '1x1',
                variations: (component.variations || []) as unknown as Json
              });
            }
            
            console.log(`Migrated ${localComponents.length} components from localStorage to company ${companyId}`);
            
            // Clear localStorage after successful migration
            localStorage.removeItem(LOCAL_STORAGE_KEY);
          }
        }
      }

      setMigrated(true);
    } catch (error) {
      console.error('Error migrating components:', error);
    }
  }, [user, companyId, migrated]);

  useEffect(() => {
    if (!authLoading && user && companyId) {
      migrateLocalStorageComponents().then(() => loadComponents());
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [authLoading, user, companyId, migrateLocalStorageComponents, loadComponents]);

  const saveComponent = useCallback(async (name: string, shapes: Shape[], tileSize: TileSize, category?: string, labelingEnabled?: boolean, labelingPriority?: number): Promise<Component | null> => {
    if (!companyId) return null;

    const config = TILE_SIZES[tileSize];
    
    try {
      const { data, error } = await supabase
        .from('components')
        .insert({
          company_id: companyId,
          name,
          shapes: shapes as unknown as Json,
          width: config.cols,
          height: config.rows,
          tile_size: tileSize,
          category: category || '',
          variations: [] as unknown as Json,
          labeling_enabled: labelingEnabled || false,
          labeling_priority: labelingPriority || 1
        } as any)
        .select()
        .single();

      if (error) {
        console.error('Error saving component:', error);
        return null;
      }

      const newComponent: Component = {
        id: data.id,
        name: data.name,
        shapes: (data.shapes as unknown) as Shape[],
        width: data.width,
        height: data.height,
        tileSize: data.tile_size as TileSize,
        category: (data as any).category || '',
        variations: (data.variations as unknown) as ComponentVariation[],
        labelingEnabled: (data as any).labeling_enabled || false,
        labelingPriority: (data as any).labeling_priority || 1
      };

      setComponents(prev => [...prev, newComponent]);
      return newComponent;
    } catch (error) {
      console.error('Error saving component:', error);
      return null;
    }
  }, [companyId]);

  const updateComponent = useCallback(async (id: string, name: string, shapes: Shape[], tileSize: TileSize, category?: string, labelingEnabled?: boolean, labelingPriority?: number): Promise<boolean> => {
    const config = TILE_SIZES[tileSize];

    try {
      const { error } = await supabase
        .from('components')
        .update({
          name,
          shapes: shapes as unknown as Json,
          width: config.cols,
          height: config.rows,
          tile_size: tileSize,
          category: category || '',
          labeling_enabled: labelingEnabled || false,
          labeling_priority: labelingPriority || 1
        } as any)
        .eq('id', id);

      if (error) {
        console.error('Error updating component:', error);
        return false;
      }

      setComponents(prev => prev.map(c => 
        c.id === id ? { 
          ...c, 
          name, 
          shapes, 
          width: config.cols, 
          height: config.rows, 
          tileSize, 
          category: category || '',
          labelingEnabled: labelingEnabled || false,
          labelingPriority: labelingPriority || 1
        } : c
      ));
      
      return true;
    } catch (error) {
      console.error('Error updating component:', error);
      return false;
    }
  }, []);

  const updateComponentFull = useCallback(async (updatedComponent: Component): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('components')
        .update({
          name: updatedComponent.name,
          shapes: updatedComponent.shapes as unknown as Json,
          width: updatedComponent.width,
          height: updatedComponent.height,
          tile_size: updatedComponent.tileSize,
          variations: (updatedComponent.variations || []) as unknown as Json
        })
        .eq('id', updatedComponent.id);

      if (error) {
        console.error('Error updating component:', error);
        return false;
      }

      setComponents(prev => prev.map(c => 
        c.id === updatedComponent.id ? updatedComponent : c
      ));
      
      return true;
    } catch (error) {
      console.error('Error updating component:', error);
      return false;
    }
  }, []);

  const deleteComponent = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('components')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting component:', error);
        return false;
      }

      setComponents(prev => prev.filter(c => c.id !== id));
      return true;
    } catch (error) {
      console.error('Error deleting component:', error);
      return false;
    }
  }, []);

  const clearAllComponents = useCallback(async (): Promise<boolean> => {
    if (!companyId) return false;

    try {
      const { error } = await supabase
        .from('components')
        .delete()
        .eq('company_id', companyId);

      if (error) {
        console.error('Error clearing components:', error);
        return false;
      }

      setComponents([]);
      return true;
    } catch (error) {
      console.error('Error clearing components:', error);
      return false;
    }
  }, [companyId]);

  // Manual import from localStorage
  const importFromLocalStorage = useCallback(async (): Promise<boolean> => {
    if (!companyId) return false;

    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!stored) return false;

      const localComponents: Component[] = JSON.parse(stored);
      
      if (localComponents.length === 0) return false;

      // Insert each component into the database
      for (const component of localComponents) {
        await supabase.from('components').insert({
          company_id: companyId,
          name: component.name,
          shapes: component.shapes as unknown as Json,
          width: component.width,
          height: component.height,
          tile_size: component.tileSize || '1x1',
          variations: (component.variations || []) as unknown as Json
        });
      }
      
      console.log(`Imported ${localComponents.length} components from localStorage`);
      
      // Clear localStorage after successful import
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      setHasLocalStorageComponents(false);
      
      // Reload components
      await loadComponents();
      
      return true;
    } catch (error) {
      console.error('Error importing components:', error);
      return false;
    }
  }, [companyId, loadComponents]);

  return {
    components,
    loading,
    saveComponent,
    updateComponent,
    updateComponentFull,
    deleteComponent,
    clearAllComponents,
    reloadComponents: loadComponents,
    importFromLocalStorage,
    hasLocalStorageComponents
  };
}
