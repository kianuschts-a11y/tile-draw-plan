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

// Generate the connection line shapes based on type
function generateConnectionShapes(type: ConnectionDirection): Shape[] {
  const strokeWidth = 0.04; // 4% of tile
  
  switch (type) {
    case 'left':
      return [{ id: generateId(), type: 'line', x: 0, y: 0.5, width: 0.5, height: 0, strokeWidth: 2 }];
    case 'right':
      return [{ id: generateId(), type: 'line', x: 0.5, y: 0.5, width: 0.5, height: 0, strokeWidth: 2 }];
    case 'top':
      return [{ id: generateId(), type: 'line', x: 0.5, y: 0, width: 0, height: 0.5, strokeWidth: 2 }];
    case 'bottom':
      return [{ id: generateId(), type: 'line', x: 0.5, y: 0.5, width: 0, height: 0.5, strokeWidth: 2 }];
    case 'horizontal':
      return [{ id: generateId(), type: 'line', x: 0, y: 0.5, width: 1, height: 0, strokeWidth: 2 }];
    case 'vertical':
      return [{ id: generateId(), type: 'line', x: 0.5, y: 0, width: 0, height: 1, strokeWidth: 2 }];
    case 'corner-tl':
      return [
        { id: generateId(), type: 'line', x: 0, y: 0.5, width: 0.5, height: 0, strokeWidth: 2 },
        { id: generateId(), type: 'line', x: 0.5, y: 0, width: 0, height: 0.5, strokeWidth: 2 }
      ];
    case 'corner-tr':
      return [
        { id: generateId(), type: 'line', x: 0.5, y: 0.5, width: 0.5, height: 0, strokeWidth: 2 },
        { id: generateId(), type: 'line', x: 0.5, y: 0, width: 0, height: 0.5, strokeWidth: 2 }
      ];
    case 'corner-bl':
      return [
        { id: generateId(), type: 'line', x: 0, y: 0.5, width: 0.5, height: 0, strokeWidth: 2 },
        { id: generateId(), type: 'line', x: 0.5, y: 0.5, width: 0, height: 0.5, strokeWidth: 2 }
      ];
    case 'corner-br':
      return [
        { id: generateId(), type: 'line', x: 0.5, y: 0.5, width: 0.5, height: 0, strokeWidth: 2 },
        { id: generateId(), type: 'line', x: 0.5, y: 0.5, width: 0, height: 0.5, strokeWidth: 2 }
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

  const handleAddVariation = useCallback((type: ConnectionDirection) => {
    const label = CONNECTION_TYPES.find(c => c.type === type)?.label || type;
    const newVariation: ComponentVariation = {
      id: generateId(),
      name: label,
      connectionType: type,
      shapes: generateConnectionShapes(type)
    };
    setVariations(prev => [...prev, newVariation]);
    setSelectedVariationId(newVariation.id);
  }, []);

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
                        <g className="text-blue-500">
                          {variation.shapes.map(shape => (
                            <line
                              key={shape.id}
                              x1={shape.x * previewSize}
                              y1={shape.y * previewSize}
                              x2={(shape.x + shape.width) * previewSize}
                              y2={(shape.y + shape.height) * previewSize}
                              stroke="hsl(var(--primary))"
                              strokeWidth={2}
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
