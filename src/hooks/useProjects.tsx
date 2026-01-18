import { useState, useEffect, useCallback } from "react";
import { Project, ComponentQuantity, ComponentGroup, GroupMatch } from "@/types/schematic";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Json } from "@/integrations/supabase/types";

export function useProjects() {
  const { companyId } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProjects = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mappedProjects: Project[] = (data || []).map(row => ({
        id: row.id,
        name: row.name,
        componentQuantities: (row.component_quantities as unknown as ComponentQuantity[]) || [],
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));

      setProjects(mappedProjects);
    } catch (error) {
      console.error('Error loading projects:', error);
      toast.error('Fehler beim Laden der Projekte');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const createProject = useCallback(async (name: string, componentQuantities: ComponentQuantity[]): Promise<Project | null> => {
    if (!companyId) {
      toast.error('Keine Firma gefunden');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          company_id: companyId,
          name,
          component_quantities: componentQuantities as unknown as Json
        })
        .select()
        .single();

      if (error) throw error;

      const newProject: Project = {
        id: data.id,
        name: data.name,
        componentQuantities: (data.component_quantities as unknown as ComponentQuantity[]) || [],
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };

      setProjects(prev => [newProject, ...prev]);
      toast.success('Projekt erstellt');
      return newProject;
    } catch (error) {
      console.error('Error creating project:', error);
      toast.error('Fehler beim Erstellen des Projekts');
      return null;
    }
  }, [companyId]);

  const updateProject = useCallback(async (id: string, name: string, componentQuantities: ComponentQuantity[]): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ name, component_quantities: componentQuantities as unknown as Json })
        .eq('id', id);

      if (error) throw error;

      setProjects(prev => prev.map(p => 
        p.id === id ? { ...p, name, componentQuantities } : p
      ));
      toast.success('Projekt aktualisiert');
      return true;
    } catch (error) {
      console.error('Error updating project:', error);
      toast.error('Fehler beim Aktualisieren des Projekts');
      return false;
    }
  }, []);

  const deleteProject = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setProjects(prev => prev.filter(p => p.id !== id));
      toast.success('Projekt gelöscht');
      return true;
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error('Fehler beim Löschen des Projekts');
      return false;
    }
  }, []);

  // Find matching groups based on project component list
  // A group is only suggested if ALL its components are present in the project
  // Match percentage = how much of the project the group covers
  const findMatchingGroups = useCallback((
    projectQuantities: ComponentQuantity[],
    groups: ComponentGroup[]
  ): GroupMatch[] => {
    if (projectQuantities.length === 0) return [];

    // Build a map of project component IDs to their quantities
    const projectComponentMap = new Map(projectQuantities.map(q => [q.componentId, q.quantity]));
    const projectComponentIds = new Set(projectQuantities.map(q => q.componentId));

    return groups.map(group => {
      // Get all component IDs needed by this group (from layoutData if available)
      let groupComponentIds: string[] = [];
      if (group.layoutData?.tiles && group.layoutData.tiles.length > 0) {
        groupComponentIds = group.layoutData.tiles.map(t => t.componentId);
      } else {
        groupComponentIds = group.componentIds;
      }
      
      const uniqueGroupComponentIds = [...new Set(groupComponentIds)];
      
      // Check if ALL group components are in the project
      const allGroupComponentsInProject = uniqueGroupComponentIds.every(id => projectComponentIds.has(id));
      
      if (!allGroupComponentsInProject) {
        // Group cannot be used - some components are missing
        return {
          group,
          matchPercentage: 0,
          matchingComponents: [],
          missingComponents: [...projectComponentIds].filter(id => !uniqueGroupComponentIds.includes(id)),
          extraComponents: uniqueGroupComponentIds.filter(id => !projectComponentIds.has(id))
        };
      }
      
      // All group components are present - calculate match percentage
      // Match percentage = (number of group component instances / total project components) * 100
      const groupComponentCount = groupComponentIds.length;
      const totalProjectComponents = projectQuantities.reduce((sum, q) => sum + q.quantity, 0);
      
      // Check if we have enough quantity of each component
      const componentCountInGroup = new Map<string, number>();
      for (const id of groupComponentIds) {
        componentCountInGroup.set(id, (componentCountInGroup.get(id) || 0) + 1);
      }
      
      let canFulfill = true;
      for (const [id, needed] of componentCountInGroup.entries()) {
        const available = projectComponentMap.get(id) || 0;
        if (available < needed) {
          canFulfill = false;
          break;
        }
      }
      
      if (!canFulfill) {
        return {
          group,
          matchPercentage: 0,
          matchingComponents: [],
          missingComponents: [],
          extraComponents: []
        };
      }
      
      const matchPercentage = (groupComponentCount / totalProjectComponents) * 100;

      return {
        group,
        matchPercentage: Math.min(100, matchPercentage),
        matchingComponents: uniqueGroupComponentIds,
        missingComponents: [...projectComponentIds].filter(id => !uniqueGroupComponentIds.includes(id)),
        extraComponents: []
      };
    })
    .filter(match => match.matchPercentage > 0)
    .sort((a, b) => b.matchPercentage - a.matchPercentage);
  }, []);

  return {
    projects,
    loading,
    createProject,
    updateProject,
    deleteProject,
    reloadProjects: loadProjects,
    findMatchingGroups
  };
}
