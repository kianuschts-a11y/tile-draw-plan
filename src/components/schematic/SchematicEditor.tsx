import { useState, useCallback, useEffect } from "react";
import { Shape, CanvasState, Component, PaperFormat, Orientation, TileSize, TILE_SIZES, CellConnection } from "@/types/schematic";
import { Toolbar, MainToolType } from "./Toolbar";
import { Canvas, PlacedTile } from "./Canvas";
import { ComponentLibrary } from "./ComponentLibrary";
import { StatusBar } from "./StatusBar";
import { PaperSettings } from "./PaperSettings";
import { ComponentEditorDialog } from "./ComponentEditorDialog";
import { useAuth } from "@/hooks/useAuth";
import { useComponents } from "@/hooks/useComponents";
import { Button } from "@/components/ui/button";
import { LogOut, Menu, User, Building2 } from "lucide-react";
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
    clearAllComponents
  } = useComponents();

  const [tiles, setTiles] = useState<PlacedTile[]>([]);
  const [connections, setConnections] = useState<CellConnection[]>([]);
  const [selectedTileIds, setSelectedTileIds] = useState<Set<string>>(new Set());
  const [activeTool, setActiveTool] = useState<MainToolType>('select');
  const [connectionColor, setConnectionColor] = useState<string>('#000000');
  const [draggingComponent, setDraggingComponent] = useState<Component | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<Component | null>(null);
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
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">V</kbd><span>Auswählen</span>
          <span className="mx-1">•</span>
          <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">C</kbd><span>Verbinden</span>
          <span className="mx-1">•</span>
          <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">X</kbd><span>Lösen</span>
        </div>
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
          hasSelection={selectedTileIds.size > 0}
          connectionColor={connectionColor}
          onConnectionColorChange={setConnectionColor}
        />

        <div className="flex-1 overflow-hidden">
          <Canvas
            tiles={tiles}
            selectedTileIds={selectedTileIds}
            activeTool={activeTool}
            canvasState={canvasState}
            connections={connections}
            connectionColor={connectionColor}
            draggingComponent={draggingComponent}
            onTilesChange={setTiles}
            onSelectionChange={setSelectedTileIds}
            onCanvasStateChange={setCanvasState}
            onDropComponent={handleDropComponent}
            onConnectionsChange={setConnections}
            onDragEnd={handleDragEnd}
          />
        </div>

        <ComponentLibrary
          components={components}
          onCreateNew={() => { setEditingComponent(null); setIsEditorOpen(true); }}
          onDeleteComponent={handleDeleteComponent}
          onClearAll={handleClearAllComponents}
          onDragStart={handleDragStart}
          onEditComponent={handleEditComponent}
          onUpdateComponent={handleUpdateComponent}
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
    </div>
  );
}
