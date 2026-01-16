import { useRef, useState, useCallback, useEffect } from "react";
import { CanvasState, Component, PAPER_SIZES, MM_TO_PX, Shape, TILE_SIZES } from "@/types/schematic";
import { ShapeRenderer } from "./ShapeRenderer";

export interface PlacedTile {
  id: string;
  component: Component;
  gridX: number; // Grid cell X position
  gridY: number; // Grid cell Y position
}

interface CanvasProps {
  tiles: PlacedTile[];
  selectedTileId: string | null;
  activeTool: 'select' | 'pan';
  canvasState: CanvasState;
  onTilesChange: (tiles: PlacedTile[]) => void;
  onSelectionChange: (id: string | null) => void;
  onCanvasStateChange: (state: CanvasState) => void;
  onDropComponent: (component: Component, gridX: number, gridY: number) => void;
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
  const [dragStartGrid, setDragStartGrid] = useState({ x: 0, y: 0 });

  // Calculate paper dimensions in pixels
  const paperSize = PAPER_SIZES[canvasState.paperFormat];
  const paperWidth = canvasState.orientation === 'portrait' 
    ? paperSize.width * MM_TO_PX 
    : paperSize.height * MM_TO_PX;
  const paperHeight = canvasState.orientation === 'portrait' 
    ? paperSize.height * MM_TO_PX 
    : paperSize.width * MM_TO_PX;

  const tileSize = canvasState.gridSize;
  
  // Calculate grid dimensions
  const gridCols = Math.floor(paperWidth / tileSize);
  const gridRows = Math.floor(paperHeight / tileSize);

  const getGridPosition = useCallback((e: React.MouseEvent | React.DragEvent): { gridX: number; gridY: number } => {
    if (!svgRef.current) return { gridX: 0, gridY: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - canvasState.panX) / canvasState.zoom;
    const y = (e.clientY - rect.top - canvasState.panY) / canvasState.zoom;
    
    const gridX = Math.floor(x / tileSize);
    const gridY = Math.floor(y / tileSize);
    
    return { 
      gridX: Math.max(0, Math.min(gridX, gridCols - 1)), 
      gridY: Math.max(0, Math.min(gridY, gridRows - 1)) 
    };
  }, [canvasState, tileSize, gridCols, gridRows]);

  // Check if a position is occupied by any tile (considering multi-cell tiles)
  const isPositionOccupied = useCallback((gridX: number, gridY: number, excludeTileId?: string): boolean => {
    for (const tile of tiles) {
      if (tile.id === excludeTileId) continue;
      
      const tileWidth = tile.component.width || 1;
      const tileHeight = tile.component.height || 1;
      
      // Check if the position falls within this tile's bounds
      if (gridX >= tile.gridX && gridX < tile.gridX + tileWidth &&
          gridY >= tile.gridY && gridY < tile.gridY + tileHeight) {
        return true;
      }
    }
    return false;
  }, [tiles]);

