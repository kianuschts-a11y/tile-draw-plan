import { useRef, useState, useCallback, useEffect } from "react";
import { Shape, ToolType, CanvasState, ShapeType, PAPER_SIZES, MM_TO_PX } from "@/types/schematic";
import { ShapeRenderer } from "./ShapeRenderer";
import { SelectionHandles } from "./SelectionHandles";

interface CanvasProps {
  shapes: Shape[];
  selectedShapeId: string | null;
  activeTool: ToolType;
  canvasState: CanvasState;
  onShapesChange: (shapes: Shape[]) => void;
  onSelectionChange: (id: string | null) => void;
  onCanvasStateChange: (state: CanvasState) => void;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function Canvas({
  shapes,
  selectedShapeId,
  activeTool,
  canvasState,
  onShapesChange,
  onSelectionChange,
  onCanvasStateChange
}: CanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [currentShape, setCurrentShape] = useState<Shape | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // Calculate paper dimensions in pixels
  const paperSize = PAPER_SIZES[canvasState.paperFormat];
  const paperWidth = canvasState.orientation === 'portrait' 
    ? paperSize.width * MM_TO_PX 
    : paperSize.height * MM_TO_PX;
  const paperHeight = canvasState.orientation === 'portrait' 
    ? paperSize.height * MM_TO_PX 
    : paperSize.width * MM_TO_PX;

  const getMousePosition = useCallback((e: React.MouseEvent): { x: number; y: number } => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - canvasState.panX) / canvasState.zoom;
    const y = (e.clientY - rect.top - canvasState.panY) / canvasState.zoom;
    
    // Snap to grid
    const snappedX = Math.round(x / canvasState.gridSize) * canvasState.gridSize;
    const snappedY = Math.round(y / canvasState.gridSize) * canvasState.gridSize;
    
    return { x: snappedX, y: snappedY };
  }, [canvasState]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    
    const pos = getMousePosition(e);

    if (activeTool === 'pan') {
      setIsPanning(true);
      setDrawStart({ x: e.clientX - canvasState.panX, y: e.clientY - canvasState.panY });
      return;
    }

    if (activeTool === 'select') {
      // Check if clicking on empty space
      onSelectionChange(null);
      return;
    }

