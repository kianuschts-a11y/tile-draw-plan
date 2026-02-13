import { useState, useCallback } from "react";
import { ComponentGroup, GroupLayoutData } from "@/types/schematic";
import { DEFAULT_GROUPS } from "@/data/defaultGroups";
import { loadFromStorage, saveToStorage } from "@/lib/localStorage";
import { toast } from "sonner";

const STORAGE_KEY = 'schematic-editor-groups';

export function useComponentGroups() {
  const [groups, setGroups] = useState<ComponentGroup[]>(() => 
    loadFromStorage<ComponentGroup>(STORAGE_KEY, DEFAULT_GROUPS as ComponentGroup[])
  );

  const persist = useCallback((updated: ComponentGroup[]) => {
    setGroups(updated);
    saveToStorage(STORAGE_KEY, updated);
  }, []);

  const createGroup = useCallback(async (
    name: string, componentIds: string[], layoutData?: GroupLayoutData, category?: string, tags?: string[]
  ): Promise<ComponentGroup | null> => {
    const newGroup: ComponentGroup = {
      id: crypto.randomUUID(), name, componentIds, layoutData, category, tags
    };
    persist([...groups, newGroup]);
    toast.success('Gruppe erstellt');
    return newGroup;
  }, [groups, persist]);

  const updateGroup = useCallback(async (id: string, name: string, componentIds: string[], category?: string, tags?: string[]): Promise<boolean> => {
    persist(groups.map(g => g.id === id ? { ...g, name, componentIds, category, tags } : g));
    return true;
  }, [groups, persist]);

  const deleteGroup = useCallback(async (id: string): Promise<boolean> => {
    persist(groups.filter(g => g.id !== id));
    toast.success('Gruppe gelöscht');
    return true;
  }, [groups, persist]);

  const reloadGroups = useCallback(() => {
    setGroups(loadFromStorage<ComponentGroup>(STORAGE_KEY, DEFAULT_GROUPS as ComponentGroup[]));
  }, []);

  return { groups, loading: false, createGroup, updateGroup, deleteGroup, reloadGroups };
}
