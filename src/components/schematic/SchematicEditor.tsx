import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Shape, CanvasState, Component, PaperFormat, Orientation, TileSize, TILE_SIZES, CellConnection, ComponentGroup, ComponentQuantity, GroupMatch, GroupLayoutData, GroupTileData, GroupConnectionData, PAPER_SIZES, MM_TO_PX, TitleBlockData } from "@/types/schematic";
import { Toolbar, MainToolType } from "./Toolbar";
import { Canvas, PlacedTile } from "./Canvas";
import { ComponentLibrary } from "./ComponentLibrary";
import { StatusBar } from "./StatusBar";
import { PaperSettings } from "./PaperSettings";
import { ComponentEditorDialog } from "./ComponentEditorDialog";
import { ComponentSelectorDialog } from "./ComponentSelectorDialog";
import { TitleBlockEditor } from "./TitleBlockEditor";
import { BillOfMaterials } from "./BillOfMaterials";
import { useAuth } from "@/hooks/useAuth";
import { useComponents } from "@/hooks/useComponents";
import { useComponentGroups } from "@/hooks/useComponentGroups";
import { useSavedPlans, SavedPlanData, DrawingData } from "@/hooks/useSavedPlans";
import { useProjects } from "@/hooks/useProjects";
import { Button } from "@/components/ui/button";
import { LogOut, Menu, User, Building2, Package } from "lucide-react";
import { isConnectionBlock } from "@/lib/connectionBlocks";

