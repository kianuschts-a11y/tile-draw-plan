import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Component, ComponentVariation, ConnectionDirection, Shape } from "@/types/schematic";
import { 
  ArrowLeft, 
  ArrowRight, 
  ArrowUp, 
  ArrowDown, 
  ArrowLeftRight,
  ArrowUpDown,
  CornerDownRight,
  CornerUpRight,
  CornerDownLeft,
  CornerUpLeft,
  Trash2,
  Check
} from "lucide-react";

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

interface VariationEditorDialogProps {
  open: boolean;
  onClose: () => void;
  component: Component;
  onSave: (updatedComponent: Component) => void;
}

const CONNECTION_TYPES: { type: ConnectionDirection; label: string; icon: React.ReactNode }[] = [
  { type: 'left', label: 'Links', icon: <ArrowLeft size={18} /> },
  { type: 'right', label: 'Rechts', icon: <ArrowRight size={18} /> },
  { type: 'top', label: 'Oben', icon: <ArrowUp size={18} /> },
  { type: 'bottom', label: 'Unten', icon: <ArrowDown size={18} /> },
  { type: 'horizontal', label: 'Horizontal', icon: <ArrowLeftRight size={18} /> },
  { type: 'vertical', label: 'Vertikal', icon: <ArrowUpDown size={18} /> },
  { type: 'corner-tl', label: 'Ecke oben-links', icon: <CornerUpLeft size={18} /> },
  { type: 'corner-tr', label: 'Ecke oben-rechts', icon: <CornerUpRight size={18} /> },
  { type: 'corner-bl', label: 'Ecke unten-links', icon: <CornerDownLeft size={18} /> },
  { type: 'corner-br', label: 'Ecke unten-rechts', icon: <CornerDownRight size={18} /> },
];

// Calculate the bounding box of component shapes
function getComponentBounds(shapes: Shape[]): { minX: number; maxX: number; minY: number; maxY: number } {
  if (shapes.length === 0) {
    return { minX: 0.1, maxX: 0.9, minY: 0.1, maxY: 0.9 };
  }
  
  let minX = 1, maxX = 0, minY = 1, maxY = 0;
  
  for (const shape of shapes) {
    // Get shape bounds based on type
    const shapeMinX = shape.x;
    const shapeMaxX = shape.x + shape.width;
    const shapeMinY = shape.y;
    const shapeMaxY = shape.y + shape.height;
    
    minX = Math.min(minX, shapeMinX);
    maxX = Math.max(maxX, shapeMaxX);
    minY = Math.min(minY, shapeMinY);
    maxY = Math.max(maxY, shapeMaxY);
  }
  
  return { minX, maxX, minY, maxY };
}

