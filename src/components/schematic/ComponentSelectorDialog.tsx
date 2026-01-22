import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Component, ComponentGroup, ComponentQuantity, GroupMatch, GroupLayoutData, ProjectComponentData } from "@/types/schematic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, Folder, Check, X, Layers, ArrowRight, ChevronDown, ChevronRight, Equal } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ComponentSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  components: Component[];
  groups: ComponentGroup[];
  onInsertGroup: (group: ComponentGroup, count: number) => void;
  onInsertMultipleGroups: (groupsWithCounts: Array<{ group: ComponentGroup; count: number }>) => void;
  projectQuantities: Map<string, number>;
  onProjectQuantitiesChange: (quantities: Map<string, number>) => void;
  projectDescriptions: Map<string, string[]>;
  onProjectDescriptionsChange: (descriptions: Map<string, string[]>) => void;
  projectKategorien: Map<string, string>;
  onProjectKategorienChange: (kategorien: Map<string, string>) => void;
  projectPreise: Map<string, number>;
  onProjectPreiseChange: (preise: Map<string, number>) => void;
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
  onProjectQuantitiesChange,
  projectDescriptions,
  onProjectDescriptionsChange,
  projectKategorien,
  onProjectKategorienChange,
  projectPreise,
  onProjectPreiseChange
}: ComponentSelectorDialogProps) {
  // Use the passed projectQuantities as initial state, but allow local editing
  const [quantities, setQuantities] = useState<Map<string, number>>(new Map());
  const [descriptions, setDescriptions] = useState<Map<string, string[]>>(new Map());
  const [kategorien, setKategorien] = useState<Map<string, string>>(new Map());
  const [preise, setPreise] = useState<Map<string, number>>(new Map());
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set());
  
  // Track initial state to determine button text
  const initialQuantitiesRef = useRef<string>("");
  const initialDescriptionsRef = useRef<string>("");
  const initialKategorienRef = useRef<string>("");
  const initialPreiseRef = useRef<string>("");
  const [hasChanges, setHasChanges] = useState(false);
  const [wasOpened, setWasOpened] = useState(false);

  // Sync local state with projectQuantities when dialog opens
  useEffect(() => {
    if (open) {
      setQuantities(new Map(projectQuantities));
      setDescriptions(new Map(projectDescriptions));
      setKategorien(new Map(projectKategorien));
      setPreise(new Map(projectPreise));
      
      initialQuantitiesRef.current = JSON.stringify(Array.from(projectQuantities.entries()));
      initialDescriptionsRef.current = JSON.stringify(Array.from(projectDescriptions.entries()));
      initialKategorienRef.current = JSON.stringify(Array.from(projectKategorien.entries()));
      initialPreiseRef.current = JSON.stringify(Array.from(projectPreise.entries()));
      
      setWasOpened(projectQuantities.size > 0);
      setHasChanges(false);
    }
  }, [open, projectQuantities, projectDescriptions, projectKategorien, projectPreise]);

  // Check for changes
  useEffect(() => {
    const currentQuantities = JSON.stringify(Array.from(quantities.entries()));
    const currentDescriptions = JSON.stringify(Array.from(descriptions.entries()));
    const currentKategorien = JSON.stringify(Array.from(kategorien.entries()));
    const currentPreise = JSON.stringify(Array.from(preise.entries()));
    const changed = currentQuantities !== initialQuantitiesRef.current || 
                    currentDescriptions !== initialDescriptionsRef.current ||
                    currentKategorien !== initialKategorienRef.current ||
                    currentPreise !== initialPreiseRef.current;
    setHasChanges(changed);
  }, [quantities, descriptions, kategorien, preise]);

  // Update both local and parent state
  const updateQuantity = (componentId: string, delta: number) => {
    setQuantities(prev => {
      const next = new Map(prev);
      const current = next.get(componentId) || 0;
      const newValue = Math.max(0, current + delta);
      if (newValue === 0) {
        next.delete(componentId);
        // Also clear descriptions, kategorien, preise
        setDescriptions(d => {
          const newD = new Map(d);
          newD.delete(componentId);
          return newD;
        });
        setKategorien(k => {
          const newK = new Map(k);
          newK.delete(componentId);
          return newK;
        });
        setPreise(p => {
          const newP = new Map(p);
          newP.delete(componentId);
          return newP;
        });
        // Collapse
        setExpandedComponents(e => {
          const newE = new Set(e);
          newE.delete(componentId);
          return newE;
        });
      } else {
        next.set(componentId, newValue);
        // Adjust descriptions array
        setDescriptions(d => {
          const newD = new Map(d);
          const currentDescs = newD.get(componentId) || [];
          // Extend or shrink descriptions array
          const newDescs = Array.from({ length: newValue }, (_, i) => currentDescs[i] || '');
          newD.set(componentId, newDescs);
          return newD;
        });
      }
      return next;
    });
  };

  const setQuantity = (componentId: string, value: number) => {
    setQuantities(prev => {
      const next = new Map(prev);
      if (value <= 0) {
        next.delete(componentId);
        setDescriptions(d => {
          const newD = new Map(d);
          newD.delete(componentId);
          return newD;
        });
        setKategorien(k => {
          const newK = new Map(k);
          newK.delete(componentId);
          return newK;
        });
        setPreise(p => {
          const newP = new Map(p);
          newP.delete(componentId);
          return newP;
        });
        setExpandedComponents(e => {
          const newE = new Set(e);
          newE.delete(componentId);
          return newE;
        });
      } else {
        next.set(componentId, value);
        setDescriptions(d => {
          const newD = new Map(d);
          const currentDescs = newD.get(componentId) || [];
          const newDescs = Array.from({ length: value }, (_, i) => currentDescs[i] || '');
          newD.set(componentId, newDescs);
          return newD;
        });
      }
      return next;
    });
  };

  const updateDescription = (componentId: string, instanceIndex: number, description: string) => {
    setDescriptions(prev => {
      const next = new Map(prev);
      const descs = [...(next.get(componentId) || [])];
      descs[instanceIndex] = description;
      next.set(componentId, descs);
      return next;
    });
  };

  const copyDescriptionToAll = (componentId: string, sourceIndex: number) => {
    setDescriptions(prev => {
      const next = new Map(prev);
      const descs = next.get(componentId) || [];
      const sourceDesc = descs[sourceIndex] || '';
      const newDescs = descs.map(() => sourceDesc);
      next.set(componentId, newDescs);
      return next;
    });
  };

  const updateKategorie = (componentId: string, kategorie: string) => {
    setKategorien(prev => {
      const next = new Map(prev);
      next.set(componentId, kategorie);
      return next;
    });
  };

  const updatePreis = (componentId: string, preis: number) => {
    setPreise(prev => {
      const next = new Map(prev);
      next.set(componentId, preis);
      return next;
    });
  };

  const toggleExpanded = (componentId: string) => {
    setExpandedComponents(prev => {
      const next = new Set(prev);
      if (next.has(componentId)) {
        next.delete(componentId);
      } else {
        next.add(componentId);
      }
      return next;
    });
  };

  const clearAll = () => {
    const empty = new Map<string, number>();
    const emptyDescs = new Map<string, string[]>();
    const emptyKat = new Map<string, string>();
    const emptyPreise = new Map<string, number>();
    setQuantities(empty);
    setDescriptions(emptyDescs);
    setKategorien(emptyKat);
    setPreise(emptyPreise);
    setExpandedComponents(new Set());
  };

  const handleSave = () => {
    onProjectQuantitiesChange(quantities);
    onProjectDescriptionsChange(descriptions);
    onProjectKategorienChange(kategorien);
    onProjectPreiseChange(preise);
    onOpenChange(false);
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
    
    // Try to find groups that complement each other
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
      return next;
    });
  };

  const handleInsertComplementarySet = (set: ComplementaryGroupSet) => {
    onInsertMultipleGroups(set.groups.map(g => ({ group: g.group, count: g.possibleCount })));
    setQuantities(set.remainingComponents);
  };

  // Determine button text
  const getButtonText = () => {
    if (!wasOpened && quantities.size === 0) {
      return "Schließen";
    }
    if (wasOpened && hasChanges) {
      return "Aktualisieren";
    }
    return "Speichern";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
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
                  const isExpanded = expandedComponents.has(component.id);
                  const componentDescs = descriptions.get(component.id) || [];
                  const componentKategorie = kategorien.get(component.id) || '';
                  const componentPreis = preise.get(component.id) || 0;
                  
                  return (
                    <div key={component.id} className="space-y-1">
                      <div
                        className={`flex items-center justify-between gap-2 p-2 rounded-lg border transition-colors ${
                          qty > 0 ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 border-transparent'
                        }`}
                      >
                        {/* Expand button for descriptions */}
                        {qty > 0 && (
                          <button
                            onClick={() => toggleExpanded(component.id)}
                            className="p-0.5 hover:bg-accent rounded"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        )}
                        <span className={`text-sm truncate flex-1 ${qty === 0 ? 'ml-6' : ''}`}>
                          {component.name}
                        </span>
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
                      
                      {/* Expanded details: Kategorie, Preis, and descriptions */}
                      {qty > 0 && isExpanded && (
                        <div className="ml-6 pl-2 border-l-2 border-primary/20 space-y-2">
                          {/* Kategorie und Preis */}
                          <div className="flex items-center gap-2">
                            <Input
                              placeholder="Kategorie..."
                              value={componentKategorie}
                              onChange={(e) => updateKategorie(component.id, e.target.value)}
                              className="h-7 text-sm flex-1"
                            />
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Preis"
                                value={componentPreis || ''}
                                onChange={(e) => updatePreis(component.id, parseFloat(e.target.value) || 0)}
                                className="h-7 text-sm w-20 text-right"
                              />
                              <span className="text-xs text-muted-foreground">€</span>
                            </div>
                          </div>
                          
                          {/* Descriptions for each instance */}
                          {Array.from({ length: qty }, (_, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-6">#{i + 1}</span>
                              <Input
                                placeholder="Beschreibung (Marke, Modell)..."
                                value={componentDescs[i] || ''}
                                onChange={(e) => updateDescription(component.id, i, e.target.value)}
                                className="h-7 text-sm flex-1"
                              />
                              {qty > 1 && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0"
                                  onClick={() => copyDescriptionToAll(component.id, i)}
                                  title="Beschreibung auf alle kopieren"
                                >
                                  <Equal className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
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
          <Button onClick={handleSave}>
            {getButtonText()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
