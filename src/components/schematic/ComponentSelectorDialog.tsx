import { useState, useMemo, useCallback, useEffect } from "react";
import { Component, ComponentGroup, ComponentQuantity, GroupMatch, GroupLayoutData } from "@/types/schematic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, Folder, Check, X, Layers, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface ComponentSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  components: Component[];
  groups: ComponentGroup[];
  onInsertGroup: (group: ComponentGroup, count: number) => void;
  onInsertMultipleGroups: (groupsWithCounts: Array<{ group: ComponentGroup; count: number }>) => void;
  projectQuantities: Map<string, number>;
  onProjectQuantitiesChange: (quantities: Map<string, number>) => void;
}

interface GroupSuggestion {
  group: ComponentGroup;
  possibleCount: number;
  usedComponents: Map<string, number>;
  coveragePercent: number;
}

interface ComplementaryGroupSet {
  groups: GroupSuggestion[];
  totalCoverage: number;
  remainingComponents: Map<string, number>;
}

export function ComponentSelectorDialog({
  open,
  onOpenChange,
  components,
  groups,
  onInsertGroup,
  onInsertMultipleGroups,
  projectQuantities,
  onProjectQuantitiesChange
}: ComponentSelectorDialogProps) {
  // Use the passed projectQuantities as initial state, but allow local editing
  const [quantities, setQuantities] = useState<Map<string, number>>(new Map());

  // Sync local state with projectQuantities when dialog opens
  useEffect(() => {
    if (open) {
      setQuantities(new Map(projectQuantities));
    }
  }, [open, projectQuantities]);

  // Update both local and parent state
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
      // Also update parent state to persist
      onProjectQuantitiesChange(next);
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
      // Also update parent state to persist
      onProjectQuantitiesChange(next);
      return next;
    });
  };

  const clearAll = () => {
    const empty = new Map<string, number>();
    setQuantities(empty);
    onProjectQuantitiesChange(empty);
  };

  // Get component requirements from a group
  const getGroupComponentRequirements = useCallback((group: ComponentGroup): Map<string, number> => {
    const requirements = new Map<string, number>();
    
    if (group.layoutData?.tiles && group.layoutData.tiles.length > 0) {
      for (const tile of group.layoutData.tiles) {
        requirements.set(tile.componentId, (requirements.get(tile.componentId) || 0) + 1);
      }
    } else {
      for (const id of group.componentIds) {
        requirements.set(id, (requirements.get(id) || 0) + 1);
      }
    }
    
    return requirements;
  }, []);

  // Check if a group can be fulfilled with given component quantities
  const canFulfillGroup = useCallback((
    group: ComponentGroup,
    availableComponents: Map<string, number>
  ): { possible: boolean; maxCount: number } => {
    const requirements = getGroupComponentRequirements(group);
    
    let maxPossible = Infinity;
    
    for (const [componentId, needed] of requirements.entries()) {
      const available = availableComponents.get(componentId) || 0;
      if (available < needed) {
        return { possible: false, maxCount: 0 };
      }
      const possibleWithThisComponent = Math.floor(available / needed);
      maxPossible = Math.min(maxPossible, possibleWithThisComponent);
    }
    
    return { possible: true, maxCount: maxPossible === Infinity ? 0 : maxPossible };
  }, [getGroupComponentRequirements]);

  // Find all matching groups with how many times they can be used
  const matchingGroups = useMemo((): GroupSuggestion[] => {
    if (quantities.size === 0) return [];
    
    const suggestions: GroupSuggestion[] = [];
    
    for (const group of groups) {
      const { possible, maxCount } = canFulfillGroup(group, quantities);
      if (possible && maxCount > 0) {
        const requirements = getGroupComponentRequirements(group);
        const totalGroupComponents = Array.from(requirements.values()).reduce((a, b) => a + b, 0);
        const totalProjectComponents = Array.from(quantities.values()).reduce((a, b) => a + b, 0);
        
        suggestions.push({
          group,
          possibleCount: maxCount,
          usedComponents: requirements,
          coveragePercent: Math.round((totalGroupComponents / totalProjectComponents) * 100)
        });
      }
    }
    
    return suggestions.sort((a, b) => b.coveragePercent - a.coveragePercent);
  }, [quantities, groups, canFulfillGroup, getGroupComponentRequirements]);

  // Find complementary group combinations that together cover more components
  const complementaryGroupSets = useMemo((): ComplementaryGroupSet[] => {
    if (matchingGroups.length < 2) return [];
    
    const sets: ComplementaryGroupSet[] = [];
    const remainingAfterFirst = new Map(quantities);
    
    // Try to find groups that complement each other
    // Start with the highest coverage group and try to add more
    for (let i = 0; i < Math.min(matchingGroups.length, 3); i++) {
      const firstGroup = matchingGroups[i];
      const tempRemaining = new Map(quantities);
      
      // Subtract first group's requirements
      for (const [compId, needed] of firstGroup.usedComponents.entries()) {
        const current = tempRemaining.get(compId) || 0;
        if (current - needed <= 0) {
          tempRemaining.delete(compId);
        } else {
          tempRemaining.set(compId, current - needed);
        }
      }
      
      // Check if remaining components can form another group
      for (let j = 0; j < matchingGroups.length; j++) {
        if (i === j) continue;
        
        const secondGroup = matchingGroups[j];
        const { possible, maxCount } = canFulfillGroup(secondGroup.group, tempRemaining);
        
        if (possible && maxCount > 0) {
          const totalCoverage = firstGroup.coveragePercent + secondGroup.coveragePercent;
          
          // Calculate remaining after both groups
          const finalRemaining = new Map(tempRemaining);
          for (const [compId, needed] of secondGroup.usedComponents.entries()) {
            const current = finalRemaining.get(compId) || 0;
            if (current - needed <= 0) {
              finalRemaining.delete(compId);
            } else {
              finalRemaining.set(compId, current - needed);
            }
          }
          
          sets.push({
            groups: [
              { ...firstGroup, possibleCount: 1 },
              { ...secondGroup, possibleCount: 1 }
            ],
            totalCoverage: Math.min(100, totalCoverage),
            remainingComponents: finalRemaining
          });
        }
      }
    }
    
    // Sort by total coverage and remove duplicates
    return sets
      .sort((a, b) => b.totalCoverage - a.totalCoverage)
      .slice(0, 3);
  }, [matchingGroups, quantities, canFulfillGroup]);

  const totalComponents = useMemo(() => 
    Array.from(quantities.values()).reduce((a, b) => a + b, 0)
  , [quantities]);

  const hasExactMatch = matchingGroups.some(g => g.coveragePercent === 100);

  const handleInsertGroup = (group: ComponentGroup, count: number = 1) => {
    onInsertGroup(group, count);
    
    // Update remaining quantities (but don't reduce project totals - just reduce what still needs inserting)
    const requirements = getGroupComponentRequirements(group);
    setQuantities(prev => {
      const next = new Map(prev);
      for (const [compId, needed] of requirements.entries()) {
        const current = next.get(compId) || 0;
        const remaining = current - (needed * count);
        if (remaining <= 0) {
          next.delete(compId);
        } else {
          next.set(compId, remaining);
        }
      }
      // Note: We don't update projectQuantities here - those are the "total needed"
      // The remaining is tracked separately by comparing placed tiles to project quantities
      return next;
    });
  };

  const handleInsertComplementarySet = (set: ComplementaryGroupSet) => {
    onInsertMultipleGroups(set.groups.map(g => ({ group: g.group, count: g.possibleCount })));
    setQuantities(set.remainingComponents);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5" />
            Komponenten auswählen
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden flex gap-4">
          {/* Left: Component List */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium">Verfügbare Komponenten</h4>
              {quantities.size > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs text-destructive"
                  onClick={clearAll}
                >
                  <X className="w-3 h-3 mr-1" />
                  Zurücksetzen
                </Button>
              )}
            </div>
            
            <ScrollArea className="flex-1 -mx-1 px-1">
              <div className="space-y-1">
                {components.map(component => {
                  const qty = quantities.get(component.id) || 0;
                  return (
                    <div
                      key={component.id}
                      className={`flex items-center justify-between gap-2 p-2 rounded-lg border transition-colors ${
                        qty > 0 ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 border-transparent'
                      }`}
                    >
                      <span className="text-sm truncate flex-1">{component.name}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 w-7 p-0"
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
                          className="h-7 w-14 text-center text-sm px-1"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 w-7 p-0"
                          onClick={() => updateQuantity(component.id, 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            
            {totalComponents > 0 && (
              <div className="pt-2 mt-2 border-t text-sm text-muted-foreground">
                Gesamt: <span className="font-medium text-foreground">{totalComponents}</span> Komponenten
              </div>
            )}
          </div>
          
          {/* Right: Matching Groups */}
          <div className="w-64 flex flex-col border-l pl-4">
            <h4 className="text-sm font-medium mb-2">Passende Gruppen</h4>
            
            <ScrollArea className="flex-1 -mx-1 px-1">
              {quantities.size === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Wählen Sie Komponenten aus, um passende Gruppen zu finden.
                </p>
              ) : matchingGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Keine passenden Gruppen gefunden. Alle Komponenten einer Gruppe müssen vorhanden sein.
                </p>
              ) : (
                <div className="space-y-3">
                  {/* Exact matches first */}
                  {hasExactMatch && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
                        <Check className="w-3 h-3" />
                        100% Übereinstimmung
                      </div>
                      {matchingGroups.filter(g => g.coveragePercent === 100).map(suggestion => (
                        <div
                          key={suggestion.group.id}
                          className="p-2 rounded-lg border border-green-500/50 bg-green-500/10 space-y-2"
                        >
                          <div className="flex items-center gap-2">
                            <Folder className="w-4 h-4 text-green-600" />
                            <span className="text-sm font-medium flex-1 truncate">
                              {suggestion.group.name}
                            </span>
                            <Badge variant="default" className="bg-green-600">
                              100%
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              Verfügbar: {suggestion.possibleCount}x
                            </span>
                            <Button
                              size="sm"
                              className="h-6 text-xs ml-auto gap-1"
                              onClick={() => handleInsertGroup(suggestion.group, 1)}
                            >
                              <ArrowRight className="w-3 h-3" />
                              Einfügen
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Partial matches */}
                  {matchingGroups.filter(g => g.coveragePercent < 100).length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground font-medium">
                        Teilweise Übereinstimmung
                      </div>
                      {matchingGroups.filter(g => g.coveragePercent < 100).slice(0, 5).map(suggestion => (
                        <div
                          key={suggestion.group.id}
                          className="p-2 rounded-lg border bg-muted/30 space-y-2"
                        >
                          <div className="flex items-center gap-2">
                            <Folder className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm flex-1 truncate">
                              {suggestion.group.name}
                            </span>
                            <Badge variant="secondary">
                              {suggestion.coveragePercent}%
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              Max: {suggestion.possibleCount}x
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-xs ml-auto gap-1"
                              onClick={() => handleInsertGroup(suggestion.group, 1)}
                            >
                              <ArrowRight className="w-3 h-3" />
                              Einfügen
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Complementary group sets */}
                  {complementaryGroupSets.length > 0 && (
                    <div className="space-y-2 pt-2 border-t">
                      <div className="text-xs text-blue-600 font-medium">
                        Ergänzende Gruppen-Kombinationen
                      </div>
                      {complementaryGroupSets.map((set, index) => (
                        <div
                          key={index}
                          className="p-2 rounded-lg border border-blue-500/30 bg-blue-500/5 space-y-2"
                        >
                          <div className="flex items-center gap-1 flex-wrap">
                            {set.groups.map((g, i) => (
                              <span key={g.group.id} className="flex items-center gap-1">
                                {i > 0 && <span className="text-blue-600">+</span>}
                                <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                                  {g.group.name}
                                </span>
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="border-blue-500/50 text-blue-600">
                              {set.totalCoverage}% gesamt
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-xs ml-auto gap-1 border-blue-500/50 text-blue-600 hover:bg-blue-50"
                              onClick={() => handleInsertComplementarySet(set)}
                            >
                              <ArrowRight className="w-3 h-3" />
                              Alle einfügen
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
        
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Schließen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
