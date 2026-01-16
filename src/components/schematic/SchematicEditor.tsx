import { useState, useCallback } from "react";
import { Shape, ToolType, CanvasState, Component, ShapeType } from "@/types/schematic";
import { Toolbar } from "./Toolbar";
import { Canvas } from "./Canvas";
import { ComponentLibrary } from "./ComponentLibrary";
import { StatusBar } from "./StatusBar";

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function SchematicEditor() {
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [canvasState, setCanvasState] = useState<CanvasState>({
    zoom: 1,
    panX: 0,
    panY: 0,
    gridSize: 20
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
      panX: 0,
      panY: 0
    }));
  }, []);

  const handleDelete = useCallback(() => {
    if (selectedShapeId) {
      setShapes(prev => prev.filter(s => s.id !== selectedShapeId));
      setSelectedShapeId(null);
    }
  }, [selectedShapeId]);

  const handleComponentDragStart = useCallback((component: Component) => {
    // Component drag is handled by the library
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    // Handle component drop - add shapes to canvas
  }, []);

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
        <div className="flex-1" />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">V</kbd>
          <span>Auswählen</span>
          <span className="mx-2">•</span>
          <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">H</kbd>
          <span>Verschieben</span>
          <span className="mx-2">•</span>
          <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">R</kbd>
          <span>Rechteck</span>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left toolbar */}
        <Toolbar
          activeTool={activeTool}
          onToolChange={setActiveTool}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetView={handleResetView}
          onDelete={handleDelete}
          hasSelection={!!selectedShapeId}
        />

        {/* Canvas */}
        <div className="flex-1 overflow-hidden" onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
          <Canvas
            shapes={shapes}
            selectedShapeId={selectedShapeId}
            activeTool={activeTool}
            canvasState={canvasState}
            onShapesChange={setShapes}
            onSelectionChange={setSelectedShapeId}
            onCanvasStateChange={setCanvasState}
          />
        </div>

        {/* Right panel - Component Library */}
        <ComponentLibrary onDragStart={handleComponentDragStart} />
      </div>

      {/* Status bar */}
      <StatusBar
        canvasState={canvasState}
        shapeCount={shapes.length}
        selectedShape={selectedShapeId}
      />
    </div>
  );
}
