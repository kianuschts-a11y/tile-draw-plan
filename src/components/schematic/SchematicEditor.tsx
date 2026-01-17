import { useState, useCallback, useEffect } from "react";
import { Shape, CanvasState, Component, PaperFormat, Orientation, TileSize, TILE_SIZES } from "@/types/schematic";
import { Toolbar, MainToolType } from "./Toolbar";
import { Canvas, PlacedTile } from "./Canvas";
import { ComponentLibrary } from "./ComponentLibrary";
import { StatusBar } from "./StatusBar";
import { PaperSettings } from "./PaperSettings";
import { ComponentEditorDialog } from "./ComponentEditorDialog";
import { VariationEditorDialog } from "./VariationEditorDialog";
import { updateComponentVariations } from "@/lib/variationUtils";

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

const STORAGE_KEY = 'schematic-editor-components';

function loadComponentsFromStorage(): Component[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const userComponents = JSON.parse(stored) as Component[];
      return userComponents;
    }
  } catch (e) {
    console.error('Failed to load components from storage:', e);
  }
  return [];
}

function saveComponentsToStorage(components: Component[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(components));
  } catch (e) {
    console.error('Failed to save components to storage:', e);
  }
}

export function SchematicEditor() {
  const [tiles, setTiles] = useState<PlacedTile[]>([]);
  const [selectedTileIds, setSelectedTileIds] = useState<Set<string>>(new Set());
  const [activeTool, setActiveTool] = useState<MainToolType>('select');
  const [components, setComponents] = useState<Component[]>(loadComponentsFromStorage);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<Component | null>(null);
  const [variationEditorComponent, setVariationEditorComponent] = useState<Component | null>(null);
  const [canvasState, setCanvasState] = useState<CanvasState>({
    zoom: 1,
    panX: 50,
    panY: 50,
    gridSize: 40,
    paperFormat: 'A4',
    orientation: 'portrait'
  });

  const handleZoomIn = useCallback(() => {
    setCanvasState(prev => ({
      ...prev,
      zoom: Math.min(prev.zoom * 1.25, 4)
    }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setCanvasState(prev => ({
      ...prev,
      zoom: Math.max(prev.zoom / 1.25, 0.25)
    }));
  }, []);

  const handleResetView = useCallback(() => {
    setCanvasState(prev => ({
      ...prev,
      zoom: 1,
      panX: 50,
      panY: 50
    }));
  }, []);

  const handleDelete = useCallback(() => {
    if (selectedTileIds.size > 0) {
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
  }, []);

  const handleDropComponent = useCallback((component: Component, gridX: number, gridY: number) => {
    const newTile: PlacedTile = {
      id: generateId(),
      component,
      gridX,
      gridY
    };
    setTiles(prev => [...prev, newTile]);
    setSelectedTileIds(new Set([newTile.id]));
  }, []);

  // Persist components to localStorage whenever they change
  useEffect(() => {
    saveComponentsToStorage(components);
  }, [components]);

  const handleSaveComponent = useCallback((name: string, shapes: Shape[], tileSize: TileSize) => {
    const config = TILE_SIZES[tileSize];
    const newComponent: Component = {
      id: generateId(),
      name,
      shapes,
      width: config.cols,
      height: config.rows,
      tileSize
    };
    setComponents(prev => [...prev, newComponent]);
  }, []);

  const handleDeleteComponent = useCallback((id: string) => {
    setComponents(prev => prev.filter(c => c.id !== id));
  }, []);

  const handleClearAllComponents = useCallback(() => {
    setComponents([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const handleEditVariations = useCallback((component: Component) => {
    setVariationEditorComponent(component);
  }, []);

  const handleEditComponent = useCallback((component: Component) => {
    setEditingComponent(component);
    setIsEditorOpen(true);
  }, []);

  const handleUpdateComponentShapes = useCallback((id: string, name: string, shapes: Shape[], tileSize: TileSize) => {
    const config = TILE_SIZES[tileSize];
    setComponents(prev => prev.map(c => {
      if (c.id !== id) return c;
      
      // Update variations to use new shapes
      const updatedVariations = updateComponentVariations(
        c.variations,
        shapes,
        config.cols,
        config.rows
      );
      
      return { 
        ...c, 
        name, 
        shapes, 
        width: config.cols, 
        height: config.rows, 
        tileSize,
        variations: updatedVariations
      };
    }));
  }, []);

  const handleUpdateComponent = useCallback((updatedComponent: Component) => {
    setComponents(prev => prev.map(c => 
      c.id === updatedComponent.id ? updatedComponent : c
    ));
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      
      switch (e.key.toLowerCase()) {
        case 'v':
          setActiveTool('select');
          break;
        case 'c':
          setActiveTool('connect');
          break;
        case '+':
        case '=':
          handleZoomIn();
          break;
        case '-':
          handleZoomOut();
          break;
        case '0':
          handleResetView();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleZoomIn, handleZoomOut, handleResetView]);

  return (
    <div className="flex flex-col h-screen bg-background no-select">
      {/* Header */}
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
            <p className="text-xs text-muted-foreground">Anlagen-Diagramm Zeichner</p>
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
          <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">V</kbd>
          <span>Auswählen</span>
          <span className="mx-1">•</span>
          <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">C</kbd>
          <span>Verbinden</span>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        <Toolbar
          activeTool={activeTool}
          onToolChange={setActiveTool}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetView={handleResetView}
          onDelete={handleDelete}
          hasSelection={selectedTileIds.size > 0}
        />

        <div className="flex-1 overflow-hidden">
          <Canvas
            tiles={tiles}
            selectedTileIds={selectedTileIds}
            activeTool={activeTool}
            canvasState={canvasState}
            onTilesChange={setTiles}
            onSelectionChange={setSelectedTileIds}
            onCanvasStateChange={setCanvasState}
            onDropComponent={handleDropComponent}
          />
        </div>

        <ComponentLibrary
          components={components}
          onCreateNew={() => { setEditingComponent(null); setIsEditorOpen(true); }}
          onDeleteComponent={handleDeleteComponent}
          onClearAll={handleClearAllComponents}
          onDragStart={handleDragStart}
          onEditVariations={handleEditVariations}
          onEditComponent={handleEditComponent}
          onUpdateComponent={handleUpdateComponent}
        />
      </div>

      <StatusBar 
        canvasState={canvasState} 
        shapeCount={tiles.length} 
        selectedCount={selectedTileIds.size} 
      />

      <ComponentEditorDialog
        open={isEditorOpen}
        onClose={() => { setIsEditorOpen(false); setEditingComponent(null); }}
        onSave={handleSaveComponent}
        onUpdate={handleUpdateComponentShapes}
        tileSize={canvasState.gridSize}
        editingComponent={editingComponent}
      />

      {variationEditorComponent && (
        <VariationEditorDialog
          open={true}
          onClose={() => setVariationEditorComponent(null)}
          component={variationEditorComponent}
          onSave={handleUpdateComponent}
        />
      )}
    </div>
  );
}
