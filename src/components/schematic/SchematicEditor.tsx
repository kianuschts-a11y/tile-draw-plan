import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Shape, CanvasState, Component, PaperFormat, Orientation, TileSize, TILE_SIZES, CellConnection, ComponentGroup, ComponentQuantity, GroupMatch, GroupLayoutData, GroupTileData, GroupConnectionData, PAPER_SIZES, MM_TO_PX, TitleBlockData } from "@/types/schematic";
import { Toolbar, MainToolType } from "./Toolbar";
import { Canvas, PlacedTile, AutoConnectionLine } from "./Canvas";
import { ComponentLibrary } from "./ComponentLibrary";
import { StatusBar } from "./StatusBar";
import { PaperSettings } from "./PaperSettings";
import { ComponentEditorDialog } from "./ComponentEditorDialog";
import { ComponentSelectorDialog } from "./ComponentSelectorDialog";
import { TitleBlockEditor } from "./TitleBlockEditor";
import { HeaderActions } from "./HeaderActions";
import { BillOfMaterials } from "./BillOfMaterials";
import { ExportGroupDialog } from "./ExportGroupDialog";
import { useAuth } from "@/hooks/useAuth";
import { useComponents } from "@/hooks/useComponents";
import { useComponentGroups } from "@/hooks/useComponentGroups";
import { useSavedPlans, SavedPlanData, DrawingData } from "@/hooks/useSavedPlans";
import { useProjects } from "@/hooks/useProjects";
import { Button } from "@/components/ui/button";
import { LogOut, Menu, User, Building2, Package } from "lucide-react";
import { isConnectionBlock, CONNECTION_BLOCKS } from "@/lib/connectionBlocks";

