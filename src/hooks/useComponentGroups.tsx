import { useState, useEffect, useCallback } from "react";
import { ComponentGroup } from "@/types/schematic";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export function useComponentGroups() {
  const { companyId } = useAuth();
  const [groups, setGroups] = useState<ComponentGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const loadGroups = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('component_groups')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const mappedGroups: ComponentGroup[] = (data || []).map(row => ({
        id: row.id,
        name: row.name,
        componentIds: row.component_ids || []
      }));

      setGroups(mappedGroups);
    } catch (error) {
      console.error('Error loading groups:', error);
      toast.error('Fehler beim Laden der Gruppen');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const createGroup = useCallback(async (name: string, componentIds: string[]): Promise<ComponentGroup | null> => {
    if (!companyId) {
      toast.error('Keine Firma gefunden');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('component_groups')
        .insert({
          company_id: companyId,
          name,
          component_ids: componentIds
        })
        .select()
        .single();

      if (error) throw error;

      const newGroup: ComponentGroup = {
        id: data.id,
        name: data.name,
        componentIds: data.component_ids || []
      };

      setGroups(prev => [...prev, newGroup]);
      toast.success('Gruppe erstellt');
      return newGroup;
    } catch (error) {
      console.error('Error creating group:', error);
      toast.error('Fehler beim Erstellen der Gruppe');
      return null;
    }
  }, [companyId]);

  const updateGroup = useCallback(async (id: string, name: string, componentIds: string[]): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('component_groups')
        .update({ name, component_ids: componentIds })
        .eq('id', id);

      if (error) throw error;

      setGroups(prev => prev.map(g => 
        g.id === id ? { ...g, name, componentIds } : g
      ));
      return true;
    } catch (error) {
      console.error('Error updating group:', error);
      toast.error('Fehler beim Aktualisieren der Gruppe');
      return false;
    }
  }, []);

  const deleteGroup = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('component_groups')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setGroups(prev => prev.filter(g => g.id !== id));
      toast.success('Gruppe gelöscht');
      return true;
    } catch (error) {
      console.error('Error deleting group:', error);
      toast.error('Fehler beim Löschen der Gruppe');
      return false;
    }
  }, []);

  return {
    groups,
    loading,
    createGroup,
    updateGroup,
    deleteGroup,
    reloadGroups: loadGroups
  };
}
