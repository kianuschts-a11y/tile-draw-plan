import { useState, useMemo } from "react";
import { Component, ComponentQuantity, ComponentGroup, GroupMatch } from "@/types/schematic";
import { SavedPlanData } from "@/hooks/useSavedPlans";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Minus, Save, FileDown, Check, Folder, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface ProjectPanelProps {
  components: Component[];
  groups: ComponentGroup[];
  savedPlans: SavedPlanData[];
  onFindMatchingGroups: (quantities: ComponentQuantity[]) => GroupMatch[];
  onFindExactMatchingPlan: (quantities: ComponentQuantity[]) => SavedPlanData | null;
  onLoadPlan: (plan: SavedPlanData) => void;
  onSavePlan: (name: string, quantities: ComponentQuantity[], matchedGroupId?: string) => Promise<void>;
}

export function ProjectPanel({
  components,
  groups,
  savedPlans,
  onFindMatchingGroups,
  onFindExactMatchingPlan,
  onLoadPlan,
  onSavePlan
}: ProjectPanelProps) {
  const [quantities, setQuantities] = useState<Map<string, number>>(new Map());
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [planName, setPlanName] = useState("");
  const [saving, setSaving] = useState(false);

  // Convert quantities map to array
  const componentQuantities = useMemo((): ComponentQuantity[] => {
    return Array.from(quantities.entries())
      .filter(([_, qty]) => qty > 0)
      .map(([componentId, quantity]) => ({ componentId, quantity }));
  }, [quantities]);

  // Find matching groups
  const matchingGroups = useMemo(() => {
    return onFindMatchingGroups(componentQuantities);
  }, [componentQuantities, onFindMatchingGroups]);

  // Find exact matching plan
  const exactMatchingPlan = useMemo(() => {
    return onFindExactMatchingPlan(componentQuantities);
  }, [componentQuantities, onFindExactMatchingPlan]);

  const updateQuantity = (componentId: string, delta: number) => {
    setQuantities(prev => {
      const next = new Map(prev);
      const current = next.get(componentId) || 0;
      const newValue = Math.max(0, current + delta);
      if (newValue === 0) {
        next.delete(componentId);
      } else {
        next.set(componentId, newValue);
      }
      return next;
    });
  };

  const setQuantity = (componentId: string, value: number) => {
    setQuantities(prev => {
      const next = new Map(prev);
      if (value <= 0) {
        next.delete(componentId);
      } else {
        next.set(componentId, value);
      }
      return next;
    });
  };

  const clearAll = () => {
    setQuantities(new Map());
  };

  const handleSavePlan = async () => {
    if (!planName.trim() || componentQuantities.length === 0) return;
    
    setSaving(true);
    try {
      // If there's a 100% matching group, link it
      const perfectMatch = matchingGroups.find(m => m.matchPercentage === 100);
      await onSavePlan(planName.trim(), componentQuantities, perfectMatch?.group.id);
      setPlanName("");
      setSaveDialogOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const totalComponents = componentQuantities.reduce((sum, q) => sum + q.quantity, 0);

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm">Projektliste</h3>
          <div className="flex gap-1">
            {componentQuantities.length > 0 && (
              <>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-7 w-7 p-0 text-destructive"
                  onClick={clearAll}
                >
                  <X className="w-3 h-3" />
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-7 gap-1"
                  onClick={() => setSaveDialogOpen(true)}
                >
                  <Save className="w-3 h-3" />
                  Speichern
                </Button>
              </>
            )}
          </div>
        </div>
        {totalComponents > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            {totalComponents} Komponente{totalComponents !== 1 ? 'n' : ''} ausgewählt
          </p>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* Component quantity list */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase">Komponenten</h4>
            {components.map(component => {
              const qty = quantities.get(component.id) || 0;
              return (
                <div key={component.id} className="flex items-center justify-between gap-2 py-1">
                  <span className="text-sm truncate flex-1">{component.name}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 w-6 p-0"
                      onClick={() => updateQuantity(component.id, -1)}
                      disabled={qty === 0}
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                    <Input
                      type="number"
                      min="0"
                      value={qty}
                      onChange={(e) => setQuantity(component.id, parseInt(e.target.value) || 0)}
                      className="h-6 w-12 text-center text-sm px-1"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 w-6 p-0"
                      onClick={() => updateQuantity(component.id, 1)}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Matching groups */}
          {matchingGroups.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase">Passende Gruppen</h4>
              {matchingGroups.map(match => (
                <div 
                  key={match.group.id} 
                  className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30"
                >
                  <Folder className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm flex-1 truncate">{match.group.name}</span>
                  <Badge variant={match.matchPercentage === 100 ? "default" : "secondary"}>
                    {Math.round(match.matchPercentage)}%
                  </Badge>
                </div>
              ))}
            </div>
          )}

          {/* Exact matching plan */}
          {exactMatchingPlan && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-1">
                <Check className="w-3 h-3 text-green-500" />
                Gespeicherter Plan gefunden
              </h4>
              <div 
                className="flex items-center gap-2 p-2 rounded-lg border border-green-500/50 bg-green-500/10 cursor-pointer hover:bg-green-500/20 transition-colors"
                onClick={() => onLoadPlan(exactMatchingPlan)}
              >
                <FileDown className="w-4 h-4 text-green-500" />
                <span className="text-sm flex-1 truncate">{exactMatchingPlan.name}</span>
                <Button size="sm" variant="ghost" className="h-6 text-xs">
                  Laden
                </Button>
              </div>
            </div>
          )}

          {/* Saved plans list */}
          {savedPlans.length > 0 && !exactMatchingPlan && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase">Gespeicherte Pläne</h4>
              {savedPlans.slice(0, 5).map(plan => (
                <div 
                  key={plan.id} 
                  className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => onLoadPlan(plan)}
                >
                  <FileDown className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm flex-1 truncate">{plan.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {plan.componentQuantities.reduce((s, q) => s + q.quantity, 0)} Komp.
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Save Plan Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Plan speichern</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="Plan-Name eingeben..."
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
            />
            <div className="text-sm text-muted-foreground">
              {componentQuantities.length} Komponententyp{componentQuantities.length !== 1 ? 'en' : ''} mit insgesamt {totalComponents} Stück
            </div>
            {matchingGroups.length > 0 && matchingGroups[0].matchPercentage === 100 && (
              <div className="flex items-center gap-2 p-2 rounded-lg border border-green-500/50 bg-green-500/10">
                <Check className="w-4 h-4 text-green-500" />
                <span className="text-sm">Wird mit Gruppe "{matchingGroups[0].group.name}" verknüpft</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button 
              onClick={handleSavePlan} 
              disabled={!planName.trim() || saving}
            >
              {saving ? 'Speichern...' : 'Speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
