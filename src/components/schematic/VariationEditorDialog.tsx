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

// Extended connection type that includes row/column indices
interface ExtendedConnectionType {
  id: string;
  label: string;
  icon: React.ReactNode;
  side: 'left' | 'right' | 'top' | 'bottom';
  indices: number[]; // Which rows (for left/right) or columns (for top/bottom) to connect
}

// Generate all possible combinations for a given count
function getAllCombinations(count: number): number[][] {
  const combinations: number[][] = [];
  // Generate all subsets (2^n - 1, excluding empty set)
  for (let mask = 1; mask < Math.pow(2, count); mask++) {
    const combo: number[] = [];
    for (let i = 0; i < count; i++) {
      if (mask & (1 << i)) {
        combo.push(i);
      }
    }
    combinations.push(combo);
  }
  return combinations;
}

// Generate connection types based on tile dimensions
function generateConnectionTypes(tileWidth: number, tileHeight: number): ExtendedConnectionType[] {
  const types: ExtendedConnectionType[] = [];
  
  // For left and right sides (based on rows/height)
  const rowCombos = getAllCombinations(tileHeight);
  
  rowCombos.forEach(indices => {
    const label = indices.length === tileHeight 
      ? 'Alle' 
      : indices.map(i => `R${i + 1}`).join('+');
    
    // Left
    types.push({
      id: `left-${indices.join('-')}`,
      label: `Links ${label}`,
      icon: <ArrowLeft size={16} />,
      side: 'left',
      indices
    });
    
    // Right
    types.push({
      id: `right-${indices.join('-')}`,
      label: `Rechts ${label}`,
      icon: <ArrowRight size={16} />,
      side: 'right',
      indices
    });
  });
  
  // For top and bottom sides (based on columns/width)
  const colCombos = getAllCombinations(tileWidth);
  
  colCombos.forEach(indices => {
    const label = indices.length === tileWidth 
      ? 'Alle' 
      : indices.map(i => `S${i + 1}`).join('+');
    
    // Top
    types.push({
      id: `top-${indices.join('-')}`,
      label: `Oben ${label}`,
      icon: <ArrowUp size={16} />,
      side: 'top',
      indices
    });
    
    // Bottom
    types.push({
      id: `bottom-${indices.join('-')}`,
      label: `Unten ${label}`,
      icon: <ArrowDown size={16} />,
      side: 'bottom',
      indices
    });
  });
  
  return types;
}

// Generate horizontal (left+right) and vertical (top+bottom) through connections
function generateThroughConnectionTypes(tileWidth: number, tileHeight: number): ExtendedConnectionType[] {
  const types: ExtendedConnectionType[] = [];
  
  // Horizontal through connections (for each row combination)
  const rowCombos = getAllCombinations(tileHeight);
  rowCombos.forEach(indices => {
    const label = indices.length === tileHeight 
      ? 'Alle Reihen' 
      : indices.map(i => `R${i + 1}`).join('+');
    
    types.push({
      id: `horizontal-${indices.join('-')}`,
      label: `Horizontal ${label}`,
      icon: <ArrowLeftRight size={16} />,
      side: 'left', // Will be handled specially
      indices
    });
  });
  
  // Vertical through connections (for each column combination)
  const colCombos = getAllCombinations(tileWidth);
  colCombos.forEach(indices => {
    const label = indices.length === tileWidth 
      ? 'Alle Spalten' 
      : indices.map(i => `S${i + 1}`).join('+');
    
    types.push({
      id: `vertical-${indices.join('-')}`,
      label: `Vertikal ${label}`,
      icon: <ArrowUpDown size={16} />,
      side: 'top', // Will be handled specially
      indices
    });
  });
  
  return types;
}

// Corner connection types
function generateCornerTypes(): ExtendedConnectionType[] {
  return [
    { id: 'corner-tl', label: 'Ecke OL', icon: <CornerUpLeft size={16} />, side: 'left', indices: [0] },
    { id: 'corner-tr', label: 'Ecke OR', icon: <CornerUpRight size={16} />, side: 'right', indices: [0] },
    { id: 'corner-bl', label: 'Ecke UL', icon: <CornerDownLeft size={16} />, side: 'left', indices: [-1] },
    { id: 'corner-br', label: 'Ecke UR', icon: <CornerDownRight size={16} />, side: 'right', indices: [-1] },
  ];
}

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

