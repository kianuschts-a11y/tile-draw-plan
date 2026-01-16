import { useState, useCallback, useRef, useEffect } from "react";
import { Shape, ShapeType, Point, TileSize, TILE_SIZES } from "@/types/schematic";
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
  Undo2, Redo2, Spline, Type, CircleDot, Grid3X3
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
  tileSize: number;
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
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [activeHandle, setActiveHandle] = useState<{ shapeId: string; handle: HandleType } | null>(null);
  const [componentTileSize, setComponentTileSize] = useState<TileSize>('1x1');

  // Canvas size based on tile size selection
  const tileSizeConfig = TILE_SIZES[componentTileSize];
  const baseCanvasSize = 300;
  const canvasWidth = componentTileSize === '3x2' ? baseCanvasSize : baseCanvasSize;
  const canvasHeight = componentTileSize === '3x2' ? baseCanvasSize * 1.5 : baseCanvasSize;
  
  const gridSize = baseCanvasSize / 20;
  const handleSize = 10;
  const lineHitArea = 12;

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

  const snapPosition = (pos: Point): Point => {
    if (!snapToGrid) return pos;
    return {
      x: Math.round(pos.x / gridSize) * gridSize,
      y: Math.round(pos.y / gridSize) * gridSize
    };
  };

  const getMousePosition = (e: React.MouseEvent): Point => {
    const svg = (e.target as Element).closest('svg');
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const rawPos = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    return snapPosition(rawPos);
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
      
      if (shape.type === 'line') {
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
    const pos = getMousePosition(e);
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

  const getHandleAtPosition = (shape: Shape, pos: Point): HandleType | null => {
    const hitRadius = handleSize / 2 + 4;

    if (shape.type === 'line') {
      // Start- und Endpunkt der Linie
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
    const pos = getMousePosition(e);

    // Handle-Resizing
    if (activeHandle) {
      const shape = shapes.find(s => s.id === activeHandle.shapeId);
      if (!shape) return;

      let newShape = { ...shape };

      if (shape.type === 'line') {
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
      if (currentShape.type === 'line') {
        // Linie: Endpunkt ist die aktuelle Mausposition
        setCurrentShape({
          ...currentShape,
          width: pos.x - drawStart.x,
          height: pos.y - drawStart.y
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
      // Für Linien: Mindestlänge prüfen
      if (currentShape.type === 'line') {
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
      if (s.type === 'line') {
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
      if (s.type === 'line') {
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
    const normalizedShapes = shapes.map(s => ({
      ...s,
      x: s.x / canvasWidth,
      y: s.y / canvasHeight,
      width: s.width / canvasWidth,
      height: s.height / canvasHeight,
      points: s.points?.map(p => ({ x: p.x / canvasWidth, y: p.y / canvasHeight }))
    }));
    onSave(name, normalizedShapes, componentTileSize);
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
        return <line x1={shape.x} y1={shape.y} x2={shape.x + shape.width} y2={shape.y + shape.height} stroke={stroke} strokeWidth={sw} strokeLinecap="round" />;
      case 'triangle':
        return <polygon points={`${shape.x + shape.width/2},${shape.y} ${shape.x},${shape.y + shape.height} ${shape.x + shape.width},${shape.y + shape.height}`} fill="none" stroke={stroke} strokeWidth={sw} transform={transform} />;
      case 'diamond':
        return <polygon points={`${shape.x + shape.width/2},${shape.y} ${shape.x + shape.width},${shape.y + shape.height/2} ${shape.x + shape.width/2},${shape.y + shape.height} ${shape.x},${shape.y + shape.height/2}`} fill="none" stroke={stroke} strokeWidth={sw} transform={transform} />;
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
        const x1 = cx + rx * Math.cos(startRad);
        const y1 = cy + ry * Math.sin(startRad);
        const x2 = cx + rx * Math.cos(endRad);
        const y2 = cy + ry * Math.sin(endRad);
        const largeArc = (shape.endAngle || 180) - (shape.startAngle || 0) > 180 ? 1 : 0;
        return <path d={`M ${x1} ${y1} A ${rx} ${ry} 0 ${largeArc} 1 ${x2} ${y2}`} fill="none" stroke={stroke} strokeWidth={sw} />;
      case 'text':
        return <text x={shape.x} y={shape.y + (shape.fontSize || 14)} fontSize={shape.fontSize || 14} fontFamily={shape.fontFamily || 'sans-serif'} fill={stroke}>{shape.text}</text>;
      default:
        return null;
    }
  };

  // Render Handles für ausgewählte Formen
  const renderHandles = (shape: Shape) => {
    if (shape.type === 'line') {
      // Start- und Endpunkt für Linien
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Komponente erstellen</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          <div className="space-y-4 pb-4">
          {/* Tile size selection */}
          <div className="space-y-2">
            <Label>Kachelgröße</Label>
            <RadioGroup 
              value={componentTileSize} 
              onValueChange={(v) => setComponentTileSize(v as TileSize)}
              className="flex gap-4"
            >
              {Object.entries(TILE_SIZES).map(([key, config]) => (
                <div key={key} className="flex items-center space-x-2">
                  <RadioGroupItem value={key} id={`tile-${key}`} />
                  <Label htmlFor={`tile-${key}`} className="cursor-pointer text-sm">
                    {config.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

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
            <div className="flex items-center gap-2">
              <Switch
                id="snap-grid"
                checked={snapToGrid}
                onCheckedChange={setSnapToGrid}
              />
              <Label htmlFor="snap-grid" className="flex items-center gap-1.5 cursor-pointer">
                <Grid3X3 className="w-4 h-4" />
                <span className="text-sm">Raster</span>
              </Label>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-1 p-2 bg-muted/50 rounded-lg flex-wrap">
            {/* Selection */}
            <ToolBtn icon={MousePointer2} label="Auswählen" shortcut="V" isActive={activeTool === 'select'} onClick={() => setActiveTool('select')} />
            
            <Separator orientation="vertical" className="h-6 mx-1" />
            
            {/* Shapes */}
            <ToolBtn icon={Square} label="Rechteck" shortcut="R" isActive={activeTool === 'rectangle'} onClick={() => setActiveTool('rectangle')} />
            <ToolBtn icon={Circle} label="Kreis" shortcut="C" isActive={activeTool === 'circle'} onClick={() => setActiveTool('circle')} />
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
                width={canvasWidth}
                height={canvasHeight}
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
                <rect width={canvasWidth} height={canvasHeight} fill="url(#editor-grid-major)" />

                {/* Shapes */}
                {shapes.map(shape => (
                  <g key={shape.id}>
                    {renderShape(shape)}
                    {/* Unsichtbarer größerer Klickbereich für Linien */}
                    {shape.type === 'line' && activeTool === 'select' && (
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
                  
                  // Bounding box für nicht-Linien
                  const showBoundingBox = shape.type !== 'line';
                  
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
            const isLineShape = selectedShape.type === 'line' || selectedShape.type === 'polyline' || selectedShape.type === 'arc';
            const hasStroke = isLineShape || ['rectangle', 'circle', 'ellipse', 'triangle', 'diamond'].includes(selectedShape.type);
            
            return (
              <div className="p-3 bg-muted/30 rounded-lg border">
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  Eigenschaften: {selectedShape.type === 'text' ? 'Text' : selectedShape.type === 'line' ? 'Linie' : selectedShape.type === 'polyline' ? 'Polylinie' : selectedShape.type}
                </div>
                <div className="flex flex-wrap gap-4">
                  {/* Strichstärke für alle außer Text */}
                  {hasStroke && (
                    <div className="space-y-1">
                      <Label className="text-xs">Strichstärke</Label>
                      <div className="flex items-center gap-2 w-32">
                        <Slider
                          value={[selectedShape.strokeWidth || 2]}
                          onValueChange={([v]) => updateSelectedShape({ strokeWidth: v })}
                          min={0.5}
                          max={8}
                          step={0.5}
                        />
                        <span className="text-xs font-mono w-6">{selectedShape.strokeWidth || 2}</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Schriftgröße für Text */}
                  {isTextShape && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs">Schriftgröße</Label>
                        <div className="flex items-center gap-2 w-32">
                          <Slider
                            value={[selectedShape.fontSize || 14]}
                            onValueChange={([v]) => updateSelectedShape({ fontSize: v })}
                            min={8}
                            max={48}
                            step={1}
                          />
                          <span className="text-xs font-mono w-6">{selectedShape.fontSize || 14}</span>
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <Label className="text-xs">Schriftart</Label>
                        <Select
                          value={selectedShape.fontFamily || 'sans-serif'}
                          onValueChange={(v) => updateSelectedShape({ fontFamily: v })}
                        >
                          <SelectTrigger className="w-40 h-8 text-xs">
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
                        <Label className="text-xs">Text bearbeiten</Label>
                        <Input
                          value={selectedShape.text || ''}
                          onChange={(e) => updateSelectedShape({ text: e.target.value })}
                          className="w-40 h-8 text-xs"
                          placeholder="Text eingeben..."
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })()}

          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {snapToGrid ? "Raster an (G)" : "Raster aus (G)"} • 
              Linie: Ziehen von Start zu Ende • 
              Doppelklick beendet Polylinie
            </span>
            <span>{shapes.length} Elemente</span>
          </div>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 pt-4 border-t mt-0">
          <Button variant="outline" onClick={handleClose}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={shapes.length === 0}>
            Komponente speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
