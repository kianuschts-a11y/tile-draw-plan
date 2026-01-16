import { useState } from "react";
import { Shape, ShapeType } from "@/types/schematic";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToolButton } from "./ToolButton";
import { ShapeRenderer } from "./ShapeRenderer";
import { SelectionHandles } from "./SelectionHandles";
import { Square, Circle, Minus, Triangle, Diamond, Trash2, MousePointer2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface ComponentEditorDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (name: string, shapes: Shape[], width: number, height: number) => void;
}

type EditorTool = 'select' | ShapeType;

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function ComponentEditorDialog({ open, onClose, onSave }: ComponentEditorDialogProps) {
  const [name, setName] = useState("Neue Komponente");
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<EditorTool>('select');
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [currentShape, setCurrentShape] = useState<Shape | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const canvasSize = 200;
  const gridSize = 10;

  const getMousePosition = (e: React.MouseEvent<SVGSVGElement>): { x: number; y: number } => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return {
      x: Math.round(x / gridSize) * gridSize,
      y: Math.round(y / gridSize) * gridSize
    };
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    const pos = getMousePosition(e);

    if (activeTool === 'select') {
      setSelectedShapeId(null);
      return;
    }

    if (['rectangle', 'circle', 'line', 'triangle', 'diamond'].includes(activeTool)) {
      setIsDrawing(true);
      setDrawStart(pos);
      const newShape: Shape = {
        id: generateId(),
        type: activeTool as ShapeType,
        x: pos.x,
        y: pos.y,
        width: 0,
        height: 0,
        strokeWidth: 2
      };
      setCurrentShape(newShape);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const pos = getMousePosition(e);

    if (isDragging && selectedShapeId) {
      setShapes(shapes.map(s =>
        s.id === selectedShapeId
          ? { ...s, x: pos.x - dragOffset.x, y: pos.y - dragOffset.y }
          : s
      ));
      return;
    }

    if (isDrawing && currentShape) {
      let width = pos.x - drawStart.x;
      let height = pos.y - drawStart.y;
      let x = drawStart.x;
      let y = drawStart.y;

      if (width < 0) { x = pos.x; width = Math.abs(width); }
      if (height < 0) { y = pos.y; height = Math.abs(height); }

      setCurrentShape({
        ...currentShape,
        x, y,
        width: Math.max(width, gridSize),
        height: Math.max(height, gridSize)
      });
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      return;
    }

    if (isDrawing && currentShape && currentShape.width > 0 && currentShape.height > 0) {
      setShapes([...shapes, currentShape]);
      setSelectedShapeId(currentShape.id);
    }
    setIsDrawing(false);
    setCurrentShape(null);
  };

  const handleShapeMouseDown = (e: React.MouseEvent, shape: Shape) => {
    if (activeTool !== 'select') return;
    e.stopPropagation();
    setSelectedShapeId(shape.id);
    const rect = (e.target as SVGElement).ownerSVGElement?.getBoundingClientRect();
    if (rect) {
      const x = Math.round((e.clientX - rect.left) / gridSize) * gridSize;
      const y = Math.round((e.clientY - rect.top) / gridSize) * gridSize;
      setDragOffset({ x: x - shape.x, y: y - shape.y });
      setIsDragging(true);
    }
  };

  const handleDelete = () => {
    if (selectedShapeId) {
      setShapes(shapes.filter(s => s.id !== selectedShapeId));
      setSelectedShapeId(null);
    }
  };

  const handleSave = () => {
    if (shapes.length === 0) return;
    
    // Calculate bounding box
    const minX = Math.min(...shapes.map(s => s.x));
    const minY = Math.min(...shapes.map(s => s.y));
    const maxX = Math.max(...shapes.map(s => s.x + s.width));
    const maxY = Math.max(...shapes.map(s => s.y + s.height));
    
    // Normalize shapes to start at 0,0
    const normalizedShapes = shapes.map(s => ({
      ...s,
      x: s.x - minX,
      y: s.y - minY
    }));
    
    onSave(name, normalizedShapes, maxX - minX, maxY - minY);
    handleClose();
  };

  const handleClose = () => {
    setShapes([]);
    setSelectedShapeId(null);
    setActiveTool('select');
    setName("Neue Komponente");
    onClose();
  };

  const getCursor = () => {
    if (activeTool === 'select') return isDragging ? 'grabbing' : 'default';
    return 'crosshair';
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Komponente erstellen</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="component-name">Name</Label>
            <Input
              id="component-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Komponentenname"
            />
          </div>

          <div className="flex gap-4">
            {/* Tool palette */}
            <div className="flex flex-col gap-1 p-2 rounded-lg bg-muted/50">
              <ToolButton
                icon={MousePointer2}
                label="Auswählen"
                shortcut="V"
                isActive={activeTool === 'select'}
                onClick={() => setActiveTool('select')}
              />
              <Separator className="my-1" />
              <ToolButton
                icon={Square}
                label="Rechteck"
                shortcut="R"
                isActive={activeTool === 'rectangle'}
                onClick={() => setActiveTool('rectangle')}
              />
              <ToolButton
                icon={Circle}
                label="Kreis"
                shortcut="C"
                isActive={activeTool === 'circle'}
                onClick={() => setActiveTool('circle')}
              />
              <ToolButton
                icon={Minus}
                label="Linie"
                shortcut="L"
                isActive={activeTool === 'line'}
                onClick={() => setActiveTool('line')}
              />
              <ToolButton
                icon={Triangle}
                label="Dreieck"
                shortcut="T"
                isActive={activeTool === 'triangle'}
                onClick={() => setActiveTool('triangle')}
              />
              <ToolButton
                icon={Diamond}
                label="Raute"
                shortcut="D"
                isActive={activeTool === 'diamond'}
                onClick={() => setActiveTool('diamond')}
              />
              {selectedShapeId && (
                <>
                  <Separator className="my-1" />
                  <ToolButton
                    icon={Trash2}
                    label="Löschen"
                    shortcut="Del"
                    onClick={handleDelete}
                  />
                </>
              )}
            </div>

            {/* Drawing canvas */}
            <div className="flex-1">
              <svg
                width={canvasSize}
                height={canvasSize}
                className="border rounded-lg bg-white"
                style={{ cursor: getCursor() }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                {/* Grid */}
                <defs>
                  <pattern id="editor-grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
                    <path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width={canvasSize} height={canvasSize} fill="url(#editor-grid)" />

                {/* Shapes */}
                {shapes.map(shape => (
                  <ShapeRenderer
                    key={shape.id}
                    shape={shape}
                    isSelected={shape.id === selectedShapeId}
                    onMouseDown={(e) => handleShapeMouseDown(e, shape)}
                  />
                ))}

                {currentShape && <ShapeRenderer shape={currentShape} />}

                {selectedShapeId && shapes.find(s => s.id === selectedShapeId) && (
                  <SelectionHandles shape={shapes.find(s => s.id === selectedShapeId)!} />
                )}
              </svg>
              <p className="text-xs text-muted-foreground mt-2">
                Zeichnen Sie Formen, um Ihre Komponente zu erstellen
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={shapes.length === 0}>
            Komponente speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