  // Check if a component can be placed at a position
  const canPlaceComponent = useCallback((component: Component, gridX: number, gridY: number, excludeTileId?: string): boolean => {
    const compWidth = component.width || 1;
    const compHeight = component.height || 1;
    
    // Check bounds
    if (gridX + compWidth > gridCols || gridY + compHeight > gridRows) {
      return false;
    }
    
    // Check all cells the component would occupy
    for (let dx = 0; dx < compWidth; dx++) {
      for (let dy = 0; dy < compHeight; dy++) {
        if (isPositionOccupied(gridX + dx, gridY + dy, excludeTileId)) {
          return false;
        }
      }
    }
    return true;
  }, [gridCols, gridRows, isPositionOccupied]);

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
      const { gridX, gridY } = getGridPosition(e);
      const tile = tiles.find(t => t.id === selectedTileId);
      if (tile && (tile.gridX !== gridX || tile.gridY !== gridY)) {
        // Check if position is valid for this component
        if (canPlaceComponent(tile.component, gridX, gridY, selectedTileId)) {
          onTilesChange(tiles.map(t => 
            t.id === selectedTileId ? { ...t, gridX, gridY } : t
          ));
        }
      }
    }
  }, [isPanning, isDragging, selectedTileId, canvasState, panStart, getGridPosition, tiles, onCanvasStateChange, onTilesChange, canPlaceComponent]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setIsDragging(false);
  }, []);

  const handleTileMouseDown = useCallback((e: React.MouseEvent, tile: PlacedTile) => {
    if (activeTool !== 'select') return;
    
    e.stopPropagation();
    onSelectionChange(tile.id);
    setDragStartGrid({ x: tile.gridX, y: tile.gridY });
    setIsDragging(true);
  }, [activeTool, onSelectionChange]);

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
      const { gridX, gridY } = getGridPosition(e);
      
      // Check if component can be placed
      if (canPlaceComponent(component, gridX, gridY)) {
        onDropComponent(component, gridX, gridY);
      }
    } catch (err) {
      console.error('Failed to parse dropped component:', err);
    }
  }, [getGridPosition, canPlaceComponent, onDropComponent]);

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

  // Render a component's shapes scaled to tile size (accounting for multi-cell components)
  const renderTileShapes = (component: Component) => {
    const compWidth = (component.width || 1) * tileSize;
    const compHeight = (component.height || 1) * tileSize;
    
    // Berechne den Referenz-Skalierungsfaktor basierend auf der kleineren Dimension
    // Dies stellt sicher, dass Linienbreiten und Text proportional bleiben
    const refScale = Math.min(compWidth, compHeight);
    
    return component.shapes.map((shape, idx) => {
      // Scale normalized shapes (0-1) to actual component size
      const scaledShape: Shape = {
        ...shape,
        x: shape.x * compWidth,
        y: shape.y * compHeight,
        width: shape.width * compWidth,
        height: shape.height * compHeight,
        // strokeWidth, fontSize und arrowSize wurden als Bruchteil der baseCanvasSize (300) gespeichert
        // Skaliere proportional zur Referenzgröße
        strokeWidth: shape.strokeWidth ? shape.strokeWidth * refScale : undefined,
        fontSize: shape.fontSize ? shape.fontSize * refScale : undefined,
        arrowSize: shape.arrowSize ? shape.arrowSize * refScale : undefined
      };
      return <ShapeRenderer key={idx} shape={scaledShape} />;
    });
  };

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
          id="tile-grid"
          width={tileSize}
          height={tileSize}
          patternUnits="userSpaceOnUse"
        >
          <rect 
            width={tileSize} 
            height={tileSize} 
            fill="none" 
            stroke="hsl(var(--canvas-grid))" 
            strokeWidth="1"
          />
        </pattern>
      </defs>

      <g transform={`translate(${canvasState.panX}, ${canvasState.panY}) scale(${canvasState.zoom})`}>
        {/* Paper shadow */}
        <rect
          x={4}
          y={4}
          width={gridCols * tileSize}
          height={gridRows * tileSize}
          fill="hsl(var(--foreground) / 0.1)"
          rx={2}
        />
        
        {/* Paper background */}
        <rect
          x={0}
          y={0}
          width={gridCols * tileSize}
          height={gridRows * tileSize}
          fill="white"
          stroke="hsl(var(--border))"
          strokeWidth={2}
          rx={2}
        />
        
        {/* Grid overlay - each cell is one tile */}
        <rect
          x={0}
          y={0}
          width={gridCols * tileSize}
          height={gridRows * tileSize}
          fill="url(#tile-grid)"
        />

        {/* Placed tiles */}
        {tiles.map(tile => {
          const x = tile.gridX * tileSize;
          const y = tile.gridY * tileSize;
          const compWidth = (tile.component.width || 1) * tileSize;
          const compHeight = (tile.component.height || 1) * tileSize;
          const isSelected = tile.id === selectedTileId;
          
          return (
            <g
              key={tile.id}
              transform={`translate(${x}, ${y})`}
              onMouseDown={(e) => handleTileMouseDown(e, tile)}
              style={{ cursor: activeTool === 'select' ? 'pointer' : 'inherit' }}
            >
              {/* Tile background - sized for multi-cell components */}
              <rect
                width={compWidth}
                height={compHeight}
                fill={isSelected ? "hsl(var(--primary) / 0.1)" : "hsl(var(--muted) / 0.3)"}
                stroke={isSelected ? "hsl(var(--primary))" : "transparent"}
                strokeWidth={2}
              />
              {/* Component shapes */}
              {renderTileShapes(tile.component)}
            </g>
          );
        })}

        {/* Paper dimensions label */}
        <text
          x={(gridCols * tileSize) / 2}
          y={gridRows * tileSize + 20}
          textAnchor="middle"
          fontSize={12}
          fill="hsl(var(--muted-foreground))"
        >
          {gridCols} × {gridRows} Kacheln ({tileSize}px)
        </text>
      </g>
    </svg>
  );
}
