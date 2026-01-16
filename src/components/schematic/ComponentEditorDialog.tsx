import { useState, useCallback, useRef, useEffect } from "react";
import { Shape, ShapeType, Point } from "@/types/schematic";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Slider } from "@/components/ui/slider";
import { 
  MousePointer2, Square, Circle, Minus, Triangle, Diamond, 
  Trash2, RotateCw, FlipHorizontal, FlipVertical, Copy, 
  Undo2, Redo2, Spline, Type, CircleDot, Plus, Pencil
} from "lucide-react";
import { cn } from "@/lib/utils";

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

interface ToolButtonProps {
  icon: React.ElementType;
  label: string;
  shortcut?: string;
  isActive?: boolean;
  onClick: () => void;
  disabled?: boolean;
}

function ToolBtn({ icon: Icon, label, shortcut, isActive, onClick, disabled }: ToolButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          disabled={disabled}
          className={cn(
            "w-8 h-8 rounded flex items-center justify-center transition-colors",
            isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground hover:text-foreground",
            disabled && "opacity-40 cursor-not-allowed"
          )}
        >
          <Icon className="w-4 h-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="flex items-center gap-2">
        <span>{label}</span>
        {shortcut && <kbd className="px-1 py-0.5 text-xs font-mono bg-muted rounded">{shortcut}</kbd>}
      </TooltipContent>
    </Tooltip>
  );
}

