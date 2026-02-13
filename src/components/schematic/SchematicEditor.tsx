import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import lavaLogo from "@/assets/lava-logo.svg";
import { PDFDocument, PDFName, PDFArray, PDFString } from "pdf-lib";
import { Shape, CanvasState, Component, PaperFormat, Orientation, TileSize, TILE_SIZES, CellConnection, ComponentGroup, ComponentQuantity, GroupMatch, GroupLayoutData, GroupTileData, GroupConnectionData, PAPER_SIZES, MM_TO_PX, TitleBlockData } from "@/types/schematic";
import { AnnotationLine, AnnotationText, LineStyle } from "@/types/annotations";
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
import { Messkonzept } from "./Messkonzept";
import { ExportGroupDialog } from "./ExportGroupDialog";
import { GroupCategoryDialog } from "./GroupCategoryDialog";
import { CategoryManagerDialog } from "./CategoryManagerDialog";
import { useComponents } from "@/hooks/useComponents";
import { useComponentGroups } from "@/hooks/useComponentGroups";
import { useSavedPlans, SavedPlanData, DrawingData } from "@/hooks/useSavedPlans";
import { useGroupCategories } from "@/hooks/useGroupCategories";
import { useProjects } from "@/hooks/useProjects";
import { Button } from "@/components/ui/button";
import { Menu, Package } from "lucide-react";
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
  annotationLines: AnnotationLine[];
  annotationTexts: AnnotationText[];
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function SchematicEditor() {
  
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

  const { savedPlans, savePlan, deletePlan, findExactMatchingPlan } = useSavedPlans();
  const { findMatchingGroups } = useProjects();
  const { categories, createCategory, updateCategory, deleteCategory } = useGroupCategories();

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
  const [libraryTab, setLibraryTab] = useState<'components' | 'groups' | 'projects'>('components');
  const [isGroupCategoryDialogOpen, setIsGroupCategoryDialogOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterTag, setFilterTag] = useState<string>("");
  const [pendingGroupData, setPendingGroupData] = useState<{ componentIds: string[]; layoutData: GroupLayoutData } | null>(null);
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
  const [isMesskonzeptOpen, setIsMesskonzeptOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  // Auto-generated labels for tiles (tileId -> { label, color })
  const [tileLabels, setTileLabels] = useState<Map<string, { label: string; color: string }>>(new Map());
  
  // Annotations state (separate layer, no interaction with connections/BOM/Messkonzept)
  const [annotationLines, setAnnotationLines] = useState<AnnotationLine[]>([]);
  const [annotationTexts, setAnnotationTexts] = useState<AnnotationText[]>([]);
  const [annotationLineStyle, setAnnotationLineStyle] = useState<LineStyle>('solid');
  const [annotationColor, setAnnotationColor] = useState<string>('#000000');
  const [annotationFontSize, setAnnotationFontSize] = useState<number>(14);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [selectedAnnotationType, setSelectedAnnotationType] = useState<'line' | 'text' | null>(null);

  // Clear annotation selection when tiles are selected
  useEffect(() => {
    if (selectedTileIds.size > 0) {
      setSelectedAnnotationId(null);
      setSelectedAnnotationType(null);
    }
  }, [selectedTileIds]);

  const [canvasState, setCanvasState] = useState<CanvasState>({
    zoom: 0.8,
    panX: 50,
    panY: 50,
    gridSize: 40,
    paperFormat: 'A4',
    orientation: 'landscape'
  });

  // Undo/Redo History - speichert kompletten Zustand
  const historyRef = useRef<HistoryEntry[]>([{ tiles: [], connections: [], annotationLines: [], annotationTexts: [] }]);
  const historyIndexRef = useRef(0);
  const [historyVersion, setHistoryVersion] = useState(0);
  const isUndoRedoRef = useRef(false);
  const saveTimeoutRef = useRef<number | null>(null);

  // Snapshot des aktuellen Zustands speichern (debounced)
  const saveToHistory = useCallback((newTiles: PlacedTile[], newConnections: CellConnection[], newAnnLines: AnnotationLine[], newAnnTexts: AnnotationText[]) => {
    // Wenn gerade Undo/Redo läuft, nicht speichern
    if (isUndoRedoRef.current) {
      return;
    }
    
    const currentEntry = historyRef.current[historyIndexRef.current];
    const tilesChanged = JSON.stringify(currentEntry?.tiles) !== JSON.stringify(newTiles);
    const connectionsChanged = JSON.stringify(currentEntry?.connections) !== JSON.stringify(newConnections);
    const annLinesChanged = JSON.stringify(currentEntry?.annotationLines) !== JSON.stringify(newAnnLines);
    const annTextsChanged = JSON.stringify(currentEntry?.annotationTexts) !== JSON.stringify(newAnnTexts);
    
    if (tilesChanged || connectionsChanged || annLinesChanged || annTextsChanged) {
      // Historie bis zum aktuellen Index abschneiden, neuen Eintrag hinzufügen
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
      historyRef.current.push({ 
        tiles: JSON.parse(JSON.stringify(newTiles)), 
        connections: JSON.parse(JSON.stringify(newConnections)),
        annotationLines: JSON.parse(JSON.stringify(newAnnLines)),
        annotationTexts: JSON.parse(JSON.stringify(newAnnTexts))
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
          setAnnotationLines(currentAnnLines => {
            setAnnotationTexts(currentAnnTexts => {
              saveToHistory(currentTiles, currentConnections, currentAnnLines, currentAnnTexts);
              return currentAnnTexts;
            });
            return currentAnnLines;
          });
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
      setAnnotationLines(JSON.parse(JSON.stringify(prevState.annotationLines || [])));
      setAnnotationTexts(JSON.parse(JSON.stringify(prevState.annotationTexts || [])));
      setSelectedTileIds(new Set());
      setSelectedAnnotationId(null);
      setSelectedAnnotationType(null);
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
      setAnnotationLines(JSON.parse(JSON.stringify(nextState.annotationLines || [])));
      setAnnotationTexts(JSON.parse(JSON.stringify(nextState.annotationTexts || [])));
      setSelectedTileIds(new Set());
      setSelectedAnnotationId(null);
      setSelectedAnnotationType(null);
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
    // Delete selected annotation (line or text)
    if (selectedAnnotationId && selectedAnnotationType) {
      if (selectedAnnotationType === 'line') {
        setAnnotationLines(prev => prev.filter(l => l.id !== selectedAnnotationId));
      } else {
        setAnnotationTexts(prev => prev.filter(t => t.id !== selectedAnnotationId));
      }
      setSelectedAnnotationId(null);
      setSelectedAnnotationType(null);
      scheduleSave();
      return;
    }
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
  }, [selectedTileIds, selectedAnnotationId, selectedAnnotationType]);

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
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedAnnotationId && selectedAnnotationType) {
        e.preventDefault();
        if (selectedAnnotationType === 'line') {
          setAnnotationLines(prev => prev.filter(l => l.id !== selectedAnnotationId));
        } else {
          setAnnotationTexts(prev => prev.filter(t => t.id !== selectedAnnotationId));
        }
        setSelectedAnnotationId(null);
        setSelectedAnnotationType(null);
        scheduleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, handleRotate, selectedTileIds.size, isGroupMode, selectedAnnotationId, selectedAnnotationType]);

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
    // Handle saved plan drops
    if (groupData.isSavedPlan && groupData.planId) {
      const plan = savedPlans.find(p => p.id === groupData.planId);
      if (!plan || !plan.drawingData?.tiles || plan.drawingData.tiles.length === 0) return;
      
      const planTiles = plan.drawingData.tiles;
      const planConnections = plan.drawingData.connections || [];
      
      // Calculate min position for relative placement
      const minX = Math.min(...planTiles.map(t => t.gridX));
      const minY = Math.min(...planTiles.map(t => t.gridY));
      
      const newTileIds: string[] = [];
      const newTiles: PlacedTile[] = [];
      const oldToNewIdMap = new Map<string, string>();
      
      for (const tile of planTiles) {
        const component = tile.component || findComponentById(tile.component?.id || (tile as any).componentId, components);
        if (!component) continue;
        
        const newId = generateId();
        oldToNewIdMap.set(tile.id, newId);
        
        const newTile: PlacedTile = {
          id: newId,
          component,
          gridX: gridX + (tile.gridX - minX),
          gridY: gridY + (tile.gridY - minY),
          rotation: tile.rotation
        };
        newTiles.push(newTile);
        newTileIds.push(newId);
      }
      
      // Remap connections
      const newConnections: CellConnection[] = [];
      for (const conn of planConnections) {
        const newFromId = oldToNewIdMap.get(conn.fromTileId);
        const newToId = oldToNewIdMap.get(conn.toTileId);
        if (newFromId && newToId) {
          newConnections.push({
            ...conn,
            id: generateId(),
            fromTileId: newFromId,
            toTileId: newToId
          });
        }
      }
      
      setTiles(prev => [...prev, ...newTiles]);
      setConnections(prev => [...prev, ...newConnections]);
      setSelectedTileIds(new Set(newTileIds));
      return;
    }
    
    // Handle regular group drops
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
  }, [groups, components, savedPlans]);

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
        if ((shape.type === 'polygon' || shape.type === 'polyline') && shape.points?.length) {
          for (const p of shape.points) {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
          }
        } else {
          minX = Math.min(minX, shape.x);
          maxX = Math.max(maxX, shape.x + shape.width);
          minY = Math.min(minY, shape.y);
          maxY = Math.max(maxY, shape.y + shape.height);
        }
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
        
        // Clamp Startpunkte auf Quellkomponenten-Grenzen
        const autoTop = autoTile.gridY + autoBounds.minY;
        const autoBottom = autoTile.gridY + autoBounds.maxY;
        const autoLeft = autoTile.gridX + autoBounds.minX;
        const autoRight = autoTile.gridX + autoBounds.maxX;
        fromY = Math.max(autoTop, Math.min(autoBottom, fromY));
        fromX = Math.max(autoLeft, Math.min(autoRight, fromX));
        
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
        
        // Clamp Zielpunkte auf Zielkomponenten-Grenzen
        const targetLeft = labeledTile.gridX + labelBounds.minX;
        const targetRight = labeledTile.gridX + labelBounds.maxX;
        toX = Math.max(targetLeft, Math.min(targetRight, toX));
        
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
    
    // Bounds-Map für Post-Spreading-Clamping aufbauen
    const tileBoundsMap = new Map<string, { left: number; right: number; top: number; bottom: number }>();
    for (const tile of tiles) {
      const comp = components.find(c => c.id === tile.component.id);
      if (!comp) continue;
      const w = tile.component.width || 1;
      const h = tile.component.height || 1;
      const shapes = (tile.component.shapes || []) as Shape[];
      const bounds = getShapeBounds(shapes, w, h);
      tileBoundsMap.set(tile.id, {
        left: tile.gridX + bounds.minX,
        right: tile.gridX + bounds.maxX,
        top: tile.gridY + bounds.minY,
        bottom: tile.gridY + bounds.maxY
      });
    }
    
    // Deduplizierung: Linien die zum selben Ziel gehen spreizen
    const linesByTarget = new Map<string, number[]>();
    for (let i = 0; i < lines.length; i++) {
      const key = lines[i].toTileId;
      const existing = linesByTarget.get(key) || [];
      existing.push(i);
      linesByTarget.set(key, existing);
    }
    
    for (const [targetId, indices] of linesByTarget) {
      if (indices.length <= 1) continue;
      const spreadStep = 0.25;
      const totalSpread = (indices.length - 1) * spreadStep;
      const tBounds = tileBoundsMap.get(targetId);
      indices.forEach((lineIdx, i) => {
        const offset = -totalSpread / 2 + i * spreadStep;
        lines[lineIdx].toX += offset;
        // Clamp nach Spreading
        if (tBounds) {
          lines[lineIdx].toX = Math.max(tBounds.left, Math.min(tBounds.right, lines[lineIdx].toX));
        }
        lines[lineIdx].midX = lines[lineIdx].toX;
      });
    }
    
    // Horizontale Segmente auf gleicher Y-Achse spreizen
    const horizontalSegments = new Map<string, number[]>();
    for (let i = 0; i < lines.length; i++) {
      const yKey = String(Math.round(lines[i].fromY * 10) / 10);
      const existing = horizontalSegments.get(yKey) || [];
      existing.push(i);
      horizontalSegments.set(yKey, existing);
    }
    
    for (const [, indices] of horizontalSegments) {
      if (indices.length <= 1) continue;
      const spreadStep = 0.15;
      const totalSpread = (indices.length - 1) * spreadStep;
      indices.forEach((lineIdx, i) => {
        const offset = -totalSpread / 2 + i * spreadStep;
        lines[lineIdx].fromY += offset;
        // Clamp nach Spreading
        const sBounds = tileBoundsMap.get(lines[lineIdx].fromTileId);
        if (sBounds) {
          lines[lineIdx].fromY = Math.max(sBounds.top, Math.min(sBounds.bottom, lines[lineIdx].fromY));
        }
        lines[lineIdx].midY = lines[lineIdx].fromY;
      });
    }
    
    return lines;
  }, [tiles, components]);

  // Annotation handlers
  const handleAnnotationLineCreate = useCallback((lineData: Omit<AnnotationLine, 'id'>) => {
    setAnnotationLines(prev => [...prev, { ...lineData, id: generateId() }]);
    scheduleSave();
  }, [scheduleSave]);

  const handleAnnotationTextCreate = useCallback((textData: Omit<AnnotationText, 'id'>) => {
    setAnnotationTexts(prev => [...prev, { ...textData, id: generateId() }]);
    scheduleSave();
  }, [scheduleSave]);

  const handleAnnotationSelect = useCallback((id: string | null, type?: 'line' | 'text') => {
    setSelectedAnnotationId(id);
    setSelectedAnnotationType(type || null);
    if (id) {
      setSelectedTileIds(new Set()); // Deselect tiles when annotation is selected
    }
  }, []);

  const handleAnnotationLineMove = useCallback((id: string, dx: number, dy: number) => {
    setAnnotationLines(prev => prev.map(line => 
      line.id === id ? { ...line, path: line.path.map(p => ({ gridX: p.gridX + dx, gridY: p.gridY + dy })) } : line
    ));
    scheduleSave();
  }, [scheduleSave]);

  const handleAnnotationTextMove = useCallback((id: string, dx: number, dy: number) => {
    setAnnotationTexts(prev => prev.map(text => 
      text.id === id ? { ...text, gridX: text.gridX + dx, gridY: text.gridY + dy } : text
    ));
    scheduleSave();
  }, [scheduleSave]);

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

  // Prepare group data from selected tiles (opens category dialog)
  const handlePrepareGroupFromTiles = useCallback((name: string) => {
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
    
    const allRelevantTileIds = new Set(selectedTileIds);
    
    for (const tile of tiles) {
      if (allRelevantTileIds.has(tile.id)) continue;
      if (isConnectionBlock(tile.component)) {
        const tileWidth = tile.component.width || 1;
        const tileHeight = tile.component.height || 1;
        const tileMinX = tile.gridX;
        const tileMaxX = tile.gridX + tileWidth - 1;
        const tileMinY = tile.gridY;
        const tileMaxY = tile.gridY + tileHeight - 1;
        if (tileMinX <= maxBoundX && tileMaxX >= minBoundX && tileMinY <= maxBoundY && tileMaxY >= minBoundY) {
          allRelevantTileIds.add(tile.id);
        }
      }
    }
    
    let changed = true;
    while (changed) {
      changed = false;
      for (const conn of connections) {
        const fromIncluded = allRelevantTileIds.has(conn.fromTileId);
        const toIncluded = allRelevantTileIds.has(conn.toTileId);
        if (fromIncluded && !toIncluded) {
          const toTile = tiles.find(t => t.id === conn.toTileId);
          if (toTile && isConnectionBlock(toTile.component)) {
            const connectedToIncluded = connections.some(c2 => 
              c2 !== conn && (
                (c2.fromTileId === conn.toTileId && allRelevantTileIds.has(c2.toTileId)) ||
                (c2.toTileId === conn.toTileId && allRelevantTileIds.has(c2.fromTileId))
              )
            );
            if (connectedToIncluded) { allRelevantTileIds.add(conn.toTileId); changed = true; }
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
            if (connectedToIncluded) { allRelevantTileIds.add(conn.fromTileId); changed = true; }
          }
        }
      }
    }
    
    const allTilesForGroup = tiles.filter(t => allRelevantTileIds.has(t.id));
    if (allTilesForGroup.length < 2) return;
    
    const minX = Math.min(...allTilesForGroup.map(t => t.gridX));
    const minY = Math.min(...allTilesForGroup.map(t => t.gridY));
    
    const tileData: GroupTileData[] = allTilesForGroup.map(tile => ({
      componentId: tile.component.id,
      relativeX: tile.gridX - minX,
      relativeY: tile.gridY - minY
    }));
    
    const componentIds = [...new Set(allTilesForGroup.map(t => t.component.id))];
    
    const relevantConnections = connections.filter(c => 
      allRelevantTileIds.has(c.fromTileId) && allRelevantTileIds.has(c.toTileId)
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
    
    // Store pending data and open category dialog with name pre-filled
    setPendingGroupData({ componentIds, layoutData });
    setPendingGroupName(name);
    setIsGroupCategoryDialogOpen(true);
    setSelectedTileIds(new Set());
  }, [selectedTileIds, tiles, connections]);

  // State for pending group name from toolbar
  const [pendingGroupName, setPendingGroupName] = useState("");

  // Confirm group creation with category/tags from dialog
  const handleConfirmGroupWithCategory = useCallback(async (name: string, category?: string, tags?: string[]) => {
    if (!pendingGroupData) return;
    await createGroup(name, pendingGroupData.componentIds, pendingGroupData.layoutData, category, tags);
    setPendingGroupData(null);
    setPendingGroupName("");
    setIsGroupCategoryDialogOpen(false);
  }, [pendingGroupData, createGroup]);

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

  // PDF Export - accepts options for which pages to include
  const handleExportPdf = useCallback((options?: { includeBOM?: boolean; includeMesskonzept?: boolean }) => {
    const includeBOM = options?.includeBOM ?? true; // Default: always include BOM (backward compat)
    const includeMesskonzept = options?.includeMesskonzept ?? false;
    const svgElement = document.querySelector('.schematic-canvas svg') as SVGSVGElement;
    if (!svgElement) return;

    // Dynamischer Import von jsPDF
    import('jspdf').then(({ default: jsPDF }) => {
      import('jspdf-autotable').then(({ default: autoTable }) => {
        const paperSize = PAPER_SIZES[canvasState.paperFormat];
        const paperWidthMM = canvasState.orientation === 'landscape' ? paperSize.height : paperSize.width;
        const paperHeightMM = canvasState.orientation === 'landscape' ? paperSize.width : paperSize.height;
        const paperWidthPx = paperWidthMM * MM_TO_PX;
        const paperHeightPx = paperHeightMM * MM_TO_PX;
        const tileSize = canvasState.gridSize;
        const gridCols = Math.floor(paperWidthPx / tileSize);
        const gridRows = Math.floor(paperHeightPx / tileSize);
        const canvasWidth = gridCols * tileSize;
        const canvasHeight = gridRows * tileSize;

        // Clone SVG (same as image export)
        const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
        clonedSvg.setAttribute('viewBox', `0 0 ${canvasWidth} ${canvasHeight}`);
        clonedSvg.setAttribute('width', String(canvasWidth));
        clonedSvg.setAttribute('height', String(canvasHeight));

        const transformGroup = clonedSvg.querySelector('g[transform]');
        if (transformGroup) {
          transformGroup.setAttribute('transform', 'translate(0, 0) scale(1)');
        }

        // CSS variable replacements
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
          if (element.style) {
            Object.entries(cssVarReplacements).forEach(([, replacement]) => {
              if (element.style.fill?.includes('var(')) element.style.fill = replacement;
              if (element.style.stroke?.includes('var(')) element.style.stroke = replacement;
            });
          }
        });

        // Remove UI elements
        clonedSvg.querySelectorAll('[data-export-ignore]').forEach(el => el.remove());
        clonedSvg.querySelectorAll('text').forEach(text => {
          const content = text.textContent || '';
          if (content.includes('Kacheln') || content.includes('×')) text.remove();
        });

        // Render SVG to canvas
        const canvas = document.createElement('canvas');
        const scale = 2;
        canvas.width = canvasWidth * scale;
        canvas.height = canvasHeight * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const svgData = new XMLSerializer().serializeToString(clonedSvg);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        const img = new window.Image();
        img.onload = () => {
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);

          // Create PDF
          const orientation = canvasState.orientation === 'landscape' ? 'landscape' : 'portrait';
          const doc = new jsPDF({
            orientation,
            unit: 'mm',
            format: canvasState.paperFormat.toLowerCase()
          });

          const pdfWidth = doc.internal.pageSize.getWidth();
          const pdfHeight = doc.internal.pageSize.getHeight();

          // Add drawing image to page 1
          const imgData = canvas.toDataURL('image/png');
          doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

          // Collect BOM data and build position map
          const nonConnectionTiles = tiles.filter(t => !isConnectionBlock(t.component));
          const componentCounts = new Map<string, { component: Component; count: number; tilePositions: { gridX: number; gridY: number; width: number; height: number }[] }>();

          for (const tile of nonConnectionTiles) {
            const existing = componentCounts.get(tile.component.id);
            const tilePos = {
              gridX: tile.gridX,
              gridY: tile.gridY,
              width: tile.component.width || 1,
              height: tile.component.height || 1
            };
            if (existing) {
              existing.count++;
              existing.tilePositions.push(tilePos);
            } else {
              componentCounts.set(tile.component.id, {
                component: tile.component,
                count: 1,
                tilePositions: [tilePos]
              });
            }
          }

          // Build BOM items sorted by category then name
          const bomItems: Array<{
            position: number;
            componentId: string;
            name: string;
            kategorie: string;
            marke: string;
            modell: string;
            quantity: number;
            preis: number;
            gesamtkosten: number;
            tilePositions: { gridX: number; gridY: number; width: number; height: number }[];
          }> = [];

          const sortedEntries = Array.from(componentCounts.entries())
            .sort(([, a], [, b]) => {
              const catA = a.component.category || '';
              const catB = b.component.category || '';
              if (catA !== catB) {
                if (!catA) return 1;
                if (!catB) return -1;
                return catA.localeCompare(catB);
              }
              return a.component.name.localeCompare(b.component.name);
            });

          let pos = 1;
          for (const [id, { component, count, tilePositions }] of sortedEntries) {
            const kategorie = component.category || projectKategorien.get(id) || '';
            const marke = projectMarken.get(id) || '';
            const modell = projectModelle.get(id) || '';
            const preis = projectPreise.get(id) || 0;

            bomItems.push({
              position: pos++,
              componentId: id,
              name: component.name,
              kategorie,
              marke,
              modell,
              quantity: count,
              preis,
              gesamtkosten: preis * count,
              tilePositions
            });
          }

          const formatCurrency = (value: number) => {
            if (!value) return '–';
            return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
          };

          // Page 2: BOM Table (if included)
          if (includeBOM) {
            doc.addPage();

            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.text('STÜCKLISTE', 14, 20);

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            let infoY = 28;
            if (titleBlockData.projekt) {
              doc.text(`Projekt: ${titleBlockData.projekt}`, 14, infoY);
              infoY += 5;
            }
            if (titleBlockData.zeichnungsNr) {
              doc.text(`Zeichnungs-Nr.: ${titleBlockData.zeichnungsNr}`, 14, infoY);
              infoY += 5;
            }
            doc.text(`Erstellt am: ${new Date().toLocaleDateString('de-DE')}`, 14, infoY);
            infoY += 8;

            const tableHead = [['Pos.', 'Komponente', 'Kategorie', 'Marke', 'Modell', 'Menge', 'Preis (€)', 'Gesamt (€)']];
            const tableBody = bomItems.map(item => [
              String(item.position),
              item.name,
              item.kategorie || '–',
              item.marke || '–',
              item.modell || '–',
              String(item.quantity),
              formatCurrency(item.preis),
              formatCurrency(item.gesamtkosten)
            ]);

            const totalQuantity = bomItems.reduce((sum, item) => sum + item.quantity, 0);
            const totalKosten = bomItems.reduce((sum, item) => sum + item.gesamtkosten, 0);
            tableBody.push([
              '', '', '', '', 'GESAMT:',
              String(totalQuantity),
              '',
              totalKosten > 0 ? formatCurrency(totalKosten) : '–'
            ]);

            autoTable(doc, {
              startY: infoY,
              head: tableHead,
              body: tableBody,
              theme: 'grid',
              headStyles: {
                fillColor: [37, 99, 235],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 9
              },
              bodyStyles: {
                fontSize: 8.5
              },
              columnStyles: {
                0: { cellWidth: 12, halign: 'center' },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 28 },
                3: { cellWidth: 25 },
                4: { cellWidth: 30 },
                5: { cellWidth: 14, halign: 'center' },
                6: { cellWidth: 22, halign: 'right' },
                7: { cellWidth: 22, halign: 'right' }
              },
              didParseCell: (data: any) => {
                if (data.section === 'body' && data.row.index >= bomItems.length) {
                  data.cell.styles.fontStyle = 'bold';
                  data.cell.styles.fillColor = [224, 231, 243];
                }
              },
              margin: { left: 14, right: 14 }
            });
          }

          // Messkonzept Page (if included)
          if (includeMesskonzept) {
            // Build messkonzept items from labeled tiles
            const messkonzeptItems: Array<{ label: string; name: string; kategorie: string; marke: string; modell: string }> = [];
            for (const tile of tiles) {
              if (isConnectionBlock(tile.component)) continue;
              const labelData = tileLabels.get(tile.id);
              if (!labelData) continue;
              const kategorie = tile.component.category || projectKategorien.get(tile.component.id) || '';
              const marke = projectMarken.get(tile.component.id) || '';
              const modell = projectModelle.get(tile.component.id) || '';
              messkonzeptItems.push({ label: labelData.label, name: tile.component.name, kategorie, marke, modell });
            }
            messkonzeptItems.sort((a, b) => {
              const [aPri, aIdx] = a.label.split('.').map(Number);
              const [bPri, bIdx] = b.label.split('.').map(Number);
              if (aPri !== bPri) return aPri - bPri;
              return aIdx - bIdx;
            });

            if (messkonzeptItems.length > 0) {
              doc.addPage();

              doc.setFontSize(18);
              doc.setFont('helvetica', 'bold');
              doc.text('MESSKONZEPT', 14, 20);

              doc.setFontSize(10);
              doc.setFont('helvetica', 'normal');
              let mkInfoY = 28;
              if (titleBlockData.projekt) {
                doc.text(`Projekt: ${titleBlockData.projekt}`, 14, mkInfoY);
                mkInfoY += 5;
              }
              if (titleBlockData.zeichnungsNr) {
                doc.text(`Zeichnungs-Nr.: ${titleBlockData.zeichnungsNr}`, 14, mkInfoY);
                mkInfoY += 5;
              }
              doc.text(`Erstellt am: ${new Date().toLocaleDateString('de-DE')}`, 14, mkInfoY);
              mkInfoY += 8;

              const mkTableHead = [['Nr.', 'Komponente', 'Kategorie', 'Marke', 'Modell']];
              const mkTableBody = messkonzeptItems.map(item => [
                item.label,
                item.name,
                item.kategorie || '–',
                item.marke || '–',
                item.modell || '–'
              ]);

              autoTable(doc, {
                startY: mkInfoY,
                head: mkTableHead,
                body: mkTableBody,
                theme: 'grid',
                headStyles: {
                  fillColor: [37, 99, 235],
                  textColor: [255, 255, 255],
                  fontStyle: 'bold',
                  fontSize: 9
                },
                bodyStyles: {
                  fontSize: 8.5
                },
                columnStyles: {
                  0: { cellWidth: 16, halign: 'center' },
                  1: { cellWidth: 'auto' },
                  2: { cellWidth: 35 },
                  3: { cellWidth: 30 },
                  4: { cellWidth: 35 }
                },
                margin: { left: 14, right: 14 }
              });
            }
          }

          // Go back to page 1 - collect annotation data for pdf-lib post-processing
          doc.setPage(1);

          const componentBomMap = new Map(bomItems.map(item => [item.componentId, item]));
          const pdfPageHeight = doc.internal.pageSize.getHeight();

          // Collect annotation data for post-processing with pdf-lib
          const annotationData: { x: number; y: number; w: number; h: number; title: string; contents: string }[] = [];

          for (const tile of nonConnectionTiles) {
            const bomItem = componentBomMap.get(tile.component.id);
            if (!bomItem) continue;

            // Convert grid position to PDF coordinates (mm)
            const tileX = (tile.gridX / gridCols) * pdfWidth;
            const tileY = (tile.gridY / gridRows) * pdfHeight;
            const tileW = ((tile.component.width || 1) / gridCols) * pdfWidth;
            const tileH = ((tile.component.height || 1) / gridRows) * pdfHeight;

            // Build tooltip content
            const tooltipLines: string[] = [];
            tooltipLines.push(`${bomItem.name} (Pos. ${bomItem.position})`);
            if (bomItem.kategorie) tooltipLines.push(`Kategorie: ${bomItem.kategorie}`);
            if (bomItem.marke) tooltipLines.push(`Marke: ${bomItem.marke}`);
            if (bomItem.modell) tooltipLines.push(`Modell: ${bomItem.modell}`);
            if (bomItem.preis) tooltipLines.push(`Preis: ${formatCurrency(bomItem.preis)}`);
            tooltipLines.push(`Menge: ${bomItem.quantity}`);
            if (bomItem.gesamtkosten > 0) tooltipLines.push(`Gesamt: ${formatCurrency(bomItem.gesamtkosten)}`);

            // PDF coordinate system: origin at bottom-left
            const pdfY1 = pdfPageHeight - tileY - tileH; // bottom
            const pdfY2 = pdfPageHeight - tileY; // top

            annotationData.push({
              x: tileX * 2.835, // mm to points (1mm = 2.835pt)
              y: pdfY1 * 2.835,
              w: (tileX + tileW) * 2.835,
              h: pdfY2 * 2.835,
              title: bomItem.name,
              contents: tooltipLines.join('\n')
            });
          }

          // Generate jsPDF output as arraybuffer, then post-process with pdf-lib
          const jspdfOutput = doc.output('arraybuffer');
          
          // Post-process with pdf-lib to add truly invisible annotations
          PDFDocument.load(jspdfOutput).then(async (pdfDoc) => {
            const page = pdfDoc.getPages()[0]; // Page 1
            
            for (const annot of annotationData) {
              // Create an empty appearance stream (XObject Form) - this hides the icon
              const emptyStream = pdfDoc.context.stream(new Uint8Array(0), {
                Type: 'XObject',
                Subtype: 'Form',
                BBox: [0, 0, annot.w - annot.x, annot.h - annot.y],
              });
              const emptyStreamRef = pdfDoc.context.register(emptyStream);
              
              // Create the appearance dictionary with the empty stream
              const apDict = pdfDoc.context.obj({
                N: emptyStreamRef,
              });
              
              // Create the annotation dictionary
              const annotDict = pdfDoc.context.obj({
                Type: 'Annot',
                Subtype: 'Text',
                Rect: [annot.x, annot.y, annot.w, annot.h],
                Contents: PDFString.of(annot.contents),
                T: PDFString.of(annot.title),
                Open: false,
                F: 0,
                AP: apDict,
                C: [], // No color
              });
              const annotRef = pdfDoc.context.register(annotDict);
              
              // Add annotation to page
              const existingAnnots = page.node.lookup(PDFName.of('Annots'));
              if (existingAnnots instanceof PDFArray) {
                existingAnnots.push(annotRef);
              } else {
                page.node.set(PDFName.of('Annots'), pdfDoc.context.obj([annotRef]));
              }
            }
            
            // Save and download
            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([new Uint8Array(pdfBytes) as any], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const projektName = titleBlockData.projekt || 'Zeichnung';
            a.download = `${projektName}-${new Date().toISOString().slice(0, 10)}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
          }).catch(err => {
            console.error('PDF post-processing failed:', err);
          });
        };
        img.onerror = (err) => {
          console.error('PDF export failed:', err);
          URL.revokeObjectURL(url);
        };
        img.src = url;
      });
    });
  }, [canvasState, tiles, tileLabels, titleBlockData, projectKategorien, projectMarken, projectModelle, projectPreise]);

  // Handle export button click - always show dialog
  const handleExportClick = useCallback(() => {
    setIsExportDialogOpen(true);
  }, []);

  // BOM Excel export (extracted for use in unified dialog)
  const handleExportBOMExcel = useCallback(() => {
    const XLSX_MODULE = import('xlsx');
    XLSX_MODULE.then((XLSX) => {
      // Build BOM items
      const componentCounts = new Map<string, { component: Component; count: number }>();
      for (const tile of tiles) {
        if (isConnectionBlock(tile.component)) continue;
        const existing = componentCounts.get(tile.component.id);
        if (existing) {
          existing.count++;
        } else {
          componentCounts.set(tile.component.id, { component: tile.component, count: 1 });
        }
      }

      const sortedEntries = Array.from(componentCounts.entries())
        .sort(([, a], [, b]) => {
          const catA = a.component.category || '';
          const catB = b.component.category || '';
          if (catA !== catB) {
            if (!catA) return 1;
            if (!catB) return -1;
            return catA.localeCompare(catB);
          }
          return a.component.name.localeCompare(b.component.name);
        });

      const bomItems: Array<{ position: number; name: string; kategorie: string; marke: string; modell: string; quantity: number; preis: number; gesamtkosten: number }> = [];
      let position = 1;
      for (const [id, { component, count }] of sortedEntries) {
        const kategorie = component.category || projectKategorien.get(id) || '';
        const marke = projectMarken.get(id) || '';
        const modell = projectModelle.get(id) || '';
        const preis = projectPreise.get(id) || 0;
        bomItems.push({
          position: position++,
          name: component.name,
          kategorie,
          marke,
          modell,
          quantity: count,
          preis,
          gesamtkosten: preis * count,
        });
      }

      const wb = XLSX.utils.book_new();
      const wsData: (string | number)[][] = [];
      wsData.push(['STÜCKLISTE', '', '', '', '', '', '', '']);
      wsData.push(['', '', '', '', '', '', '', '']);
      if (titleBlockData.projekt) wsData.push(['Projekt:', titleBlockData.projekt, '', '', '', '', '', '']);
      if (titleBlockData.zeichnungsNr) wsData.push(['Zeichnungs-Nr.:', titleBlockData.zeichnungsNr, '', '', '', '', '', '']);
      wsData.push(['Erstellt am:', new Date().toLocaleDateString('de-DE'), '', '', '', '', '', '']);
      wsData.push(['', '', '', '', '', '', '', '']);
      wsData.push(['Pos.', 'Komponente', 'Kategorie', 'Marke', 'Modell', 'Menge', 'Preis (€)', 'Gesamt (€)']);
      for (const item of bomItems) {
        wsData.push([item.position, item.name, item.kategorie || '', item.marke || '', item.modell || '', item.quantity, item.preis || '', item.gesamtkosten || '']);
      }
      wsData.push(Array(8).fill(''));
      const totalCount = bomItems.reduce((sum, item) => sum + item.quantity, 0);
      const totalKosten = bomItems.reduce((sum, item) => sum + item.gesamtkosten, 0);
      wsData.push(['', '', '', '', 'GESAMT:', totalCount, '', totalKosten > 0 ? totalKosten : '']);

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [{ wch: 6 }, { wch: 20 }, { wch: 18 }, { wch: 15 }, { wch: 20 }, { wch: 8 }, { wch: 12 }, { wch: 12 }];
      ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];
      XLSX.utils.book_append_sheet(wb, ws, 'Stückliste');
      const projektName = titleBlockData.projekt || 'Projekt';
      XLSX.writeFile(wb, `stueckliste-${projektName}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    });
  }, [tiles, titleBlockData, projectKategorien, projectMarken, projectModelle, projectPreise]);

  // Messkonzept Excel export (extracted for use in unified dialog)
  const handleExportMesskonzeptExcel = useCallback(() => {
    import('xlsx').then((XLSX) => {
      const items: Array<{ label: string; name: string; kategorie: string; marke: string; modell: string }> = [];
      for (const tile of tiles) {
        if (isConnectionBlock(tile.component)) continue;
        const labelData = tileLabels.get(tile.id);
        if (!labelData) continue;
        const kategorie = tile.component.category || projectKategorien.get(tile.component.id) || '';
        const marke = projectMarken.get(tile.component.id) || '';
        const modell = projectModelle.get(tile.component.id) || '';
        items.push({ label: labelData.label, name: tile.component.name, kategorie, marke, modell });
      }
      items.sort((a, b) => {
        const [aPri, aIdx] = a.label.split('.').map(Number);
        const [bPri, bIdx] = b.label.split('.').map(Number);
        if (aPri !== bPri) return aPri - bPri;
        return aIdx - bIdx;
      });

      const wb = XLSX.utils.book_new();
      const wsData: (string | number)[][] = [];
      wsData.push(['MESSKONZEPT', '', '', '', '']);
      wsData.push(['', '', '', '', '']);
      if (titleBlockData.projekt) wsData.push(['Projekt:', titleBlockData.projekt, '', '', '']);
      if (titleBlockData.zeichnungsNr) wsData.push(['Zeichnungs-Nr.:', titleBlockData.zeichnungsNr, '', '', '']);
      wsData.push(['Erstellt am:', new Date().toLocaleDateString('de-DE'), '', '', '']);
      wsData.push(['', '', '', '', '']);
      wsData.push(['Nr.', 'Komponente', 'Kategorie', 'Marke', 'Modell']);
      for (const item of items) {
        wsData.push([item.label, item.name, item.kategorie || '', item.marke || '', item.modell || '']);
      }

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [{ wch: 8 }, { wch: 25 }, { wch: 18 }, { wch: 18 }, { wch: 22 }];
      ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];
      XLSX.utils.book_append_sheet(wb, ws, 'Messkonzept');
      const projektName = titleBlockData.projekt || 'Projekt';
      XLSX.writeFile(wb, `messkonzept-${projektName}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    });
  }, [tiles, tileLabels, titleBlockData, projectKategorien, projectMarken, projectModelle]);

  // Check if there are messkonzept items (labeled tiles)
  const hasMesskonzeptItems = useMemo(() => {
    for (const tile of tiles) {
      if (isConnectionBlock(tile.component)) continue;
      if (tileLabels.has(tile.id)) return true;
    }
    return false;
  }, [tiles, tileLabels]);

  // Handle save project + export image from dialog
  const handleSaveProjectAndExportImage = useCallback(async (projectName: string) => {
    // Save as saved_plan (project) instead of group
    const componentCounts = new Map<string, number>();
    for (const tile of tiles) {
      if (!isConnectionBlock(tile.component)) {
        componentCounts.set(tile.component.id, (componentCounts.get(tile.component.id) || 0) + 1);
      }
    }
    const componentQuantities: ComponentQuantity[] = Array.from(componentCounts.entries()).map(([componentId, quantity]) => ({
      componentId, quantity
    }));
    const drawingData: DrawingData = { tiles, connections };
    await savePlan(projectName, componentQuantities, drawingData);
    setIsExportDialogOpen(false);
    handleExport();
  }, [tiles, connections, savePlan, handleExport]);

  // Handle save project + export PDF from dialog
  const handleSaveProjectAndExportPdf = useCallback(async (projectName: string, pdfOptions?: { includeBOM?: boolean; includeMesskonzept?: boolean }) => {
    const componentCounts = new Map<string, number>();
    for (const tile of tiles) {
      if (!isConnectionBlock(tile.component)) {
        componentCounts.set(tile.component.id, (componentCounts.get(tile.component.id) || 0) + 1);
      }
    }
    const componentQuantities: ComponentQuantity[] = Array.from(componentCounts.entries()).map(([componentId, quantity]) => ({
      componentId, quantity
    }));
    const drawingData: DrawingData = { tiles, connections };
    await savePlan(projectName, componentQuantities, drawingData);
    setIsExportDialogOpen(false);
    handleExportPdf(pdfOptions);
  }, [tiles, connections, savePlan, handleExportPdf]);

  // Handle export image only from dialog
  const handleExportImageOnly = useCallback(() => {
    setIsExportDialogOpen(false);
    handleExport();
  }, [handleExport]);

  // Handle export PDF only from dialog
  const handleExportPdfOnly = useCallback((pdfOptions?: { includeBOM?: boolean; includeMesskonzept?: boolean }) => {
    setIsExportDialogOpen(false);
    handleExportPdf(pdfOptions);
  }, [handleExportPdf]);

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
        case 'l': setActiveTool('annotate-line'); break;
        case 't': setActiveTool('annotate-text'); break;
        case '+': case '=': handleZoomIn(); break;
        case '-': handleZoomOut(); break;
        case '0': handleResetView(); break;
        case 'e': handleExportClick(); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleZoomIn, handleZoomOut, handleResetView, handleExportClick]);

  const [splashDone, setSplashDone] = useState(false);

  const dotLottieRefCallback = useCallback((dotLottie: any) => {
    if (dotLottie) {
      dotLottie.addEventListener('complete', () => setSplashDone(true));
    }
  }, []);

  if (!splashDone || componentsLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background gap-4">
        <DotLottieReact
          src="/lava-loading.lottie"
          autoplay
          loop={false}
          dotLottieRefCallback={dotLottieRefCallback}
          style={{ width: 200, height: 200 }}
        />
        {splashDone && componentsLoading && (
          <p className="text-sm text-muted-foreground animate-fade-in">Komponenten werden geladen...</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background no-select">
      <header className="toolbar-panel h-14 border-b flex items-center px-4 gap-4">
        <div className="flex items-center gap-5">
          <img src={lavaLogo} alt="LAVA Logo" className="h-8" />
          <h1 className="font-semibold text-xs leading-tight max-w-[100px]">Anlagen-Diagramm Zeichner</h1>
        </div>
        <div className="h-8 w-px bg-border mx-4" />
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
          onOpenMesskonzept={() => setIsMesskonzeptOpen(true)}
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
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Toolbar
          activeTool={activeTool}
          onToolChange={setActiveTool}
          onDelete={handleDelete}
          hasSelection={selectedTileIds.size > 0 || selectedAnnotationId !== null}
          connectionColor={connectionColor}
          onConnectionColorChange={setConnectionColor}
          isGroupMode={isGroupMode}
          onToggleGroupMode={() => {
            setIsGroupMode(!isGroupMode);
          }}
          selectedTileCount={selectedTileIds.size}
          onSaveGroup={(name) => {
            // Prepare group data, then open category dialog
            handlePrepareGroupFromTiles(name);
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
          annotationLineStyle={annotationLineStyle}
          onAnnotationLineStyleChange={setAnnotationLineStyle}
          annotationColor={annotationColor}
          onAnnotationColorChange={setAnnotationColor}
          annotationFontSize={annotationFontSize}
          onAnnotationFontSizeChange={setAnnotationFontSize}
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
            annotationLines={annotationLines}
            annotationTexts={annotationTexts}
            annotationLineStyle={annotationLineStyle}
            annotationColor={annotationColor}
            annotationFontSize={annotationFontSize}
            selectedAnnotationId={selectedAnnotationId}
            onAnnotationLineCreate={handleAnnotationLineCreate}
            onAnnotationTextCreate={handleAnnotationTextCreate}
            onAnnotationSelect={handleAnnotationSelect}
            onAnnotationLineMove={handleAnnotationLineMove}
            onAnnotationTextMove={handleAnnotationTextMove}
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
          categories={categories}
          savedPlans={savedPlans}
          onDeletePlan={deletePlan}
          filterCategory={filterCategory}
          onFilterCategoryChange={setFilterCategory}
          filterTag={filterTag}
          onFilterTagChange={setFilterTag}
          onManageCategories={() => setIsCategoryManagerOpen(true)}
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
        savedPlans={savedPlans}
        onInsertGroup={handleInsertGroupFromSelector}
        onInsertPlan={(plan) => {
          if (!plan.drawingData?.tiles || plan.drawingData.tiles.length === 0) return;
          const planTiles = plan.drawingData.tiles;
          const planConnections = plan.drawingData.connections || [];
          const minX = Math.min(...planTiles.map(t => t.gridX));
          const minY = Math.min(...planTiles.map(t => t.gridY));
          const maxGridY = tiles.length > 0 ? Math.max(...tiles.map(t => t.gridY + (t.component.height || 1))) : 0;
          const oldToNewIdMap = new Map<string, string>();
          const newTiles: PlacedTile[] = [];
          for (const tile of planTiles) {
            const component = tile.component || findComponentById(tile.component?.id || (tile as any).componentId, components);
            if (!component) continue;
            const newId = generateId();
            oldToNewIdMap.set(tile.id, newId);
            newTiles.push({ id: newId, component, gridX: tile.gridX - minX, gridY: maxGridY + (tile.gridY - minY), rotation: tile.rotation });
          }
          const newConnections: CellConnection[] = [];
          for (const conn of planConnections) {
            const newFromId = oldToNewIdMap.get(conn.fromTileId);
            const newToId = oldToNewIdMap.get(conn.toTileId);
            if (newFromId && newToId) {
              newConnections.push({ ...conn, id: generateId(), fromTileId: newFromId, toTileId: newToId });
            }
          }
          setTiles(prev => [...prev, ...newTiles]);
          setConnections(prev => [...prev, ...newConnections]);
        }}
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

      <Messkonzept
        open={isMesskonzeptOpen}
        onClose={() => setIsMesskonzeptOpen(false)}
        tiles={tiles}
        tileLabels={tileLabels}
        titleBlockData={titleBlockData}
        components={components}
        projectKategorien={projectKategorien}
        projectMarken={projectMarken}
        projectModelle={projectModelle}
      />

      <ExportGroupDialog
        open={isExportDialogOpen}
        onClose={() => setIsExportDialogOpen(false)}
        onExportImage={handleExportImageOnly}
        onExportPdf={handleExportPdfOnly}
        onExportBOMExcel={handleExportBOMExcel}
        onExportMesskonzeptExcel={handleExportMesskonzeptExcel}
        onSaveProjectAndExportImage={handleSaveProjectAndExportImage}
        onSaveProjectAndExportPdf={handleSaveProjectAndExportPdf}
        hasTiles={tiles.filter(t => !isConnectionBlock(t.component)).length >= 2}
        hasMesskonzeptItems={hasMesskonzeptItems}
      />

      <GroupCategoryDialog
        open={isGroupCategoryDialogOpen}
        onClose={() => { setIsGroupCategoryDialogOpen(false); setPendingGroupData(null); }}
        onConfirm={handleConfirmGroupWithCategory}
        categories={categories}
        onManageCategories={() => setIsCategoryManagerOpen(true)}
        initialName={pendingGroupName}
      />

      <CategoryManagerDialog
        open={isCategoryManagerOpen}
        onClose={() => setIsCategoryManagerOpen(false)}
        categories={categories}
        onCreateCategory={createCategory}
        onUpdateCategory={updateCategory}
        onDeleteCategory={deleteCategory}
      />
    </div>
  );
}
