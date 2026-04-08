import { useState, useCallback, useRef, useEffect } from "react";
import { Shape, ShapeType, Point, TileSize, TILE_SIZES, Component } from "@/types/schematic";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
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
  Undo2, Redo2, Spline, Type, Grid3X3, ArrowRight,
  PaintBucket
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
  onSave: (name: string, shapes: Shape[], tileSize: TileSize, category?: string, labelingEnabled?: boolean, labelingPriority?: number, labelingColor?: string, autoConnectionsEnabled?: boolean) => void;
  onUpdate?: (id: string, name: string, shapes: Shape[], tileSize: TileSize, category?: string, labelingEnabled?: boolean, labelingPriority?: number, labelingColor?: string, autoConnectionsEnabled?: boolean) => void;
  tileSize: number;
  editingComponent?: Component | null;
  existingCategories?: string[];
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

export function ComponentEditorDialog({ open, onClose, onSave, onUpdate, tileSize, editingComponent, existingCategories = [] }: ComponentEditorDialogProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
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
  const [moveOnlyMode, setMoveOnlyMode] = useState(false);
  const [activeHandle, setActiveHandle] = useState<{ shapeId: string; handle: HandleType } | null>(null);
  const [componentTileSize, setComponentTileSize] = useState<TileSize>('1x1');
  const [hoverPosition, setHoverPosition] = useState<Point | null>(null);
  
  // Fläche-Füllen-Modus
  const [fillAreaMode, setFillAreaMode] = useState(false);
  const [fillAreaSelectedIds, setFillAreaSelectedIds] = useState<string[]>([]);
  
  // Kurven-Kontrollpunkt (Linie zu Kurve ziehen)
  const [draggingCurveControl, setDraggingCurveControl] = useState<string | null>(null);

  // Beschriftung (Labeling)
  const [labelingEnabled, setLabelingEnabled] = useState(false);
  const [labelingPriority, setLabelingPriority] = useState<number>(1);
  const [labelingColor, setLabelingColor] = useState<string>('#000000');
  
  // Auto-Verbindungen
  const [autoConnectionsEnabled, setAutoConnectionsEnabled] = useState(false);

  const isEditing = !!editingComponent && !!editingComponent.id;

  // Canvas size based on tile size selection
  const tileSizeConfig = TILE_SIZES[componentTileSize];
  const baseCanvasSize = 200; // Basis für Normalisierung (bleibt konstant)
  const maxCanvasWidth = 700; // Maximale Breite damit es in den Dialog passt (reduziert für 5x1/10x1)
  
  // Berechne Canvas-Dimensionen basierend auf dem Seitenverhältnis
  const aspectRatio = tileSizeConfig.cols / tileSizeConfig.rows;
  let canvasWidth: number;
  let canvasHeight: number;
  
  // Für sehr breite Formate (5x1, 10x1) die ursprüngliche Logik verwenden
  if (componentTileSize === '5x1' || componentTileSize === '10x1') {
    canvasWidth = baseCanvasSize * aspectRatio;
    canvasHeight = baseCanvasSize;
    
    // Skaliere runter wenn zu breit - mit etwas Puffer
    const effectiveMaxWidth = maxCanvasWidth - 20; // Zusätzlicher Puffer für Ränder
    if (canvasWidth > effectiveMaxWidth) {
      const scale = effectiveMaxWidth / canvasWidth;
      canvasWidth = effectiveMaxWidth;
      canvasHeight = canvasHeight * scale;
    }
  } else {
    // Für andere Formate größere Zeichenfläche
    const displayBaseSize = 280;
    
    if (aspectRatio >= 1) {
      // Breite Formate (z.B. 2x2)
      canvasWidth = Math.min(maxCanvasWidth, displayBaseSize * aspectRatio);
      canvasHeight = canvasWidth / aspectRatio;
    } else {
      // Hohe Formate (z.B. 3x2)
      canvasHeight = displayBaseSize;
      canvasWidth = canvasHeight * aspectRatio;
    }
  }
  
  const gridSize = Math.min(canvasWidth, canvasHeight) / 20;
  const handleSize = 10;
  const lineHitArea = 12;

  // Lade bestehende Komponente beim Öffnen
  useEffect(() => {
    if (open && editingComponent) {
      setName(editingComponent.name);
      setCategory(editingComponent.category || '');
      setComponentTileSize(editingComponent.tileSize || '1x1');
      setLabelingEnabled(editingComponent.labelingEnabled || false);
      setLabelingPriority(editingComponent.labelingPriority || 1);
      setLabelingColor(editingComponent.labelingColor || '#000000');
      setAutoConnectionsEnabled(editingComponent.autoConnectionsEnabled || false);
      
      const loadTileConfig = TILE_SIZES[editingComponent.tileSize || '1x1'];
      const loadAspectRatio = loadTileConfig.cols / loadTileConfig.rows;
      
      // Use the same canvas calculation logic as the display
      // This ensures shapes load at the same positions they were saved
      let loadCanvasWidth: number;
      let loadCanvasHeight: number;
      
      const loadComponentTileSize = editingComponent.tileSize || '1x1';
      if (loadComponentTileSize === '5x1' || loadComponentTileSize === '10x1') {
        loadCanvasWidth = baseCanvasSize * loadAspectRatio;
        loadCanvasHeight = baseCanvasSize;
        const effectiveMaxWidth = maxCanvasWidth - 20;
        if (loadCanvasWidth > effectiveMaxWidth) {
          const scale = effectiveMaxWidth / loadCanvasWidth;
          loadCanvasWidth = effectiveMaxWidth;
          loadCanvasHeight = loadCanvasHeight * scale;
        }
      } else {
        const displayBaseSize = 280;
        if (loadAspectRatio >= 1) {
          loadCanvasWidth = Math.min(maxCanvasWidth, displayBaseSize * loadAspectRatio);
          loadCanvasHeight = loadCanvasWidth / loadAspectRatio;
        } else {
          loadCanvasHeight = displayBaseSize;
          loadCanvasWidth = loadCanvasHeight * loadAspectRatio;
        }
      }
      
      // refScale muss konsistent mit handleSave berechnet werden
      const loadRefScale = Math.min(loadCanvasWidth, loadCanvasHeight);
      
      const denormalizedShapes = editingComponent.shapes.map(s => ({
        ...s,
        x: s.x * loadCanvasWidth,
        y: s.y * loadCanvasHeight,
        width: s.width * loadCanvasWidth,
        height: s.height * loadCanvasHeight,
        // Alle Größen mit refScale skalieren (konsistent mit handleSave)
        strokeWidth: s.strokeWidth ? s.strokeWidth * loadRefScale : 2,
        fontSize: s.fontSize ? s.fontSize * loadRefScale : undefined,
        arrowSize: s.arrowSize ? s.arrowSize * loadRefScale : undefined,
        // curveOffset mit Canvas-Größe skalieren
        curveOffset: s.curveOffset ? {
          x: s.curveOffset.x * loadCanvasWidth,
          y: s.curveOffset.y * loadCanvasHeight
        } : undefined,
        points: s.points?.map(p => ({ x: p.x * loadCanvasWidth, y: p.y * loadCanvasHeight }))
      }));
      
      setShapes(denormalizedShapes);
      setHistory([denormalizedShapes]);
      setHistoryIndex(0);
    } else if (open && !editingComponent) {
      setName("Neue Komponente");
      setCategory('');
      setLabelingEnabled(false);
      setLabelingPriority(1);
      setLabelingColor('#000000');
      setAutoConnectionsEnabled(false);
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

  // Berechnet den Abstand eines Punktes zu einer quadratischen Bezier-Kurve (Approximation)
  const distanceToBezier = (px: number, py: number, x1: number, y1: number, cx: number, cy: number, x2: number, y2: number): number => {
    // Approximiere die Kurve mit mehreren Liniensegmenten
    const segments = 10;
    let minDistance = Infinity;
    
    for (let i = 0; i < segments; i++) {
      const t1 = i / segments;
      const t2 = (i + 1) / segments;
      
      // Quadratische Bezier-Formel: B(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2
      const bx1 = (1 - t1) * (1 - t1) * x1 + 2 * (1 - t1) * t1 * cx + t1 * t1 * x2;
      const by1 = (1 - t1) * (1 - t1) * y1 + 2 * (1 - t1) * t1 * cy + t1 * t1 * y2;
      const bx2 = (1 - t2) * (1 - t2) * x1 + 2 * (1 - t2) * t2 * cx + t2 * t2 * x2;
      const by2 = (1 - t2) * (1 - t2) * y1 + 2 * (1 - t2) * t2 * cy + t2 * t2 * y2;
      
      const dist = distanceToLine(px, py, bx1, by1, bx2, by2);
      if (dist < minDistance) minDistance = dist;
    }
    
    return minDistance;
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
        
        // Prüfe ob es eine gebogene Linie ist
        if (shape.curveOffset && (shape.curveOffset.x !== 0 || shape.curveOffset.y !== 0)) {
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;
          const cx = midX + shape.curveOffset.x;
          const cy = midY + shape.curveOffset.y;
          const distance = distanceToBezier(pos.x, pos.y, x1, y1, cx, cy, x2, y2);
          if (distance <= lineHitArea) return shape;
        } else {
          const distance = distanceToLine(pos.x, pos.y, x1, y1, x2, y2);
          if (distance <= lineHitArea) return shape;
        }
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

    // Fläche-Füllen-Modus: Linien auswählen
    if (fillAreaMode) {
      const shapeAtPos = findShapeAtPosition(rawPos);
      if (shapeAtPos && shapeAtPos.type === 'line') {
        if (fillAreaSelectedIds.includes(shapeAtPos.id)) {
          setFillAreaSelectedIds(fillAreaSelectedIds.filter(id => id !== shapeAtPos.id));
        } else {
          const newSelected = [...fillAreaSelectedIds, shapeAtPos.id];
          setFillAreaSelectedIds(newSelected);
        }
      }
      return;
    }

    if (activeTool === 'select') {
      // Prüfe ob ein Kurven-Kontrollpunkt angeklickt wurde
      if (!moveOnlyMode) {
        for (const id of selectedShapeIds) {
          const shape = shapes.find(s => s.id === id);
          if (shape && (shape.type === 'line' || shape.type === 'arrow')) {
            const midX = shape.x + shape.width / 2 + (shape.curveOffset?.x || 0);
            const midY = shape.y + shape.height / 2 + (shape.curveOffset?.y || 0);
            const hitRadius = handleSize / 2 + 4;
            if (Math.abs(rawPos.x - midX) <= hitRadius && Math.abs(rawPos.y - midY) <= hitRadius) {
              setDraggingCurveControl(shape.id);
              return;
            }
          }
        }
      }

      // Prüfe ob ein Handle angeklickt wurde (nur wenn nicht im "Nur Verschieben"-Modus)
      if (!moveOnlyMode) {
        const clickedShape = shapes.find(s => selectedShapeIds.includes(s.id));
        if (clickedShape) {
          const handle = getHandleAtPosition(clickedShape, rawPos);
          if (handle) {
            setActiveHandle({ shapeId: clickedShape.id, handle });
            return;
          }
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
    if (['rectangle', 'circle', 'line', 'arrow', 'triangle', 'diamond', 'ellipse'].includes(activeTool)) {
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
    const rawPos = getRawMousePosition(e);
    
    // Hover-Position für visuellen Cursor aktualisieren (nicht bei select/text/fillAreaMode)
    if (snapToGrid && activeTool !== 'select' && activeTool !== 'text' && !fillAreaMode) {
      const snappedPos = strictSnapPosition(rawPos);
      setHoverPosition(snappedPos);
    } else {
      setHoverPosition(null);
    }

    // Kurven-Kontrollpunkt ziehen
    if (draggingCurveControl) {
      const shape = shapes.find(s => s.id === draggingCurveControl);
      if (shape) {
        const midX = shape.x + shape.width / 2;
        const midY = shape.y + shape.height / 2;
        const offsetX = rawPos.x - midX;
        const offsetY = rawPos.y - midY;
        setShapes(shapes.map(s => 
          s.id === draggingCurveControl 
            ? { ...s, curveOffset: { x: offsetX, y: offsetY } }
            : s
        ));
      }
      return;
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
    // Kurven-Kontrollpunkt loslassen
    if (draggingCurveControl) {
      setDraggingCurveControl(null);
      pushHistory(shapes);
      return;
    }

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
          // Auswahl zurücksetzen nach Platzierung
          setSelectedShapeIds([]);
        }
      } else if (currentShape.width > 0 && currentShape.height > 0) {
        const newShapes = [...shapes, currentShape];
        setShapes(newShapes);
        pushHistory(newShapes);
        // Auswahl zurücksetzen nach Platzierung
        setSelectedShapeIds([]);
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
      // Calculate text dimensions based on font size
      const fontSize = 14;
      const textWidth = textInput.length * fontSize * 0.6; // Approximate character width
      const textHeight = fontSize * 1.2; // Line height
      
      const newShape: Shape = {
        id: generateId(),
        type: 'text',
        x: textPosition.x,
        y: textPosition.y,
        width: textWidth,
        height: textHeight,
        text: textInput,
        fontSize: fontSize,
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
    // Normalisiere alle Koordinaten und Größen auf 0-1 Bereich
    // WICHTIG: Alle Werte müssen konsistent mit derselben Referenz (canvasWidth/canvasHeight) normalisiert werden
    const refScale = Math.min(canvasWidth, canvasHeight);
    const normalizedShapes = shapes.map(s => ({
      ...s,
      // Normalisiere auf 0-1 Bereich relativ zur jeweiligen Achse
      x: s.x / canvasWidth,
      y: s.y / canvasHeight,
      width: s.width / canvasWidth,
      height: s.height / canvasHeight,
      // Alle anderen Größen (strokeWidth, fontSize, arrowSize) werden mit refScale normalisiert
      // um konsistente Skalierung bei unterschiedlichen Seitenverhältnissen zu gewährleisten
      strokeWidth: s.strokeWidth ? s.strokeWidth / refScale : undefined,
      fontSize: s.fontSize ? s.fontSize / refScale : undefined,
      arrowSize: s.arrowSize ? s.arrowSize / refScale : undefined,
      // curveOffset relativ zur Canvas-Größe speichern
      curveOffset: s.curveOffset ? { 
        x: s.curveOffset.x / canvasWidth, 
        y: s.curveOffset.y / canvasHeight 
      } : undefined,
      points: s.points?.map(p => ({ x: p.x / canvasWidth, y: p.y / canvasHeight }))
    }));
    
    if (isEditing && editingComponent && onUpdate) {
      onUpdate(editingComponent.id, name, normalizedShapes, componentTileSize, category, labelingEnabled, labelingPriority, labelingColor, autoConnectionsEnabled);
    } else {
      onSave(name, normalizedShapes, componentTileSize, category, labelingEnabled, labelingPriority, labelingColor, autoConnectionsEnabled);
    }
    handleClose();
  };

  const handleClose = () => {
    setShapes([]);
    setSelectedShapeIds([]);
    setActiveTool('rectangle');
    setName("Neue Komponente");
    setCategory("");
    setHistory([[]]);
    setHistoryIndex(0);
    setClipboard([]);
    setPolylinePoints([]);
    setIsDrawingPolyline(false);
    setActiveHandle(null);
    setComponentTileSize('1x1');
    setFillColor("");
    setFillAreaMode(false);
    setFillAreaSelectedIds([]);
    setDraggingCurveControl(null);
    setLabelingEnabled(false);
    setLabelingPriority(1);
    setLabelingColor('#000000');
    setAutoConnectionsEnabled(false);
    onClose();
  };

  // Keyboard shortcuts - use capture phase to prevent main editor from receiving events
  useEffect(() => {
    if (!open) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      // Stop propagation for all keyboard events to prevent main editor interference
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'z':
            e.preventDefault();
            e.stopPropagation();
            if (e.shiftKey) redo();
            else undo();
            break;
          case 'y':
            e.preventDefault();
            e.stopPropagation();
            redo();
            break;
          case 'c':
            e.preventDefault();
            e.stopPropagation();
            handleCopy();
            break;
          case 'v':
            e.preventDefault();
            e.stopPropagation();
            handlePaste();
            break;
          case 'd':
            e.preventDefault();
            e.stopPropagation();
            handleDuplicate();
            break;
        }
        return;
      }

      // Stop propagation for tool shortcuts too
      e.stopPropagation();
      
      switch (e.key.toLowerCase()) {
        case 'v': setActiveTool('select'); setSelectedShapeIds([]); break;
        case 'r': setActiveTool('rectangle'); setSelectedShapeIds([]); break;
        case 'c': setActiveTool('circle'); setSelectedShapeIds([]); break;
        case 'l': setActiveTool('line'); setSelectedShapeIds([]); break;
        case 'w': setActiveTool('arrow'); setSelectedShapeIds([]); break;
        case 't': setActiveTool('triangle'); setSelectedShapeIds([]); break;
        case 'd': setActiveTool('diamond'); setSelectedShapeIds([]); break;
        case 'p': setActiveTool('polyline'); setSelectedShapeIds([]); break;
        case 'x': setActiveTool('text'); setSelectedShapeIds([]); break;
        case 'g': setSnapToGrid(!snapToGrid); break;
        case 'f': setFillAreaMode(!fillAreaMode); setFillAreaSelectedIds([]); break;
        case 'delete':
        case 'backspace':
          handleDelete();
          break;
        case 'escape':
          if (fillAreaMode) {
            setFillAreaMode(false);
            setFillAreaSelectedIds([]);
          } else if (isDrawingPolyline) {
            setPolylinePoints([]);
            setIsDrawingPolyline(false);
          } else {
            setSelectedShapeIds([]);
          }
          break;
      }
    };

    // Use capture phase to intercept events before they reach the main editor
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [open, selectedShapeIds, shapes, isDrawingPolyline, snapToGrid, fillAreaMode, undo, redo]);

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

  // Hilfsfunktion: Punkte einer Linie (gerade oder gebogen) ermitteln
  const getLinePoints = useCallback((line: Shape, numSegments: number = 10): Point[] => {
    const x1 = line.x;
    const y1 = line.y;
    const x2 = line.x + line.width;
    const y2 = line.y + line.height;
    
    if (line.curveOffset && (line.curveOffset.x !== 0 || line.curveOffset.y !== 0)) {
      // Gebogene Linie - Bezier-Punkte berechnen
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const cx = midX + line.curveOffset.x;
      const cy = midY + line.curveOffset.y;
      
      const points: Point[] = [];
      for (let i = 0; i <= numSegments; i++) {
        const t = i / numSegments;
        // Quadratische Bezier-Formel: B(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2
        const bx = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cx + t * t * x2;
        const by = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cy + t * t * y2;
        points.push({ x: bx, y: by });
      }
      return points;
    } else {
      // Gerade Linie
      return [{ x: x1, y: y1 }, { x: x2, y: y2 }];
    }
  }, []);

  // Funktion zum Erkennen geschlossener Linienzüge (mit Kurvenunterstützung)
  const findClosedPolygonWithCurves = useCallback((lineShapes: Shape[]): { points: Point[], lineOrder: { line: Shape, reversed: boolean }[] } | null => {
    const lines = lineShapes.filter(s => s.type === 'line');
    if (lines.length < 3) return null;
    
    const tolerance = gridSize * 0.5;
    
    const getEndpoints = (line: Shape): [Point, Point] => [
      { x: line.x, y: line.y },
      { x: line.x + line.width, y: line.y + line.height }
    ];
    
    const pointsEqual = (p1: Point, p2: Point): boolean => {
      return Math.abs(p1.x - p2.x) < tolerance && Math.abs(p1.y - p2.y) < tolerance;
    };
    
    // Versuche einen geschlossenen Pfad zu finden und merke die Reihenfolge
    const findPath = (
      startLine: Shape, 
      usedLines: Set<string>, 
      path: Point[],
      lineOrder: { line: Shape, reversed: boolean }[]
    ): { points: Point[], lineOrder: { line: Shape, reversed: boolean }[] } | null => {
      const [start, end] = getEndpoints(startLine);
      const currentEnd = path[path.length - 1];
      
      let nextPoint: Point;
      let reversed: boolean;
      if (pointsEqual(start, currentEnd)) {
        nextPoint = end;
        reversed = false;
      } else if (pointsEqual(end, currentEnd)) {
        nextPoint = start;
        reversed = true;
      } else {
        return null;
      }
      
      path.push(nextPoint);
      usedLines.add(startLine.id);
      lineOrder.push({ line: startLine, reversed });
      
      if (path.length >= 4 && pointsEqual(nextPoint, path[0])) {
        return { points: path, lineOrder };
      }
      
      for (const line of lines) {
        if (usedLines.has(line.id)) continue;
        const [lineStart, lineEnd] = getEndpoints(line);
        if (pointsEqual(lineStart, nextPoint) || pointsEqual(lineEnd, nextPoint)) {
          const result = findPath(line, new Set(usedLines), [...path], [...lineOrder]);
          if (result) return result;
        }
      }
      
      return null;
    };
    
    for (const startLine of lines) {
      const [start, end] = getEndpoints(startLine);
      
      for (const line of lines) {
        if (line.id === startLine.id) continue;
        const [lineStart, lineEnd] = getEndpoints(line);
        if (pointsEqual(lineStart, end) || pointsEqual(lineEnd, end)) {
          const result = findPath(line, new Set([startLine.id]), [start, end], [{ line: startLine, reversed: false }]);
          if (result) return result;
        }
      }
    }
    
    return null;
  }, [gridSize]);

  // Erstelle Polygon-Punkte aus der Linienreihenfolge (mit Kurven)
  const buildPolygonPoints = useCallback((lineOrder: { line: Shape, reversed: boolean }[]): Point[] => {
    const allPoints: Point[] = [];
    
    for (const { line, reversed } of lineOrder) {
      const linePoints = getLinePoints(line, 10);
      const orderedPoints = reversed ? [...linePoints].reverse() : linePoints;
      
      // Füge Punkte hinzu, aber überspringe den ersten wenn er dem letzten entspricht
      for (let i = 0; i < orderedPoints.length; i++) {
        if (allPoints.length === 0 || i > 0) {
          allPoints.push(orderedPoints[i]);
        }
      }
    }
    
    // Entferne den letzten Punkt wenn er dem ersten entspricht (geschlossen)
    if (allPoints.length > 1) {
      const first = allPoints[0];
      const last = allPoints[allPoints.length - 1];
      if (Math.abs(first.x - last.x) < 1 && Math.abs(first.y - last.y) < 1) {
        allPoints.pop();
      }
    }
    
    return allPoints;
  }, [getLinePoints]);

  // Prüfe ob ausgewählte Linien ein geschlossenes Polygon bilden
  const selectedLines = shapes.filter(s => selectedShapeIds.includes(s.id) && s.type === 'line');
  const closedPolygonResult = selectedLines.length >= 3 ? findClosedPolygonWithCurves(selectedLines) : null;
  const closedPolygonPoints = closedPolygonResult ? buildPolygonPoints(closedPolygonResult.lineOrder) : null;

  // Funktion zum Erstellen eines gefüllten Polygons aus Linien
  const handleCreateFilledPolygon = () => {
    if (!closedPolygonPoints || closedPolygonPoints.length < 3) return;
    
    // Berechne Bounding Box
    const minX = Math.min(...closedPolygonPoints.map(p => p.x));
    const maxX = Math.max(...closedPolygonPoints.map(p => p.x));
    const minY = Math.min(...closedPolygonPoints.map(p => p.y));
    const maxY = Math.max(...closedPolygonPoints.map(p => p.y));
    
    const newShape: Shape = {
      id: generateId(),
      type: 'polygon',
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      points: closedPolygonPoints,
      fillColor: fillColor || '#3b82f6',
      strokeWidth: strokeWidth
    };
    
    // Entferne die ausgewählten Linien und füge das Polygon hinzu
    const newShapes = shapes.filter(s => !selectedShapeIds.includes(s.id));
    newShapes.push(newShape);
    setShapes(newShapes);
    pushHistory(newShapes);
    setSelectedShapeIds([newShape.id]);
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
      case 'line': {
        const x1 = shape.x;
        const y1 = shape.y;
        const x2 = shape.x + shape.width;
        const y2 = shape.y + shape.height;
        
        // Curved line (quadratic bezier)
        if (shape.curveOffset && (shape.curveOffset.x !== 0 || shape.curveOffset.y !== 0)) {
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;
          const cx = midX + shape.curveOffset.x;
          const cy = midY + shape.curveOffset.y;
          return <path d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`} fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />;
        }
        return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={sw} strokeLinecap="round" />;
      }
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
      case 'polygon':
        if (!shape.points || shape.points.length < 3) return null;
        return <polygon points={shape.points.map(p => `${p.x},${p.y}`).join(' ')} fill={fill} stroke={stroke} strokeWidth={sw} transform={transform} />;
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
      // Start- und Endpunkt für Linien und Pfeile + Kurven-Kontrollpunkt in der Mitte
      const midX = shape.x + shape.width / 2 + (shape.curveOffset?.x || 0);
      const midY = shape.y + shape.height / 2 + (shape.curveOffset?.y || 0);
      
      return (
        <>
          {/* Startpunkt */}
          <circle
            cx={shape.x}
            cy={shape.y}
            r={handleSize / 2}
            fill="white"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            style={{ cursor: 'crosshair' }}
          />
          {/* Kurven-Kontrollpunkt (Mitte) */}
          <circle
            cx={midX}
            cy={midY}
            r={handleSize / 2}
            fill="hsl(var(--primary))"
            stroke="white"
            strokeWidth={2}
            style={{ cursor: 'move' }}
          />
          {/* Endpunkt */}
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
      <DialogContent className="max-w-5xl max-h-[90vh] p-4 flex flex-col overflow-hidden">
        <DialogHeader className="pb-2 flex-shrink-0">
          <DialogTitle>{isEditing ? `"${editingComponent?.name}" bearbeiten` : 'Komponente erstellen'}</DialogTitle>
          <DialogDescription className="sr-only">
            Zeichne Formen um eine neue Komponente zu erstellen
          </DialogDescription>
        </DialogHeader>
        
        {/* Toolbar - kompakt oben */}
        <div className="flex items-center gap-1 p-1.5 bg-muted/50 rounded-lg flex-wrap flex-shrink-0">
          <ToolBtn icon={MousePointer2} label="Auswählen" shortcut="V" isActive={activeTool === 'select'} onClick={() => { setActiveTool('select'); setSelectedShapeIds([]); }} />
          <Separator orientation="vertical" className="h-5 mx-0.5" />
          <ToolBtn icon={Square} label="Rechteck" shortcut="R" isActive={activeTool === 'rectangle'} onClick={() => { setActiveTool('rectangle'); setSelectedShapeIds([]); }} />
          <ToolBtn icon={Circle} label="Kreis" shortcut="C" isActive={activeTool === 'circle'} onClick={() => { setActiveTool('circle'); setSelectedShapeIds([]); }} />
          <ToolBtn icon={Minus} label="Linie" shortcut="L" isActive={activeTool === 'line'} onClick={() => { setActiveTool('line'); setSelectedShapeIds([]); }} />
          <ToolBtn icon={ArrowRight} label="Pfeil" shortcut="W" isActive={activeTool === 'arrow'} onClick={() => { setActiveTool('arrow'); setSelectedShapeIds([]); }} />
          <ToolBtn icon={Triangle} label="Dreieck" shortcut="T" isActive={activeTool === 'triangle'} onClick={() => { setActiveTool('triangle'); setSelectedShapeIds([]); }} />
          <ToolBtn icon={Diamond} label="Raute" shortcut="D" isActive={activeTool === 'diamond'} onClick={() => { setActiveTool('diamond'); setSelectedShapeIds([]); }} />
          <ToolBtn icon={Spline} label="Polylinie" shortcut="P" isActive={activeTool === 'polyline'} onClick={() => { setActiveTool('polyline'); setSelectedShapeIds([]); }} />
          <ToolBtn icon={Type} label="Text" shortcut="X" isActive={activeTool === 'text'} onClick={() => { setActiveTool('text'); setSelectedShapeIds([]); }} />
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

        {/* Hauptbereich: Optionen links, Canvas rechts - scrollbar */}
        <div className="flex gap-4 mt-2 flex-1 min-h-0 overflow-hidden">
          {/* Linke Seite - Optionen mit Scroll */}
          <ScrollArea className="w-52 flex-shrink-0">
            <div className="space-y-3 pr-3">
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

            {/* Kategorie */}
            <div className="space-y-1">
              <Label htmlFor="component-category" className="text-xs">Kategorie</Label>
              <div className="relative">
                <Input
                  id="component-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="z.B. Heizung, Sanitär..."
                  className="h-8 text-sm"
                  list="category-suggestions"
                />
                {existingCategories.length > 0 && (
                  <datalist id="category-suggestions">
                    {existingCategories.map((cat) => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                )}
              </div>
            </div>

            {/* Beschriftung */}
            <div className="space-y-2 p-2 bg-muted/30 rounded">
              <div className="flex items-center gap-2">
                <Switch
                  id="labeling-enabled"
                  checked={labelingEnabled}
                  onCheckedChange={setLabelingEnabled}
                />
                <Label htmlFor="labeling-enabled" className="cursor-pointer text-xs font-medium">
                  Beschriftung aktivieren
                </Label>
              </div>
              
              {labelingEnabled && (
                <div className="space-y-2 pl-1">
                  <div className="space-y-1">
                    <Label htmlFor="labeling-priority" className="text-xs text-muted-foreground">
                      Priorität (1 = zuerst beschriften)
                    </Label>
                    <Input
                      id="labeling-priority"
                      type="number"
                      min={1}
                      max={99}
                      value={labelingPriority}
                      onChange={(e) => setLabelingPriority(Math.max(1, parseInt(e.target.value) || 1))}
                      className="h-8 text-sm w-20"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Schriftfarbe
                    </Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={labelingColor}
                        onChange={(e) => setLabelingColor(e.target.value)}
                        className="w-8 h-8 rounded border cursor-pointer"
                      />
                      <span className="text-xs font-mono">{labelingColor}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Komponenten mit Priorität 1 erhalten Nummern 1.1, 1.2, ..., dann Priorität 2 usw.
                  </p>
                </div>
              )}
            </div>

            {/* Auto-Verbindungen */}
            <div className="space-y-2 p-2 bg-muted/30 rounded">
              <div className="flex items-center gap-2">
                <Switch
                  id="auto-connections-enabled"
                  checked={autoConnectionsEnabled}
                  onCheckedChange={setAutoConnectionsEnabled}
                />
                <Label htmlFor="auto-connections-enabled" className="cursor-pointer text-xs font-medium">
                  Auto-Verbindungen aktivieren
                </Label>
              </div>
              {autoConnectionsEnabled && (
                <p className="text-xs text-muted-foreground pl-1">
                  Zeichnet automatisch gestrichelte Linien zu allen Komponenten mit aktivierter Beschriftung.
                </p>
              )}
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

            {/* Nur Verschieben Modus */}
            <div className="flex items-center gap-2">
              <Switch
                id="move-only"
                checked={moveOnlyMode}
                onCheckedChange={setMoveOnlyMode}
              />
              <Label htmlFor="move-only" className="flex items-center gap-1 cursor-pointer text-xs">
                <MousePointer2 className="w-3 h-3" />
                Nur Verschieben
              </Label>
            </div>

            {/* Fläche Füllen Modus */}
            <div className="flex items-center gap-2">
              <Switch
                id="fill-area"
                checked={fillAreaMode}
                onCheckedChange={(checked) => {
                  setFillAreaMode(checked);
                  if (!checked) setFillAreaSelectedIds([]);
                }}
              />
              <Label htmlFor="fill-area" className="flex items-center gap-1 cursor-pointer text-xs">
                <PaintBucket className="w-3 h-3" />
                Fläche füllen
              </Label>
            </div>

            {/* Fläche Füllen Steuerung */}
            {fillAreaMode && (
              <div className="p-2 bg-muted/50 rounded space-y-2">
                <p className="text-xs text-muted-foreground">
                  Klicke auf Linien um sie auszuwählen. Bei geschlossener Form erscheint die Füll-Option.
                </p>
                <p className="text-xs font-medium">
                  Ausgewählt: {fillAreaSelectedIds.length} Linien
                </p>
                {(() => {
                  const fillAreaLines = shapes.filter(s => fillAreaSelectedIds.includes(s.id) && s.type === 'line');
                  const fillAreaResult = fillAreaLines.length >= 3 ? findClosedPolygonWithCurves(fillAreaLines) : null;
                  const fillAreaPolygonPoints = fillAreaResult ? buildPolygonPoints(fillAreaResult.lineOrder) : null;
                  
                  if (fillAreaPolygonPoints && fillAreaPolygonPoints.length >= 3) {
                    return (
                      <div className="space-y-2">
                        <p className="text-xs text-green-600 font-medium">✓ Geschlossene Form erkannt!</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={fillColor || "#3b82f6"}
                            onChange={(e) => setFillColor(e.target.value)}
                            className="w-6 h-6 rounded border cursor-pointer"
                          />
                          <Button 
                            size="sm" 
                            className="h-7 text-xs flex-1"
                            onClick={() => {
                              // Berechne Bounding Box
                              const minX = Math.min(...fillAreaPolygonPoints.map(p => p.x));
                              const maxX = Math.max(...fillAreaPolygonPoints.map(p => p.x));
                              const minY = Math.min(...fillAreaPolygonPoints.map(p => p.y));
                              const maxY = Math.max(...fillAreaPolygonPoints.map(p => p.y));
                              
                              const newShape: Shape = {
                                id: generateId(),
                                type: 'polygon',
                                x: minX,
                                y: minY,
                                width: maxX - minX,
                                height: maxY - minY,
                                points: fillAreaPolygonPoints,
                                fillColor: fillColor || '#3b82f6',
                                strokeWidth: strokeWidth
                              };
                              
                              // Entferne die ausgewählten Linien und füge das Polygon hinzu
                              const newShapes = shapes.filter(s => !fillAreaSelectedIds.includes(s.id));
                              newShapes.push(newShape);
                              setShapes(newShapes);
                              pushHistory(newShapes);
                              setSelectedShapeIds([newShape.id]);
                              setFillAreaMode(false);
                              setFillAreaSelectedIds([]);
                            }}
                          >
                            <PaintBucket className="w-3 h-3 mr-1" />
                            Fläche füllen
                          </Button>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-7 text-xs w-full"
                  onClick={() => setFillAreaSelectedIds([])}
                >
                  Auswahl zurücksetzen
                </Button>
              </div>
            )}

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
              const hasStroke = isLineShape || ['rectangle', 'circle', 'ellipse', 'triangle', 'diamond', 'polygon'].includes(selectedShape.type);
              const hasFill = ['rectangle', 'circle', 'ellipse', 'triangle', 'diamond', 'polygon'].includes(selectedShape.type);
              
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
                            onValueChange={([v]) => {
                              // Recalculate text dimensions when font size changes
                              const textLength = selectedShape.text?.length || 5;
                              const newWidth = textLength * v * 0.6;
                              const newHeight = v * 1.2;
                              updateSelectedShape({ fontSize: v, width: newWidth, height: newHeight });
                            }}
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
                          onChange={(e) => {
                            // Recalculate text dimensions when text changes
                            const fontSize = selectedShape.fontSize || 14;
                            const newWidth = e.target.value.length * fontSize * 0.6;
                            const newHeight = fontSize * 1.2;
                            updateSelectedShape({ text: e.target.value, width: newWidth, height: newHeight });
                          }}
                          className="h-7 text-xs"
                          placeholder="Text..."
                        />
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            {/* Geschlossene Fläche füllen - erscheint wenn Linien ein geschlossenes Polygon bilden */}
            {closedPolygonPoints && closedPolygonPoints.length >= 3 && (
              <div className="p-2 bg-blue-50 dark:bg-blue-950 rounded border border-blue-200 dark:border-blue-800">
                <div className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-2">
                  Geschlossene Fläche erkannt!
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <Label className="text-xs">Füllfarbe:</Label>
                  <input
                    type="color"
                    value={fillColor || "#3b82f6"}
                    onChange={(e) => setFillColor(e.target.value)}
                    className="w-6 h-6 rounded border cursor-pointer"
                  />
                </div>
                <Button 
                  size="sm" 
                  className="w-full h-7 text-xs gap-1"
                  onClick={handleCreateFilledPolygon}
                >
                  <PaintBucket className="w-3 h-3" />
                  Fläche füllen
                </Button>
              </div>
            )}

            {/* Status */}
            <div className="text-xs text-muted-foreground pt-2">
              {shapes.length} Elemente
            </div>
            </div>
          </ScrollArea>

          {/* Rechte Seite - Canvas */}
          <div className="flex-1 flex justify-center items-start overflow-auto">
            <div className="relative">
              <svg
                width={canvasWidth + 1}
                height={canvasHeight + 1}
                viewBox={`0 0 ${canvasWidth + 1} ${canvasHeight + 1}`}
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
                {/* Right and bottom edge lines to complete the grid */}
                <line x1={canvasWidth} y1={0} x2={canvasWidth} y2={canvasHeight} stroke="#9ca3af" strokeWidth="1" />
                <line x1={0} y1={canvasHeight} x2={canvasWidth} y2={canvasHeight} stroke="#9ca3af" strokeWidth="1" />
                
                {/* Tile cell boundaries - exact grid lines for each cell */}
                {(() => {
                  const cellWidth = canvasWidth / tileSizeConfig.cols;
                  const cellHeight = canvasHeight / tileSizeConfig.rows;
                  const lines: JSX.Element[] = [];
                  
                  // Vertical cell boundaries
                  for (let col = 0; col <= tileSizeConfig.cols; col++) {
                    const x = col * cellWidth;
                    lines.push(
                      <line
                        key={`v-${col}`}
                        x1={x}
                        y1={0}
                        x2={x}
                        y2={canvasHeight}
                        stroke="#374151"
                        strokeWidth={1}
                      />
                    );
                  }
                  
                  // Horizontal cell boundaries
                  for (let row = 0; row <= tileSizeConfig.rows; row++) {
                    const y = row * cellHeight;
                    lines.push(
                      <line
                        key={`h-${row}`}
                        x1={0}
                        y1={y}
                        x2={canvasWidth}
                        y2={y}
                        stroke="#374151"
                        strokeWidth={1}
                      />
                    );
                  }
                  
                  return lines;
                })()}


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
                {isDrawingPolyline && polylinePoints.length > 0 && (() => {
                  // Prüfe ob die Polyline geschlossen ist (erstes und letztes Punkt in der Nähe)
                  const tolerance = gridSize * 0.5;
                  const firstPoint = polylinePoints[0];
                  const lastPoint = polylinePoints[polylinePoints.length - 1];
                  const isClosed = polylinePoints.length >= 3 && 
                    Math.abs(firstPoint.x - lastPoint.x) < tolerance && 
                    Math.abs(firstPoint.y - lastPoint.y) < tolerance;
                  
                  return (
                    <polyline
                      points={polylinePoints.map(p => `${p.x},${p.y}`).join(' ')}
                      fill="none"
                      stroke={isClosed ? "hsl(220, 25%, 20%)" : "hsl(var(--muted-foreground))"}
                      strokeWidth={strokeWidth}
                      strokeDasharray={isClosed ? undefined : "4 2"}
                    />
                  );
                })()}

                {/* Fill Area Mode - Markierte Linien hervorheben */}
                {fillAreaMode && fillAreaSelectedIds.map(id => {
                  const shape = shapes.find(s => s.id === id);
                  if (!shape || shape.type !== 'line') return null;
                  
                  const x1 = shape.x;
                  const y1 = shape.y;
                  const x2 = shape.x + shape.width;
                  const y2 = shape.y + shape.height;
                  
                  // Gebogene Linie
                  if (shape.curveOffset && (shape.curveOffset.x !== 0 || shape.curveOffset.y !== 0)) {
                    const midX = (x1 + x2) / 2;
                    const midY = (y1 + y2) / 2;
                    const cx = midX + shape.curveOffset.x;
                    const cy = midY + shape.curveOffset.y;
                    return (
                      <path
                        key={`fill-${id}`}
                        d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`}
                        fill="none"
                        stroke="hsl(var(--primary))"
                        strokeWidth={(shape.strokeWidth || 2) + 4}
                        strokeLinecap="round"
                        opacity={0.5}
                      />
                    );
                  }
                  
                  // Gerade Linie
                  return (
                    <line
                      key={`fill-${id}`}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="hsl(var(--primary))"
                      strokeWidth={(shape.strokeWidth || 2) + 4}
                      strokeLinecap="round"
                      opacity={0.5}
                    />
                  );
                })}

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
                      {!moveOnlyMode && renderHandles(shape)}
                    </g>
                  );
                })}

                {/* Hover cursor indicator - rendered last to always be visible */}
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

        <DialogFooter className="pt-3 border-t mt-3 flex-shrink-0">
          <Button variant="outline" onClick={handleClose}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={shapes.length === 0}>
            Komponente speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
