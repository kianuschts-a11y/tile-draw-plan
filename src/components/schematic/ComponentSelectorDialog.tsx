import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Component, ComponentGroup, ComponentQuantity, GroupMatch, GroupLayoutData, ProjectComponentData } from "@/types/schematic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, Folder, Check, X, Layers, ArrowRight, ChevronDown, ChevronRight, Equal, AlertTriangle } from "lucide-react";
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
import { GroupPreview } from "./GroupPreview";

interface ComponentSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  components: Component[];
  groups: ComponentGroup[];
  onInsertGroup: (group: ComponentGroup, count: number, isPartialMatch?: boolean, currentQuantities?: Map<string, number>) => void;
  onInsertMultipleGroups: (groupsWithCounts: Array<{ group: ComponentGroup; count: number }>, isPartialMatch?: boolean, currentQuantities?: Map<string, number>) => void;
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

  // Check if a component ID is a connection block (should be ignored in matching)
  const isConnectionBlock = useCallback((componentId: string): boolean => {
    return componentId.startsWith('connection-');
  }, []);

  // Get component requirements from a group (excluding connection blocks for matching purposes)
  const getGroupComponentRequirements = useCallback((group: ComponentGroup, excludeConnections: boolean = false): Map<string, number> => {
    const requirements = new Map<string, number>();
    
    if (group.layoutData?.tiles && group.layoutData.tiles.length > 0) {
      for (const tile of group.layoutData.tiles) {
        // Skip connection blocks when matching against project components
        if (excludeConnections && isConnectionBlock(tile.componentId)) {
          continue;
        }
        requirements.set(tile.componentId, (requirements.get(tile.componentId) || 0) + 1);
      }
    } else {
      for (const id of group.componentIds) {
        if (excludeConnections && isConnectionBlock(id)) {
          continue;
        }
        requirements.set(id, (requirements.get(id) || 0) + 1);
      }
    }
    
    return requirements;
  }, [isConnectionBlock]);

  // Check if a group can be fulfilled with given component quantities (full match)
  // Uses excludeConnections=true to ignore connection blocks when matching
  const canFulfillGroup = useCallback((
    group: ComponentGroup,
    availableComponents: Map<string, number>
  ): { possible: boolean; maxCount: number } => {
    // For matching, exclude connection blocks - they are auto-included with groups
    const requirements = getGroupComponentRequirements(group, true);
    
    // If the group has no non-connection components, skip it
    if (requirements.size === 0) {
      return { possible: false, maxCount: 0 };
    }
    
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

  // Calculate partial match percentage for a group
  const calculateGroupMatchPercentage = useCallback((
    group: ComponentGroup,
    availableComponents: Map<string, number>
  ): { matchPercent: number; matchingComponents: number; totalComponents: number } => {
    const requirements = getGroupComponentRequirements(group, true);
    
    if (requirements.size === 0) {
      return { matchPercent: 0, matchingComponents: 0, totalComponents: 0 };
    }
    
    let matchingComponents = 0;
    let totalComponents = 0;
    
    for (const [componentId, needed] of requirements.entries()) {
      totalComponents += needed;
      const available = availableComponents.get(componentId) || 0;
      matchingComponents += Math.min(available, needed);
    }
    
    return {
      matchPercent: totalComponents > 0 ? Math.round((matchingComponents / totalComponents) * 100) : 0,
      matchingComponents,
      totalComponents
    };
  }, [getGroupComponentRequirements]);

  // Find all matching groups - now shows partial matches too!
  const matchingGroups = useMemo((): GroupSuggestion[] => {
    if (quantities.size === 0) return [];
    
    const suggestions: GroupSuggestion[] = [];
    
    for (const group of groups) {
      const requirements = getGroupComponentRequirements(group, true);
      
      // Skip groups with no non-connection components
      if (requirements.size === 0) continue;
      
      // Check for any overlap with selected components
      let hasAnyOverlap = false;
      for (const [componentId] of requirements.entries()) {
        if ((quantities.get(componentId) || 0) > 0) {
          hasAnyOverlap = true;
          break;
        }
      }
      
      // Only show groups that have at least one matching component
      if (!hasAnyOverlap) continue;
      
      // Check if fully fulfillable
      const { possible, maxCount } = canFulfillGroup(group, quantities);
      
      // Calculate match percentage
      const { matchPercent } = calculateGroupMatchPercentage(group, quantities);
      
      const totalGroupComponents = Array.from(requirements.values()).reduce((a, b) => a + b, 0);
      const totalProjectComponents = Array.from(quantities.values()).reduce((a, b) => a + b, 0);
      
      suggestions.push({
        group,
        possibleCount: possible ? maxCount : 0, // 0 if not fully fulfillable
        usedComponents: requirements,
        coveragePercent: possible 
          ? Math.round((totalGroupComponents / totalProjectComponents) * 100)
          : matchPercent // For partial matches, show how much of the group is covered
      });
    }
    
    // Sort: 100% matches first (possibleCount > 0), then by coverage percentage
    return suggestions.sort((a, b) => {
      // Fully fulfillable groups first
      if (a.possibleCount > 0 && b.possibleCount === 0) return -1;
      if (a.possibleCount === 0 && b.possibleCount > 0) return 1;
      // Then by coverage percentage
      return b.coveragePercent - a.coveragePercent;
    });
  }, [quantities, groups, canFulfillGroup, getGroupComponentRequirements, calculateGroupMatchPercentage]);

  // Helper to subtract group requirements from a component map
  const subtractGroupFromComponents = useCallback((
    components: Map<string, number>,
    groupRequirements: Map<string, number>
  ): Map<string, number> => {
    const result = new Map(components);
    for (const [compId, needed] of groupRequirements.entries()) {
      const current = result.get(compId) || 0;
      if (current - needed <= 0) {
        result.delete(compId);
      } else {
        result.set(compId, current - needed);
      }
    }
    return result;
  }, []);

  // Calculate coverage percentage for a set of groups
  const calculateSetCoverage = useCallback((
    groupsInSet: GroupSuggestion[],
    totalProjectComponents: number
  ): number => {
    let totalGroupComponents = 0;
    for (const g of groupsInSet) {
      const groupComps = Array.from(g.usedComponents.values()).reduce((a, b) => a + b, 0);
      totalGroupComponents += groupComps * g.possibleCount;
    }
    return Math.min(100, Math.round((totalGroupComponents / totalProjectComponents) * 100));
  }, []);

  // Find ALL complementary group combinations (2, 3, or more groups)
  const complementaryGroupSets = useMemo((): ComplementaryGroupSet[] => {
    if (matchingGroups.length < 2) return [];
    
    const sets: ComplementaryGroupSet[] = [];
    const totalProjectComponents = Array.from(quantities.values()).reduce((a, b) => a + b, 0);
    if (totalProjectComponents === 0) return [];
    
    // Recursive function to find all valid combinations
    const findCombinations = (
      startIndex: number,
      currentGroups: GroupSuggestion[],
      remainingComponents: Map<string, number>,
      depth: number
    ) => {
      // Limit depth to prevent combinatorial explosion (max 4 groups)
      if (depth > 4) return;
      
      for (let i = startIndex; i < matchingGroups.length; i++) {
        const candidateGroup = matchingGroups[i];
        const { possible, maxCount } = canFulfillGroup(candidateGroup.group, remainingComponents);
        
        if (possible && maxCount > 0) {
          // Use 1 instance of this group
          const newRemaining = subtractGroupFromComponents(remainingComponents, candidateGroup.usedComponents);
          const newGroups = [...currentGroups, { ...candidateGroup, possibleCount: 1 }];
          
          const coverage = calculateSetCoverage(newGroups, totalProjectComponents);
          
          // Only add combinations with 2+ groups
          if (newGroups.length >= 2) {
            sets.push({
              groups: newGroups,
              totalCoverage: coverage,
              remainingComponents: newRemaining
            });
          }
          
          // Continue searching for more groups (only if there are remaining components)
          if (newRemaining.size > 0) {
            findCombinations(i + 1, newGroups, newRemaining, depth + 1);
          }
        }
      }
    };
    
    // Start combinations from each group
    for (let i = 0; i < matchingGroups.length; i++) {
      const firstGroup = matchingGroups[i];
      const remainingAfterFirst = subtractGroupFromComponents(quantities, firstGroup.usedComponents);
      findCombinations(i + 1, [{ ...firstGroup, possibleCount: 1 }], remainingAfterFirst, 1);
    }
    
    // Remove duplicates (same groups in different order) by creating a unique key
    const uniqueSets = new Map<string, ComplementaryGroupSet>();
    for (const set of sets) {
      const key = set.groups.map(g => g.group.id).sort().join('|');
      if (!uniqueSets.has(key) || uniqueSets.get(key)!.totalCoverage < set.totalCoverage) {
        uniqueSets.set(key, set);
      }
    }
    
    return Array.from(uniqueSets.values())
      .sort((a, b) => {
        // 100% matches first
        if (a.totalCoverage === 100 && b.totalCoverage !== 100) return -1;
        if (b.totalCoverage === 100 && a.totalCoverage !== 100) return 1;
        // Then by coverage descending
        return b.totalCoverage - a.totalCoverage;
      });
  }, [matchingGroups, quantities, canFulfillGroup, subtractGroupFromComponents, calculateSetCoverage]);

  const totalComponents = useMemo(() => 
    Array.from(quantities.values()).reduce((a, b) => a + b, 0)
  , [quantities]);

  // Check for fully fulfillable 100% matches (possibleCount > 0 means all components are available)
  const hasExactMatch = matchingGroups.some(g => g.possibleCount > 0 && g.coveragePercent === 100);
  const hasExactCombinationMatch = complementaryGroupSets.some(s => s.totalCoverage === 100);
  
  // Split complementary sets into exact (100%) and partial
  const exactCombinations = complementaryGroupSets.filter(s => s.totalCoverage === 100);
  const partialCombinations = complementaryGroupSets.filter(s => s.totalCoverage < 100);

  const handleInsertGroup = (group: ComponentGroup, count: number = 1, isPartialMatch: boolean = false) => {
    // Pass current quantities to enable accurate excess calculation
    onInsertGroup(group, count, isPartialMatch, quantities);
    
    // When updating quantities, only subtract non-connection components
    const requirements = getGroupComponentRequirements(group, true);
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
    onInsertMultipleGroups(set.groups.map(g => ({ group: g.group, count: g.possibleCount })), false, quantities);
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
                  Keine Gruppen gefunden, die mindestens eine der gewählten Komponenten enthalten.
                </p>
              ) : (
                <div className="space-y-3">
                  {/* 100% matches first (single groups AND combinations) */}
                  {(hasExactMatch || hasExactCombinationMatch) && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
                        <Check className="w-3 h-3" />
                        100% Übereinstimmung
                      </div>
                      
                      {/* Single groups with 100% (fully fulfillable) */}
                      {matchingGroups.filter(g => g.possibleCount > 0 && g.coveragePercent === 100).map(suggestion => (
                        <div
                          key={suggestion.group.id}
                          className="p-2 rounded-lg border border-green-500/50 bg-green-500/10 space-y-2"
                        >
                          <div className="flex items-start gap-2">
                            <div className="flex-shrink-0">
                              <GroupPreview group={suggestion.group} components={components} maxSize={50} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium truncate block">
                                {suggestion.group.name}
                              </span>
                              <div className="flex items-center gap-1 mt-1">
                                <Badge variant="default" className="bg-green-600 h-5 text-[10px]">
                                  100%
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {suggestion.possibleCount}x
                                </span>
                              </div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            className="h-6 text-xs w-full gap-1"
                            onClick={() => handleInsertGroup(suggestion.group, 1, false)}
                          >
                            <ArrowRight className="w-3 h-3" />
                            Einfügen
                          </Button>
                        </div>
                      ))}
                      
                      {/* Combinations with 100% */}
                      {exactCombinations.map((set, index) => (
                        <div
                          key={`exact-combo-${index}`}
                          className="p-2 rounded-lg border border-green-500/50 bg-green-500/10 space-y-2"
                        >
                          <div className="flex items-center gap-1 flex-wrap">
                            {set.groups.map((g, i) => (
                              <span key={g.group.id} className="flex items-center gap-1">
                                {i > 0 && <span className="text-green-600">+</span>}
                                <span className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded">
                                  {g.group.name}
                                </span>
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="default" className="bg-green-600">
                              100%
                            </Badge>
                            <Button
                              size="sm"
                              className="h-6 text-xs ml-auto gap-1"
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
                  
                  {/* All partial matches (single groups and combinations) sorted by percentage */}
                  {(matchingGroups.filter(g => !(g.possibleCount > 0 && g.coveragePercent === 100)).length > 0 || partialCombinations.length > 0) && (
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground font-medium">
                        Teilweise Übereinstimmung
                      </div>
                      
                      {/* Merge and sort: single groups + combinations by percentage */}
                      {(() => {
                        // Create unified list of single groups and combinations
                        type DisplayItem = 
                          | { type: 'single'; suggestion: GroupSuggestion; coverage: number }
                          | { type: 'combo'; set: ComplementaryGroupSet; coverage: number };
                        
                        const items: DisplayItem[] = [
                          ...matchingGroups
                            // Exclude 100% fully fulfillable groups (already shown above)
                            .filter(g => !(g.possibleCount > 0 && g.coveragePercent === 100))
                            .map(g => ({ type: 'single' as const, suggestion: g, coverage: g.coveragePercent })),
                          ...partialCombinations
                            .map(s => ({ type: 'combo' as const, set: s, coverage: s.totalCoverage }))
                        ];
                        
                        // Sort by coverage descending
                        items.sort((a, b) => b.coverage - a.coverage);
                        
                        // Show top 10 items
                        return items.slice(0, 10).map((item, idx) => {
                          if (item.type === 'single') {
                            const suggestion = item.suggestion;
                            const isPartiallyFulfillable = suggestion.possibleCount > 0;
                            return (
                              <div
                                key={`single-${suggestion.group.id}`}
                                className="p-2 rounded-lg border bg-muted/30 space-y-2"
                              >
                                <div className="flex items-start gap-2">
                                  <div className="flex-shrink-0">
                                    <GroupPreview group={suggestion.group} components={components} maxSize={50} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <span className="text-sm truncate block">
                                      {suggestion.group.name}
                                    </span>
                                    <div className="flex items-center gap-1 mt-1">
                                      <Badge variant="secondary" className="h-5 text-[10px]">
                                        {suggestion.coveragePercent}%
                                      </Badge>
                                      {!isPartiallyFulfillable && (
                                        <span className="text-[10px] text-orange-600 flex items-center gap-0.5">
                                          <AlertTriangle className="w-3 h-3" />
                                          fehlen
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                {/* Always show insert button - for partial matches, mark excess components */}
                                <Button
                                  size="sm"
                                  variant={isPartiallyFulfillable ? "outline" : "secondary"}
                                  className="h-6 text-xs w-full gap-1"
                                  onClick={() => handleInsertGroup(suggestion.group, 1, !isPartiallyFulfillable)}
                                >
                                  <ArrowRight className="w-3 h-3" />
                                  {isPartiallyFulfillable ? 'Einfügen' : 'Trotzdem einfügen'}
                                </Button>
                              </div>
                            );
                          } else {
                            const set = item.set;
                            return (
                              <div
                                key={`combo-${idx}`}
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
                                    {set.totalCoverage}%
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
                            );
                          }
                        });
                      })()}
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
