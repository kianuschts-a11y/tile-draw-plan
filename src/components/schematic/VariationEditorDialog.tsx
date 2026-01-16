import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Component, ComponentVariation, ConnectionDirection, Shape, TILE_SIZES } from "@/types/schematic";
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
  Plus,
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
function generateConnectionShapes(
  type: ConnectionDirection, 
  componentShapes: Shape[], 
  tileWidth: number, // in grid cells
  tileHeight: number // in grid cells
): Shape[] {
  const bounds = getComponentBounds(componentShapes);
  const stroke = "#000000"; // Black lines
  
  // For multi-cell tiles, calculate connection positions
  // Left/Right: connections per row (tileHeight positions)
  // Top/Bottom: connections per column (tileWidth positions)
  
  const leftRightConnections = tileHeight; // 3 for 3x2 tile
  const topBottomConnections = tileWidth;  // 2 for 3x2 tile
  
  switch (type) {
    case 'left': {
      const shapes: Shape[] = [];
      for (let i = 0; i < leftRightConnections; i++) {
        // Calculate Y position for each row (centered in each row cell)
        const rowHeight = 1 / leftRightConnections;
        const yCenter = rowHeight * i + rowHeight / 2;
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
        const rowHeight = 1 / leftRightConnections;
        const yCenter = rowHeight * i + rowHeight / 2;
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
        const colWidth = 1 / topBottomConnections;
        const xCenter = colWidth * i + colWidth / 2;
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
        const colWidth = 1 / topBottomConnections;
        const xCenter = colWidth * i + colWidth / 2;
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
      // Left and right connections
      const shapes: Shape[] = [];
      for (let i = 0; i < leftRightConnections; i++) {
        const rowHeight = 1 / leftRightConnections;
        const yCenter = rowHeight * i + rowHeight / 2;
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
      // Top and bottom connections
      const shapes: Shape[] = [];
      for (let i = 0; i < topBottomConnections; i++) {
        const colWidth = 1 / topBottomConnections;
        const xCenter = colWidth * i + colWidth / 2;
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
        { id: generateId(), type: 'line', x: 0, y: 0.5 / leftRightConnections, width: bounds.minX, height: 0, strokeWidth: 2, stroke },
        { id: generateId(), type: 'line', x: 0.5 / topBottomConnections, y: 0, width: 0, height: bounds.minY, strokeWidth: 2, stroke }
      ];
    case 'corner-tr':
      return [
        { id: generateId(), type: 'line', x: bounds.maxX, y: 0.5 / leftRightConnections, width: 1 - bounds.maxX, height: 0, strokeWidth: 2, stroke },
        { id: generateId(), type: 'line', x: (topBottomConnections - 0.5) / topBottomConnections, y: 0, width: 0, height: bounds.minY, strokeWidth: 2, stroke }
      ];
    case 'corner-bl':
      return [
        { id: generateId(), type: 'line', x: 0, y: (leftRightConnections - 0.5) / leftRightConnections, width: bounds.minX, height: 0, strokeWidth: 2, stroke },
        { id: generateId(), type: 'line', x: 0.5 / topBottomConnections, y: bounds.maxY, width: 0, height: 1 - bounds.maxY, strokeWidth: 2, stroke }
      ];
    case 'corner-br':
      return [
        { id: generateId(), type: 'line', x: bounds.maxX, y: (leftRightConnections - 0.5) / leftRightConnections, width: 1 - bounds.maxX, height: 0, strokeWidth: 2, stroke },
        { id: generateId(), type: 'line', x: (topBottomConnections - 0.5) / topBottomConnections, y: bounds.maxY, width: 0, height: 1 - bounds.maxY, strokeWidth: 2, stroke }
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

  const previewSize = 120;

  // Render component shapes
  const renderShape = (shape: Shape, scale: number) => {
    const x = shape.x * scale;
    const y = shape.y * scale;
    const width = shape.width * scale;
    const height = shape.height * scale;
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
      <DialogContent className="max-w-4xl h-[80vh]">
        <DialogHeader>
          <DialogTitle>Varianten für "{component.name}"</DialogTitle>
        </DialogHeader>

        <div className="flex gap-4 h-full overflow-hidden">
          {/* Left panel - Connection types */}
          <div className="w-64 flex flex-col gap-3">
            <Label className="text-sm font-medium">Verbindungstyp hinzufügen</Label>
            <ScrollArea className="flex-1">
              <div className="grid grid-cols-2 gap-2 pr-2">
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
            </ScrollArea>
          </div>

          <Separator orientation="vertical" />

          {/* Right panel - Preview and list */}
          <div className="flex-1 flex flex-col gap-4">
            {/* Base component preview */}
            <div className="flex items-center gap-4">
              <div className="text-sm font-medium">Basis-Komponente:</div>
              <div 
                className="border rounded bg-white"
                style={{ width: previewSize, height: previewSize }}
              >
                <svg width={previewSize} height={previewSize} viewBox={`0 0 ${previewSize} ${previewSize}`}>
                  <rect 
                    width={previewSize} 
                    height={previewSize} 
                    fill="white" 
                    stroke="hsl(var(--border))" 
                    strokeWidth={1}
                  />
                  {component.shapes.map(shape => renderShape(shape, previewSize))}
                </svg>
              </div>
            </div>

            <Separator />

            {/* Variations list */}
            <Label className="text-sm font-medium">
              Erstellte Varianten ({variations.length})
            </Label>
            <ScrollArea className="flex-1">
              <div className="grid grid-cols-3 gap-3 pr-2">
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
                      style={{ width: '100%', aspectRatio: '1' }}
                    >
                      <svg width="100%" height="100%" viewBox={`0 0 ${previewSize} ${previewSize}`} preserveAspectRatio="xMidYMid meet">
                        {/* Grid background */}
                        <rect width={previewSize} height={previewSize} fill="white" />
                        {/* Base component shapes */}
                        {component.shapes.map(shape => renderShape(shape, previewSize))}
                        {/* Variation connection lines */}
                        <g>
                          {variation.shapes.map(shape => (
                            <line
                              key={shape.id}
                              x1={shape.x * previewSize}
                              y1={shape.y * previewSize}
                              x2={(shape.x + shape.width) * previewSize}
                              y2={(shape.y + shape.height) * previewSize}
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
            </ScrollArea>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
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