export function ComponentEditorDialog({ open, onClose, onSave, tileSize }: ComponentEditorDialogProps) {
  const [name, setName] = useState("Neue Komponente");
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selectedShapeIds, setSelectedShapeIds] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<EditorTool>('rectangle');
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [currentShape, setCurrentShape] = useState<Shape | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [history, setHistory] = useState<Shape[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [clipboard, setClipboard] = useState<Shape[]>([]);
  const [polylinePoints, setPolylinePoints] = useState<Point[]>([]);
  const [isDrawingPolyline, setIsDrawingPolyline] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [showTextInput, setShowTextInput] = useState(false);
  const [textPosition, setTextPosition] = useState({ x: 0, y: 0 });

  const canvasSize = 300;
  const gridSize = canvasSize / 20;

  const pushHistory = useCallback((newShapes: Shape[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newShapes);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setShapes(history[historyIndex - 1]);
      setSelectedShapeIds([]);
    }
  }, [historyIndex, history]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setShapes(history[historyIndex + 1]);
      setSelectedShapeIds([]);
    }
  }, [historyIndex, history]);

  const getMousePosition = (e: React.MouseEvent): Point => {
    const svg = (e.target as Element).closest('svg');
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
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
      setSelectedShapeIds([]);
      return;
    }

    if (activeTool === 'text') {
      setTextPosition(pos);
      setShowTextInput(true);
      return;
    }

    if (activeTool === 'polyline') {
      if (!isDrawingPolyline) {
        setIsDrawingPolyline(true);
        setPolylinePoints([pos]);
      } else {
        setPolylinePoints([...polylinePoints, pos]);
      }
      return;
    }

    if (['rectangle', 'circle', 'line', 'triangle', 'diamond', 'ellipse', 'arc'].includes(activeTool)) {
      setIsDrawing(true);
      setDrawStart(pos);
      const newShape: Shape = {
        id: generateId(),
        type: activeTool as ShapeType,
        x: pos.x,
        y: pos.y,
        width: 0,
        height: 0,
        strokeWidth,
        startAngle: activeTool === 'arc' ? 0 : undefined,
        endAngle: activeTool === 'arc' ? 180 : undefined
      };
      setCurrentShape(newShape);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const pos = getMousePosition(e);

    if (isDragging && selectedShapeIds.length > 0) {
      const dx = pos.x - dragOffset.x;
      const dy = pos.y - dragOffset.y;
      setShapes(shapes.map(s =>
        selectedShapeIds.includes(s.id)
          ? { ...s, x: Math.max(0, Math.min(s.x + dx, canvasSize - s.width)), 
                   y: Math.max(0, Math.min(s.y + dy, canvasSize - s.height)) }
          : s
      ));
      setDragOffset(pos);
      return;
    }

    if (isDrawing && currentShape) {
      let width = pos.x - drawStart.x;
      let height = pos.y - drawStart.y;
      let x = drawStart.x;
      let y = drawStart.y;

      if (width < 0) { x = pos.x; width = Math.abs(width); }
      if (height < 0) { y = pos.y; height = Math.abs(height); }

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
      pushHistory(shapes);
      return;
    }

    if (isDrawing && currentShape && currentShape.width > 0 && currentShape.height > 0) {
      const newShapes = [...shapes, currentShape];
      setShapes(newShapes);
      pushHistory(newShapes);
      setSelectedShapeIds([currentShape.id]);
    }
    setIsDrawing(false);
    setCurrentShape(null);
  };

  const handleDoubleClick = () => {
    if (activeTool === 'polyline' && isDrawingPolyline && polylinePoints.length >= 2) {
      const newShape: Shape = {
        id: generateId(),
        type: 'polyline',
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        points: polylinePoints,
        strokeWidth
      };
      const newShapes = [...shapes, newShape];
      setShapes(newShapes);
      pushHistory(newShapes);
      setPolylinePoints([]);
      setIsDrawingPolyline(false);
    }
  };

  const handleShapeMouseDown = (e: React.MouseEvent, shape: Shape) => {
    if (activeTool !== 'select') return;
    e.stopPropagation();
    
    const isMultiSelect = e.shiftKey || e.ctrlKey;
    if (isMultiSelect) {
      if (selectedShapeIds.includes(shape.id)) {
        setSelectedShapeIds(selectedShapeIds.filter(id => id !== shape.id));
      } else {
        setSelectedShapeIds([...selectedShapeIds, shape.id]);
      }
    } else {
      setSelectedShapeIds([shape.id]);
    }
    
    const pos = getMousePosition(e);
    setDragOffset(pos);
    setIsDragging(true);
  };

  const handleDelete = () => {
    if (selectedShapeIds.length > 0) {
      const newShapes = shapes.filter(s => !selectedShapeIds.includes(s.id));
      setShapes(newShapes);
      pushHistory(newShapes);
      setSelectedShapeIds([]);
    }
  };

  const handleCopy = () => {
    const selected = shapes.filter(s => selectedShapeIds.includes(s.id));
    setClipboard(selected);
  };

  const handlePaste = () => {
    if (clipboard.length > 0) {
      const offset = gridSize;
      const newShapes = clipboard.map(s => ({
        ...s,
        id: generateId(),
        x: s.x + offset,
        y: s.y + offset
      }));
      const updatedShapes = [...shapes, ...newShapes];
      setShapes(updatedShapes);
      pushHistory(updatedShapes);
      setSelectedShapeIds(newShapes.map(s => s.id));
    }
  };

  const handleDuplicate = () => {
    handleCopy();
    setTimeout(() => {
      const selected = shapes.filter(s => selectedShapeIds.includes(s.id));
      const offset = gridSize;
      const newShapes = selected.map(s => ({
        ...s,
        id: generateId(),
        x: Math.min(s.x + offset, canvasSize - s.width),
        y: Math.min(s.y + offset, canvasSize - s.height)
      }));
      const updatedShapes = [...shapes, ...newShapes];
      setShapes(updatedShapes);
      pushHistory(updatedShapes);
      setSelectedShapeIds(newShapes.map(s => s.id));
    }, 0);
  };

  const handleRotate = (angle: number) => {
    if (selectedShapeIds.length === 0) return;
    const newShapes = shapes.map(s =>
      selectedShapeIds.includes(s.id)
        ? { ...s, rotation: ((s.rotation || 0) + angle) % 360 }
        : s
    );
    setShapes(newShapes);
    pushHistory(newShapes);
  };

  const handleFlipH = () => {
    if (selectedShapeIds.length === 0) return;
    const newShapes = shapes.map(s => {
      if (!selectedShapeIds.includes(s.id)) return s;
      // Flip horizontally by mirroring x coordinates
      if (s.points) {
        const centerX = s.points.reduce((sum, p) => sum + p.x, 0) / s.points.length;
        return {
          ...s,
          points: s.points.map(p => ({ x: 2 * centerX - p.x, y: p.y }))
        };
      }
      return s;
    });
    setShapes(newShapes);
    pushHistory(newShapes);
  };

  const handleFlipV = () => {
    if (selectedShapeIds.length === 0) return;
    const newShapes = shapes.map(s => {
      if (!selectedShapeIds.includes(s.id)) return s;
      if (s.points) {
        const centerY = s.points.reduce((sum, p) => sum + p.y, 0) / s.points.length;
        return {
          ...s,
          points: s.points.map(p => ({ x: p.x, y: 2 * centerY - p.y }))
        };
      }
      return s;
    });
    setShapes(newShapes);
    pushHistory(newShapes);
  };

  const handleTextSubmit = () => {
    if (textInput.trim()) {
      const newShape: Shape = {
        id: generateId(),
        type: 'text',
        x: textPosition.x,
        y: textPosition.y,
        width: textInput.length * 8,
        height: 16,
        text: textInput,
        fontSize: 14,
        strokeWidth: 1
      };
      const newShapes = [...shapes, newShape];
      setShapes(newShapes);
      pushHistory(newShapes);
    }
    setTextInput("");
    setShowTextInput(false);
  };

  const handleSave = () => {
    if (shapes.length === 0) return;
    const normalizedShapes = shapes.map(s => ({
      ...s,
      x: s.x / canvasSize,
      y: s.y / canvasSize,
      width: s.width / canvasSize,
      height: s.height / canvasSize,
      points: s.points?.map(p => ({ x: p.x / canvasSize, y: p.y / canvasSize }))
    }));
    onSave(name, normalizedShapes);
    handleClose();
  };

  const handleClose = () => {
    setShapes([]);
    setSelectedShapeIds([]);
    setActiveTool('rectangle');
    setName("Neue Komponente");
    setHistory([[]]);
    setHistoryIndex(0);
    setClipboard([]);
    setPolylinePoints([]);
    setIsDrawingPolyline(false);
    onClose();
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'z':
            e.preventDefault();
            if (e.shiftKey) redo();
            else undo();
            break;
          case 'y':
            e.preventDefault();
            redo();
            break;
          case 'c':
            e.preventDefault();
            handleCopy();
            break;
          case 'v':
            e.preventDefault();
            handlePaste();
            break;
          case 'd':
            e.preventDefault();
            handleDuplicate();
            break;
        }
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'v': setActiveTool('select'); break;
        case 'r': setActiveTool('rectangle'); break;
        case 'c': setActiveTool('circle'); break;
        case 'l': setActiveTool('line'); break;
        case 't': setActiveTool('triangle'); break;
        case 'd': setActiveTool('diamond'); break;
        case 'p': setActiveTool('polyline'); break;
        case 'a': setActiveTool('arc'); break;
        case 'x': setActiveTool('text'); break;
        case 'delete':
        case 'backspace':
          handleDelete();
          break;
        case 'escape':
          if (isDrawingPolyline) {
            setPolylinePoints([]);
            setIsDrawingPolyline(false);
          } else {
            setSelectedShapeIds([]);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, selectedShapeIds, shapes, isDrawingPolyline, undo, redo]);

  const getCursor = () => {
    if (activeTool === 'select') return isDragging ? 'grabbing' : 'default';
    if (activeTool === 'text') return 'text';
    return 'crosshair';
  };

  const renderShape = (shape: Shape, isPreview = false) => {
    const isSelected = selectedShapeIds.includes(shape.id) && !isPreview;
    const stroke = isSelected ? "hsl(var(--primary))" : "hsl(220, 25%, 20%)";
    const sw = shape.strokeWidth || 2;
    const transform = shape.rotation ? `rotate(${shape.rotation} ${shape.x + shape.width/2} ${shape.y + shape.height/2})` : undefined;

    switch (shape.type) {
      case 'rectangle':
        return <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} fill="none" stroke={stroke} strokeWidth={sw} transform={transform} />;
      case 'circle':
      case 'ellipse':
        return <ellipse cx={shape.x + shape.width/2} cy={shape.y + shape.height/2} rx={shape.width/2} ry={shape.height/2} fill="none" stroke={stroke} strokeWidth={sw} transform={transform} />;
      case 'line':
        return <line x1={shape.x} y1={shape.y} x2={shape.x + shape.width} y2={shape.y + shape.height} stroke={stroke} strokeWidth={sw} />;
      case 'triangle':
        return <polygon points={`${shape.x + shape.width/2},${shape.y} ${shape.x},${shape.y + shape.height} ${shape.x + shape.width},${shape.y + shape.height}`} fill="none" stroke={stroke} strokeWidth={sw} transform={transform} />;
      case 'diamond':
        return <polygon points={`${shape.x + shape.width/2},${shape.y} ${shape.x + shape.width},${shape.y + shape.height/2} ${shape.x + shape.width/2},${shape.y + shape.height} ${shape.x},${shape.y + shape.height/2}`} fill="none" stroke={stroke} strokeWidth={sw} transform={transform} />;
      case 'polyline':
        if (!shape.points || shape.points.length < 2) return null;
        return <polyline points={shape.points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={stroke} strokeWidth={sw} />;
      case 'arc':
        const rx = shape.width / 2;
        const ry = shape.height / 2;
        const cx = shape.x + rx;
        const cy = shape.y + ry;
        const startRad = ((shape.startAngle || 0) * Math.PI) / 180;
        const endRad = ((shape.endAngle || 180) * Math.PI) / 180;
        const x1 = cx + rx * Math.cos(startRad);
        const y1 = cy + ry * Math.sin(startRad);
        const x2 = cx + rx * Math.cos(endRad);
        const y2 = cy + ry * Math.sin(endRad);
        const largeArc = (shape.endAngle || 180) - (shape.startAngle || 0) > 180 ? 1 : 0;
        return <path d={`M ${x1} ${y1} A ${rx} ${ry} 0 ${largeArc} 1 ${x2} ${y2}`} fill="none" stroke={stroke} strokeWidth={sw} />;
      case 'text':
        return <text x={shape.x} y={shape.y + (shape.fontSize || 14)} fontSize={shape.fontSize || 14} fill={stroke}>{shape.text}</text>;
      default:
        return null;
    }
  };

  const hasSelection = selectedShapeIds.length > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Komponente erstellen</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex gap-4 items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="component-name">Name</Label>
              <Input
                id="component-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Komponentenname"
              />
            </div>
            <div className="space-y-2">
              <Label>Strichstärke</Label>
              <div className="flex items-center gap-2 w-32">
                <Slider
                  value={[strokeWidth]}
                  onValueChange={([v]) => setStrokeWidth(v)}
                  min={1}
                  max={6}
                  step={0.5}
                />
                <span className="text-xs font-mono w-6">{strokeWidth}</span>
              </div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-1 p-2 bg-muted/50 rounded-lg flex-wrap">
            {/* Selection */}
            <ToolBtn icon={MousePointer2} label="Auswählen" shortcut="V" isActive={activeTool === 'select'} onClick={() => setActiveTool('select')} />
            
            <Separator orientation="vertical" className="h-6 mx-1" />
            
            {/* Shapes */}
            <ToolBtn icon={Square} label="Rechteck" shortcut="R" isActive={activeTool === 'rectangle'} onClick={() => setActiveTool('rectangle')} />
            <ToolBtn icon={Circle} label="Kreis/Ellipse" shortcut="C" isActive={activeTool === 'circle'} onClick={() => setActiveTool('circle')} />
            <ToolBtn icon={Minus} label="Linie" shortcut="L" isActive={activeTool === 'line'} onClick={() => setActiveTool('line')} />
            <ToolBtn icon={Triangle} label="Dreieck" shortcut="T" isActive={activeTool === 'triangle'} onClick={() => setActiveTool('triangle')} />
            <ToolBtn icon={Diamond} label="Raute" shortcut="D" isActive={activeTool === 'diamond'} onClick={() => setActiveTool('diamond')} />
            <ToolBtn icon={Spline} label="Polylinie" shortcut="P" isActive={activeTool === 'polyline'} onClick={() => setActiveTool('polyline')} />
            <ToolBtn icon={CircleDot} label="Bogen" shortcut="A" isActive={activeTool === 'arc'} onClick={() => setActiveTool('arc')} />
            <ToolBtn icon={Type} label="Text" shortcut="X" isActive={activeTool === 'text'} onClick={() => setActiveTool('text')} />
            
            <Separator orientation="vertical" className="h-6 mx-1" />
            
            {/* Edit */}
            <ToolBtn icon={Undo2} label="Rückgängig" shortcut="Ctrl+Z" onClick={undo} disabled={historyIndex <= 0} />
            <ToolBtn icon={Redo2} label="Wiederholen" shortcut="Ctrl+Y" onClick={redo} disabled={historyIndex >= history.length - 1} />
            
            <Separator orientation="vertical" className="h-6 mx-1" />
            
            {/* Transform */}
            <ToolBtn icon={Copy} label="Duplizieren" shortcut="Ctrl+D" onClick={handleDuplicate} disabled={!hasSelection} />
            <ToolBtn icon={RotateCw} label="90° drehen" onClick={() => handleRotate(90)} disabled={!hasSelection} />
            <ToolBtn icon={FlipHorizontal} label="Horizontal spiegeln" onClick={handleFlipH} disabled={!hasSelection} />
            <ToolBtn icon={FlipVertical} label="Vertikal spiegeln" onClick={handleFlipV} disabled={!hasSelection} />
            <ToolBtn icon={Trash2} label="Löschen" shortcut="Del" onClick={handleDelete} disabled={!hasSelection} />
          </div>

          {/* Canvas */}
          <div className="flex justify-center">
            <div className="relative">
              <svg
                width={canvasSize}
                height={canvasSize}
                className="border-2 border-dashed border-primary/30 rounded-lg bg-white"
                style={{ cursor: getCursor() }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onDoubleClick={handleDoubleClick}
              >
                {/* Grid */}
                <defs>
                  <pattern id="editor-grid-fine" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
                    <path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
                  </pattern>
                  <pattern id="editor-grid-major" width={gridSize * 5} height={gridSize * 5} patternUnits="userSpaceOnUse">
                    <rect width={gridSize * 5} height={gridSize * 5} fill="url(#editor-grid-fine)" />
                    <path d={`M ${gridSize * 5} 0 L 0 0 0 ${gridSize * 5}`} fill="none" stroke="#d1d5db" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width={canvasSize} height={canvasSize} fill="url(#editor-grid-major)" />

                {/* Shapes */}
                {shapes.map(shape => (
                  <g key={shape.id} onMouseDown={(e) => handleShapeMouseDown(e, shape)} style={{ cursor: activeTool === 'select' ? 'pointer' : 'inherit' }}>
                    {renderShape(shape)}
                  </g>
                ))}

                {/* Current drawing */}
                {currentShape && renderShape(currentShape, true)}

                {/* Polyline preview */}
                {isDrawingPolyline && polylinePoints.length > 0 && (
                  <polyline
                    points={polylinePoints.map(p => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth={strokeWidth}
                    strokeDasharray="4 2"
                  />
                )}

                {/* Selection boxes */}
                {selectedShapeIds.map(id => {
                  const shape = shapes.find(s => s.id === id);
                  if (!shape) return null;
                  return (
                    <rect
                      key={`sel-${id}`}
                      x={shape.x - 3}
                      y={shape.y - 3}
                      width={shape.width + 6}
                      height={shape.height + 6}
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth={1}
                      strokeDasharray="4 2"
                      rx={2}
                    />
                  );
                })}
              </svg>

              {/* Text input overlay */}
              {showTextInput && (
                <div 
                  className="absolute bg-white border rounded shadow-lg p-2"
                  style={{ left: textPosition.x, top: textPosition.y }}
                >
                  <Input
                    autoFocus
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleTextSubmit();
                      if (e.key === 'Escape') { setShowTextInput(false); setTextInput(""); }
                    }}
                    placeholder="Text eingeben..."
                    className="w-32 h-7 text-sm"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Quadratische Kachel • Doppelklick beendet Polylinie</span>
            <span>{shapes.length} Elemente</span>
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