// Generate connection shapes based on extended type
function generateConnectionShapesFromType(
  connectionType: ExtendedConnectionType,
  componentShapes: Shape[],
  tileWidth: number,
  tileHeight: number
): Shape[] {
  const bounds = getComponentBounds(componentShapes);
  const stroke = "#000000";
  
  const cellHeight = 1 / tileHeight;
  const cellWidth = 1 / tileWidth;
  
  const shapes: Shape[] = [];
  const isHorizontal = connectionType.id.startsWith('horizontal-');
  const isVertical = connectionType.id.startsWith('vertical-');
  const isCorner = connectionType.id.startsWith('corner-');
  
  if (isCorner) {
    // Handle corner types
    switch (connectionType.id) {
      case 'corner-tl':
        shapes.push(
          { id: generateId(), type: 'line', x: 0, y: cellHeight / 2, width: bounds.minX, height: 0, strokeWidth: 2, stroke },
          { id: generateId(), type: 'line', x: cellWidth / 2, y: 0, width: 0, height: bounds.minY, strokeWidth: 2, stroke }
        );
        break;
      case 'corner-tr':
        shapes.push(
          { id: generateId(), type: 'line', x: bounds.maxX, y: cellHeight / 2, width: 1 - bounds.maxX, height: 0, strokeWidth: 2, stroke },
          { id: generateId(), type: 'line', x: 1 - cellWidth / 2, y: 0, width: 0, height: bounds.minY, strokeWidth: 2, stroke }
        );
        break;
      case 'corner-bl':
        shapes.push(
          { id: generateId(), type: 'line', x: 0, y: 1 - cellHeight / 2, width: bounds.minX, height: 0, strokeWidth: 2, stroke },
          { id: generateId(), type: 'line', x: cellWidth / 2, y: bounds.maxY, width: 0, height: 1 - bounds.maxY, strokeWidth: 2, stroke }
        );
        break;
      case 'corner-br':
        shapes.push(
          { id: generateId(), type: 'line', x: bounds.maxX, y: 1 - cellHeight / 2, width: 1 - bounds.maxX, height: 0, strokeWidth: 2, stroke },
          { id: generateId(), type: 'line', x: 1 - cellWidth / 2, y: bounds.maxY, width: 0, height: 1 - bounds.maxY, strokeWidth: 2, stroke }
        );
        break;
    }
    return shapes;
  }
  
  if (isHorizontal) {
    // Horizontal through connection for specified rows
    connectionType.indices.forEach(rowIndex => {
      const yCenter = cellHeight * rowIndex + cellHeight / 2;
      // Left
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
      // Right
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
    });
    return shapes;
  }
  
  if (isVertical) {
    // Vertical through connection for specified columns
    connectionType.indices.forEach(colIndex => {
      const xCenter = cellWidth * colIndex + cellWidth / 2;
      // Top
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
      // Bottom
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
    });
    return shapes;
  }
  
  // Single side connections
  if (connectionType.side === 'left') {
    connectionType.indices.forEach(rowIndex => {
      const yCenter = cellHeight * rowIndex + cellHeight / 2;
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
    });
  } else if (connectionType.side === 'right') {
    connectionType.indices.forEach(rowIndex => {
      const yCenter = cellHeight * rowIndex + cellHeight / 2;
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
    });
  } else if (connectionType.side === 'top') {
    connectionType.indices.forEach(colIndex => {
      const xCenter = cellWidth * colIndex + cellWidth / 2;
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
    });
  } else if (connectionType.side === 'bottom') {
    connectionType.indices.forEach(colIndex => {
      const xCenter = cellWidth * colIndex + cellWidth / 2;
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
    });
  }
  
  return shapes;
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

  // Generate all connection types for this tile size
  const singleSideTypes = generateConnectionTypes(tileWidth, tileHeight);
  const throughTypes = generateThroughConnectionTypes(tileWidth, tileHeight);
  const cornerTypes = generateCornerTypes();
  const allConnectionTypes = [...singleSideTypes, ...throughTypes, ...cornerTypes];

  const handleAddVariation = useCallback((connectionType: ExtendedConnectionType) => {
    const newVariation: ComponentVariation = {
      id: generateId(),
      name: connectionType.label,
      connectionType: connectionType.id as ConnectionDirection,
      shapes: generateConnectionShapesFromType(connectionType, component.shapes, tileWidth, tileHeight)
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
              <Label className="text-sm font-medium">Einzelseiten</Label>
              <ScrollArea className="h-48">
                <div className="grid grid-cols-2 gap-1 pr-2">
                  {singleSideTypes.map((connType) => {
                    const exists = variations.some(v => v.connectionType === connType.id);
                    return (
                      <Button
                        key={connType.id}
                        variant={exists ? "secondary" : "outline"}
                        size="sm"
                        className="flex items-center gap-1 h-auto py-1 px-2 text-xs justify-start"
                        onClick={() => !exists && handleAddVariation(connType)}
                        disabled={exists}
                      >
                        {connType.icon}
                        <span className="truncate">{connType.label}</span>
                        {exists && <Check size={10} className="text-green-500 ml-auto" />}
                      </Button>
                    );
                  })}
                </div>
              </ScrollArea>
              
              <Separator />
              
              <Label className="text-sm font-medium">Durchverbindungen</Label>
              <ScrollArea className="h-32">
                <div className="grid grid-cols-2 gap-1 pr-2">
                  {throughTypes.map((connType) => {
                    const exists = variations.some(v => v.connectionType === connType.id);
                    return (
                      <Button
                        key={connType.id}
                        variant={exists ? "secondary" : "outline"}
                        size="sm"
                        className="flex items-center gap-1 h-auto py-1 px-2 text-xs justify-start"
                        onClick={() => !exists && handleAddVariation(connType)}
                        disabled={exists}
                      >
                        {connType.icon}
                        <span className="truncate">{connType.label}</span>
                        {exists && <Check size={10} className="text-green-500 ml-auto" />}
                      </Button>
                    );
                  })}
                </div>
              </ScrollArea>
              
              <Separator />
              
              <Label className="text-sm font-medium">Ecken</Label>
              <div className="grid grid-cols-2 gap-1">
                {cornerTypes.map((connType) => {
                  const exists = variations.some(v => v.connectionType === connType.id);
                  return (
                    <Button
                      key={connType.id}
                      variant={exists ? "secondary" : "outline"}
                      size="sm"
                      className="flex items-center gap-1 h-auto py-1 px-2 text-xs justify-start"
                      onClick={() => !exists && handleAddVariation(connType)}
                      disabled={exists}
                    >
                      {connType.icon}
                      <span className="truncate">{connType.label}</span>
                      {exists && <Check size={10} className="text-green-500 ml-auto" />}
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