// Generate connection shapes based on type, component bounds, and tile size
// For 3x2 tiles (3 high, 2 wide): left/right get 3 connections, top/bottom get 2
// Coordinates are normalized: x is 0-1 across width, y is 0-1 across height
// For 3x2: each row is 1/3 of height, each column is 1/2 of width
function generateConnectionShapes(
  type: ConnectionDirection, 
  componentShapes: Shape[], 
  tileWidth: number, // in grid cells (e.g., 2 for 3x2)
  tileHeight: number // in grid cells (e.g., 3 for 3x2)
): Shape[] {
  const bounds = getComponentBounds(componentShapes);
  const stroke = "#000000"; // Black lines
  
  // Number of connections on each side
  const leftRightConnections = tileHeight; // 3 for 3x2 tile (one per row)
  const topBottomConnections = tileWidth;  // 2 for 3x2 tile (one per column)
  
  // Cell dimensions in normalized coordinates
  const cellHeight = 1 / leftRightConnections; // height of one row
  const cellWidth = 1 / topBottomConnections;  // width of one column
  
  switch (type) {
    case 'left': {
      const shapes: Shape[] = [];
      for (let i = 0; i < leftRightConnections; i++) {
        // Y position: center of each row
        const yCenter = cellHeight * i + cellHeight / 2;
        shapes.push({
          id: generateId(),
          type: 'line',
          x: 0,
          y: yCenter,
          width: bounds.minX,
          height: 0,
          strokeWidth: 2,
          stroke
        });
      }
      return shapes;
    }
    case 'right': {
      const shapes: Shape[] = [];
      for (let i = 0; i < leftRightConnections; i++) {
        const yCenter = cellHeight * i + cellHeight / 2;
        shapes.push({
          id: generateId(),
          type: 'line',
          x: bounds.maxX,
          y: yCenter,
          width: 1 - bounds.maxX,
          height: 0,
          strokeWidth: 2,
          stroke
        });
      }
      return shapes;
    }
    case 'top': {
      const shapes: Shape[] = [];
      for (let i = 0; i < topBottomConnections; i++) {
        // X position: center of each column
        const xCenter = cellWidth * i + cellWidth / 2;
        shapes.push({
          id: generateId(),
          type: 'line',
          x: xCenter,
          y: 0,
          width: 0,
          height: bounds.minY,
          strokeWidth: 2,
          stroke
        });
      }
      return shapes;
    }
    case 'bottom': {
      const shapes: Shape[] = [];
      for (let i = 0; i < topBottomConnections; i++) {
        const xCenter = cellWidth * i + cellWidth / 2;
        shapes.push({
          id: generateId(),
          type: 'line',
          x: xCenter,
          y: bounds.maxY,
          width: 0,
          height: 1 - bounds.maxY,
          strokeWidth: 2,
          stroke
        });
      }
      return shapes;
    }
    case 'horizontal': {
      // Left and right connections for each row
      const shapes: Shape[] = [];
      for (let i = 0; i < leftRightConnections; i++) {
        const yCenter = cellHeight * i + cellHeight / 2;
        // Left connection
        shapes.push({
          id: generateId(),
          type: 'line',
          x: 0,
          y: yCenter,
          width: bounds.minX,
          height: 0,
          strokeWidth: 2,
          stroke
        });
        // Right connection
        shapes.push({
          id: generateId(),
          type: 'line',
          x: bounds.maxX,
          y: yCenter,
          width: 1 - bounds.maxX,
          height: 0,
          strokeWidth: 2,
          stroke
        });
      }
      return shapes;
    }
    case 'vertical': {
      // Top and bottom connections for each column
      const shapes: Shape[] = [];
      for (let i = 0; i < topBottomConnections; i++) {
        const xCenter = cellWidth * i + cellWidth / 2;
        // Top connection
        shapes.push({
          id: generateId(),
          type: 'line',
          x: xCenter,
          y: 0,
          width: 0,
          height: bounds.minY,
          strokeWidth: 2,
          stroke
        });
        // Bottom connection
        shapes.push({
          id: generateId(),
          type: 'line',
          x: xCenter,
          y: bounds.maxY,
          width: 0,
          height: 1 - bounds.maxY,
          strokeWidth: 2,
          stroke
        });
      }
      return shapes;
    }
    case 'corner-tl':
      return [
        // Left connection on first row
        { id: generateId(), type: 'line', x: 0, y: cellHeight / 2, width: bounds.minX, height: 0, strokeWidth: 2, stroke },
        // Top connection on first column
        { id: generateId(), type: 'line', x: cellWidth / 2, y: 0, width: 0, height: bounds.minY, strokeWidth: 2, stroke }
      ];
    case 'corner-tr':
      return [
        // Right connection on first row
        { id: generateId(), type: 'line', x: bounds.maxX, y: cellHeight / 2, width: 1 - bounds.maxX, height: 0, strokeWidth: 2, stroke },
        // Top connection on last column
        { id: generateId(), type: 'line', x: 1 - cellWidth / 2, y: 0, width: 0, height: bounds.minY, strokeWidth: 2, stroke }
      ];
    case 'corner-bl':
      return [
        // Left connection on last row
        { id: generateId(), type: 'line', x: 0, y: 1 - cellHeight / 2, width: bounds.minX, height: 0, strokeWidth: 2, stroke },
        // Bottom connection on first column
        { id: generateId(), type: 'line', x: cellWidth / 2, y: bounds.maxY, width: 0, height: 1 - bounds.maxY, strokeWidth: 2, stroke }
      ];
    case 'corner-br':
      return [
        // Right connection on last row
        { id: generateId(), type: 'line', x: bounds.maxX, y: 1 - cellHeight / 2, width: 1 - bounds.maxX, height: 0, strokeWidth: 2, stroke },
        // Bottom connection on last column
        { id: generateId(), type: 'line', x: 1 - cellWidth / 2, y: bounds.maxY, width: 0, height: 1 - bounds.maxY, strokeWidth: 2, stroke }
      ];
    default:
      return [];
  }
}

