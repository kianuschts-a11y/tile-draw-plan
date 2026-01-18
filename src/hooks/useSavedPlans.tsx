import { useState, useEffect, useCallback } from "react";
import { ComponentQuantity, CellConnection } from "@/types/schematic";
import { PlacedTile } from "@/components/schematic/Canvas";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Json } from "@/integrations/supabase/types";

export interface DrawingData {
  tiles: PlacedTile[];
  connections: CellConnection[];
}

export interface SavedPlanData {
  id: string;
  name: string;
  componentQuantities: ComponentQuantity[];
  drawingData: DrawingData;
  matchedGroupId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function useSavedPlans() {
  const { companyId } = useAuth();
  const [savedPlans, setSavedPlans] = useState<SavedPlanData[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSavedPlans = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('saved_plans')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mappedPlans: SavedPlanData[] = (data || []).map(row => ({
        id: row.id,
        name: row.name,
        componentQuantities: (row.component_quantities as unknown as ComponentQuantity[]) || [],
        drawingData: (row.drawing_data as unknown as DrawingData) || { tiles: [], connections: [] },
        matchedGroupId: row.matched_group_id || undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));

      setSavedPlans(mappedPlans);
    } catch (error) {
      console.error('Error loading saved plans:', error);
      toast.error('Fehler beim Laden der Pläne');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadSavedPlans();
  }, [loadSavedPlans]);

  const savePlan = useCallback(async (
    name: string,
    componentQuantities: ComponentQuantity[],
    drawingData: DrawingData,
    matchedGroupId?: string
  ): Promise<SavedPlanData | null> => {
    if (!companyId) {
      toast.error('Keine Firma gefunden');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('saved_plans')
        .insert({
          company_id: companyId,
          name,
          component_quantities: componentQuantities as unknown as Json,
          drawing_data: drawingData as unknown as Json,
          matched_group_id: matchedGroupId || null
        })
        .select()
        .single();

      if (error) throw error;

      const newPlan: SavedPlanData = {
        id: data.id,
        name: data.name,
        componentQuantities: (data.component_quantities as unknown as ComponentQuantity[]) || [],
        drawingData: (data.drawing_data as unknown as DrawingData) || { tiles: [], connections: [] },
        matchedGroupId: data.matched_group_id || undefined,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };

      setSavedPlans(prev => [newPlan, ...prev]);
      toast.success('Plan gespeichert');
      return newPlan;
    } catch (error) {
      console.error('Error saving plan:', error);
      toast.error('Fehler beim Speichern des Plans');
      return null;
    }
  }, [companyId]);

  const deletePlan = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('saved_plans')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSavedPlans(prev => prev.filter(p => p.id !== id));
      toast.success('Plan gelöscht');
      return true;
    } catch (error) {
      console.error('Error deleting plan:', error);
      toast.error('Fehler beim Löschen des Plans');
      return false;
    }
  }, []);

  // Find exact matching plan for given component quantities
  const findExactMatchingPlan = useCallback((
    componentQuantities: ComponentQuantity[]
  ): SavedPlanData | null => {
    if (componentQuantities.length === 0) return null;

    // Sort quantities for comparison
    const sortedInput = [...componentQuantities]
      .sort((a, b) => a.componentId.localeCompare(b.componentId));

    for (const plan of savedPlans) {
      const sortedPlan = [...plan.componentQuantities]
        .sort((a, b) => a.componentId.localeCompare(b.componentId));

      if (sortedInput.length !== sortedPlan.length) continue;

      const isMatch = sortedInput.every((item, index) => 
        item.componentId === sortedPlan[index].componentId &&
        item.quantity === sortedPlan[index].quantity
      );

      if (isMatch) return plan;
    }

    return null;
  }, [savedPlans]);

  return {
    savedPlans,
    loading,
    savePlan,
    deletePlan,
    reloadPlans: loadSavedPlans,
    findExactMatchingPlan
  };
}
