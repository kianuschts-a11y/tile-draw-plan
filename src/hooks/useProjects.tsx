import { useState, useCallback } from "react";
import { Project, ComponentQuantity, ComponentGroup, GroupMatch } from "@/types/schematic";
import { loadFromStorage, saveToStorage } from "@/lib/localStorage";
import { toast } from "sonner";

const STORAGE_KEY = 'schematic-editor-projects';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>(() => 
    loadFromStorage<Project>(STORAGE_KEY, [])
  );

  const persist = useCallback((updated: Project[]) => {
    setProjects(updated);
    saveToStorage(STORAGE_KEY, updated);
  }, []);

  const createProject = useCallback(async (name: string, componentQuantities: ComponentQuantity[]): Promise<Project | null> => {
    const newProject: Project = {
      id: crypto.randomUUID(), name, componentQuantities,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    persist([newProject, ...projects]);
    toast.success('Projekt erstellt');
    return newProject;
  }, [projects, persist]);

  const updateProject = useCallback(async (id: string, name: string, componentQuantities: ComponentQuantity[]): Promise<boolean> => {
    persist(projects.map(p => p.id === id ? { ...p, name, componentQuantities } : p));
    toast.success('Projekt aktualisiert');
    return true;
  }, [projects, persist]);

  const deleteProject = useCallback(async (id: string): Promise<boolean> => {
    persist(projects.filter(p => p.id !== id));
    toast.success('Projekt gelöscht');
    return true;
  }, [projects, persist]);

  const findMatchingGroups = useCallback((
    projectQuantities: ComponentQuantity[],
    groups: ComponentGroup[]
  ): GroupMatch[] => {
    if (projectQuantities.length === 0) return [];

    const projectComponentMap = new Map(projectQuantities.map(q => [q.componentId, q.quantity]));
    const projectComponentIds = new Set(projectQuantities.map(q => q.componentId));

    return groups.map(group => {
      let groupComponentIds: string[] = [];
      if (group.layoutData?.tiles && group.layoutData.tiles.length > 0) {
        groupComponentIds = group.layoutData.tiles.map(t => t.componentId);
      } else {
        groupComponentIds = group.componentIds;
      }
      
      const uniqueGroupComponentIds = [...new Set(groupComponentIds)];
      const allGroupComponentsInProject = uniqueGroupComponentIds.every(id => projectComponentIds.has(id));
      
      if (!allGroupComponentsInProject) {
        return {
          group, matchPercentage: 0, matchingComponents: [],
          missingComponents: [...projectComponentIds].filter(id => !uniqueGroupComponentIds.includes(id)),
          extraComponents: uniqueGroupComponentIds.filter(id => !projectComponentIds.has(id))
        };
      }
      
      const groupComponentCount = groupComponentIds.length;
      const totalProjectComponents = projectQuantities.reduce((sum, q) => sum + q.quantity, 0);
      
      const componentCountInGroup = new Map<string, number>();
      for (const id of groupComponentIds) {
        componentCountInGroup.set(id, (componentCountInGroup.get(id) || 0) + 1);
      }
      
      let canFulfill = true;
      for (const [id, needed] of componentCountInGroup.entries()) {
        const available = projectComponentMap.get(id) || 0;
        if (available < needed) { canFulfill = false; break; }
      }
      
      if (!canFulfill) {
        return { group, matchPercentage: 0, matchingComponents: [], missingComponents: [], extraComponents: [] };
      }
      
      const matchPercentage = (groupComponentCount / totalProjectComponents) * 100;
      return {
        group, matchPercentage: Math.min(100, matchPercentage),
        matchingComponents: uniqueGroupComponentIds,
        missingComponents: [...projectComponentIds].filter(id => !uniqueGroupComponentIds.includes(id)),
        extraComponents: []
      };
    })
    .filter(match => match.matchPercentage > 0)
    .sort((a, b) => b.matchPercentage - a.matchPercentage);
  }, []);

  const reloadProjects = useCallback(() => {
    setProjects(loadFromStorage<Project>(STORAGE_KEY, []));
  }, []);

  return { projects, loading: false, createProject, updateProject, deleteProject, reloadProjects, findMatchingGroups };
}
