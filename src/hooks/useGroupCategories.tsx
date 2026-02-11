import { useState, useEffect, useCallback } from "react";
import { GroupCategory } from "@/types/schematic";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const DEFAULT_CATEGORIES: Omit<GroupCategory, 'id'>[] = [
  { name: 'Erzeugung', tags: ['Wärme', 'Kälte'], sortOrder: 0 },
  { name: 'Speicherung', tags: ['Wärmespeicher', 'Kältespeicher', 'Stromspeicher'], sortOrder: 1 },
  { name: 'Verteilung', tags: ['Heizkreisgruppen', 'Kälteverteilung', 'Trinkwasser', 'Fernwärme'], sortOrder: 2 },
  { name: 'Hydraulik', tags: [], sortOrder: 3 },
  { name: 'Sicherheit', tags: [], sortOrder: 4 },
];

export function useGroupCategories() {
  const { companyId } = useAuth();
  const [categories, setCategories] = useState<GroupCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCategories = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('group_categories')
        .select('*')
        .eq('company_id', companyId)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        // Seed default categories
        const inserts = DEFAULT_CATEGORIES.map(cat => ({
          company_id: companyId,
          name: cat.name,
          tags: cat.tags,
          sort_order: cat.sortOrder,
        }));

        const { data: seeded, error: seedError } = await supabase
          .from('group_categories')
          .insert(inserts)
          .select();

        if (seedError) throw seedError;

        setCategories((seeded || []).map(row => ({
          id: row.id,
          name: row.name,
          tags: row.tags || [],
          sortOrder: row.sort_order || 0,
        })));
      } else {
        setCategories(data.map(row => ({
          id: row.id,
          name: row.name,
          tags: row.tags || [],
          sortOrder: row.sort_order || 0,
        })));
      }
    } catch (error) {
      console.error('Error loading categories:', error);
      toast.error('Fehler beim Laden der Kategorien');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const createCategory = useCallback(async (name: string, tags: string[] = []): Promise<GroupCategory | null> => {
    if (!companyId) return null;

    try {
      const maxOrder = categories.length > 0 ? Math.max(...categories.map(c => c.sortOrder)) + 1 : 0;
      const { data, error } = await supabase
        .from('group_categories')
        .insert({
          company_id: companyId,
          name,
          tags,
          sort_order: maxOrder,
        })
        .select()
        .single();

      if (error) throw error;

      const newCat: GroupCategory = {
        id: data.id,
        name: data.name,
        tags: data.tags || [],
        sortOrder: data.sort_order || 0,
      };

      setCategories(prev => [...prev, newCat]);
      toast.success('Kategorie erstellt');
      return newCat;
    } catch (error) {
      console.error('Error creating category:', error);
      toast.error('Fehler beim Erstellen der Kategorie');
      return null;
    }
  }, [companyId, categories]);

  const updateCategory = useCallback(async (id: string, name: string, tags: string[]): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('group_categories')
        .update({ name, tags })
        .eq('id', id);

      if (error) throw error;

      setCategories(prev => prev.map(c => c.id === id ? { ...c, name, tags } : c));
      return true;
    } catch (error) {
      console.error('Error updating category:', error);
      toast.error('Fehler beim Aktualisieren der Kategorie');
      return false;
    }
  }, []);

  const deleteCategory = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('group_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setCategories(prev => prev.filter(c => c.id !== id));
      toast.success('Kategorie gelöscht');
      return true;
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error('Fehler beim Löschen der Kategorie');
      return false;
    }
  }, []);

  return {
    categories,
    loading,
    createCategory,
    updateCategory,
    deleteCategory,
    reloadCategories: loadCategories,
  };
}
