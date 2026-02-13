import { useState, useCallback } from 'react';
import { Component, Shape, TileSize, TILE_SIZES, ComponentVariation } from '@/types/schematic';
import { DEFAULT_COMPONENTS } from '@/data/defaultComponents';
import { loadFromStorage, saveToStorage } from '@/lib/localStorage';

const STORAGE_KEY = 'schematic-editor-components';

export function useComponents() {
  const [components, setComponents] = useState<Component[]>(() => 
    loadFromStorage<Component>(STORAGE_KEY, DEFAULT_COMPONENTS as Component[])
  );

  const persist = useCallback((updated: Component[]) => {
    setComponents(updated);
    saveToStorage(STORAGE_KEY, updated);
  }, []);

  const saveComponent = useCallback((name: string, shapes: Shape[], tileSize: TileSize, category?: string, labelingEnabled?: boolean, labelingPriority?: number, labelingColor?: string, autoConnectionsEnabled?: boolean): Component | null => {
    const config = TILE_SIZES[tileSize];
    const newComponent: Component = {
      id: crypto.randomUUID(),
      name,
      shapes,
      width: config.cols,
      height: config.rows,
      tileSize,
      category: category || '',
      variations: [] as ComponentVariation[],
      labelingEnabled: labelingEnabled || false,
      labelingPriority: labelingPriority || 1,
      labelingColor: labelingColor || '#000000',
      autoConnectionsEnabled: autoConnectionsEnabled || false
    };
    persist([...components, newComponent]);
    return newComponent;
  }, [components, persist]);

  const updateComponent = useCallback((id: string, name: string, shapes: Shape[], tileSize: TileSize, category?: string, labelingEnabled?: boolean, labelingPriority?: number, labelingColor?: string, autoConnectionsEnabled?: boolean): boolean => {
    const config = TILE_SIZES[tileSize];
    const updated = components.map(c => 
      c.id === id ? { ...c, name, shapes, width: config.cols, height: config.rows, tileSize, category: category || '', labelingEnabled: labelingEnabled || false, labelingPriority: labelingPriority || 1, labelingColor: labelingColor || '#000000', autoConnectionsEnabled: autoConnectionsEnabled || false } : c
    );
    persist(updated);
    return true;
  }, [components, persist]);

  const updateComponentFull = useCallback((updatedComponent: Component): boolean => {
    const updated = components.map(c => c.id === updatedComponent.id ? updatedComponent : c);
    persist(updated);
    return true;
  }, [components, persist]);

  const deleteComponent = useCallback((id: string): boolean => {
    persist(components.filter(c => c.id !== id));
    return true;
  }, [components, persist]);

  const clearAllComponents = useCallback((): boolean => {
    persist([]);
    return true;
  }, [persist]);

  const reloadComponents = useCallback(() => {
    setComponents(loadFromStorage<Component>(STORAGE_KEY, DEFAULT_COMPONENTS as Component[]));
  }, []);

  return {
    components,
    loading: false,
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