// History-Eintrag für Undo/Redo
interface HistoryEntry {
  tiles: PlacedTile[];
  connections: CellConnection[];
}
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function SchematicEditor() {
  const { user, companyName, signOut } = useAuth();
  const { 
    components, 
    loading: componentsLoading,
    saveComponent,
    updateComponent,
    updateComponentFull,
    deleteComponent,
    clearAllComponents,
    importFromLocalStorage,
    hasLocalStorageComponents
  } = useComponents();
  
  const {
    groups,
    loading: groupsLoading,
    createGroup,
    deleteGroup,
    updateGroup
  } = useComponentGroups();

  const { savedPlans, savePlan, findExactMatchingPlan } = useSavedPlans();
  const { findMatchingGroups } = useProjects();

  const [tiles, setTilesInternal] = useState<PlacedTile[]>([]);
  const [connections, setConnectionsInternal] = useState<CellConnection[]>([]);
  const [selectedTileIds, setSelectedTileIds] = useState<Set<string>>(new Set());
  const [selectedComponentIds, setSelectedComponentIds] = useState<Set<string>>(new Set());
  const [activeTool, setActiveTool] = useState<MainToolType>('select');
  const [connectionColor, setConnectionColor] = useState<string>('#000000');
  const [draggingComponent, setDraggingComponent] = useState<Component | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<Component | null>(null);
  const [editingGroup, setEditingGroup] = useState<ComponentGroup | null>(null);
  const [libraryTab, setLibraryTab] = useState<'components' | 'connections' | 'groups'>('components');
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [showComponentSelector, setShowComponentSelector] = useState(false);
  const [projectQuantities, setProjectQuantities] = useState<Map<string, number>>(new Map());
  const [projectDescriptions, setProjectDescriptions] = useState<Map<string, string[]>>(new Map());
  const [projectKategorien, setProjectKategorien] = useState<Map<string, string>>(new Map());
  const [projectPreise, setProjectPreise] = useState<Map<string, number>>(new Map());
  const [titleBlockData, setTitleBlockData] = useState<TitleBlockData>({
    enabled: false,
    projekt: '',
    zeichnungsNr: '',
    blattNr: '1',
    blattzahl: '1',
    aenderungen: '',
    gezeichnet: { name: '', datum: '' },
    geprueft: { name: '', datum: '' },
  });
  const [isTitleBlockEditorOpen, setIsTitleBlockEditorOpen] = useState(false);
  const [isBOMOpen, setIsBOMOpen] = useState(false);
  const [canvasState, setCanvasState] = useState<CanvasState>({
    zoom: 1,
    panX: 50,
    panY: 50,
    gridSize: 40,
    paperFormat: 'A4',
    orientation: 'portrait'
  });

  // Undo/Redo History - speichert kompletten Zustand
  const historyRef = useRef<HistoryEntry[]>([{ tiles: [], connections: [] }]);
  const historyIndexRef = useRef(0);
  const [historyVersion, setHistoryVersion] = useState(0);
  const isUndoRedoRef = useRef(false);
  const saveTimeoutRef = useRef<number | null>(null);

  // Snapshot des aktuellen Zustands speichern (debounced)
  const saveToHistory = useCallback((newTiles: PlacedTile[], newConnections: CellConnection[]) => {
    // Wenn gerade Undo/Redo läuft, nicht speichern
    if (isUndoRedoRef.current) {
      return;
    }
    
    const currentEntry = historyRef.current[historyIndexRef.current];
    const tilesChanged = JSON.stringify(currentEntry?.tiles) !== JSON.stringify(newTiles);
    const connectionsChanged = JSON.stringify(currentEntry?.connections) !== JSON.stringify(newConnections);
    
    if (tilesChanged || connectionsChanged) {
      // Historie bis zum aktuellen Index abschneiden, neuen Eintrag hinzufügen
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
      historyRef.current.push({ 
        tiles: JSON.parse(JSON.stringify(newTiles)), 
        connections: JSON.parse(JSON.stringify(newConnections)) 
      });
      // Maximal 50 Einträge
      if (historyRef.current.length > 50) {
        historyRef.current.shift();
      } else {
        historyIndexRef.current++;
      }
      console.log('[History] Saved, index:', historyIndexRef.current, 'length:', historyRef.current.length);
      setHistoryVersion(v => v + 1);
    }
  }, []);

  // Debounced save - wartet bis keine weiteren Änderungen kommen
  const scheduleSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = window.setTimeout(() => {
      // Aktuellen State holen und speichern
      setTilesInternal(currentTiles => {
        setConnectionsInternal(currentConnections => {
          saveToHistory(currentTiles, currentConnections);
          return currentConnections;
        });
        return currentTiles;
      });
    }, 100);
  }, [saveToHistory]);

  // Normale setTiles
  const setTiles = useCallback((newTilesOrUpdater: PlacedTile[] | ((prev: PlacedTile[]) => PlacedTile[])) => {
    setTilesInternal(prev => {
      const newTiles = typeof newTilesOrUpdater === 'function' ? newTilesOrUpdater(prev) : newTilesOrUpdater;
      return newTiles;
    });
    scheduleSave();
  }, [scheduleSave]);

  // Normale setConnections
  const setConnections = useCallback((newConnectionsOrUpdater: CellConnection[] | ((prev: CellConnection[]) => CellConnection[])) => {
    setConnectionsInternal(prev => {
      const newConnections = typeof newConnectionsOrUpdater === 'function' ? newConnectionsOrUpdater(prev) : newConnectionsOrUpdater;
      return newConnections;
    });
    scheduleSave();
  }, [scheduleSave]);

  // Undo-Funktion
  const handleUndo = useCallback(() => {
    console.log('[Undo] Called, index:', historyIndexRef.current);
    if (historyIndexRef.current > 0) {
      // Pending saves abbrechen
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      isUndoRedoRef.current = true;
      historyIndexRef.current--;
      const prevState = historyRef.current[historyIndexRef.current];
      console.log('[Undo] Restoring to index:', historyIndexRef.current, 'tiles:', prevState.tiles.length);
      setTilesInternal(JSON.parse(JSON.stringify(prevState.tiles)));
      setConnectionsInternal(JSON.parse(JSON.stringify(prevState.connections)));
      setSelectedTileIds(new Set());
      setHistoryVersion(v => v + 1);
      // Flag nach kurzer Zeit zurücksetzen
      setTimeout(() => {
        isUndoRedoRef.current = false;
      }, 200);
    }
  }, []);

  // Redo-Funktion
  const handleRedo = useCallback(() => {
    console.log('[Redo] Called, index:', historyIndexRef.current, 'max:', historyRef.current.length - 1);
    if (historyIndexRef.current < historyRef.current.length - 1) {
      // Pending saves abbrechen
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      isUndoRedoRef.current = true;
      historyIndexRef.current++;
      const nextState = historyRef.current[historyIndexRef.current];
      console.log('[Redo] Restoring to index:', historyIndexRef.current);
      setTilesInternal(JSON.parse(JSON.stringify(nextState.tiles)));
      setConnectionsInternal(JSON.parse(JSON.stringify(nextState.connections)));
      setSelectedTileIds(new Set());
      setHistoryVersion(v => v + 1);
      // Flag nach kurzer Zeit zurücksetzen
      setTimeout(() => {
        isUndoRedoRef.current = false;
      }, 200);
    }
  }, []);

  // Keyboard-Shortcuts für Undo/Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  const handleZoomIn = useCallback(() => {
    setCanvasState(prev => ({ ...prev, zoom: Math.min(prev.zoom * 1.25, 4) }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setCanvasState(prev => ({ ...prev, zoom: Math.max(prev.zoom / 1.25, 0.25) }));
  }, []);

  const handleResetView = useCallback(() => {
    setCanvasState(prev => ({ ...prev, zoom: 1, panX: 50, panY: 50 }));
  }, []);

  const handleDelete = useCallback(() => {
    if (selectedTileIds.size > 0) {
      setConnections(prev => prev.filter(c => 
        !selectedTileIds.has(c.fromTileId) && !selectedTileIds.has(c.toTileId)
      ));
      setTiles(prev => prev.filter(t => !selectedTileIds.has(t.id)));
      setSelectedTileIds(new Set());
    }
  }, [selectedTileIds]);

  const handleExport = useCallback(() => {
    const svgElement = document.querySelector('.schematic-canvas svg') as SVGSVGElement;
    if (!svgElement) return;

    // Calculate paper dimensions based on format and orientation
    const paperSize = PAPER_SIZES[canvasState.paperFormat];
    const paperWidthMM = canvasState.orientation === 'landscape' ? paperSize.height : paperSize.width;
    const paperHeightMM = canvasState.orientation === 'landscape' ? paperSize.width : paperSize.height;
    const paperWidthPx = paperWidthMM * MM_TO_PX;
    const paperHeightPx = paperHeightMM * MM_TO_PX;
    
    // Calculate grid dimensions (same logic as Canvas.tsx)
    const tileSize = canvasState.gridSize;
    const gridCols = Math.floor(paperWidthPx / tileSize);
    const gridRows = Math.floor(paperHeightPx / tileSize);
    const canvasWidth = gridCols * tileSize;
    const canvasHeight = gridRows * tileSize;

    // Clone the SVG to avoid modifying the original
    const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
    
    // Set viewBox to match the actual canvas content (grid area only)
    clonedSvg.setAttribute('viewBox', `0 0 ${canvasWidth} ${canvasHeight}`);
    clonedSvg.setAttribute('width', String(canvasWidth));
    clonedSvg.setAttribute('height', String(canvasHeight));
    
    // Find and reset the main transform group to scale(1) translate(0,0)
    const transformGroup = clonedSvg.querySelector('g[transform]');
    if (transformGroup) {
      transformGroup.setAttribute('transform', 'translate(0, 0) scale(1)');
    }
    
    // Replace CSS variables with fixed colors for export compatibility
    const cssVarReplacements: Record<string, string> = {
      'hsl(var(--primary) / 0.1)': 'rgba(37, 99, 235, 0.1)',
      'hsl(var(--primary) / 0.15)': 'rgba(37, 99, 235, 0.15)',
      'hsl(var(--primary) / 0.3)': 'rgba(37, 99, 235, 0.3)',
      'hsl(var(--primary) / 0.4)': 'rgba(37, 99, 235, 0.4)',
      'hsl(var(--primary) / 0.5)': 'rgba(37, 99, 235, 0.5)',
      'hsl(var(--primary))': '#2563eb',
      'hsl(var(--muted) / 0.3)': 'rgba(241, 245, 249, 0.3)',
      'hsl(var(--muted-foreground))': '#64748b',
      'hsl(var(--foreground) / 0.1)': 'rgba(15, 23, 42, 0.1)',
      'hsl(var(--border))': '#e2e8f0',
      'hsl(var(--canvas-grid))': '#cbd5e1',
      'hsl(var(--destructive) / 0.3)': 'rgba(239, 68, 68, 0.3)',
      'hsl(var(--destructive))': '#ef4444',
    };
    
    // Replace CSS variables in all elements
    const allElements = clonedSvg.querySelectorAll('*');
    allElements.forEach(el => {
      const element = el as SVGElement;
      ['fill', 'stroke', 'style'].forEach(attr => {
        const value = element.getAttribute(attr);
        if (value) {
          let newValue = value;
          Object.entries(cssVarReplacements).forEach(([cssVar, replacement]) => {
            newValue = newValue.replace(new RegExp(cssVar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement);
          });
          element.setAttribute(attr, newValue);
        }
      });
      
      // Also check inline style
      if (element.style) {
        Object.entries(cssVarReplacements).forEach(([cssVar, replacement]) => {
          if (element.style.fill && element.style.fill.includes('var(')) {
            element.style.fill = replacement;
          }
          if (element.style.stroke && element.style.stroke.includes('var(')) {
            element.style.stroke = replacement;
          }
        });
      }
    });
    
    // Remove temporary UI elements that shouldn't be exported
    const selectorsToRemove = [
      '[data-export-ignore]',
    ];
    selectorsToRemove.forEach(selector => {
      clonedSvg.querySelectorAll(selector).forEach(el => el.remove());
    });
    
    // Remove elements that are clearly UI-only (selection boxes, previews, dimension labels)
    // Remove the last text element (dimension label)
    const textElements = clonedSvg.querySelectorAll('text');
    textElements.forEach(text => {
      const content = text.textContent || '';
      if (content.includes('Kacheln') || content.includes('×')) {
        text.remove();
      }
    });

    // Create a canvas to render the SVG
    const canvas = document.createElement('canvas');
    const scale = 2; // Higher resolution for better quality
    canvas.width = canvasWidth * scale;
    canvas.height = canvasHeight * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Create an image from the SVG
    const svgData = new XMLSerializer().serializeToString(clonedSvg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);

      // Download as PNG
      const link = document.createElement('a');
      link.download = `zeichnung-${canvasState.paperFormat}-${canvasState.orientation}-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.onerror = (err) => {
      console.error('Export failed:', err);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, [canvasState.paperFormat, canvasState.orientation, canvasState.gridSize]);

  const handlePaperFormatChange = useCallback((format: PaperFormat) => {
    setCanvasState(prev => ({ ...prev, paperFormat: format }));
  }, []);

  const handleOrientationChange = useCallback((orientation: Orientation) => {
    setCanvasState(prev => ({ ...prev, orientation }));
  }, []);

  const handleGridSizeChange = useCallback((gridSize: number) => {
    setCanvasState(prev => ({ ...prev, gridSize }));
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, component: Component) => {
    e.dataTransfer.setData('application/json', JSON.stringify(component));
    e.dataTransfer.effectAllowed = 'copy';
    setDraggingComponent(component);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingComponent(null);
  }, []);

  const handleDropComponent = useCallback((component: Component, gridX: number, gridY: number) => {
    const newTile: PlacedTile = { id: generateId(), component, gridX, gridY };
    setTiles(prev => [...prev, newTile]);
    setSelectedTileIds(new Set([newTile.id]));
  }, []);

  // Handle dropping a group onto the canvas - places all tiles with their relative positions and connections
  const handleDropGroup = useCallback((groupData: any, gridX: number, gridY: number) => {
    const group = groups.find(g => g.id === groupData.groupId);
    if (!group || !group.layoutData) return;
    
    const newTileIds: string[] = [];
    const newTiles: PlacedTile[] = [];
    
    // Create tiles from layout data
    for (const tileData of group.layoutData.tiles) {
      const component = components.find(c => c.id === tileData.componentId);
      if (!component) continue;
      
      const newTile: PlacedTile = {
        id: generateId(),
        component,
        gridX: gridX + tileData.relativeX,
        gridY: gridY + tileData.relativeY
      };
      newTiles.push(newTile);
      newTileIds.push(newTile.id);
    }
    
    // Create connections using the new tile IDs
    const newConnections: CellConnection[] = [];
    for (const connData of group.layoutData.connections) {
      if (connData.fromTileIndex < newTileIds.length && connData.toTileIndex < newTileIds.length) {
        newConnections.push({
          id: generateId(),
          fromTileId: newTileIds[connData.fromTileIndex],
          fromCellX: connData.fromCellX,
          fromCellY: connData.fromCellY,
          fromSide: connData.fromSide,
          toTileId: newTileIds[connData.toTileIndex],
          toCellX: connData.toCellX,
          toCellY: connData.toCellY,
          toSide: connData.toSide,
          color: connData.color
        });
      }
    }
    
    setTiles(prev => [...prev, ...newTiles]);
    setConnections(prev => [...prev, ...newConnections]);
    setSelectedTileIds(new Set(newTileIds));
  }, [groups, components]);

  const handleSaveComponent = useCallback(async (name: string, shapes: Shape[], tileSize: TileSize, category?: string) => {
    await saveComponent(name, shapes, tileSize, category);
  }, [saveComponent]);

  const handleDeleteComponent = useCallback(async (id: string) => {
    await deleteComponent(id);
  }, [deleteComponent]);

  const handleClearAllComponents = useCallback(async () => {
    await clearAllComponents();
  }, [clearAllComponents]);

  const handleEditComponent = useCallback((component: Component) => {
    setEditingComponent(component);
    setIsEditorOpen(true);
  }, []);

  const handleUpdateComponentShapes = useCallback(async (id: string, name: string, shapes: Shape[], tileSize: TileSize, category?: string) => {
    await updateComponent(id, name, shapes, tileSize, category);
  }, [updateComponent]);

  const handleUpdateComponent = useCallback(async (updatedComponent: Component) => {
    await updateComponentFull(updatedComponent);
  }, [updateComponentFull]);

  const handleComponentSelect = useCallback((id: string) => {
    // Toggle selection for the component
    setSelectedComponentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Create group from selected tiles on canvas
  const handleCreateGroupFromTiles = useCallback(async (name: string) => {
    if (selectedTileIds.size < 2) return;
    
    const selectedTiles = tiles.filter(t => selectedTileIds.has(t.id));
    if (selectedTiles.length < 2) return;
    
    // Get all tile IDs that are involved in connections between selected tiles
    // This includes connection blocks that may not be directly selected but link selected tiles
    const selectedTileIdSet = new Set(selectedTileIds);
    
    // Find all connections where at least one end is a selected tile
    const potentialConnections = connections.filter(c => 
      selectedTileIdSet.has(c.fromTileId) || selectedTileIdSet.has(c.toTileId)
    );
    
    // Build a set of all tiles we need to include (selected + intermediate connection blocks)
    const allRelevantTileIds = new Set(selectedTileIds);
    
    // For each connection, if both endpoints eventually connect to selected tiles, include intermediate tiles
    // First pass: add connection blocks that directly connect two selected tiles
    for (const conn of potentialConnections) {
      if (selectedTileIdSet.has(conn.fromTileId) && selectedTileIdSet.has(conn.toTileId)) {
        allRelevantTileIds.add(conn.fromTileId);
        allRelevantTileIds.add(conn.toTileId);
      }
    }
    
    // Second pass: find connection blocks between selected tiles
    // A connection block is relevant if it's connected to selected tiles on both sides
    let changed = true;
    while (changed) {
      changed = false;
      for (const conn of connections) {
        const fromIncluded = allRelevantTileIds.has(conn.fromTileId);
        const toIncluded = allRelevantTileIds.has(conn.toTileId);
        
        // If one end is included, check if the other end leads to a selected tile
        if (fromIncluded && !toIncluded) {
          const toTile = tiles.find(t => t.id === conn.toTileId);
          if (toTile && isConnectionBlock(toTile.component)) {
            // Check if this connection block connects to any selected tile
            const connectedToSelected = connections.some(c2 => 
              (c2.fromTileId === conn.toTileId && selectedTileIdSet.has(c2.toTileId)) ||
              (c2.toTileId === conn.toTileId && selectedTileIdSet.has(c2.fromTileId))
            );
            if (connectedToSelected) {
              allRelevantTileIds.add(conn.toTileId);
              changed = true;
            }
          }
        } else if (!fromIncluded && toIncluded) {
          const fromTile = tiles.find(t => t.id === conn.fromTileId);
          if (fromTile && isConnectionBlock(fromTile.component)) {
            const connectedToSelected = connections.some(c2 => 
              (c2.fromTileId === conn.fromTileId && selectedTileIdSet.has(c2.toTileId)) ||
              (c2.toTileId === conn.fromTileId && selectedTileIdSet.has(c2.fromTileId))
            );
            if (connectedToSelected) {
              allRelevantTileIds.add(conn.fromTileId);
              changed = true;
            }
          }
        }
      }
    }
    
    // Get all tiles to include in the group
    const allTilesForGroup = tiles.filter(t => allRelevantTileIds.has(t.id));
    if (allTilesForGroup.length < 2) return;
    
    // Find min coordinates to calculate relative positions
    const minX = Math.min(...allTilesForGroup.map(t => t.gridX));
    const minY = Math.min(...allTilesForGroup.map(t => t.gridY));
    
    // Create tile data with relative positions
    const tileData: GroupTileData[] = allTilesForGroup.map(tile => ({
      componentId: tile.component.id,
      relativeX: tile.gridX - minX,
      relativeY: tile.gridY - minY
    }));
    
    // Get component IDs (unique)
    const componentIds = [...new Set(allTilesForGroup.map(t => t.component.id))];
    
    // Find connections between all relevant tiles
    const relevantConnections = connections.filter(c => 
      allRelevantTileIds.has(c.fromTileId) && allRelevantTileIds.has(c.toTileId)
    );
    
    // Map tile IDs to indices
    const tileIdToIndex = new Map(allTilesForGroup.map((t, i) => [t.id, i]));
    
    const connectionData: GroupConnectionData[] = relevantConnections.map(conn => ({
      fromTileIndex: tileIdToIndex.get(conn.fromTileId)!,
      fromCellX: conn.fromCellX,
      fromCellY: conn.fromCellY,
      fromSide: conn.fromSide,
      toTileIndex: tileIdToIndex.get(conn.toTileId)!,
      toCellX: conn.toCellX,
      toCellY: conn.toCellY,
      toSide: conn.toSide,
      color: conn.color
    }));
    
    const layoutData: GroupLayoutData = {
      tiles: tileData,
      connections: connectionData
    };
    
    await createGroup(name, componentIds, layoutData);
    setSelectedTileIds(new Set());
  }, [selectedTileIds, tiles, connections, createGroup]);

  const handleCreateGroup = useCallback(async (name: string, componentIds: string[]) => {
    await createGroup(name, componentIds);
    setSelectedComponentIds(new Set());
  }, [createGroup]);

  const handleDeleteGroup = useCallback(async (id: string) => {
    await deleteGroup(id);
  }, [deleteGroup]);

  const handleEditGroup = useCallback((group: ComponentGroup) => {
    setEditingGroup(group);
    // For now, just log - can extend to open a group editor dialog
    console.log('Edit group:', group);
  }, []);

  // Helper to generate unique ID
  const generateNewId = useCallback(() => {
    return Math.random().toString(36).substring(2, 11);
  }, []);

  // Insert a group from the component selector
  const handleInsertGroupFromSelector = useCallback((group: ComponentGroup, count: number) => {
    if (!group.layoutData) return;
    
    // Find next available position
    const maxGridY = tiles.length > 0 ? Math.max(...tiles.map(t => t.gridY + (t.component.height || 1))) : 0;
    
    for (let i = 0; i < count; i++) {
      const offsetY = maxGridY + (i * 5);
      const newTileIds: string[] = [];
      const newTiles: PlacedTile[] = [];
      
      // Create tiles from layout data
      for (const tileData of group.layoutData.tiles) {
        const component = components.find(c => c.id === tileData.componentId);
        if (!component) continue;
        
        const newTile: PlacedTile = {
          id: generateNewId(),
          component,
          gridX: tileData.relativeX,
          gridY: offsetY + tileData.relativeY
        };
        newTiles.push(newTile);
        newTileIds.push(newTile.id);
      }
      
      // Create connections using the new tile IDs
      const newConnections: CellConnection[] = [];
      for (const connData of group.layoutData.connections) {
        if (connData.fromTileIndex < newTileIds.length && connData.toTileIndex < newTileIds.length) {
          newConnections.push({
            id: generateNewId(),
            fromTileId: newTileIds[connData.fromTileIndex],
            fromCellX: connData.fromCellX,
            fromCellY: connData.fromCellY,
            fromSide: connData.fromSide,
            toTileId: newTileIds[connData.toTileIndex],
            toCellX: connData.toCellX,
            toCellY: connData.toCellY,
            toSide: connData.toSide,
            color: connData.color
          });
        }
      }
      
      setTiles(prev => [...prev, ...newTiles]);
      setConnections(prev => [...prev, ...newConnections]);
    }
  }, [tiles, components, generateNewId]);

  // Insert multiple groups from complementary set
  const handleInsertMultipleGroups = useCallback((groupsWithCounts: Array<{ group: ComponentGroup; count: number }>) => {
    for (const { group, count } of groupsWithCounts) {
      handleInsertGroupFromSelector(group, count);
    }
  }, [handleInsertGroupFromSelector]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      switch (e.key.toLowerCase()) {
        case 'v': setActiveTool('select'); break;
        case 'c': setActiveTool('connect'); break;
        case 'x': setActiveTool('disconnect'); break;
        case '+': case '=': handleZoomIn(); break;
        case '-': handleZoomOut(); break;
        case '0': handleResetView(); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleZoomIn, handleZoomOut, handleResetView]);

  if (componentsLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-muted-foreground">Komponenten werden geladen...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background no-select">
      <header className="toolbar-panel h-14 border-b flex items-center px-4 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <svg className="w-5 h-5 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
          </div>
          <div>
            <h1 className="font-semibold text-sm">Schema-Editor</h1>
            <p className="text-xs text-muted-foreground">{companyName || 'Anlagen-Diagramm Zeichner'}</p>
          </div>
        </div>
        <div className="h-8 w-px bg-border mx-2" />
        <PaperSettings
          paperFormat={canvasState.paperFormat}
          orientation={canvasState.orientation}
          gridSize={canvasState.gridSize}
          titleBlockData={titleBlockData}
          onPaperFormatChange={handlePaperFormatChange}
          onOrientationChange={handleOrientationChange}
          onGridSizeChange={handleGridSizeChange}
          onTitleBlockToggle={(enabled) => setTitleBlockData(prev => ({ ...prev, enabled }))}
          onEditTitleBlock={() => setIsTitleBlockEditorOpen(true)}
        />
        <div className="flex-1" />
        <div className="h-8 w-px bg-border mx-2" />
        <Button
          variant="default"
          size="sm"
          className="h-8 gap-1"
          onClick={() => setShowComponentSelector(true)}
        >
          <Package className="w-4 h-4" />
          Komponenten wählen
        </Button>
        <div className="h-8 w-px bg-border mx-2" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <Menu className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">Kontoinformationen</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="flex items-center gap-2 cursor-default focus:bg-transparent">
              <User className="w-4 h-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">E-Mail</span>
                <span className="text-sm">{user?.email}</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex items-center gap-2 cursor-default focus:bg-transparent">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Firma</span>
                <span className="text-sm">{companyName || '–'}</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive cursor-pointer">
              <LogOut className="w-4 h-4 mr-2" />
              Abmelden
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Toolbar
          activeTool={activeTool}
          onToolChange={setActiveTool}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetView={handleResetView}
          onDelete={handleDelete}
          onExport={handleExport}
          onOpenBOM={() => setIsBOMOpen(true)}
          hasSelection={selectedTileIds.size > 0}
          connectionColor={connectionColor}
          onConnectionColorChange={setConnectionColor}
          isGroupMode={isGroupMode}
          onToggleGroupMode={() => {
            setIsGroupMode(!isGroupMode);
          }}
          selectedTileCount={selectedTileIds.size}
          onSaveGroup={(name) => {
            handleCreateGroupFromTiles(name);
            setIsGroupMode(false);
          }}
          onCancelGroupMode={() => {
            setIsGroupMode(false);
          }}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={historyIndexRef.current > 0}
          canRedo={historyIndexRef.current < historyRef.current.length - 1}
        />

        <div className="flex-1 overflow-hidden schematic-canvas">
          <Canvas
            tiles={tiles}
            selectedTileIds={selectedTileIds}
            activeTool={activeTool}
            canvasState={canvasState}
            connections={connections}
            connectionColor={connectionColor}
            draggingComponent={draggingComponent}
            isGroupMode={isGroupMode}
            components={components}
            titleBlockData={titleBlockData}
            onTilesChange={setTiles}
            onSelectionChange={setSelectedTileIds}
            onCanvasStateChange={setCanvasState}
            onDropComponent={handleDropComponent}
            onDropGroup={handleDropGroup}
            onConnectionsChange={setConnections}
            onDragEnd={handleDragEnd}
          />
        </div>

        <ComponentLibrary
          components={components}
          groups={groups}
          onCreateNew={() => { setEditingComponent(null); setIsEditorOpen(true); }}
          onDeleteComponent={handleDeleteComponent}
          onClearAll={handleClearAllComponents}
          onDragStart={handleDragStart}
          onEditComponent={handleEditComponent}
          onUpdateComponent={handleUpdateComponent}
          onImportFromLocalStorage={importFromLocalStorage}
          hasLocalStorageComponents={hasLocalStorageComponents}
          onDeleteGroup={handleDeleteGroup}
          onEditGroup={handleEditGroup}
          activeTab={libraryTab}
          onTabChange={setLibraryTab}
          projectQuantities={projectQuantities}
          placedTiles={tiles}
        />
      </div>

      <StatusBar canvasState={canvasState} shapeCount={tiles.length} selectedCount={selectedTileIds.size} />

      <ComponentEditorDialog
        open={isEditorOpen}
        onClose={() => { setIsEditorOpen(false); setEditingComponent(null); }}
        onSave={handleSaveComponent}
        onUpdate={handleUpdateComponentShapes}
        tileSize={canvasState.gridSize}
        editingComponent={editingComponent}
        existingCategories={[...new Set(components.map(c => c.category).filter(Boolean) as string[])]}
      />

      <ComponentSelectorDialog
        open={showComponentSelector}
        onOpenChange={setShowComponentSelector}
        components={components}
        groups={groups}
        onInsertGroup={handleInsertGroupFromSelector}
        onInsertMultipleGroups={handleInsertMultipleGroups}
        projectQuantities={projectQuantities}
        onProjectQuantitiesChange={setProjectQuantities}
        projectDescriptions={projectDescriptions}
        onProjectDescriptionsChange={setProjectDescriptions}
        projectKategorien={projectKategorien}
        onProjectKategorienChange={setProjectKategorien}
        projectPreise={projectPreise}
        onProjectPreiseChange={setProjectPreise}
      />

      <TitleBlockEditor
        open={isTitleBlockEditorOpen}
        data={titleBlockData}
        onClose={() => setIsTitleBlockEditorOpen(false)}
        onSave={setTitleBlockData}
      />

      <BillOfMaterials
        open={isBOMOpen}
        onClose={() => setIsBOMOpen(false)}
        tiles={tiles}
        titleBlockData={titleBlockData}
        paperFormat={canvasState.paperFormat}
        orientation={canvasState.orientation}
        projectDescriptions={projectDescriptions}
        projectKategorien={projectKategorien}
        projectPreise={projectPreise}
      />
    </div>
  );
}
