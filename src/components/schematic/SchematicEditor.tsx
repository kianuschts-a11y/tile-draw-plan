import { useState, useCallback, useEffect } from "react";
import { Shape, CanvasState, Component, PaperFormat, Orientation } from "@/types/schematic";
import { Toolbar } from "./Toolbar";
import { Canvas, PlacedTile } from "./Canvas";
import { ComponentLibrary } from "./ComponentLibrary";
import { StatusBar } from "./StatusBar";
import { PaperSettings } from "./PaperSettings";
import { ComponentEditorDialog } from "./ComponentEditorDialog";
import { VariationEditorDialog } from "./VariationEditorDialog";

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

// Default components with normalized shapes (0-1 range)
const defaultComponents: Component[] = [
  {
    id: 'default-rect',
    name: 'Rechteck',
    width: 1,
    height: 1,
    shapes: [{ id: '1', type: 'rectangle', x: 0.1, y: 0.1, width: 0.8, height: 0.8, strokeWidth: 2 }]
  },
  {
    id: 'default-circle',
    name: 'Kreis',
    width: 1,
    height: 1,
    shapes: [{ id: '1', type: 'circle', x: 0.1, y: 0.1, width: 0.8, height: 0.8, strokeWidth: 2 }]
  },
  {
    id: 'default-valve',
    name: 'Ventil',
    width: 1,
    height: 1,
    shapes: [
      { id: '1', type: 'triangle', x: 0.05, y: 0.15, width: 0.45, height: 0.7, strokeWidth: 2 },
      { id: '2', type: 'triangle', x: 0.5, y: 0.15, width: 0.45, height: 0.7, strokeWidth: 2 }
    ]
  },
  {
    id: 'default-pump',
    name: 'Pumpe',
    width: 1,
    height: 1,
    shapes: [
      { id: '1', type: 'circle', x: 0.15, y: 0.15, width: 0.7, height: 0.7, strokeWidth: 2 },
      { id: '2', type: 'triangle', x: 0.4, y: 0.05, width: 0.2, height: 0.15, strokeWidth: 2 }
    ]
  },
  {
    id: 'default-tank',
    name: 'Tank',
    width: 1,
    height: 1,
    shapes: [
      { id: '1', type: 'rectangle', x: 0.15, y: 0.2, width: 0.7, height: 0.6, strokeWidth: 2 },
      { id: '2', type: 'ellipse', x: 0.15, y: 0.1, width: 0.7, height: 0.2, strokeWidth: 2 },
      { id: '3', type: 'ellipse', x: 0.15, y: 0.7, width: 0.7, height: 0.2, strokeWidth: 2 }
    ]
  },
  {
    id: 'default-motor',
    name: 'Motor',
    width: 1,
    height: 1,
    shapes: [
      { id: '1', type: 'circle', x: 0.2, y: 0.2, width: 0.6, height: 0.6, strokeWidth: 2 },
      { id: '2', type: 'rectangle', x: 0.05, y: 0.4, width: 0.18, height: 0.2, strokeWidth: 2 },
      { id: '3', type: 'rectangle', x: 0.77, y: 0.4, width: 0.18, height: 0.2, strokeWidth: 2 }
    ]
  }
];

export function SchematicEditor() {
  const [tiles, setTiles] = useState<PlacedTile[]>([]);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<'select' | 'pan'>('select');
  const [components, setComponents] = useState<Component[]>(defaultComponents);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
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
    if (selectedTileId) {
      setTiles(prev => prev.filter(t => t.id !== selectedTileId));
      setSelectedTileId(null);
    }
  }, [selectedTileId]);

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
    setSelectedTileId(newTile.id);
  }, []);

  const handleSaveComponent = useCallback((name: string, shapes: Shape[]) => {
    const newComponent: Component = {
      id: generateId(),
      name,
      shapes,
      width: 1,
      height: 1
    };
    setComponents(prev => [...prev, newComponent]);
  }, []);

  const handleDeleteComponent = useCallback((id: string) => {
    setComponents(prev => prev.filter(c => c.id !== id));
  }, []);

  const handleEditVariations = useCallback((component: Component) => {
    setVariationEditorComponent(component);
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
        case 'h':
          setActiveTool('pan');
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
          <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">H</kbd>
          <span>Verschieben</span>
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
          hasSelection={!!selectedTileId}
        />

        <div className="flex-1 overflow-hidden">
          <Canvas
            tiles={tiles}
            selectedTileId={selectedTileId}
            activeTool={activeTool}
            canvasState={canvasState}
            onTilesChange={setTiles}
            onSelectionChange={setSelectedTileId}
            onCanvasStateChange={setCanvasState}
            onDropComponent={handleDropComponent}
          />
        </div>

        <ComponentLibrary
          components={components}
          onCreateNew={() => setIsEditorOpen(true)}
          onDeleteComponent={handleDeleteComponent}
          onDragStart={handleDragStart}
          onEditVariations={handleEditVariations}
          onUpdateComponent={handleUpdateComponent}
        />
      </div>

      <StatusBar
        canvasState={canvasState}
        shapeCount={tiles.length}
        selectedShape={selectedTileId}
      />

      <ComponentEditorDialog
        open={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onSave={handleSaveComponent}
        tileSize={canvasState.gridSize}
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
