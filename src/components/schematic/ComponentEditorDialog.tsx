import { useState, useCallback, useRef, useEffect } from "react";
import { Shape, ShapeType, Point, TileSize, TILE_SIZES, Component } from "@/types/schematic";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MousePointer2, Square, Circle, Minus, Triangle, Diamond, 
  Trash2, RotateCw, FlipHorizontal, FlipVertical, Copy, 
  Undo2, Redo2, Spline, Type, CircleDot, Grid3X3, ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";

const AVAILABLE_FONTS = [
  { value: 'sans-serif', label: 'Sans Serif' },
  { value: 'serif', label: 'Serif' },
  { value: 'monospace', label: 'Monospace' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Courier New', label: 'Courier New' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Verdana', label: 'Verdana' },
];

interface ComponentEditorDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (name: string, shapes: Shape[], tileSize: TileSize) => void;
  onUpdate?: (id: string, name: string, shapes: Shape[], tileSize: TileSize) => void;
  tileSize: number;
  editingComponent?: Component | null; // Bestehende Komponente zum Bearbeiten
}

type EditorTool = 'select' | ShapeType;
type HandleType = 'start' | 'end' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';

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

export function ComponentEditorDialog({ open, onClose, onSave, onUpdate, tileSize, editingComponent }: ComponentEditorDialogProps) {
  const [name, setName] = useState("");
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selectedShapeIds, setSelectedShapeIds] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<EditorTool>('rectangle');
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [currentShape, setCurrentShape] = useState<Shape | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [fillColor, setFillColor] = useState<string>("");
  const [history, setHistory] = useState<Shape[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [clipboard, setClipboard] = useState<Shape[]>([]);
  const [polylinePoints, setPolylinePoints] = useState<Point[]>([]);
  const [isDrawingPolyline, setIsDrawingPolyline] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [showTextInput, setShowTextInput] = useState(false);
  const [textPosition, setTextPosition] = useState({ x: 0, y: 0 });
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [activeHandle, setActiveHandle] = useState<{ shapeId: string; handle: HandleType } | null>(null);
  const [componentTileSize, setComponentTileSize] = useState<TileSize>('1x1');
  const [hoverPosition, setHoverPosition] = useState<Point | null>(null);

  const isEditing = !!editingComponent;

  // Canvas size based on tile size selection
  const tileSizeConfig = TILE_SIZES[componentTileSize];
  const baseCanvasSize = 300;
  const canvasWidth = tileSizeConfig.cols > 1 ? baseCanvasSize : baseCanvasSize;
  const canvasHeight = tileSizeConfig.rows > tileSizeConfig.cols 
    ? baseCanvasSize * (tileSizeConfig.rows / tileSizeConfig.cols)
    : tileSizeConfig.rows === tileSizeConfig.cols && tileSizeConfig.rows > 1
      ? baseCanvasSize
      : baseCanvasSize;
  
  const gridSize = baseCanvasSize / 20;
  const handleSize = 10;
  const lineHitArea = 12;

  // Lade bestehende Komponente beim Öffnen
  useEffect(() => {
    if (open && editingComponent) {
      setName(editingComponent.name);
      setComponentTileSize(editingComponent.tileSize || '1x1');
      
      // Berechne Canvas-Größe für die zu ladende Komponente
      const loadTileConfig = TILE_SIZES[editingComponent.tileSize || '1x1'];
      const loadCanvasWidth = baseCanvasSize;
      const loadCanvasHeight = loadTileConfig.rows > loadTileConfig.cols 
        ? baseCanvasSize * (loadTileConfig.rows / loadTileConfig.cols)
        : baseCanvasSize;
      
      // Denormalisiere die Formen (von 0-1 auf Canvas-Koordinaten)
      const denormalizedShapes = editingComponent.shapes.map(s => ({
        ...s,
        x: s.x * loadCanvasWidth,
        y: s.y * loadCanvasHeight,
        width: s.width * loadCanvasWidth,
        height: s.height * loadCanvasHeight,
        strokeWidth: s.strokeWidth ? s.strokeWidth * baseCanvasSize : 2,
        fontSize: s.fontSize ? s.fontSize * baseCanvasSize : undefined,
        arrowSize: s.arrowSize ? s.arrowSize * baseCanvasSize : undefined,
        points: s.points?.map(p => ({ x: p.x * loadCanvasWidth, y: p.y * loadCanvasHeight }))
      }));
      
      setShapes(denormalizedShapes);
      setHistory([denormalizedShapes]);
      setHistoryIndex(0);
    } else if (open && !editingComponent) {
      setName("Neue Komponente");
    }
  }, [open, editingComponent]);

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

  // Magnetischer Snap - Cursor springt zu Rasterpunkt wenn nah genug (Snap-Radius)
  const snapRadius = gridSize * 0.4; // 40% der Rastergröße als Snap-Bereich
  
  // Strenger Snap für Linien - immer auf Rasterpunkt
  const strictSnapPosition = (pos: Point): Point => {
    if (!snapToGrid) return pos;
    return {
      x: Math.round(pos.x / gridSize) * gridSize,
      y: Math.round(pos.y / gridSize) * gridSize
    };
  };
  
  const snapPosition = (pos: Point, strict: boolean = false): Point => {
    if (!snapToGrid) return pos;
    
    // Strenger Modus für Linien - immer auf Rasterpunkt
    if (strict) {
      return strictSnapPosition(pos);
    }
    
    // Nächster Rasterpunkt
    const nearestX = Math.round(pos.x / gridSize) * gridSize;
    const nearestY = Math.round(pos.y / gridSize) * gridSize;
    
    // Magnetischer Effekt - nur snappen wenn innerhalb des Radius
    const distX = Math.abs(pos.x - nearestX);
    const distY = Math.abs(pos.y - nearestY);
    
    return {
      x: distX <= snapRadius ? nearestX : pos.x,
      y: distY <= snapRadius ? nearestY : pos.y
    };
  };

  const getMousePosition = (e: React.MouseEvent, strict: boolean = false): Point => {
    const svg = (e.target as Element).closest('svg');
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const rawPos = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    return snapPosition(rawPos, strict);
  };

  const getRawMousePosition = (e: React.MouseEvent): Point => {
    const svg = (e.target as Element).closest('svg');
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  // Berechnet den Abstand eines Punktes zu einer Linie
  const distanceToLine = (px: number, py: number, x1: number, y1: number, x2: number, y2: number): number => {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;
    
    let xx, yy;
    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }
    
    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Findet Form unter dem Mauszeiger mit erweitertem Klickbereich für Linien
  const findShapeAtPosition = (pos: Point): Shape | null => {
    // Rückwärts iterieren für z-order (oberste zuerst)
    for (let i = shapes.length - 1; i >= 0; i--) {
      const shape = shapes[i];
      
      if (shape.type === 'line' || shape.type === 'arrow') {
        const x1 = shape.x;
        const y1 = shape.y;
        const x2 = shape.x + shape.width;
        const y2 = shape.y + shape.height;
        const distance = distanceToLine(pos.x, pos.y, x1, y1, x2, y2);
        if (distance <= lineHitArea) return shape;
      } else if (shape.type === 'polyline' && shape.points) {
        for (let j = 0; j < shape.points.length - 1; j++) {
          const p1 = shape.points[j];
          const p2 = shape.points[j + 1];
          const distance = distanceToLine(pos.x, pos.y, p1.x, p1.y, p2.x, p2.y);
          if (distance <= lineHitArea) return shape;
        }
      } else {
        // Rechteck-basierte Kollision mit Padding
        const padding = 4;
        if (pos.x >= shape.x - padding && pos.x <= shape.x + shape.width + padding &&
            pos.y >= shape.y - padding && pos.y <= shape.y + shape.height + padding) {
          return shape;
        }
      }
    }
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    // Strenger Snap für Linien und Pfeile
    const isLineType = activeTool === 'line' || activeTool === 'arrow';
    const pos = getMousePosition(e, isLineType);
    const rawPos = getRawMousePosition(e);

    if (activeTool === 'select') {
      // Prüfe ob ein Handle angeklickt wurde
      const clickedShape = shapes.find(s => selectedShapeIds.includes(s.id));
      if (clickedShape) {
        const handle = getHandleAtPosition(clickedShape, rawPos);
        if (handle) {
          setActiveHandle({ shapeId: clickedShape.id, handle });
          return;
        }
      }

      // Prüfe ob eine Form angeklickt wurde
      const shapeAtPos = findShapeAtPosition(rawPos);
      if (shapeAtPos) {
        const isMultiSelect = e.shiftKey || e.ctrlKey;
        if (isMultiSelect) {
          if (selectedShapeIds.includes(shapeAtPos.id)) {
            setSelectedShapeIds(selectedShapeIds.filter(id => id !== shapeAtPos.id));
          } else {
            setSelectedShapeIds([...selectedShapeIds, shapeAtPos.id]);
          }
        } else {
          setSelectedShapeIds([shapeAtPos.id]);
        }
        setDragOffset(pos);
        setIsDragging(true);
      } else {
        setSelectedShapeIds([]);
      }
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

    // Zeichnen startet - für alle Formen inkl. Linie und Kreis
    if (['rectangle', 'circle', 'line', 'arrow', 'triangle', 'diamond', 'ellipse', 'arc'].includes(activeTool)) {
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
        fillColor: fillColor || undefined,
        startAngle: activeTool === 'arc' ? 0 : undefined,
        endAngle: activeTool === 'arc' ? 180 : undefined,
        arrowSize: activeTool === 'arrow' ? Math.max(8, strokeWidth * 4) : undefined
      };
      setCurrentShape(newShape);
    }
  };

  const getHandleAtPosition = (shape: Shape, pos: Point): HandleType | null => {
    const hitRadius = handleSize / 2 + 4;

    if (shape.type === 'line' || shape.type === 'arrow') {
      // Start- und Endpunkt der Linie/des Pfeils
      const startX = shape.x;
      const startY = shape.y;
      const endX = shape.x + shape.width;
      const endY = shape.y + shape.height;

      if (Math.abs(pos.x - startX) <= hitRadius && Math.abs(pos.y - startY) <= hitRadius) return 'start';
      if (Math.abs(pos.x - endX) <= hitRadius && Math.abs(pos.y - endY) <= hitRadius) return 'end';
    } else {
      // 8 Eck-Handles für andere Formen
      const handles: { type: HandleType; x: number; y: number }[] = [
        { type: 'nw', x: shape.x, y: shape.y },
        { type: 'n', x: shape.x + shape.width / 2, y: shape.y },
        { type: 'ne', x: shape.x + shape.width, y: shape.y },
        { type: 'e', x: shape.x + shape.width, y: shape.y + shape.height / 2 },
        { type: 'se', x: shape.x + shape.width, y: shape.y + shape.height },
        { type: 's', x: shape.x + shape.width / 2, y: shape.y + shape.height },
        { type: 'sw', x: shape.x, y: shape.y + shape.height },
        { type: 'w', x: shape.x, y: shape.y + shape.height / 2 },
      ];

      for (const h of handles) {
        if (Math.abs(pos.x - h.x) <= hitRadius && Math.abs(pos.y - h.y) <= hitRadius) {
          return h.type;
        }
      }
    }
    return null;
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    // Strenger Snap für Linien und Pfeile
    const isLineType = activeTool === 'line' || activeTool === 'arrow' || 
      (activeHandle && (shapes.find(s => s.id === activeHandle.shapeId)?.type === 'line' || 
                        shapes.find(s => s.id === activeHandle.shapeId)?.type === 'arrow'));
    const pos = getMousePosition(e, isLineType);
    
    // Hover-Position für visuellen Cursor aktualisieren (nicht bei select/text)
    if (snapToGrid && activeTool !== 'select' && activeTool !== 'text') {
      const snappedPos = strictSnapPosition(getRawMousePosition(e));
      setHoverPosition(snappedPos);
    } else {
      setHoverPosition(null);
    }

    // Handle-Resizing
    if (activeHandle) {
      const shape = shapes.find(s => s.id === activeHandle.shapeId);
      if (!shape) return;

      let newShape = { ...shape };

      if (shape.type === 'line' || shape.type === 'arrow') {
        if (activeHandle.handle === 'start') {
          const dx = pos.x - shape.x;
          const dy = pos.y - shape.y;
          newShape = {
            ...shape,
            x: pos.x,
            y: pos.y,
            width: shape.width - dx,
            height: shape.height - dy
          };
        } else if (activeHandle.handle === 'end') {
          newShape = {
            ...shape,
            width: pos.x - shape.x,
            height: pos.y - shape.y
          };
        }
      } else {
        // Resize für andere Formen
        const { handle } = activeHandle;
        
        switch (handle) {
          case 'nw':
            newShape.width = shape.x + shape.width - pos.x;
            newShape.height = shape.y + shape.height - pos.y;
            newShape.x = pos.x;
            newShape.y = pos.y;
            break;
          case 'ne':
            newShape.width = pos.x - shape.x;
            newShape.height = shape.y + shape.height - pos.y;
            newShape.y = pos.y;
            break;
          case 'sw':
            newShape.width = shape.x + shape.width - pos.x;
            newShape.height = pos.y - shape.y;
            newShape.x = pos.x;
            break;
          case 'se':
            newShape.width = pos.x - shape.x;
            newShape.height = pos.y - shape.y;
            break;
          case 'n':
            newShape.height = shape.y + shape.height - pos.y;
            newShape.y = pos.y;
            break;
          case 's':
            newShape.height = pos.y - shape.y;
            break;
          case 'w':
            newShape.width = shape.x + shape.width - pos.x;
            newShape.x = pos.x;
            break;
          case 'e':
            newShape.width = pos.x - shape.x;
            break;
        }

        // Negative Größen verhindern
        if (newShape.width < gridSize) newShape.width = gridSize;
        if (newShape.height < gridSize) newShape.height = gridSize;
      }

      setShapes(shapes.map(s => s.id === shape.id ? newShape : s));
      return;
    }

    // Dragging (Verschieben)
    if (isDragging && selectedShapeIds.length > 0) {
      const dx = pos.x - dragOffset.x;
      const dy = pos.y - dragOffset.y;
      setShapes(shapes.map(s =>
        selectedShapeIds.includes(s.id)
          ? { 
              ...s, 
              x: Math.max(0, Math.min(s.x + dx, canvasWidth - Math.abs(s.width))), 
              y: Math.max(0, Math.min(s.y + dy, canvasHeight - Math.abs(s.height))),
              points: s.points?.map(p => ({
                x: Math.max(0, Math.min(p.x + dx, canvasWidth)),
                y: Math.max(0, Math.min(p.y + dy, canvasHeight))
              }))
            }
          : s
      ));
      setDragOffset(pos);
      return;
    }

    // Zeichnen
    if (isDrawing && currentShape) {
      if (currentShape.type === 'line' || currentShape.type === 'arrow') {
        // Linie/Pfeil: Endpunkt ist die aktuelle Mausposition
        setCurrentShape({
          ...currentShape,
          width: pos.x - drawStart.x,
          height: pos.y - drawStart.y,
          arrowSize: currentShape.type === 'arrow' ? Math.max(8, (currentShape.strokeWidth || 2) * 4) : undefined
        });
      } else if (currentShape.type === 'circle') {
        // Kreis: Immer quadratisch (gleiche Breite und Höhe)
        let size = Math.max(
          Math.abs(pos.x - drawStart.x),
          Math.abs(pos.y - drawStart.y)
        );
        
        let x = drawStart.x;
        let y = drawStart.y;
        
        if (pos.x < drawStart.x) x = drawStart.x - size;
        if (pos.y < drawStart.y) y = drawStart.y - size;

        size = Math.min(size, canvasWidth - x, canvasHeight - y);

        setCurrentShape({
          ...currentShape,
          x, y,
          width: Math.max(size, gridSize),
          height: Math.max(size, gridSize)
        });
      } else {
        // Andere Formen: Rechteckig
        let width = pos.x - drawStart.x;
        let height = pos.y - drawStart.y;
        let x = drawStart.x;
        let y = drawStart.y;

        if (width < 0) { x = pos.x; width = Math.abs(width); }
        if (height < 0) { y = pos.y; height = Math.abs(height); }

        width = Math.min(width, canvasWidth - x);
        height = Math.min(height, canvasHeight - y);

        setCurrentShape({
          ...currentShape,
          x, y,
          width: Math.max(width, gridSize),
          height: Math.max(height, gridSize)
        });
      }
    }
  };

  const handleMouseUp = () => {
    if (activeHandle) {
      setActiveHandle(null);
      pushHistory(shapes);
      return;
    }

    if (isDragging) {
      setIsDragging(false);
      pushHistory(shapes);
      return;
    }

    if (isDrawing && currentShape) {
      // Für Linien und Pfeile: Mindestlänge prüfen
      if (currentShape.type === 'line' || currentShape.type === 'arrow') {
        const length = Math.sqrt(currentShape.width ** 2 + currentShape.height ** 2);
        if (length >= gridSize / 2) {
          const newShapes = [...shapes, currentShape];
          setShapes(newShapes);
          pushHistory(newShapes);
          setSelectedShapeIds([currentShape.id]);
        }
      } else if (currentShape.width > 0 && currentShape.height > 0) {
        const newShapes = [...shapes, currentShape];
        setShapes(newShapes);
        pushHistory(newShapes);
        setSelectedShapeIds([currentShape.id]);
      }
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
        y: s.y + offset,
        points: s.points?.map(p => ({ x: p.x + offset, y: p.y + offset }))
      }));
      const updatedShapes = [...shapes, ...newShapes];
      setShapes(updatedShapes);
      pushHistory(updatedShapes);
      setSelectedShapeIds(newShapes.map(s => s.id));
    }
  };

  const handleDuplicate = () => {
    const selected = shapes.filter(s => selectedShapeIds.includes(s.id));
    const offset = gridSize;
    const newShapes = selected.map(s => ({
      ...s,
      id: generateId(),
      x: Math.min(s.x + offset, canvasWidth - Math.abs(s.width)),
      y: Math.min(s.y + offset, canvasHeight - Math.abs(s.height)),
      points: s.points?.map(p => ({ 
        x: Math.min(p.x + offset, canvasWidth), 
        y: Math.min(p.y + offset, canvasHeight) 
      }))
    }));
    const updatedShapes = [...shapes, ...newShapes];
    setShapes(updatedShapes);
    pushHistory(updatedShapes);
    setSelectedShapeIds(newShapes.map(s => s.id));
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
      if (s.points) {
        const centerX = s.points.reduce((sum, p) => sum + p.x, 0) / s.points.length;
        return { ...s, points: s.points.map(p => ({ x: 2 * centerX - p.x, y: p.y })) };
      }
      if (s.type === 'line' || s.type === 'arrow') {
        return { ...s, width: -s.width };
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
        return { ...s, points: s.points.map(p => ({ x: p.x, y: 2 * centerY - p.y })) };
      }
      if (s.type === 'line' || s.type === 'arrow') {
        return { ...s, height: -s.height };
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
    // Normalisiere immer auf Basis der baseCanvasSize (300px), 
    // damit alle Formen unabhängig von der Tile-Größe gleich skaliert werden
    // Wir verwenden die tatsächliche Canvas-Größe für die Normalisierung
    const normalizedShapes = shapes.map(s => ({
      ...s,
      // Normalisiere auf 0-1 Bereich relativ zur jeweiligen Achse
      x: s.x / canvasWidth,
      y: s.y / canvasHeight,
      width: s.width / canvasWidth,
      height: s.height / canvasHeight,
      // Speichere strokeWidth als Bruchteil der Canvas-Breite für proportionale Skalierung
      strokeWidth: s.strokeWidth ? s.strokeWidth / baseCanvasSize : undefined,
      // Speichere fontSize als Bruchteil der Canvas-Breite für proportionale Skalierung  
      fontSize: s.fontSize ? s.fontSize / baseCanvasSize : undefined,
      // Speichere arrowSize als Bruchteil der Canvas-Breite
      arrowSize: s.arrowSize ? s.arrowSize / baseCanvasSize : undefined,
      points: s.points?.map(p => ({ x: p.x / canvasWidth, y: p.y / canvasHeight }))
    }));
    
    if (isEditing && editingComponent && onUpdate) {
      onUpdate(editingComponent.id, name, normalizedShapes, componentTileSize);
    } else {
      onSave(name, normalizedShapes, componentTileSize);
    }
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
    setActiveHandle(null);
    setComponentTileSize('1x1');
    setFillColor("");
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
        case 'w': setActiveTool('arrow'); break;
        case 't': setActiveTool('triangle'); break;
        case 'd': setActiveTool('diamond'); break;
        case 'p': setActiveTool('polyline'); break;
        case 'a': setActiveTool('arc'); break;
        case 'x': setActiveTool('text'); break;
        case 'g': setSnapToGrid(!snapToGrid); break;
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
  }, [open, selectedShapeIds, shapes, isDrawingPolyline, snapToGrid, undo, redo]);

  const getCursor = () => {
    if (activeHandle) {
      const h = activeHandle.handle;
      if (h === 'start' || h === 'end') return 'crosshair';
      if (h === 'nw' || h === 'se') return 'nwse-resize';
      if (h === 'ne' || h === 'sw') return 'nesw-resize';
      if (h === 'n' || h === 's') return 'ns-resize';
      if (h === 'e' || h === 'w') return 'ew-resize';
    }
    if (activeTool === 'select') return isDragging ? 'grabbing' : 'default';
    if (activeTool === 'text') return 'text';
    // Verstecke Cursor wenn Raster aktiv und Hover-Cursor angezeigt wird
    if (snapToGrid && hoverPosition) return 'none';
    return 'crosshair';
  };

  const renderShape = (shape: Shape, isPreview = false) => {
    const isSelected = selectedShapeIds.includes(shape.id) && !isPreview;
    const stroke = isSelected ? "hsl(var(--primary))" : "hsl(220, 25%, 20%)";
    const sw = shape.strokeWidth || 2;
    const fill = shape.fillColor || "none";
    const transform = shape.rotation ? `rotate(${shape.rotation} ${shape.x + shape.width/2} ${shape.y + shape.height/2})` : undefined;

    switch (shape.type) {
      case 'rectangle':
        return <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} fill={fill} stroke={stroke} strokeWidth={sw} transform={transform} />;
      case 'circle':
      case 'ellipse':
        return <ellipse cx={shape.x + shape.width/2} cy={shape.y + shape.height/2} rx={shape.width/2} ry={shape.height/2} fill={fill} stroke={stroke} strokeWidth={sw} transform={transform} />;
      case 'line':
        return <line x1={shape.x} y1={shape.y} x2={shape.x + shape.width} y2={shape.y + shape.height} stroke={stroke} strokeWidth={sw} strokeLinecap="round" />;
      case 'arrow': {
        const x1 = shape.x;
        const y1 = shape.y;
        const x2 = shape.x + shape.width;
        const y2 = shape.y + shape.height;
        const arrowSize = shape.arrowSize || Math.max(8, sw * 4);
        
        // Calculate arrow head
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const arrowAngle = Math.PI / 6; // 30 degrees
        
        const ax1 = x2 - arrowSize * Math.cos(angle - arrowAngle);
        const ay1 = y2 - arrowSize * Math.sin(angle - arrowAngle);
        const ax2 = x2 - arrowSize * Math.cos(angle + arrowAngle);
        const ay2 = y2 - arrowSize * Math.sin(angle + arrowAngle);
        
        return (
          <g>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
            <polyline 
              points={`${ax1},${ay1} ${x2},${y2} ${ax2},${ay2}`} 
              fill="none" 
              stroke={stroke} 
              strokeWidth={sw} 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />
          </g>
        );
      }
      case 'triangle':
        return <polygon points={`${shape.x + shape.width/2},${shape.y} ${shape.x},${shape.y + shape.height} ${shape.x + shape.width},${shape.y + shape.height}`} fill={fill} stroke={stroke} strokeWidth={sw} transform={transform} />;
      case 'diamond':
        return <polygon points={`${shape.x + shape.width/2},${shape.y} ${shape.x + shape.width},${shape.y + shape.height/2} ${shape.x + shape.width/2},${shape.y + shape.height} ${shape.x},${shape.y + shape.height/2}`} fill={fill} stroke={stroke} strokeWidth={sw} transform={transform} />;
      case 'polyline':
        if (!shape.points || shape.points.length < 2) return null;
        return <polyline points={shape.points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />;
      case 'arc':
        const rx = shape.width / 2;
        const ry = shape.height / 2;
        const cx = shape.x + rx;
        const cy = shape.y + ry;
        const startRad = ((shape.startAngle || 0) * Math.PI) / 180;
        const endRad = ((shape.endAngle || 180) * Math.PI) / 180;
        const arcX1 = cx + rx * Math.cos(startRad);
        const arcY1 = cy + ry * Math.sin(startRad);
        const arcX2 = cx + rx * Math.cos(endRad);
        const arcY2 = cy + ry * Math.sin(endRad);
        const largeArc = (shape.endAngle || 180) - (shape.startAngle || 0) > 180 ? 1 : 0;
        return <path d={`M ${arcX1} ${arcY1} A ${rx} ${ry} 0 ${largeArc} 1 ${arcX2} ${arcY2}`} fill="none" stroke={stroke} strokeWidth={sw} />;
      case 'text':
        return <text x={shape.x} y={shape.y + (shape.fontSize || 14)} fontSize={shape.fontSize || 14} fontFamily={shape.fontFamily || 'sans-serif'} fill={stroke}>{shape.text}</text>;
      default:
        return null;
    }
  };

  // Render Handles für ausgewählte Formen
  const renderHandles = (shape: Shape) => {
    if (shape.type === 'line' || shape.type === 'arrow') {
      // Start- und Endpunkt für Linien und Pfeile
      return (
        <>
          <circle
            cx={shape.x}
            cy={shape.y}
            r={handleSize / 2}
            fill="white"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            style={{ cursor: 'crosshair' }}
          />
          <circle
            cx={shape.x + shape.width}
            cy={shape.y + shape.height}
            r={handleSize / 2}
            fill="white"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            style={{ cursor: 'crosshair' }}
          />
        </>
      );
    }

    // 8 Eck-Handles für andere Formen
    const handles = [
      { x: shape.x, y: shape.y, cursor: 'nwse-resize' },
      { x: shape.x + shape.width / 2, y: shape.y, cursor: 'ns-resize' },
      { x: shape.x + shape.width, y: shape.y, cursor: 'nesw-resize' },
      { x: shape.x + shape.width, y: shape.y + shape.height / 2, cursor: 'ew-resize' },
      { x: shape.x + shape.width, y: shape.y + shape.height, cursor: 'nwse-resize' },
      { x: shape.x + shape.width / 2, y: shape.y + shape.height, cursor: 'ns-resize' },
      { x: shape.x, y: shape.y + shape.height, cursor: 'nesw-resize' },
      { x: shape.x, y: shape.y + shape.height / 2, cursor: 'ew-resize' },
    ];

    return handles.map((h, i) => (
      <rect
        key={i}
        x={h.x - handleSize / 2}
        y={h.y - handleSize / 2}
        width={handleSize}
        height={handleSize}
        fill="white"
        stroke="hsl(var(--primary))"
        strokeWidth={2}
        rx={2}
        style={{ cursor: h.cursor }}
      />
    ));
  };

  const hasSelection = selectedShapeIds.length > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-5xl p-4">
        <DialogHeader className="pb-2">
          <DialogTitle>{isEditing ? `"${editingComponent?.name}" bearbeiten` : 'Komponente erstellen'}</DialogTitle>
        </DialogHeader>
        
        {/* Toolbar - kompakt oben */}
        <div className="flex items-center gap-1 p-1.5 bg-muted/50 rounded-lg flex-wrap">
          <ToolBtn icon={MousePointer2} label="Auswählen" shortcut="V" isActive={activeTool === 'select'} onClick={() => setActiveTool('select')} />
          <Separator orientation="vertical" className="h-5 mx-0.5" />
          <ToolBtn icon={Square} label="Rechteck" shortcut="R" isActive={activeTool === 'rectangle'} onClick={() => setActiveTool('rectangle')} />
          <ToolBtn icon={Circle} label="Kreis" shortcut="C" isActive={activeTool === 'circle'} onClick={() => setActiveTool('circle')} />
          <ToolBtn icon={Minus} label="Linie" shortcut="L" isActive={activeTool === 'line'} onClick={() => setActiveTool('line')} />
          <ToolBtn icon={ArrowRight} label="Pfeil" shortcut="W" isActive={activeTool === 'arrow'} onClick={() => setActiveTool('arrow')} />
          <ToolBtn icon={Triangle} label="Dreieck" shortcut="T" isActive={activeTool === 'triangle'} onClick={() => setActiveTool('triangle')} />
          <ToolBtn icon={Diamond} label="Raute" shortcut="D" isActive={activeTool === 'diamond'} onClick={() => setActiveTool('diamond')} />
          <ToolBtn icon={Spline} label="Polylinie" shortcut="P" isActive={activeTool === 'polyline'} onClick={() => setActiveTool('polyline')} />
          <ToolBtn icon={CircleDot} label="Bogen" shortcut="A" isActive={activeTool === 'arc'} onClick={() => setActiveTool('arc')} />
          <ToolBtn icon={Type} label="Text" shortcut="X" isActive={activeTool === 'text'} onClick={() => setActiveTool('text')} />
          <Separator orientation="vertical" className="h-5 mx-0.5" />
          <ToolBtn icon={Undo2} label="Rückgängig" shortcut="Ctrl+Z" onClick={undo} disabled={historyIndex <= 0} />
          <ToolBtn icon={Redo2} label="Wiederholen" shortcut="Ctrl+Y" onClick={redo} disabled={historyIndex >= history.length - 1} />
          <Separator orientation="vertical" className="h-5 mx-0.5" />
          <ToolBtn icon={Copy} label="Duplizieren" shortcut="Ctrl+D" onClick={handleDuplicate} disabled={!hasSelection} />
          <ToolBtn icon={RotateCw} label="90° drehen" onClick={() => handleRotate(90)} disabled={!hasSelection} />
          <ToolBtn icon={FlipHorizontal} label="Horizontal spiegeln" onClick={handleFlipH} disabled={!hasSelection} />
          <ToolBtn icon={FlipVertical} label="Vertikal spiegeln" onClick={handleFlipV} disabled={!hasSelection} />
          <ToolBtn icon={Trash2} label="Löschen" shortcut="Del" onClick={handleDelete} disabled={!hasSelection} />
        </div>

        {/* Hauptbereich: Optionen links, Canvas rechts */}
        <div className="flex gap-4 mt-2">
          {/* Linke Seite - Optionen */}
          <div className="w-48 flex-shrink-0 space-y-3">
            {/* Name */}
            <div className="space-y-1">
              <Label htmlFor="component-name" className="text-xs">Name</Label>
              <Input
                id="component-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Neue Komponente"
                className="h-8 text-sm"
                onFocus={(e) => e.target.select()}
              />
            </div>

            {/* Kachelgröße */}
            <div className="space-y-1">
              <Label className="text-xs">Kachelgröße</Label>
              <RadioGroup 
                value={componentTileSize} 
                onValueChange={(v) => setComponentTileSize(v as TileSize)}
                className="flex flex-col gap-1"
              >
                {Object.entries(TILE_SIZES).map(([key, config]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <RadioGroupItem value={key} id={`tile-${key}`} />
                    <Label htmlFor={`tile-${key}`} className="cursor-pointer text-xs">
                      {config.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Strichstärke */}
            <div className="space-y-1">
              <Label className="text-xs">Strichstärke</Label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[strokeWidth]}
                  onValueChange={([v]) => setStrokeWidth(v)}
                  min={1}
                  max={6}
                  step={0.5}
                  className="flex-1"
                />
                <span className="text-xs font-mono w-5">{strokeWidth}</span>
              </div>
            </div>

            {/* Füllfarbe */}
            <div className="space-y-1">
              <Label className="text-xs">Füllfarbe</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={fillColor || "#ffffff"}
                  onChange={(e) => setFillColor(e.target.value)}
                  className="w-8 h-8 rounded border cursor-pointer"
                />
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 text-xs"
                  onClick={() => setFillColor("")}
                >
                  Keine
                </Button>
              </div>
            </div>

            {/* Raster */}
            <div className="flex items-center gap-2">
              <Switch
                id="snap-grid"
                checked={snapToGrid}
                onCheckedChange={setSnapToGrid}
              />
              <Label htmlFor="snap-grid" className="flex items-center gap-1 cursor-pointer text-xs">
                <Grid3X3 className="w-3 h-3" />
                Raster
              </Label>
            </div>

            <Separator />

            {/* Properties Panel für ausgewählte Shapes */}
            {selectedShapeIds.length === 1 && (() => {
              const selectedShape = shapes.find(s => s.id === selectedShapeIds[0]);
              if (!selectedShape) return null;
              
              const updateSelectedShape = (updates: Partial<Shape>) => {
                const newShapes = shapes.map(s => 
                  s.id === selectedShape.id ? { ...s, ...updates } : s
                );
                setShapes(newShapes);
                pushHistory(newShapes);
              };
              
              const isTextShape = selectedShape.type === 'text';
              const isLineShape = selectedShape.type === 'line' || selectedShape.type === 'arrow' || selectedShape.type === 'polyline' || selectedShape.type === 'arc';
              const hasStroke = isLineShape || ['rectangle', 'circle', 'ellipse', 'triangle', 'diamond'].includes(selectedShape.type);
              const hasFill = ['rectangle', 'circle', 'ellipse', 'triangle', 'diamond'].includes(selectedShape.type);
              
              return (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">
                    Auswahl: {selectedShape.type}
                  </div>
                  
                  {hasStroke && (
                    <div className="space-y-1">
                      <Label className="text-xs">Strichstärke</Label>
                      <div className="flex items-center gap-2">
                        <Slider
                          value={[selectedShape.strokeWidth || 2]}
                          onValueChange={([v]) => updateSelectedShape({ strokeWidth: v })}
                          min={0.5}
                          max={8}
                          step={0.5}
                          className="flex-1"
                        />
                        <span className="text-xs font-mono w-5">{selectedShape.strokeWidth || 2}</span>
                      </div>
                    </div>
                  )}
                  
                  {hasFill && (
                    <div className="space-y-1">
                      <Label className="text-xs">Füllfarbe</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={selectedShape.fillColor || "#ffffff"}
                          onChange={(e) => updateSelectedShape({ fillColor: e.target.value })}
                          className="w-8 h-8 rounded border cursor-pointer"
                        />
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-7 text-xs"
                          onClick={() => updateSelectedShape({ fillColor: undefined })}
                        >
                          Keine
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {isTextShape && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs">Schriftgröße</Label>
                        <div className="flex items-center gap-2">
                          <Slider
                            value={[selectedShape.fontSize || 14]}
                            onValueChange={([v]) => updateSelectedShape({ fontSize: v })}
                            min={8}
                            max={48}
                            step={1}
                            className="flex-1"
                          />
                          <span className="text-xs font-mono w-5">{selectedShape.fontSize || 14}</span>
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <Label className="text-xs">Schriftart</Label>
                        <Select
                          value={selectedShape.fontFamily || 'sans-serif'}
                          onValueChange={(v) => updateSelectedShape({ fontFamily: v })}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {AVAILABLE_FONTS.map(font => (
                              <SelectItem key={font.value} value={font.value} className="text-xs">
                                <span style={{ fontFamily: font.value }}>{font.label}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-1">
                        <Label className="text-xs">Text</Label>
                        <Input
                          value={selectedShape.text || ''}
                          onChange={(e) => updateSelectedShape({ text: e.target.value })}
                          className="h-7 text-xs"
                          placeholder="Text..."
                        />
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            {/* Status */}
            <div className="text-xs text-muted-foreground pt-2">
              {shapes.length} Elemente
            </div>
          </div>

          {/* Rechte Seite - Canvas */}
          <div className="flex-1 flex justify-center items-start">
            <div className="relative">
              <svg
                width={canvasWidth}
                height={canvasHeight}
                className="border-2 border-dashed border-primary/30 rounded-lg bg-white"
                style={{ cursor: getCursor() }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => { handleMouseUp(); setHoverPosition(null); }}
                onDoubleClick={handleDoubleClick}
              >
                {/* Grid */}
                <defs>
                  <pattern id="editor-grid-fine" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
                    <path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} fill="none" stroke="#c4c7cc" strokeWidth="0.5" />
                  </pattern>
                  <pattern id="editor-grid-major" width={gridSize * 5} height={gridSize * 5} patternUnits="userSpaceOnUse">
                    <rect width={gridSize * 5} height={gridSize * 5} fill="url(#editor-grid-fine)" />
                    <path d={`M ${gridSize * 5} 0 L 0 0 0 ${gridSize * 5}`} fill="none" stroke="#9ca3af" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width={canvasWidth} height={canvasHeight} fill="url(#editor-grid-major)" />

                {/* Hover cursor indicator - springt von Raster zu Raster */}
                {hoverPosition && snapToGrid && activeTool !== 'select' && activeTool !== 'text' && (
                  <g>
                    {/* Crosshair */}
                    <line 
                      x1={hoverPosition.x - 8} 
                      y1={hoverPosition.y} 
                      x2={hoverPosition.x + 8} 
                      y2={hoverPosition.y} 
                      stroke="hsl(var(--primary))" 
                      strokeWidth="1.5"
                      pointerEvents="none"
                    />
                    <line 
                      x1={hoverPosition.x} 
                      y1={hoverPosition.y - 8} 
                      x2={hoverPosition.x} 
                      y2={hoverPosition.y + 8} 
                      stroke="hsl(var(--primary))" 
                      strokeWidth="1.5"
                      pointerEvents="none"
                    />
                    {/* Center dot */}
                    <circle 
                      cx={hoverPosition.x} 
                      cy={hoverPosition.y} 
                      r="3" 
                      fill="hsl(var(--primary))" 
                      pointerEvents="none"
                    />
                  </g>
                )}

                {/* Connection point markers */}
                {(() => {
                  const markers: JSX.Element[] = [];
                  const markerLength = 12;
                  const markerStrokeWidth = 2;
                  const markerColor = "#ef4444"; // Red color for visibility
                  const connectionsPerSide = tileSizeConfig.connectionsPerSide;
                  
                  // Calculate positions based on tile configuration
                  const cellWidth = canvasWidth / tileSizeConfig.cols;
                  const cellHeight = canvasHeight / tileSizeConfig.rows;
                  
                  // Top edge markers
                  for (let col = 0; col < tileSizeConfig.cols; col++) {
                    const x = cellWidth * col + cellWidth / 2;
                    markers.push(
                      <line
                        key={`top-${col}`}
                        x1={x}
                        y1={0}
                        x2={x}
                        y2={markerLength}
                        stroke={markerColor}
                        strokeWidth={markerStrokeWidth}
                        strokeLinecap="round"
                      />
                    );
                  }
                  
                  // Bottom edge markers
                  for (let col = 0; col < tileSizeConfig.cols; col++) {
                    const x = cellWidth * col + cellWidth / 2;
                    markers.push(
                      <line
                        key={`bottom-${col}`}
                        x1={x}
                        y1={canvasHeight}
                        x2={x}
                        y2={canvasHeight - markerLength}
                        stroke={markerColor}
                        strokeWidth={markerStrokeWidth}
                        strokeLinecap="round"
                      />
                    );
                  }
                  
                  // Left edge markers
                  for (let row = 0; row < tileSizeConfig.rows; row++) {
                    const y = cellHeight * row + cellHeight / 2;
                    markers.push(
                      <line
                        key={`left-${row}`}
                        x1={0}
                        y1={y}
                        x2={markerLength}
                        y2={y}
                        stroke={markerColor}
                        strokeWidth={markerStrokeWidth}
                        strokeLinecap="round"
                      />
                    );
                  }
                  
                  // Right edge markers
                  for (let row = 0; row < tileSizeConfig.rows; row++) {
                    const y = cellHeight * row + cellHeight / 2;
                    markers.push(
                      <line
                        key={`right-${row}`}
                        x1={canvasWidth}
                        y1={y}
                        x2={canvasWidth - markerLength}
                        y2={y}
                        stroke={markerColor}
                        strokeWidth={markerStrokeWidth}
                        strokeLinecap="round"
                      />
                    );
                  }
                  
                  return markers;
                })()}

                {/* Shapes */}
                {shapes.map(shape => (
                  <g key={shape.id}>
                    {renderShape(shape)}
                    {(shape.type === 'line' || shape.type === 'arrow') && activeTool === 'select' && (
                      <line
                        x1={shape.x}
                        y1={shape.y}
                        x2={shape.x + shape.width}
                        y2={shape.y + shape.height}
                        stroke="transparent"
                        strokeWidth={lineHitArea}
                        strokeLinecap="round"
                        style={{ cursor: 'pointer' }}
                      />
                    )}
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

                {/* Selection boxes and handles */}
                {selectedShapeIds.map(id => {
                  const shape = shapes.find(s => s.id === id);
                  if (!shape) return null;
                  const showBoundingBox = shape.type !== 'line' && shape.type !== 'arrow';
                  
                  return (
                    <g key={`sel-${id}`}>
                      {showBoundingBox && (
                        <rect
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
                      )}
                      {renderHandles(shape)}
                    </g>
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
        </div>

        <DialogFooter className="pt-3 border-t mt-3">
          <Button variant="outline" onClick={handleClose}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={shapes.length === 0}>
            Komponente speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
