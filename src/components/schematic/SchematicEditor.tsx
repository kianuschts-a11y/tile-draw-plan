import { useState, useCallback, useEffect } from "react";
import { Shape, CanvasState, Component, PaperFormat, Orientation } from "@/types/schematic";
import { Toolbar } from "./Toolbar";
import { Canvas, PlacedTileType } from "./Canvas";
import { ComponentLibrary } from "./ComponentLibrary";
import { StatusBar } from "./StatusBar";
import { PaperSettings } from "./PaperSettings";
import { ComponentEditorDialog } from "./ComponentEditorDialog";

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

// Default components
const defaultComponents: Component[] = [
  {
    id: 'default-rect',
    name: 'Rechteck',
    width: 60,
    height: 40,
    shapes: [{ id: '1', type: 'rectangle', x: 0, y: 0, width: 60, height: 40, strokeWidth: 2 }]
  },
  {
    id: 'default-circle',
    name: 'Kreis',
    width: 40,
    height: 40,
    shapes: [{ id: '1', type: 'circle', x: 0, y: 0, width: 40, height: 40, strokeWidth: 2 }]
  },
  {
    id: 'default-valve',
    name: 'Ventil',
    width: 40,
    height: 30,
    shapes: [
      { id: '1', type: 'triangle', x: 0, y: 0, width: 20, height: 30, strokeWidth: 2 },
      { id: '2', type: 'triangle', x: 20, y: 0, width: 20, height: 30, strokeWidth: 2 }
    ]
  },
  {
    id: 'default-pump',
    name: 'Pumpe',
    width: 50,
    height: 50,
    shapes: [
      { id: '1', type: 'circle', x: 5, y: 5, width: 40, height: 40, strokeWidth: 2 },
      { id: '2', type: 'triangle', x: 20, y: 0, width: 10, height: 10, strokeWidth: 2 }
    ]
  },
  {
    id: 'default-tank',
    name: 'Tank',
    width: 60,
    height: 80,
    shapes: [
      { id: '1', type: 'rectangle', x: 0, y: 10, width: 60, height: 60, strokeWidth: 2 },
      { id: '2', type: 'ellipse', x: 0, y: 0, width: 60, height: 20, strokeWidth: 2 },
      { id: '3', type: 'ellipse', x: 0, y: 60, width: 60, height: 20, strokeWidth: 2 }
    ]
  },
  {
    id: 'default-motor',
    name: 'Motor',
    width: 60,
    height: 40,
    shapes: [
      { id: '1', type: 'circle', x: 10, y: 0, width: 40, height: 40, strokeWidth: 2 },
      { id: '2', type: 'rectangle', x: 0, y: 15, width: 12, height: 10, strokeWidth: 2 },
      { id: '3', type: 'rectangle', x: 48, y: 15, width: 12, height: 10, strokeWidth: 2 }
    ]
  }
];

export function SchematicEditor() {
  const [tiles, setTiles] = useState<PlacedTileType[]>([]);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<'select' | 'pan'>('select');
  const [components, setComponents] = useState<Component[]>(defaultComponents);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [canvasState, setCanvasState] = useState<CanvasState>({
    zoom: 1,
    panX: 50,
    panY: 50,
    gridSize: 20,
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

  const handleDropComponent = useCallback((component: Component, x: number, y: number) => {
    const newTile: PlacedTileType = {
      id: generateId(),
      component,
      x,
      y
    };
    setTiles(prev => [...prev, newTile]);
    setSelectedTileId(newTile.id);
  }, []);

  const handleSaveComponent = useCallback((name: string, shapes: Shape[], width: number, height: number) => {
    const newComponent: Component = {
      id: generateId(),
      name,
      shapes,
      width,
      height
    };
    setComponents(prev => [...prev, newComponent]);
  }, []);

  const handleDeleteComponent = useCallback((id: string) => {
    setComponents(prev => prev.filter(c => c.id !== id));
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
      />
    </div>
  );
}
