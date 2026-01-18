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
  const findMatchingGroups = useCallback((
    projectQuantities: ComponentQuantity[],
    groups: ComponentGroup[]
  ): GroupMatch[] => {
    if (projectQuantities.length === 0) return [];

    const projectComponentIds = new Set(projectQuantities.map(q => q.componentId));

    return groups.map(group => {
      const groupComponentIds = new Set(group.componentIds);
      
      // Find matching components (in both project and group)
      const matchingComponents = group.componentIds.filter(id => projectComponentIds.has(id));
      
      // Find missing components (in project but not in group)
      const missingComponents = projectQuantities
        .map(q => q.componentId)
        .filter(id => !groupComponentIds.has(id));
      
      // Find extra components (in group but not in project)
      const extraComponents = group.componentIds.filter(id => !projectComponentIds.has(id));
      
      // Calculate match percentage
      // A group must have ALL its components in the project to be a match
      // The percentage is based on how many group components are in the project
      const matchCount = matchingComponents.length;
      
      // Only consider groups where all group components are in the project
      const allGroupComponentsInProject = extraComponents.length === 0;
      const matchPercentage = allGroupComponentsInProject 
        ? (matchCount / projectComponentIds.size) * 100 
        : 0;

      return {
        group,
        matchPercentage,
        matchingComponents,
        missingComponents,
        extraComponents
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
