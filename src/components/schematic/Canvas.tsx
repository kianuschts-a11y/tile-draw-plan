import { useRef, useState, useCallback, useEffect } from "react";
import { CanvasState, Component, PAPER_SIZES, MM_TO_PX, Shape } from "@/types/schematic";
import { ShapeRenderer } from "./ShapeRenderer";

interface PlacedTile {
  id: string;
  component: Component;
  x: number;
  y: number;
}

interface CanvasProps {
  tiles: PlacedTile[];
  selectedTileId: string | null;
  activeTool: 'select' | 'pan';
  canvasState: CanvasState;
  onTilesChange: (tiles: PlacedTile[]) => void;
  onSelectionChange: (id: string | null) => void;
  onCanvasStateChange: (state: CanvasState) => void;
  onDropComponent: (component: Component, x: number, y: number) => void;
}

export interface PlacedTileType {
  id: string;
  component: Component;
  x: number;
  y: number;
}

export function Canvas({
  tiles,
  selectedTileId,
  activeTool,
  canvasState,
  onTilesChange,
  onSelectionChange,
  onCanvasStateChange,
  onDropComponent
}: CanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Calculate paper dimensions in pixels
  const paperSize = PAPER_SIZES[canvasState.paperFormat];
  const paperWidth = canvasState.orientation === 'portrait' 
    ? paperSize.width * MM_TO_PX 
    : paperSize.height * MM_TO_PX;
  const paperHeight = canvasState.orientation === 'portrait' 
    ? paperSize.height * MM_TO_PX 
    : paperSize.width * MM_TO_PX;

  const getMousePosition = useCallback((e: React.MouseEvent | React.DragEvent): { x: number; y: number } => {
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

    if (activeTool === 'pan') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - canvasState.panX, y: e.clientY - canvasState.panY });
      return;
    }

    if (activeTool === 'select') {
      onSelectionChange(null);
    }
  }, [activeTool, canvasState.panX, canvasState.panY, onSelectionChange]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      onCanvasStateChange({
        ...canvasState,
        panX: e.clientX - panStart.x,
        panY: e.clientY - panStart.y
      });
      return;
    }

    if (isDragging && selectedTileId) {
      const pos = getMousePosition(e);
      onTilesChange(tiles.map(t => 
        t.id === selectedTileId 
          ? { ...t, x: pos.x - dragOffset.x, y: pos.y - dragOffset.y }
          : t
      ));
    }
  }, [isPanning, isDragging, selectedTileId, canvasState, panStart, getMousePosition, tiles, dragOffset, onCanvasStateChange, onTilesChange]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setIsDragging(false);
  }, []);

  const handleTileMouseDown = useCallback((e: React.MouseEvent, tile: PlacedTile) => {
    if (activeTool !== 'select') return;
    
    e.stopPropagation();
    onSelectionChange(tile.id);
    
    const pos = getMousePosition(e);
    setDragOffset({ x: pos.x - tile.x, y: pos.y - tile.y });
    setIsDragging(true);
  }, [activeTool, getMousePosition, onSelectionChange]);

  // Drag and drop handling
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const componentData = e.dataTransfer.getData('application/json');
    if (!componentData) return;

    try {
      const component: Component = JSON.parse(componentData);
      const pos = getMousePosition(e);
      onDropComponent(component, pos.x, pos.y);
    } catch (err) {
      console.error('Failed to parse dropped component:', err);
    }
  }, [getMousePosition, onDropComponent]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedTileId) {
        onTilesChange(tiles.filter(t => t.id !== selectedTileId));
        onSelectionChange(null);
      }
      if (e.key === 'Escape') {
        onSelectionChange(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTileId, tiles, onTilesChange, onSelectionChange]);

  const getCursor = () => {
    if (activeTool === 'pan') return isPanning ? 'grabbing' : 'grab';
    if (isDragging) return 'grabbing';
    return 'default';
  };

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
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
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
        
        {/* Paper background */}
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
        
        {/* Grid overlay */}
        <rect
          x={0}
          y={0}
          width={paperWidth}
          height={paperHeight}
          fill={`url(#${majorGridPatternId})`}
          rx={2}
        />

        {/* Placed tiles */}
        {tiles.map(tile => (
          <g
            key={tile.id}
            transform={`translate(${tile.x}, ${tile.y})`}
            onMouseDown={(e) => handleTileMouseDown(e, tile)}
            style={{ cursor: activeTool === 'select' ? 'pointer' : 'inherit' }}
          >
            {/* Selection highlight */}
            {tile.id === selectedTileId && (
              <rect
                x={-4}
                y={-4}
                width={tile.component.width + 8}
                height={tile.component.height + 8}
                fill="hsl(var(--primary) / 0.1)"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                strokeDasharray="4 2"
                rx={4}
              />
            )}
            {/* Component shapes */}
            {tile.component.shapes.map((shape, idx) => (
              <ShapeRenderer key={idx} shape={shape} />
            ))}
          </g>
        ))}

        {/* Paper dimensions label */}
        <text
          x={paperWidth / 2}
          y={paperHeight + 20}
          textAnchor="middle"
          fontSize={12}
          fill="hsl(var(--muted-foreground))"
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
