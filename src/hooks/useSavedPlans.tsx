import { useState, useCallback, useEffect } from "react";
import { ComponentQuantity, PaperFormat, Orientation, TitleBlockData, CellConnection } from "@/types/schematic";
import { AnnotationLine, AnnotationText } from "@/types/annotations";
import { PlacedTile } from "@/components/schematic/Canvas";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DEFAULT_COMPANY_ID = '83ccf558-e5ad-4b01-8125-23fb4e92c64e';

export interface DrawingData {
  tiles: PlacedTile[];
  connections: CellConnection[];
  annotationLines?: AnnotationLine[];
  annotationTexts?: AnnotationText[];
  tileLabels?: Record<string, { label: string; color: string }>;
}

export interface SavedPlanMetadata {
  paperFormat?: PaperFormat;
  orientation?: Orientation;
  titleBlockData?: TitleBlockData;
  projectDescriptions?: Record<string, string[]>;
  projectKategorien?: Record<string, string>;
  projectMarken?: Record<string, string>;
  projectModelle?: Record<string, string>;
  projectPreise?: Record<string, number>;
  projectCustomFields?: Record<string, Record<string, string | number>>;
}

export interface SavedPlanData {
  id: string;
  name: string;
  componentQuantities: ComponentQuantity[];
  drawingData: DrawingData;
  matchedGroupId?: string;
  createdAt?: string;
  updatedAt?: string;
  paperFormat?: PaperFormat;
  orientation?: Orientation;
  titleBlockData?: TitleBlockData;
  projectDescriptions?: Record<string, string[]>;
  projectKategorien?: Record<string, string>;
  projectMarken?: Record<string, string>;
  projectModelle?: Record<string, string>;
  projectPreise?: Record<string, number>;
  projectCustomFields?: Record<string, Record<string, string | number>>;
}

function mapDbToSavedPlan(row: any): SavedPlanData {
  const metadata = (row.metadata || {}) as SavedPlanMetadata;
  return {
    id: row.id,
    name: row.name,
    componentQuantities: (row.component_quantities || []) as ComponentQuantity[],
    drawingData: (row.drawing_data || { tiles: [], connections: [] }) as DrawingData,
    matchedGroupId: row.matched_group_id || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...metadata,
  };
}

export function useSavedPlans() {
  const [savedPlans, setSavedPlans] = useState<SavedPlanData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPlans = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('saved_plans')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSavedPlans((data || []).map(mapDbToSavedPlan));
    } catch (err) {
      console.error('Error fetching saved plans:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const savePlan = useCallback(async (
    name: string,
    componentQuantities: ComponentQuantity[],
    drawingData: DrawingData,
    matchedGroupId?: string,
    metadata?: SavedPlanMetadata
  ): Promise<SavedPlanData | null> => {
    try {
      const { data, error } = await supabase
        .from('saved_plans')
        .insert({
          company_id: DEFAULT_COMPANY_ID,
          name,
          component_quantities: componentQuantities as any,
          drawing_data: drawingData as any,
          matched_group_id: matchedGroupId || null,
          metadata: (metadata || {}) as any,
        })
        .select()
        .single();

      if (error) throw error;

      const newPlan = mapDbToSavedPlan(data);
      setSavedPlans(prev => [newPlan, ...prev]);
      toast.success('Plan gespeichert');
      return newPlan;
    } catch (err) {
      console.error('Error saving plan:', err);
      toast.error('Fehler beim Speichern');
      return null;
    }
  }, []);

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
    } catch (err) {
      console.error('Error deleting plan:', err);
      toast.error('Fehler beim Löschen');
      return false;
    }
  }, []);

  const findExactMatchingPlan = useCallback((componentQuantities: ComponentQuantity[]): SavedPlanData | null => {
    if (componentQuantities.length === 0) return null;
    const sortedInput = [...componentQuantities].sort((a, b) => a.componentId.localeCompare(b.componentId));

    for (const plan of savedPlans) {
      const sortedPlan = [...plan.componentQuantities].sort((a, b) => a.componentId.localeCompare(b.componentId));
      if (sortedInput.length !== sortedPlan.length) continue;
      const isMatch = sortedInput.every((item, index) =>
        item.componentId === sortedPlan[index].componentId && item.quantity === sortedPlan[index].quantity
      );
      if (isMatch) return plan;
    }
    return null;
  }, [savedPlans]);

  const reloadPlans = useCallback(() => {
    fetchPlans();
  }, [fetchPlans]);

  return { savedPlans, loading, savePlan, deletePlan, reloadPlans, findExactMatchingPlan };
}