// Helper to find component by ID, checking both custom components and connection blocks
function findComponentById(componentId: string, components: Component[]): Component | undefined {
  // First check custom components
  const found = components.find(c => c.id === componentId);
  if (found) return found;
  
  // Then check connection blocks
  return CONNECTION_BLOCKS.find(c => c.id === componentId);
}

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
  const [projectOriginalQuantities, setProjectOriginalQuantities] = useState<Map<string, number>>(new Map());
  const [projectDescriptions, setProjectDescriptions] = useState<Map<string, string[]>>(new Map());
  const [projectKategorien, setProjectKategorien] = useState<Map<string, string>>(new Map());
  const [projectPreise, setProjectPreise] = useState<Map<string, number>>(new Map());
  const [projectMarken, setProjectMarken] = useState<Map<string, string>>(new Map());
  const [projectModelle, setProjectModelle] = useState<Map<string, string>>(new Map());
  const [projectCustomFields, setProjectCustomFields] = useState<Map<string, Record<string, string | number>>>(new Map());
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
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  // Auto-generated labels for tiles (tileId -> { label, color })
  const [tileLabels, setTileLabels] = useState<Map<string, { label: string; color: string }>>(new Map());
  const [canvasState, setCanvasState] = useState<CanvasState>({
    zoom: 0.8,
    panX: 50,
    panY: 50,
    gridSize: 40,
    paperFormat: 'A4',
    orientation: 'landscape'
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
      // Also remove deleted tiles from excessTileIds
      setExcessTileIds(prev => {
        const next = new Set(prev);
        selectedTileIds.forEach(id => next.delete(id));
        return next;
      });
      setSelectedTileIds(new Set());
    }
  }, [selectedTileIds]);

  // Rotate selected tiles 90 degrees clockwise
  // The component is rotated visually using SVG transform, shapes stay unchanged
  // Connection blocks are NOT rotated - they maintain their absolute orientation
  const handleRotate = useCallback(() => {
    if (selectedTileIds.size === 0) return;
    
    // For each selected tile, increment rotation by 90 degrees
    setTiles(prev => prev.map(tile => {
      if (!selectedTileIds.has(tile.id)) return tile;
      
      // Check if this is a connection block - don't rotate these
      const isConnBlock = isConnectionBlock(tile.component);
      if (isConnBlock) {
        // Connection blocks maintain their absolute orientation
        return tile;
      }
      
      // Simply increment the rotation angle by 90 degrees
      const currentRotation = tile.rotation || 0;
      const newRotation = (currentRotation + 90) % 360;
      
      return {
        ...tile,
        rotation: newRotation
      };
    }));
    
    // Connections stay exactly as they are - the rotation is purely visual
    // The connection points remain at their absolute grid positions
  }, [selectedTileIds]);

  // Keyboard-Shortcuts für Undo/Redo und Rotation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in input fields
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }
      
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
      } else if (e.key === 'r' || e.key === 'R') {
        // R key to rotate selected tiles
        if (selectedTileIds.size > 0 && !isGroupMode) {
          e.preventDefault();
          handleRotate();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, handleRotate, selectedTileIds.size, isGroupMode]);

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
      const component = findComponentById(tileData.componentId, components);
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

  const handleSaveComponent = useCallback(async (name: string, shapes: Shape[], tileSize: TileSize, category?: string, labelingEnabled?: boolean, labelingPriority?: number, labelingColor?: string, autoConnectionsEnabled?: boolean) => {
    await saveComponent(name, shapes, tileSize, category, labelingEnabled, labelingPriority, labelingColor, autoConnectionsEnabled);
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

  const handleUpdateComponentShapes = useCallback(async (id: string, name: string, shapes: Shape[], tileSize: TileSize, category?: string, labelingEnabled?: boolean, labelingPriority?: number, labelingColor?: string, autoConnectionsEnabled?: boolean) => {
    await updateComponent(id, name, shapes, tileSize, category, labelingEnabled, labelingPriority, labelingColor, autoConnectionsEnabled);
  }, [updateComponent]);

  const handleUpdateComponent = useCallback(async (updatedComponent: Component) => {
    await updateComponentFull(updatedComponent);
  }, [updateComponentFull]);

  // Auto-Label: Generate labels for all tiles with labelingEnabled components
  const handleAutoLabel = useCallback(() => {
    // Find all tiles that have labeling enabled, grouped by priority
    const tilesToLabel: { tile: PlacedTile; priority: number; color: string }[] = [];
    
    for (const tile of tiles) {
      // Skip connection blocks
      if (isConnectionBlock(tile.component)) continue;
      
      // Find the component definition to check labelingEnabled
      const componentDef = components.find(c => c.id === tile.component.id);
      if (componentDef?.labelingEnabled) {
        tilesToLabel.push({
          tile,
          priority: componentDef.labelingPriority || 1,
          color: componentDef.labelingColor || '#000000'
        });
      }
    }
    
    if (tilesToLabel.length === 0) return;
    
    // Sort by priority, then by position (top-to-bottom, left-to-right)
    tilesToLabel.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      if (a.tile.gridY !== b.tile.gridY) return a.tile.gridY - b.tile.gridY;
      return a.tile.gridX - b.tile.gridX;
    });
    
    // Generate labels: priority.index format (1.1, 1.2, 2.1, 2.2, ...)
    const newLabels = new Map<string, { label: string; color: string }>();
    let currentPriority = -1;
    let indexInPriority = 0;
    
    for (const { tile, priority, color } of tilesToLabel) {
      if (priority !== currentPriority) {
        currentPriority = priority;
        indexInPriority = 1;
      } else {
        indexInPriority++;
      }
      newLabels.set(tile.id, { label: `${priority}.${indexInPriority}`, color });
    }
    
    setTileLabels(newLabels);
  }, [tiles, components]);

  // Check if there are any tiles with labelable components
  const hasLabelableComponents = useMemo(() => {
    for (const tile of tiles) {
      if (isConnectionBlock(tile.component)) continue;
      const componentDef = components.find(c => c.id === tile.component.id);
      if (componentDef?.labelingEnabled) return true;
    }
    return false;
  }, [tiles, components]);

  // Auto-Verbindungslinien: Berechne gestrichelte Linien von Komponenten mit autoConnectionsEnabled
  // zu allen Komponenten mit labelingEnabled
  const autoConnectionLines = useMemo(() => {
    const lines: { fromTileId: string; toTileId: string; fromX: number; fromY: number; midX: number; midY: number; toX: number; toY: number }[] = [];
    
    // Finde alle Tiles mit autoConnectionsEnabled
    const autoConnectTiles: PlacedTile[] = [];
    // Finde alle Tiles mit labelingEnabled
    const labeledTiles: PlacedTile[] = [];
    
    for (const tile of tiles) {
      if (isConnectionBlock(tile.component)) continue;
      const componentDef = components.find(c => c.id === tile.component.id);
      if (componentDef?.autoConnectionsEnabled) {
        autoConnectTiles.push(tile);
      }
      if (componentDef?.labelingEnabled) {
        labeledTiles.push(tile);
      }
    }
    
    // Hilfsfunktion: Berechne die tatsächlichen Körperkanten aus den Shapes einer Komponente
    const getShapeBounds = (shapes: Shape[], tileWidth: number, tileHeight: number) => {
      // Filtere nur sichtbare Shapes (keine Linien, Pfeile, Texte)
      const boundaryShapes = shapes.filter(s => 
        s.type !== 'text' && s.type !== 'line' && s.type !== 'arrow' && s.type !== 'polyline'
      );
      
      if (boundaryShapes.length === 0) {
        return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
      }
      
      let minX = 1, maxX = 0, minY = 1, maxY = 0;
      for (const shape of boundaryShapes) {
        minX = Math.min(minX, shape.x);
        maxX = Math.max(maxX, shape.x + shape.width);
        minY = Math.min(minY, shape.y);
        maxY = Math.max(maxY, shape.y + shape.height);
      }
      
      // Konvertiere normalisierte Koordinaten (0-1) zu Grid-Einheiten
      return {
        minX: minX * tileWidth,
        maxX: maxX * tileWidth,
        minY: minY * tileHeight,
        maxY: maxY * tileHeight
      };
    };
    
    // Für jede Auto-Connect-Komponente, erstelle orthogonale Linien zu allen beschrifteten Komponenten
    for (const autoTile of autoConnectTiles) {
      const autoWidth = autoTile.component.width || 1;
      const autoHeight = autoTile.component.height || 1;
      const autoShapes = (autoTile.component.shapes || []) as Shape[];
      
      // Berechne tatsächliche Körperkanten der Quellkomponente
      const autoBounds = getShapeBounds(autoShapes, autoWidth, autoHeight);
      
      // Tatsächliches Zentrum basierend auf Shapes
      const autoCenterX = autoTile.gridX + (autoBounds.minX + autoBounds.maxX) / 2;
      const autoCenterY = autoTile.gridY + (autoBounds.minY + autoBounds.maxY) / 2;
      
      // Filtere Zielkomponenten (nicht sich selbst)
      const targets = labeledTiles.filter(lt => lt.id !== autoTile.id);
      const connectionCount = targets.length;
      
      if (connectionCount === 0) continue;
      
      // Offset-Faktor für Linien-Versatz an der Quellkomponente
      const offsetStep = 0.15; // Grid-Einheiten Versatz pro Linie
      
      targets.forEach((labeledTile, connectionIndex) => {
        const labelWidth = labeledTile.component.width || 1;
        const labelHeight = labeledTile.component.height || 1;
        const labelShapes = (labeledTile.component.shapes || []) as Shape[];
        
        // Berechne tatsächliche Körperkanten der Zielkomponente
        const labelBounds = getShapeBounds(labelShapes, labelWidth, labelHeight);
        
        // Tatsächliches Zentrum der Zielkomponente
        const targetCenterX = labeledTile.gridX + (labelBounds.minX + labelBounds.maxX) / 2;
        const targetCenterY = labeledTile.gridY + (labelBounds.minY + labelBounds.maxY) / 2;
        
        // Berechne die Richtung zur Zielkomponente
        const dx = targetCenterX - autoCenterX;
        const dy = targetCenterY - autoCenterY;
        
        // Berechne Versatz für Startpunkt: verteile Linien um das Zentrum
        const centerOffset = (connectionIndex - (connectionCount - 1) / 2) * offsetStep;
        
        // Bestimme Startpunkt am tatsächlichen Rand der Quellkomponente
        let fromX: number, fromY: number;
        
        if (Math.abs(dx) >= Math.abs(dy)) {
          // Horizontal dominant: Start an linker/rechter Körperkante
          fromX = dx > 0 
            ? autoTile.gridX + autoBounds.maxX  // rechte Kante
            : autoTile.gridX + autoBounds.minX; // linke Kante
          fromY = autoCenterY + centerOffset;
        } else {
          // Vertikal dominant: Start an oberer/unterer Körperkante
          fromX = autoCenterX + centerOffset;
          fromY = dy > 0 
            ? autoTile.gridY + autoBounds.maxY  // untere Kante
            : autoTile.gridY + autoBounds.minY; // obere Kante
        }
        
        // Endpunkt an der tatsächlichen Körperkante der Zielkomponente
        let toX: number, toY: number;
        
        // Kleiner Offset um Überlappungen mit Komponenten-Verbindungslinien zu vermeiden
        const endpointOffset = 0.15; // Grid-Einheiten
        
        // Endpunkt immer an oberer oder unterer Körperkante (weil letzte Strecke vertikal ist)
        // Mit horizontalem Offset je nach Richtung, um Überlappung mit Komponenten-Linien zu vermeiden
        if (dx > 0) {
          // Von links kommend: Offset nach links vom Mittelpunkt
          toX = targetCenterX - endpointOffset;
        } else if (dx < 0) {
          // Von rechts kommend: Offset nach rechts vom Mittelpunkt
          toX = targetCenterX + endpointOffset;
        } else {
          // Exakt vertikal: kleiner Offset nach links
          toX = targetCenterX - endpointOffset;
        }
        
        toY = dy > 0 
          ? labeledTile.gridY + labelBounds.minY  // obere Kante
          : labeledTile.gridY + labelBounds.maxY; // untere Kante
        
        // Orthogonale Linienführung: erst horizontal (X), dann vertikal (Y)
        const midX = toX;
        const midY = fromY;
        
        lines.push({
          fromTileId: autoTile.id,
          toTileId: labeledTile.id,
          fromX,
          fromY,
          midX,
          midY,
          toX,
          toY
        });
      });
    }
    
    return lines;
  }, [tiles, components]);

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
    
    // Calculate bounding box of selected tiles
    let minBoundX = Infinity, maxBoundX = -Infinity;
    let minBoundY = Infinity, maxBoundY = -Infinity;
    
    for (const tile of selectedTiles) {
      const tileWidth = tile.component.width || 1;
      const tileHeight = tile.component.height || 1;
      minBoundX = Math.min(minBoundX, tile.gridX);
      maxBoundX = Math.max(maxBoundX, tile.gridX + tileWidth - 1);
      minBoundY = Math.min(minBoundY, tile.gridY);
      maxBoundY = Math.max(maxBoundY, tile.gridY + tileHeight - 1);
    }
    
    // Start with all selected tiles
    const allRelevantTileIds = new Set(selectedTileIds);
    
    // Add all connection blocks that fall within the bounding box of selected tiles
    // This ensures "free" connection blocks in the selection area are included
    for (const tile of tiles) {
      if (allRelevantTileIds.has(tile.id)) continue;
      
      if (isConnectionBlock(tile.component)) {
        const tileWidth = tile.component.width || 1;
        const tileHeight = tile.component.height || 1;
        
        // Check if connection block is within or overlaps the bounding box
        const tileMinX = tile.gridX;
        const tileMaxX = tile.gridX + tileWidth - 1;
        const tileMinY = tile.gridY;
        const tileMaxY = tile.gridY + tileHeight - 1;
        
        const overlapsX = tileMinX <= maxBoundX && tileMaxX >= minBoundX;
        const overlapsY = tileMinY <= maxBoundY && tileMaxY >= minBoundY;
        
        if (overlapsX && overlapsY) {
          allRelevantTileIds.add(tile.id);
        }
      }
    }
    
    // Also include connection blocks that are connected in a chain from selected tiles
    // This handles cases where connections extend beyond the bounding box but are still part of the group
    let changed = true;
    while (changed) {
      changed = false;
      for (const conn of connections) {
        const fromIncluded = allRelevantTileIds.has(conn.fromTileId);
        const toIncluded = allRelevantTileIds.has(conn.toTileId);
        
        // If one end is included and the other is a connection block connected to another included tile
        if (fromIncluded && !toIncluded) {
          const toTile = tiles.find(t => t.id === conn.toTileId);
          if (toTile && isConnectionBlock(toTile.component)) {
            // Check if this connection block connects to any already included tile
            const connectedToIncluded = connections.some(c2 => 
              c2 !== conn && (
                (c2.fromTileId === conn.toTileId && allRelevantTileIds.has(c2.toTileId)) ||
                (c2.toTileId === conn.toTileId && allRelevantTileIds.has(c2.fromTileId))
              )
            );
            if (connectedToIncluded) {
              allRelevantTileIds.add(conn.toTileId);
              changed = true;
            }
          }
        } else if (!fromIncluded && toIncluded) {
          const fromTile = tiles.find(t => t.id === conn.fromTileId);
          if (fromTile && isConnectionBlock(fromTile.component)) {
            const connectedToIncluded = connections.some(c2 => 
              c2 !== conn && (
                (c2.fromTileId === conn.fromTileId && allRelevantTileIds.has(c2.toTileId)) ||
                (c2.toTileId === conn.fromTileId && allRelevantTileIds.has(c2.fromTileId))
              )
            );
            if (connectedToIncluded) {
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

  // Create group from ALL non-connection tiles on canvas (for export dialog)
  const handleCreateGroupFromAllTiles = useCallback(async (name: string) => {
    const nonConnectionTiles = tiles.filter(t => !isConnectionBlock(t.component));
    if (nonConnectionTiles.length < 2) return;
    
    // Include all tiles (non-connection + connection blocks within bounding box)
    const allTileIds = new Set(tiles.map(t => t.id));
    const allTilesForGroup = tiles;
    
    const minX = Math.min(...allTilesForGroup.map(t => t.gridX));
    const minY = Math.min(...allTilesForGroup.map(t => t.gridY));
    
    const tileData: GroupTileData[] = allTilesForGroup.map(tile => ({
      componentId: tile.component.id,
      relativeX: tile.gridX - minX,
      relativeY: tile.gridY - minY
    }));
    
    const componentIds = [...new Set(allTilesForGroup.map(t => t.component.id))];
    
    const relevantConnections = connections.filter(c => 
      allTileIds.has(c.fromTileId) && allTileIds.has(c.toTileId)
    );
    
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
  }, [tiles, connections, createGroup]);

  // Handle export button click - show dialog first
  const handleExportClick = useCallback(() => {
    const nonConnectionTiles = tiles.filter(t => !isConnectionBlock(t.component));
    if (nonConnectionTiles.length >= 2) {
      setIsExportDialogOpen(true);
    } else {
      // Not enough tiles for a group, just export directly
      handleExport();
    }
  }, [tiles, handleExport]);

  // Handle save group + export from dialog
  const handleSaveGroupAndExport = useCallback(async (groupName: string) => {
    await handleCreateGroupFromAllTiles(groupName);
    setIsExportDialogOpen(false);
    handleExport();
  }, [handleCreateGroupFromAllTiles, handleExport]);

  // Handle export only from dialog
  const handleExportOnly = useCallback(() => {
    setIsExportDialogOpen(false);
    handleExport();
  }, [handleExport]);

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

  const handleRenameGroup = useCallback(async (id: string, newName: string): Promise<boolean> => {
    const group = groups.find(g => g.id === id);
    if (!group) return false;
    return await updateGroup(id, newName, group.componentIds);
  }, [groups, updateGroup]);

  // Helper to generate unique ID
  const generateNewId = useCallback(() => {
    return Math.random().toString(36).substring(2, 11);
  }, []);

  // Track excess tile IDs (tiles from groups that exceed project requirements)
  const [excessTileIds, setExcessTileIds] = useState<Set<string>>(new Set());

  // Insert a group from the component selector
  const handleInsertGroupFromSelector = useCallback((group: ComponentGroup, count: number, isPartialMatch: boolean = false, currentQuantities?: Map<string, number>) => {
    if (!group.layoutData) return;
    
    // Use provided quantities (from dialog) or fall back to projectQuantities
    const effectiveQuantities = currentQuantities || projectQuantities;
    
    // Find next available position
    const maxGridY = tiles.length > 0 ? Math.max(...tiles.map(t => t.gridY + (t.component.height || 1))) : 0;
    
    // For partial matches, we need to track which tiles should be marked as "excess"
    const newExcessTileIds: string[] = [];
    
    // Calculate how many of each component are ALREADY placed on the canvas
    const alreadyPlacedCounts = new Map<string, number>();
    for (const tile of tiles) {
      if (!tile.component.id.startsWith('connection-')) {
        alreadyPlacedCounts.set(tile.component.id, (alreadyPlacedCounts.get(tile.component.id) || 0) + 1);
      }
    }
    
    for (let i = 0; i < count; i++) {
      const offsetY = maxGridY + (i * 5);
      const newTileIds: string[] = [];
      const newTiles: PlacedTile[] = [];
      
      // Track how many of each component we're placing in this group iteration
      const placingCounts = new Map<string, number>();
      
      // Create tiles from layout data
      for (const tileData of group.layoutData.tiles) {
        const component = findComponentById(tileData.componentId, components);
        if (!component) continue;
        
        const newTileId = generateNewId();
        const newTile: PlacedTile = {
          id: newTileId,
          component,
          gridX: tileData.relativeX,
          gridY: offsetY + tileData.relativeY
        };
        newTiles.push(newTile);
        newTileIds.push(newTileId);
        
        // Check if this tile should be marked as excess (only for partial matches)
        if (isPartialMatch && !tileData.componentId.startsWith('connection-')) {
          const alreadyPlaced = alreadyPlacedCounts.get(tileData.componentId) || 0;
          const placingNow = placingCounts.get(tileData.componentId) || 0;
          const totalPlaced = alreadyPlaced + placingNow;
          const available = effectiveQuantities.get(tileData.componentId) || 0;
          
          // Only mark as excess if total placed (including this one) exceeds available
          if (totalPlaced >= available) {
            newExcessTileIds.push(newTileId);
          }
          placingCounts.set(tileData.componentId, placingNow + 1);
        }
      }
      
      // Update already placed counts for next iteration
      for (const [compId, cnt] of placingCounts.entries()) {
        alreadyPlacedCounts.set(compId, (alreadyPlacedCounts.get(compId) || 0) + cnt);
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
    
    // Update excess tile IDs
    if (newExcessTileIds.length > 0) {
      setExcessTileIds(prev => new Set([...prev, ...newExcessTileIds]));
    }
  }, [tiles, components, generateNewId]);

  // Insert multiple groups from complementary set - positions them next to each other
  const handleInsertMultipleGroups = useCallback((groupsWithCounts: Array<{ group: ComponentGroup; count: number }>) => {
    if (groupsWithCounts.length === 0) return;
    
    // Calculate the bounding box of each group
    const groupBounds: Array<{ group: ComponentGroup; count: number; width: number; height: number }> = [];
    
    for (const { group, count } of groupsWithCounts) {
      if (!group.layoutData?.tiles) continue;
      
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const tile of group.layoutData.tiles) {
        const component = findComponentById(tile.componentId, components);
        const tileWidth = component?.width || 1;
        const tileHeight = component?.height || 1;
        minX = Math.min(minX, tile.relativeX);
        maxX = Math.max(maxX, tile.relativeX + tileWidth);
        minY = Math.min(minY, tile.relativeY);
        maxY = Math.max(maxY, tile.relativeY + tileHeight);
      }
      
      const width = maxX === -Infinity ? 1 : maxX - minX;
      const height = maxY === -Infinity ? 1 : maxY - minY;
      
      groupBounds.push({ group, count, width, height });
    }
    
    if (groupBounds.length === 0) return;
    
    // Find starting position - center of canvas or below existing tiles
    const maxExistingY = tiles.length > 0 
      ? Math.max(...tiles.map(t => t.gridY + (t.component.height || 1))) + 2
      : 2;
    
    // Calculate total width needed for all groups with spacing
    const spacing = 2; // Grid cells between groups
    const totalWidth = groupBounds.reduce((sum, g) => sum + g.width, 0) + (groupBounds.length - 1) * spacing;
    
    // Start position - try to center horizontally
    let startX = Math.max(0, Math.floor((20 - totalWidth) / 2)); // Assume ~20 grid cells visible width
    
    // Position groups based on count
    let currentX = startX;
    const allNewTiles: PlacedTile[] = [];
    const allNewConnections: CellConnection[] = [];
    
    // For positioning: 2 groups = left/right, 3+ = grid pattern
    if (groupBounds.length === 2) {
      // Side by side
      for (const { group, count, width } of groupBounds) {
        if (!group.layoutData) continue;
        
        for (let i = 0; i < count; i++) {
          const offsetY = i * (groupBounds[0].height + spacing);
          const newTileIds: string[] = [];
          const newTiles: PlacedTile[] = [];
          
          for (const tileData of group.layoutData.tiles) {
            const component = findComponentById(tileData.componentId, components);
            if (!component) continue;
            
            const newTile: PlacedTile = {
              id: generateNewId(),
              component,
              gridX: currentX + tileData.relativeX,
              gridY: maxExistingY + offsetY + tileData.relativeY
            };
            newTiles.push(newTile);
            newTileIds.push(newTile.id);
          }
          
          // Create connections
          for (const connData of group.layoutData.connections) {
            if (connData.fromTileIndex < newTileIds.length && connData.toTileIndex < newTileIds.length) {
              allNewConnections.push({
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
          
          allNewTiles.push(...newTiles);
        }
        
        currentX += width + spacing;
      }
    } else {
      // Grid pattern for 3+ groups: distribute in a 2-column layout
      let row = 0;
      let col = 0;
      const colWidth = Math.max(...groupBounds.map(g => g.width)) + spacing;
      const rowHeight = Math.max(...groupBounds.map(g => g.height)) + spacing;
      
      for (const { group, count } of groupBounds) {
        if (!group.layoutData) continue;
        
        const posX = startX + col * colWidth;
        const posY = maxExistingY + row * rowHeight;
        
        for (let i = 0; i < count; i++) {
          const newTileIds: string[] = [];
          const newTiles: PlacedTile[] = [];
          
          for (const tileData of group.layoutData.tiles) {
            const component = findComponentById(tileData.componentId, components);
            if (!component) continue;
            
            const newTile: PlacedTile = {
              id: generateNewId(),
              component,
              gridX: posX + tileData.relativeX,
              gridY: posY + tileData.relativeY + i * rowHeight
            };
            newTiles.push(newTile);
            newTileIds.push(newTile.id);
          }
          
          // Create connections
          for (const connData of group.layoutData.connections) {
            if (connData.fromTileIndex < newTileIds.length && connData.toTileIndex < newTileIds.length) {
              allNewConnections.push({
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
          
          allNewTiles.push(...newTiles);
        }
        
        // Move to next position
        col++;
        if (col >= 2) {
          col = 0;
          row++;
        }
      }
    }
    
    // Add all tiles and connections at once
    if (allNewTiles.length > 0) {
      setTiles(prev => [...prev, ...allNewTiles]);
      setConnections(prev => [...prev, ...allNewConnections]);
    }
  }, [tiles, components, generateNewId]);

  // Handle arrow direction toggle on connection
  const handleConnectionArrowToggle = useCallback((connectionId: string) => {
    setConnections(prev => prev.map(conn => {
      if (conn.id !== connectionId) return conn;
      
      // Cycle through: none -> forward -> backward -> none
      const currentDirection = conn.arrowDirection || 'none';
      let newDirection: 'none' | 'forward' | 'backward';
      
      if (currentDirection === 'none') {
        newDirection = 'forward';
      } else if (currentDirection === 'forward') {
        newDirection = 'backward';
      } else {
        newDirection = 'none';
      }
      
      return { ...conn, arrowDirection: newDirection };
    }));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      switch (e.key.toLowerCase()) {
        case 'v': setActiveTool('select'); break;
        case 'c': setActiveTool('connect'); break;
        case 'x': setActiveTool('disconnect'); break;
        case 'a': setActiveTool('arrow'); break;
        case '+': case '=': handleZoomIn(); break;
        case '-': handleZoomOut(); break;
        case '0': handleResetView(); break;
        case 'e': handleExportClick(); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleZoomIn, handleZoomOut, handleResetView, handleExportClick]);

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
        <HeaderActions
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetView={handleResetView}
          onExport={handleExportClick}
          onOpenBOM={() => setIsBOMOpen(true)}
        />
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
          onDelete={handleDelete}
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
          onRotate={handleRotate}
          canRotate={selectedTileIds.size > 0}
          onAutoLabel={handleAutoLabel}
          hasLabelableComponents={hasLabelableComponents}
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
            tileLabels={tileLabels}
            excessTileIds={excessTileIds}
            autoConnectionLines={autoConnectionLines}
            onTilesChange={setTiles}
            onSelectionChange={setSelectedTileIds}
            onCanvasStateChange={setCanvasState}
            onDropComponent={handleDropComponent}
            onDropGroup={handleDropGroup}
            onConnectionsChange={setConnections}
            onDragEnd={handleDragEnd}
            onConnectionArrowToggle={handleConnectionArrowToggle}
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
          onRenameGroup={handleRenameGroup}
          activeTab={libraryTab}
          onTabChange={setLibraryTab}
          projectQuantities={projectQuantities}
          projectOriginalQuantities={projectOriginalQuantities}
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
        projectOriginalQuantities={projectOriginalQuantities}
        onProjectOriginalQuantitiesChange={setProjectOriginalQuantities}
        projectDescriptions={projectDescriptions}
        onProjectDescriptionsChange={setProjectDescriptions}
        projectKategorien={projectKategorien}
        onProjectKategorienChange={setProjectKategorien}
        projectPreise={projectPreise}
        onProjectPreiseChange={setProjectPreise}
        projectMarken={projectMarken}
        onProjectMarkenChange={setProjectMarken}
        projectModelle={projectModelle}
        onProjectModelleChange={setProjectModelle}
        projectCustomFields={projectCustomFields}
        onProjectCustomFieldsChange={setProjectCustomFields}
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
        projectMarken={projectMarken}
        projectModelle={projectModelle}
        projectCustomFields={projectCustomFields}
      />

      <ExportGroupDialog
        open={isExportDialogOpen}
        onClose={() => setIsExportDialogOpen(false)}
        onExportOnly={handleExportOnly}
        onSaveGroupAndExport={handleSaveGroupAndExport}
        hasTiles={tiles.filter(t => !isConnectionBlock(t.component)).length >= 2}
      />
    </div>
  );
}
