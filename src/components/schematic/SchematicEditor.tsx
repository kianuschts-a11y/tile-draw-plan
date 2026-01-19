import { useState, useCallback, useEffect, useMemo } from "react";
import { Shape, CanvasState, Component, PaperFormat, Orientation, TileSize, TILE_SIZES, CellConnection, ComponentGroup, ComponentQuantity, GroupMatch, GroupLayoutData, GroupTileData, GroupConnectionData, PAPER_SIZES, MM_TO_PX } from "@/types/schematic";
import { Toolbar, MainToolType } from "./Toolbar";
import { Canvas, PlacedTile } from "./Canvas";
import { ComponentLibrary } from "./ComponentLibrary";
import { StatusBar } from "./StatusBar";
import { PaperSettings } from "./PaperSettings";
import { ComponentEditorDialog } from "./ComponentEditorDialog";
import { ComponentSelectorDialog } from "./ComponentSelectorDialog";
import { useAuth } from "@/hooks/useAuth";
import { useComponents } from "@/hooks/useComponents";
import { useComponentGroups } from "@/hooks/useComponentGroups";
import { useSavedPlans, SavedPlanData, DrawingData } from "@/hooks/useSavedPlans";
import { useProjects } from "@/hooks/useProjects";
import { Button } from "@/components/ui/button";
import { LogOut, Menu, User, Building2, Package } from "lucide-react";
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

  const [tiles, setTiles] = useState<PlacedTile[]>([]);
  const [connections, setConnections] = useState<CellConnection[]>([]);
  const [selectedTileIds, setSelectedTileIds] = useState<Set<string>>(new Set());
  const [selectedComponentIds, setSelectedComponentIds] = useState<Set<string>>(new Set());
  const [activeTool, setActiveTool] = useState<MainToolType>('select');
  const [connectionColor, setConnectionColor] = useState<string>('#000000');
  const [draggingComponent, setDraggingComponent] = useState<Component | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<Component | null>(null);
  const [editingGroup, setEditingGroup] = useState<ComponentGroup | null>(null);
  const [libraryTab, setLibraryTab] = useState<'components' | 'groups'>('components');
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [showComponentSelector, setShowComponentSelector] = useState(false);
  const [projectQuantities, setProjectQuantities] = useState<Map<string, number>>(new Map());
  const [canvasState, setCanvasState] = useState<CanvasState>({
    zoom: 1,
    panX: 50,
    panY: 50,
    gridSize: 40,
    paperFormat: 'A4',
    orientation: 'portrait'
  });

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

    // Calculate fixed paper dimensions based on format and orientation
    const paperSize = PAPER_SIZES[canvasState.paperFormat];
    const paperWidth = (canvasState.orientation === 'landscape' ? paperSize.height : paperSize.width) * MM_TO_PX;
    const paperHeight = (canvasState.orientation === 'landscape' ? paperSize.width : paperSize.height) * MM_TO_PX;

    // Clone the SVG to avoid modifying the original
    const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
    
    // Set fixed viewBox for paper size (no zoom/pan)
    clonedSvg.setAttribute('viewBox', `0 0 ${paperWidth} ${paperHeight}`);
    clonedSvg.setAttribute('width', String(paperWidth));
    clonedSvg.setAttribute('height', String(paperHeight));
    
    // Find and reset the main transform group to scale(1) translate(0,0)
    const transformGroup = clonedSvg.querySelector('g[transform]');
    if (transformGroup) {
      transformGroup.setAttribute('transform', 'translate(0, 0) scale(1)');
    }
    
    // Remove temporary UI elements that shouldn't be exported
    const selectorsToRemove = [
      '[data-export-ignore]',
      '.selection-box',
      '.connection-preview',
      '.drop-preview'
    ];
    selectorsToRemove.forEach(selector => {
      clonedSvg.querySelectorAll(selector).forEach(el => el.remove());
    });

    // Create a canvas to render the SVG
    const canvas = document.createElement('canvas');
    const scale = 2; // Higher resolution for better quality
    canvas.width = paperWidth * scale;
    canvas.height = paperHeight * scale;
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
      link.download = `zeichnung-${canvasState.paperFormat}-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = url;
  }, [canvasState.paperFormat, canvasState.orientation]);

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

  const handleSaveComponent = useCallback(async (name: string, shapes: Shape[], tileSize: TileSize) => {
    await saveComponent(name, shapes, tileSize);
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

  const handleUpdateComponentShapes = useCallback(async (id: string, name: string, shapes: Shape[], tileSize: TileSize) => {
    await updateComponent(id, name, shapes, tileSize);
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
    
    // Find min coordinates to calculate relative positions
    const minX = Math.min(...selectedTiles.map(t => t.gridX));
    const minY = Math.min(...selectedTiles.map(t => t.gridY));
    
    // Create tile data with relative positions
    const tileData: GroupTileData[] = selectedTiles.map(tile => ({
      componentId: tile.component.id,
      relativeX: tile.gridX - minX,
      relativeY: tile.gridY - minY
    }));
    
    // Get component IDs (unique)
    const componentIds = [...new Set(selectedTiles.map(t => t.component.id))];
    
    // Find connections between selected tiles
    const relevantConnections = connections.filter(c => 
      selectedTileIds.has(c.fromTileId) && selectedTileIds.has(c.toTileId)
    );
    
    // Map tile IDs to indices
    const tileIdToIndex = new Map(selectedTiles.map((t, i) => [t.id, i]));
    
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
          onPaperFormatChange={handlePaperFormatChange}
          onOrientationChange={handleOrientationChange}
          onGridSizeChange={handleGridSizeChange}
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
      />
    </div>
  );
}