export function VariationEditorDialog({
  open,
  onClose,
  component,
  onSave
}: VariationEditorDialogProps) {
  const [variations, setVariations] = useState<ComponentVariation[]>(component.variations || []);
  const [selectedVariationId, setSelectedVariationId] = useState<string | null>(null);

  // Get tile dimensions
  const tileWidth = component.width || 1;
  const tileHeight = component.height || 1;

  const handleAddVariation = useCallback((type: ConnectionDirection) => {
    const label = CONNECTION_TYPES.find(c => c.type === type)?.label || type;
    const newVariation: ComponentVariation = {
      id: generateId(),
      name: label,
      connectionType: type,
      shapes: generateConnectionShapes(type, component.shapes, tileWidth, tileHeight)
    };
    setVariations(prev => [...prev, newVariation]);
    setSelectedVariationId(newVariation.id);
  }, [component.shapes, tileWidth, tileHeight]);

  const handleDeleteVariation = useCallback((id: string) => {
    setVariations(prev => prev.filter(v => v.id !== id));
    if (selectedVariationId === id) {
      setSelectedVariationId(null);
    }
  }, [selectedVariationId]);

  const handleSave = useCallback(() => {
    onSave({
      ...component,
      variations
    });
    onClose();
  }, [component, variations, onSave, onClose]);

  const previewBaseSize = 100;
  // For 3x2 tiles: width is 2 cells, height is 3 cells
  // Preview should maintain the aspect ratio
  const previewWidth = previewBaseSize * tileWidth;
  const previewHeight = previewBaseSize * tileHeight;

  // Render component shapes with separate scaleX and scaleY
  const renderShape = (shape: Shape, scaleX: number, scaleY: number) => {
    const x = shape.x * scaleX;
    const y = shape.y * scaleY;
    const width = shape.width * scaleX;
    const height = shape.height * scaleY;
    const strokeWidth = (shape.strokeWidth || 2);

    switch (shape.type) {
      case 'rectangle':
        return (
          <rect
            key={shape.id}
            x={x}
            y={y}
            width={width}
            height={height}
            fill={shape.fill || "none"}
            stroke={shape.stroke || "hsl(var(--foreground))"}
            strokeWidth={strokeWidth}
          />
        );
      case 'circle':
      case 'ellipse':
        return (
          <ellipse
            key={shape.id}
            cx={x + width / 2}
            cy={y + height / 2}
            rx={width / 2}
            ry={height / 2}
            fill={shape.fill || "none"}
            stroke={shape.stroke || "hsl(var(--foreground))"}
            strokeWidth={strokeWidth}
          />
        );
      case 'line':
        return (
          <line
            key={shape.id}
            x1={x}
            y1={y}
            x2={x + width}
            y2={y + height}
            stroke={shape.stroke || "hsl(var(--foreground))"}
            strokeWidth={strokeWidth}
          />
        );
      case 'triangle':
        const triPoints = `${x + width / 2},${y} ${x + width},${y + height} ${x},${y + height}`;
        return (
          <polygon
            key={shape.id}
            points={triPoints}
            fill={shape.fill || "none"}
            stroke={shape.stroke || "hsl(var(--foreground))"}
            strokeWidth={strokeWidth}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Varianten für "{component.name}"</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          <div className="flex gap-4">
            {/* Left panel - Connection types */}
            <div className="w-64 flex-shrink-0 space-y-3">
              <Label className="text-sm font-medium">Verbindungstyp hinzufügen</Label>
              <div className="grid grid-cols-2 gap-2">
                {CONNECTION_TYPES.map(({ type, label, icon }) => {
                  const exists = variations.some(v => v.connectionType === type);
                  return (
                    <Button
                      key={type}
                      variant={exists ? "secondary" : "outline"}
                      size="sm"
                      className="flex flex-col gap-1 h-auto py-2"
                      onClick={() => !exists && handleAddVariation(type)}
                      disabled={exists}
                    >
                      {icon}
                      <span className="text-xs">{label}</span>
                      {exists && <Check size={12} className="text-green-500" />}
                    </Button>
                  );
                })}
              </div>
            </div>

            <Separator orientation="vertical" className="h-auto" />

            {/* Right panel - Preview and list */}
            <div className="flex-1 space-y-4">
              {/* Base component preview */}
              <div className="flex items-start gap-4">
                <div className="text-sm font-medium">Basis-Komponente ({tileWidth}x{tileHeight}):</div>
                <div 
                  className="border rounded bg-white flex-shrink-0"
                  style={{ width: previewWidth, height: previewHeight }}
                >
                  <svg width={previewWidth} height={previewHeight} viewBox={`0 0 ${previewWidth} ${previewHeight}`}>
                    <rect 
                      width={previewWidth} 
                      height={previewHeight} 
                      fill="white" 
                      stroke="hsl(var(--border))" 
                      strokeWidth={1}
                    />
                    {/* Grid lines for multi-cell tiles */}
                    {tileHeight > 1 && Array.from({ length: tileHeight - 1 }).map((_, i) => (
                      <line 
                        key={`h-${i}`} 
                        x1={0} 
                        y1={(i + 1) * previewBaseSize} 
                        x2={previewWidth} 
                        y2={(i + 1) * previewBaseSize} 
                        stroke="hsl(var(--border))" 
                        strokeWidth={0.5} 
                        strokeDasharray="4 2"
                      />
                    ))}
                    {tileWidth > 1 && Array.from({ length: tileWidth - 1 }).map((_, i) => (
                      <line 
                        key={`v-${i}`} 
                        x1={(i + 1) * previewBaseSize} 
                        y1={0} 
                        x2={(i + 1) * previewBaseSize} 
                        y2={previewHeight} 
                        stroke="hsl(var(--border))" 
                        strokeWidth={0.5} 
                        strokeDasharray="4 2"
                      />
                    ))}
                    {component.shapes.map(shape => renderShape(shape, previewWidth, previewHeight))}
                  </svg>
                </div>
              </div>

              <Separator />

              {/* Variations list */}
              <Label className="text-sm font-medium">
                Erstellte Varianten ({variations.length})
              </Label>
              <div className="grid grid-cols-3 gap-3 pb-4">
                {variations.map(variation => (
                  <div
                    key={variation.id}
                    className={`relative border rounded-lg p-2 cursor-pointer transition-colors ${
                      selectedVariationId === variation.id 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => setSelectedVariationId(variation.id)}
                  >
                    <div className="text-xs font-medium mb-1 truncate">{variation.name}</div>
                    <div 
                      className="bg-white border rounded"
                      style={{ width: '100%', aspectRatio: `${tileWidth}/${tileHeight}` }}
                    >
                      <svg width="100%" height="100%" viewBox={`0 0 ${previewWidth} ${previewHeight}`} preserveAspectRatio="xMidYMid meet">
                        {/* Grid background */}
                        <rect width={previewWidth} height={previewHeight} fill="white" />
                        {/* Grid lines for multi-cell tiles */}
                        {tileHeight > 1 && Array.from({ length: tileHeight - 1 }).map((_, i) => (
                          <line 
                            key={`h-${i}`} 
                            x1={0} 
                            y1={(i + 1) * previewBaseSize} 
                            x2={previewWidth} 
                            y2={(i + 1) * previewBaseSize} 
                            stroke="hsl(var(--border))" 
                            strokeWidth={0.5} 
                            strokeDasharray="4 2"
                          />
                        ))}
                        {tileWidth > 1 && Array.from({ length: tileWidth - 1 }).map((_, i) => (
                          <line 
                            key={`v-${i}`} 
                            x1={(i + 1) * previewBaseSize} 
                            y1={0} 
                            x2={(i + 1) * previewBaseSize} 
                            y2={previewHeight} 
                            stroke="hsl(var(--border))" 
                            strokeWidth={0.5} 
                            strokeDasharray="4 2"
                          />
                        ))}
                        {/* Base component shapes */}
                        {component.shapes.map(shape => renderShape(shape, previewWidth, previewHeight))}
                        {/* Variation connection lines */}
                        <g>
                          {variation.shapes.map(shape => (
                            <line
                              key={shape.id}
                              x1={shape.x * previewWidth}
                              y1={shape.y * previewHeight}
                              x2={(shape.x + shape.width) * previewWidth}
                              y2={(shape.y + shape.height) * previewHeight}
                              stroke={shape.stroke || "#000000"}
                              strokeWidth={shape.strokeWidth || 2}
                            />
                          ))}
                        </g>
                      </svg>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6 opacity-50 hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteVariation(variation.id);
                      }}
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                ))}
                {variations.length === 0 && (
                  <div className="col-span-3 text-center py-8 text-muted-foreground">
                    Noch keine Varianten erstellt.<br />
                    Wähle links einen Verbindungstyp aus.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t flex-shrink-0">
          <Button variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button onClick={handleSave}>
            Speichern
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