    // Drawing tools
    if (['rectangle', 'circle', 'line', 'triangle', 'diamond', 'ellipse'].includes(activeTool)) {
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
  }, [activeTool, canvasState, getMousePosition, onSelectionChange]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      onCanvasStateChange({
        ...canvasState,
        panX: e.clientX - drawStart.x,
        panY: e.clientY - drawStart.y
      });
      return;
    }

    if (isDragging && selectedShapeId) {
      const pos = getMousePosition(e);
      onShapesChange(shapes.map(s => 
        s.id === selectedShapeId 
          ? { ...s, x: pos.x - dragOffset.x, y: pos.y - dragOffset.y }
          : s
      ));
      return;
    }

    if (isDrawing && currentShape) {
      const pos = getMousePosition(e);
      let width = pos.x - drawStart.x;
      let height = pos.y - drawStart.y;
      let x = drawStart.x;
      let y = drawStart.y;

      // Handle negative dimensions
      if (width < 0) {
        x = pos.x;
        width = Math.abs(width);
      }
      if (height < 0) {
        y = pos.y;
        height = Math.abs(height);
      }

      setCurrentShape({
        ...currentShape,
        x,
        y,
        width: Math.max(width, canvasState.gridSize),
        height: Math.max(height, canvasState.gridSize)
      });
    }
  }, [isPanning, isDragging, isDrawing, currentShape, canvasState, drawStart, getMousePosition, shapes, selectedShapeId, dragOffset, onCanvasStateChange, onShapesChange]);

  const handleMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (isDragging) {
      setIsDragging(false);
      return;
    }

    if (isDrawing && currentShape && currentShape.width > 0 && currentShape.height > 0) {
      onShapesChange([...shapes, currentShape]);
      onSelectionChange(currentShape.id);
    }
    
    setIsDrawing(false);
    setCurrentShape(null);
  }, [isPanning, isDragging, isDrawing, currentShape, shapes, onShapesChange, onSelectionChange]);

  const handleShapeMouseDown = useCallback((e: React.MouseEvent, shape: Shape) => {
    if (activeTool !== 'select') return;
    
    e.stopPropagation();
    onSelectionChange(shape.id);
    
    const pos = getMousePosition(e);
    setDragOffset({ x: pos.x - shape.x, y: pos.y - shape.y });
    setIsDragging(true);
  }, [activeTool, getMousePosition, onSelectionChange]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      
      switch (e.key.toLowerCase()) {
        case 'delete':
        case 'backspace':
          if (selectedShapeId) {
            onShapesChange(shapes.filter(s => s.id !== selectedShapeId));
            onSelectionChange(null);
          }
          break;
        case 'escape':
          onSelectionChange(null);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedShapeId, shapes, onShapesChange, onSelectionChange]);

  const getCursor = () => {
    if (activeTool === 'pan') return isPanning ? 'grabbing' : 'grab';
    if (activeTool === 'select') return isDragging ? 'grabbing' : 'default';
    return 'crosshair';
  };

  // Generate grid pattern for paper
  const gridPatternId = `grid-${canvasState.gridSize}`;
  const majorGridPatternId = `major-grid-${canvasState.gridSize}`;

  return (
    <svg
      ref={svgRef}
      className="w-full h-full bg-muted/30"
      style={{ cursor: getCursor() }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Define grid patterns */}
      <defs>
        <pattern
          id={gridPatternId}
          width={canvasState.gridSize}
          height={canvasState.gridSize}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M ${canvasState.gridSize} 0 L 0 0 0 ${canvasState.gridSize}`}
            fill="none"
            stroke="hsl(var(--canvas-grid))"
            strokeWidth="0.5"
          />
        </pattern>
        <pattern
          id={majorGridPatternId}
          width={canvasState.gridSize * 5}
          height={canvasState.gridSize * 5}
          patternUnits="userSpaceOnUse"
        >
          <rect width={canvasState.gridSize * 5} height={canvasState.gridSize * 5} fill={`url(#${gridPatternId})`} />
          <path
            d={`M ${canvasState.gridSize * 5} 0 L 0 0 0 ${canvasState.gridSize * 5}`}
            fill="none"
            stroke="hsl(var(--canvas-grid-major))"
            strokeWidth="1"
          />
        </pattern>
      </defs>

      <g transform={`translate(${canvasState.panX}, ${canvasState.panY}) scale(${canvasState.zoom})`}>
        {/* Paper shadow */}
        <rect
          x={4}
          y={4}
          width={paperWidth}
          height={paperHeight}
          fill="hsl(var(--foreground) / 0.1)"
          rx={2}
        />
        
        {/* Paper background with grid */}
        <rect
          x={0}
          y={0}
          width={paperWidth}
          height={paperHeight}
          fill="white"
          stroke="hsl(var(--border))"
          strokeWidth={1}
          rx={2}
        />
        
        {/* Grid overlay on paper */}
        <rect
          x={0}
          y={0}
          width={paperWidth}
          height={paperHeight}
          fill={`url(#${majorGridPatternId})`}
          rx={2}
        />

        {/* Clip content to paper */}
        <clipPath id="paper-clip">
          <rect x={0} y={0} width={paperWidth} height={paperHeight} />
        </clipPath>

        <g clipPath="url(#paper-clip)">
          {/* Render existing shapes */}
          {shapes.map(shape => (
            <ShapeRenderer
              key={shape.id}
              shape={shape}
              isSelected={shape.id === selectedShapeId}
              onMouseDown={(e) => handleShapeMouseDown(e, shape)}
            />
          ))}
          
          {/* Render current drawing shape */}
          {currentShape && (
            <ShapeRenderer shape={currentShape} />
          )}
          
          {/* Selection handles */}
          {selectedShapeId && shapes.find(s => s.id === selectedShapeId) && (
            <SelectionHandles shape={shapes.find(s => s.id === selectedShapeId)!} />
          )}
        </g>

        {/* Paper dimensions label */}
        <text
          x={paperWidth / 2}
          y={paperHeight + 20}
          textAnchor="middle"
          className="text-xs fill-muted-foreground"
          fontSize={12}
        >
          {canvasState.orientation === 'portrait' 
            ? `${paperSize.width} × ${paperSize.height} mm`
            : `${paperSize.height} × ${paperSize.width} mm`
          }
        </text>
      </g>
    </svg>
  );
}
