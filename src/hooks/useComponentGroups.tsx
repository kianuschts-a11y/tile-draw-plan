import { useState, useCallback, useEffect } from "react";
import { ComponentGroup, GroupLayoutData } from "@/types/schematic";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DEFAULT_COMPANY_ID = '83ccf558-e5ad-4b01-8125-23fb4e92c64e';

function mapDbToGroup(row: any): ComponentGroup {
  return {
    id: row.id,
    name: row.name,
    componentIds: row.component_ids || [],
    layoutData: row.layout_data as GroupLayoutData | undefined,
    category: row.category || undefined,
    tags: row.tags || [],
  };
}

export function useComponentGroups() {
  const [groups, setGroups] = useState<ComponentGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('component_groups')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error loading groups:', error);
      toast.error('Fehler beim Laden der Gruppen');
      setLoading(false);
      return;
    }

    setGroups((data || []).map(mapDbToGroup));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const createGroup = useCallback(async (
    name: string, componentIds: string[], layoutData?: GroupLayoutData, category?: string, tags?: string[]
  ): Promise<ComponentGroup | null> => {
    const { data, error } = await supabase
      .from('component_groups')
      .insert({
        name,
        component_ids: componentIds,
        layout_data: (layoutData || {}) as any,
        category: category || null,
        tags: tags || [],
        company_id: DEFAULT_COMPANY_ID,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating group:', error);
      toast.error('Fehler beim Erstellen der Gruppe');
      return null;
    }

    const newGroup = mapDbToGroup(data);
    setGroups(prev => [...prev, newGroup]);
    toast.success('Gruppe erstellt');
    return newGroup;
  }, []);

  const updateGroup = useCallback(async (id: string, name: string, componentIds: string[], category?: string, tags?: string[]): Promise<boolean> => {
    const { error } = await supabase
      .from('component_groups')
      .update({
        name,
        component_ids: componentIds,
        category: category || null,
        tags: tags || [],
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating group:', error);
      toast.error('Fehler beim Aktualisieren der Gruppe');
      return false;
    }

    setGroups(prev => prev.map(g => g.id === id ? { ...g, name, componentIds, category, tags } : g));
    return true;
  }, []);

  const deleteGroup = useCallback(async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('component_groups')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting group:', error);
      toast.error('Fehler beim Löschen der Gruppe');
      return false;
    }

    setGroups(prev => prev.filter(g => g.id !== id));
    toast.success('Gruppe gelöscht');
    return true;
  }, []);

  const reloadGroups = useCallback(() => {
    fetchGroups();
  }, [fetchGroups]);

  return { groups, loading, createGroup, updateGroup, deleteGroup, reloadGroups };
}
