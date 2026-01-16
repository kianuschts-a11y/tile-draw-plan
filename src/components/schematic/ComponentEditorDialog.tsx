import { useState } from "react";
import { Shape, ShapeType } from "@/types/schematic";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToolButton } from "./ToolButton";
import { ShapeRenderer } from "./ShapeRenderer";
import { Square, Circle, Minus, Triangle, Diamond, Trash2, MousePointer2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface ComponentEditorDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (name: string, shapes: Shape[]) => void;
  tileSize: number;
}

type EditorTool = 'select' | ShapeType;

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function ComponentEditorDialog({ open, onClose, onSave, tileSize }: ComponentEditorDialogProps) {
  const [name, setName] = useState("Neue Komponente");
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<EditorTool>('rectangle');
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [currentShape, setCurrentShape] = useState<Shape | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Canvas is always square, matching tileSize ratio
  const canvasSize = 200;
  const gridSize = canvasSize / 10; // 10x10 inner grid for precision

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
          ? { ...s, x: Math.max(0, Math.min(pos.x - dragOffset.x, canvasSize - s.width)), 
                   y: Math.max(0, Math.min(pos.y - dragOffset.y, canvasSize - s.height)) }
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

      // Clamp to canvas bounds
      width = Math.min(width, canvasSize - x);
      height = Math.min(height, canvasSize - y);

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
      setActiveTool('select');
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
    
    // Normalize shapes to 0-1 range (relative to canvas size)
    // They will be scaled to actual tileSize when rendered
    const normalizedShapes = shapes.map(s => ({
      ...s,
      x: s.x / canvasSize,
      y: s.y / canvasSize,
      width: s.width / canvasSize,
      height: s.height / canvasSize
    }));
    
    onSave(name, normalizedShapes);
    handleClose();
  };

  const handleClose = () => {
    setShapes([]);
    setSelectedShapeId(null);
    setActiveTool('rectangle');
    setName("Neue Komponente");
    onClose();
  };

  const getCursor = () => {
    if (activeTool === 'select') return isDragging ? 'grabbing' : 'default';
    return 'crosshair';
  };

  const selectedShape = shapes.find(s => s.id === selectedShapeId);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg">
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

            {/* Drawing canvas - always square */}
            <div className="flex-1 flex flex-col items-center">
              <svg
                width={canvasSize}
                height={canvasSize}
                className="border-2 border-dashed border-primary/30 rounded-lg bg-white"
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
                  <g key={shape.id} onMouseDown={(e) => handleShapeMouseDown(e, shape)}>
                    <ShapeRenderer
                      shape={shape}
                      isSelected={shape.id === selectedShapeId}
                    />
                  </g>
                ))}

                {currentShape && <ShapeRenderer shape={currentShape} />}

                {/* Selection box */}
                {selectedShape && (
                  <rect
                    x={selectedShape.x - 2}
                    y={selectedShape.y - 2}
                    width={selectedShape.width + 4}
                    height={selectedShape.height + 4}
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    strokeDasharray="4 2"
                    rx={2}
                  />
                )}
              </svg>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Quadratische Kachel ({tileSize}×{tileSize} px)
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
