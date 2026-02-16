import { useState, useCallback } from "react";
import { ComponentQuantity, CellConnection, PaperFormat, Orientation, TitleBlockData } from "@/types/schematic";
import { AnnotationLine, AnnotationText } from "@/types/annotations";
import { PlacedTile } from "@/components/schematic/Canvas";
import { DEFAULT_SAVED_PLANS } from "@/data/defaultSavedPlans";
import { loadFromStorage, saveToStorage } from "@/lib/localStorage";
import { toast } from "sonner";

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
  // Extended metadata
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

const STORAGE_KEY = 'schematic-editor-saved-plans';

export function useSavedPlans() {
  const [savedPlans, setSavedPlans] = useState<SavedPlanData[]>(() => 
    loadFromStorage<SavedPlanData>(STORAGE_KEY, DEFAULT_SAVED_PLANS as SavedPlanData[])
  );

  const persist = useCallback((updated: SavedPlanData[]) => {
    setSavedPlans(updated);
    saveToStorage(STORAGE_KEY, updated);
  }, []);

  const savePlan = useCallback(async (
    name: string, componentQuantities: ComponentQuantity[], drawingData: DrawingData, matchedGroupId?: string, metadata?: SavedPlanMetadata
  ): Promise<SavedPlanData | null> => {
    const newPlan: SavedPlanData = {
      id: crypto.randomUUID(), name, componentQuantities, drawingData, matchedGroupId,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      ...metadata
    };
    persist([newPlan, ...savedPlans]);
    toast.success('Plan gespeichert');
    return newPlan;
  }, [savedPlans, persist]);

  const deletePlan = useCallback(async (id: string): Promise<boolean> => {
    persist(savedPlans.filter(p => p.id !== id));
    toast.success('Plan gelöscht');
    return true;
  }, [savedPlans, persist]);

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
    setSavedPlans(loadFromStorage<SavedPlanData>(STORAGE_KEY, DEFAULT_SAVED_PLANS as SavedPlanData[]));
  }, []);

  return { savedPlans, loading: false, savePlan, deletePlan, reloadPlans, findExactMatchingPlan };
}
