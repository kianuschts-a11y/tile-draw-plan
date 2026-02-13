import { useState, useCallback } from "react";
import { GroupCategory } from "@/types/schematic";
import { DEFAULT_CATEGORIES } from "@/data/defaultCategories";
import { loadFromStorage, saveToStorage } from "@/lib/localStorage";
import { toast } from "sonner";

const STORAGE_KEY = 'schematic-editor-categories';

export function useGroupCategories() {
  const [categories, setCategories] = useState<GroupCategory[]>(() => 
    loadFromStorage<GroupCategory>(STORAGE_KEY, DEFAULT_CATEGORIES)
  );

  const persist = useCallback((updated: GroupCategory[]) => {
    setCategories(updated);
    saveToStorage(STORAGE_KEY, updated);
  }, []);

  const createCategory = useCallback(async (name: string, tags: string[] = []): Promise<GroupCategory | null> => {
    const maxOrder = categories.length > 0 ? Math.max(...categories.map(c => c.sortOrder)) + 1 : 0;
    const newCat: GroupCategory = { id: crypto.randomUUID(), name, tags, sortOrder: maxOrder };
    persist([...categories, newCat]);
    toast.success('Kategorie erstellt');
    return newCat;
  }, [categories, persist]);

  const updateCategory = useCallback(async (id: string, name: string, tags: string[]): Promise<boolean> => {
    persist(categories.map(c => c.id === id ? { ...c, name, tags } : c));
    return true;
  }, [categories, persist]);

  const deleteCategory = useCallback(async (id: string): Promise<boolean> => {
    persist(categories.filter(c => c.id !== id));
    toast.success('Kategorie gelöscht');
    return true;
  }, [categories, persist]);

  const reloadCategories = useCallback(() => {
    setCategories(loadFromStorage<GroupCategory>(STORAGE_KEY, DEFAULT_CATEGORIES));
  }, []);

  return { categories, loading: false, createCategory, updateCategory, deleteCategory, reloadCategories };
}
