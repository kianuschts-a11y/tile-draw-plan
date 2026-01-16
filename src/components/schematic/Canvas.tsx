import { useRef, useState, useCallback, useEffect } from "react";
import { CanvasState, Component, PAPER_SIZES, MM_TO_PX, Shape, ConnectionDirection } from "@/types/schematic";
import { ShapeRenderer } from "./ShapeRenderer";
import { MainToolType } from "./Toolbar";

export interface PlacedTile {
  id: string;
  component: Component;
  gridX: number; // Grid cell X position
  gridY: number; // Grid cell Y position
  activeVariationId?: string; // Active variation for this tile
  connectedDirections?: ConnectionDirection[]; // Track which directions are connected
}

interface CanvasProps {
  tiles: PlacedTile[];
  selectedTileIds: Set<string>;
  activeTool: MainToolType;
  canvasState: CanvasState;
  onTilesChange: (tiles: PlacedTile[]) => void;
  onSelectionChange: (ids: Set<string>) => void;
  onCanvasStateChange: (state: CanvasState) => void;
  onDropComponent: (component: Component, gridX: number, gridY: number) => void;
}

// Determine connection direction based on relative positions
function getConnectionDirection(
  fromTile: PlacedTile,
  toTile: PlacedTile
): { fromDirection: ConnectionDirection; toDirection: ConnectionDirection } | null {
  const fromRight = fromTile.gridX + (fromTile.component.width || 1);
  const fromBottom = fromTile.gridY + (fromTile.component.height || 1);
  const toRight = toTile.gridX + (toTile.component.width || 1);
  const toBottom = toTile.gridY + (toTile.component.height || 1);

  // Check if horizontally adjacent (from is left of to)
  if (fromRight === toTile.gridX && 
      fromTile.gridY < toBottom && fromBottom > toTile.gridY) {
    return { fromDirection: 'right', toDirection: 'left' };
  }
  // Check if horizontally adjacent (from is right of to)
  if (toRight === fromTile.gridX && 
      fromTile.gridY < toBottom && fromBottom > toTile.gridY) {
    return { fromDirection: 'left', toDirection: 'right' };
  }
  // Check if vertically adjacent (from is above to)
  if (fromBottom === toTile.gridY && 
      fromTile.gridX < toRight && fromRight > toTile.gridX) {
    return { fromDirection: 'bottom', toDirection: 'top' };
  }
  // Check if vertically adjacent (from is below to)
  if (toBottom === fromTile.gridY && 
      fromTile.gridX < toRight && fromRight > toTile.gridX) {
    return { fromDirection: 'top', toDirection: 'bottom' };
  }
  
  return null; // Not adjacent
}

// Determine which corner variation to use based on connected directions
function getCornerType(directions: ConnectionDirection[]): ConnectionDirection | null {
  const hasLeft = directions.includes('left');
  const hasRight = directions.includes('right');
  const hasTop = directions.includes('top');
  const hasBottom = directions.includes('bottom');
  
  // Corner combinations
  if (hasTop && hasLeft) return 'corner-tl';
  if (hasTop && hasRight) return 'corner-tr';
  if (hasBottom && hasLeft) return 'corner-bl';
  if (hasBottom && hasRight) return 'corner-br';
  
  // Horizontal/vertical through connections
  if (hasLeft && hasRight) return 'horizontal';
  if (hasTop && hasBottom) return 'vertical';
  
  return null;
}

// Find the best variation for given connected directions
function findVariationForDirections(component: Component, directions: ConnectionDirection[]): string | null {
  if (!component.variations || directions.length === 0) return null;
  
  // If only one direction, find simple match
  if (directions.length === 1) {
    const dir = directions[0];
    const exactMatch = component.variations.find(v => v.connectionType === dir);
    if (exactMatch) return exactMatch.id;
    
    // Fallback to horizontal/vertical
    if (dir === 'left' || dir === 'right') {
      const horizontal = component.variations.find(v => v.connectionType === 'horizontal');
      if (horizontal) return horizontal.id;
    }
    if (dir === 'top' || dir === 'bottom') {
      const vertical = component.variations.find(v => v.connectionType === 'vertical');
      if (vertical) return vertical.id;
    }
    return null;
  }
  
  // Multiple directions - find corner or through connection
  const combinedType = getCornerType(directions);
  if (combinedType) {
    const match = component.variations.find(v => v.connectionType === combinedType);
    if (match) return match.id;
  }
  
  return null;
}

export function Canvas({
  tiles,
  selectedTileIds,
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
  const [dragStartPositions, setDragStartPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [dragStartMousePos, setDragStartMousePos] = useState({ x: 0, y: 0 });
  
  // Selection box state
  const [isSelectionBox, setIsSelectionBox] = useState(false);
  const [selectionBoxStart, setSelectionBoxStart] = useState({ x: 0, y: 0 });
  const [selectionBoxEnd, setSelectionBoxEnd] = useState({ x: 0, y: 0 });
  
  // Connect tool state
  const [connectStartTileId, setConnectStartTileId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectedTileIds, setConnectedTileIds] = useState<Set<string>>(new Set());

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

  // Get raw canvas position (not snapped to grid)
  const getCanvasPosition = useCallback((e: React.MouseEvent): { x: number; y: number } => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - canvasState.panX) / canvasState.zoom;
    const y = (e.clientY - rect.top - canvasState.panY) / canvasState.zoom;
    return { x, y };
  }, [canvasState]);

  // Find tile at grid position
  const getTileAtPosition = useCallback((gridX: number, gridY: number): PlacedTile | null => {
    for (const tile of tiles) {
      const tileWidth = tile.component.width || 1;
      const tileHeight = tile.component.height || 1;
      
      if (gridX >= tile.gridX && gridX < tile.gridX + tileWidth &&
          gridY >= tile.gridY && gridY < tile.gridY + tileHeight) {
        return tile;
      }
    }
    return null;
  }, [tiles]);

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

  // Connect two tiles by setting their variations (with corner detection)
  const connectTiles = useCallback((fromTile: PlacedTile, toTile: PlacedTile) => {
    const directions = getConnectionDirection(fromTile, toTile);
    if (!directions) return; // Not adjacent
    
    onTilesChange(tiles.map(t => {
      if (t.id === fromTile.id) {
        // Add new direction to existing connected directions
        const existingDirs = t.connectedDirections || [];
        const newDirs = existingDirs.includes(directions.fromDirection) 
          ? existingDirs 
          : [...existingDirs, directions.fromDirection];
        const variation = findVariationForDirections(t.component, newDirs);
        return { 
          ...t, 
          connectedDirections: newDirs,
          activeVariationId: variation || t.activeVariationId 
        };
      }
      if (t.id === toTile.id) {
        // Add new direction to existing connected directions
        const existingDirs = t.connectedDirections || [];
        const newDirs = existingDirs.includes(directions.toDirection) 
          ? existingDirs 
          : [...existingDirs, directions.toDirection];
        const variation = findVariationForDirections(t.component, newDirs);
        return { 
          ...t, 
          connectedDirections: newDirs,
          activeVariationId: variation || t.activeVariationId 
        };
      }
      return t;
    }));
  }, [tiles, onTilesChange]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;

    if (activeTool === 'pan') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - canvasState.panX, y: e.clientY - canvasState.panY });
      return;
    }

    if (activeTool === 'connect') {
      // Start connecting - check if mouse is over a tile
      const { gridX, gridY } = getGridPosition(e);
      const tile = getTileAtPosition(gridX, gridY);
      if (tile) {
        setConnectStartTileId(tile.id);
        setIsConnecting(true);
        setConnectedTileIds(new Set([tile.id]));
      }
      return;
    }

    if (activeTool === 'select') {
      // Start selection box on empty space
      const pos = getCanvasPosition(e);
      setSelectionBoxStart(pos);
      setSelectionBoxEnd(pos);
      setIsSelectionBox(true);
      onSelectionChange(new Set());
    }
  }, [activeTool, canvasState.panX, canvasState.panY, onSelectionChange, getGridPosition, getTileAtPosition, getCanvasPosition]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      onCanvasStateChange({
        ...canvasState,
        panX: e.clientX - panStart.x,
        panY: e.clientY - panStart.y
      });
      return;
    }

    // Selection box mode - expand selection box and select tiles within
    if (isSelectionBox && activeTool === 'select') {
      const pos = getCanvasPosition(e);
      setSelectionBoxEnd(pos);
      
      // Calculate selection box bounds
      const minX = Math.min(selectionBoxStart.x, pos.x);
      const maxX = Math.max(selectionBoxStart.x, pos.x);
      const minY = Math.min(selectionBoxStart.y, pos.y);
      const maxY = Math.max(selectionBoxStart.y, pos.y);
      
      // Find all tiles that intersect with the selection box
      const selectedIds = new Set<string>();
      for (const tile of tiles) {
        const tileX = tile.gridX * tileSize;
        const tileY = tile.gridY * tileSize;
        const tileWidth = (tile.component.width || 1) * tileSize;
        const tileHeight = (tile.component.height || 1) * tileSize;
        
        // Check if tile intersects with selection box
        if (tileX < maxX && tileX + tileWidth > minX &&
            tileY < maxY && tileY + tileHeight > minY) {
          selectedIds.add(tile.id);
        }
      }
      onSelectionChange(selectedIds);
      return;
    }

    // Connect mode - drag over tiles to connect them
    if (isConnecting && activeTool === 'connect') {
      const { gridX, gridY } = getGridPosition(e);
      const tile = getTileAtPosition(gridX, gridY);
      
      if (tile && !connectedTileIds.has(tile.id)) {
        // Find the last connected tile
        const connectedArray = Array.from(connectedTileIds);
        const lastTileId = connectedArray[connectedArray.length - 1];
        const lastTile = tiles.find(t => t.id === lastTileId);
        
        if (lastTile) {
          // Try to connect lastTile with current tile
          connectTiles(lastTile, tile);
          setConnectedTileIds(prev => new Set([...prev, tile.id]));
        }
      }
      return;
    }

    // Dragging selected tiles (supports multiple tiles)
    if (isDragging && selectedTileIds.size > 0) {
      const pos = getCanvasPosition(e);
      const dx = Math.floor((pos.x - dragStartMousePos.x) / tileSize);
      const dy = Math.floor((pos.y - dragStartMousePos.y) / tileSize);
      
      if (dx !== 0 || dy !== 0) {
        // Check if all tiles can be moved
        let canMove = true;
        const newPositions = new Map<string, { x: number; y: number }>();
        
        for (const tileId of selectedTileIds) {
          const startPos = dragStartPositions.get(tileId);
          const tile = tiles.find(t => t.id === tileId);
          if (!startPos || !tile) continue;
          
          const newX = startPos.x + dx;
          const newY = startPos.y + dy;
          
          // Check bounds
          if (newX < 0 || newY < 0 || 
              newX + (tile.component.width || 1) > gridCols ||
              newY + (tile.component.height || 1) > gridRows) {
            canMove = false;
            break;
          }
          
          // Check collision with non-selected tiles
          for (let cx = 0; cx < (tile.component.width || 1); cx++) {
            for (let cy = 0; cy < (tile.component.height || 1); cy++) {
              const checkTile = getTileAtPosition(newX + cx, newY + cy);
              if (checkTile && !selectedTileIds.has(checkTile.id)) {
                canMove = false;
                break;
              }
            }
            if (!canMove) break;
          }
          if (!canMove) break;
          
          newPositions.set(tileId, { x: newX, y: newY });
        }
        
        if (canMove && newPositions.size === selectedTileIds.size) {
          onTilesChange(tiles.map(t => {
            const newPos = newPositions.get(t.id);
            if (newPos) {
              return { ...t, gridX: newPos.x, gridY: newPos.y };
            }
            return t;
          }));
          
          // Update start positions for next move
          setDragStartMousePos(pos);
          const updatedStartPositions = new Map<string, { x: number; y: number }>();
          for (const [id, oldPos] of dragStartPositions) {
            const newPos = newPositions.get(id);
            if (newPos) {
              updatedStartPositions.set(id, newPos);
            } else {
              updatedStartPositions.set(id, oldPos);
            }
          }
          setDragStartPositions(updatedStartPositions);
        }
      }
    }
  }, [isPanning, isDragging, isSelectionBox, isConnecting, selectedTileIds, canvasState, panStart, getGridPosition, getCanvasPosition, getTileAtPosition, tiles, onCanvasStateChange, onTilesChange, onSelectionChange, canPlaceComponent, activeTool, connectedTileIds, connectTiles, selectionBoxStart, tileSize, gridCols, gridRows, dragStartMousePos, dragStartPositions]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setIsDragging(false);
    setIsSelectionBox(false);
    setIsConnecting(false);
    setConnectStartTileId(null);
    setConnectedTileIds(new Set());
  }, []);

  const handleTileMouseDown = useCallback((e: React.MouseEvent, tile: PlacedTile) => {
    e.stopPropagation();
    
    if (activeTool === 'connect') {
      // Start connect from this tile
      setConnectStartTileId(tile.id);
      setIsConnecting(true);
      setConnectedTileIds(new Set([tile.id]));
      return;
    }
    
    if (activeTool !== 'select') return;
    
    // Check if clicking on already selected tile - start drag
    if (selectedTileIds.has(tile.id)) {
      // Start dragging all selected tiles
      const pos = getCanvasPosition(e);
      setDragStartMousePos(pos);
      const startPositions = new Map<string, { x: number; y: number }>();
      for (const tileId of selectedTileIds) {
        const t = tiles.find(t => t.id === tileId);
        if (t) {
          startPositions.set(tileId, { x: t.gridX, y: t.gridY });
        }
      }
      setDragStartPositions(startPositions);
      setIsDragging(true);
    } else {
      // Select this tile and start dragging
      onSelectionChange(new Set([tile.id]));
      const pos = getCanvasPosition(e);
      setDragStartMousePos(pos);
      setDragStartPositions(new Map([[tile.id, { x: tile.gridX, y: tile.gridY }]]));
      setIsDragging(true);
    }
  }, [activeTool, onSelectionChange, selectedTileIds, tiles, getCanvasPosition]);

  // Handle click-to-click connection
  const handleTileClick = useCallback((e: React.MouseEvent, tile: PlacedTile) => {
    if (activeTool !== 'connect') return;
    
    e.stopPropagation();
    
    if (connectStartTileId && connectStartTileId !== tile.id && !isConnecting) {
      // Second click - connect the two tiles
      const startTile = tiles.find(t => t.id === connectStartTileId);
      if (startTile) {
        connectTiles(startTile, tile);
      }
      setConnectStartTileId(tile.id); // Set this as new start for chaining
    } else if (!isConnecting) {
      // First click - set as start tile
      setConnectStartTileId(tile.id);
    }
  }, [activeTool, connectStartTileId, isConnecting, tiles, connectTiles]);

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
      
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedTileIds.size > 0) {
        onTilesChange(tiles.filter(t => !selectedTileIds.has(t.id)));
        onSelectionChange(new Set());
      }
      if (e.key === 'Escape') {
        onSelectionChange(new Set());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTileIds, tiles, onTilesChange, onSelectionChange]);

  const getCursor = () => {
    if (activeTool === 'pan') return isPanning ? 'grabbing' : 'grab';
    if (activeTool === 'connect') return isConnecting ? 'crosshair' : 'crosshair';
    if (isDragging) return 'grabbing';
    return 'default';
  };

  // Render a component's shapes scaled to tile size (accounting for multi-cell components)
  const renderTileShapes = (tile: PlacedTile) => {
    const component = tile.component;
    const compWidth = (component.width || 1) * tileSize;
    const compHeight = (component.height || 1) * tileSize;
    
    // Berechne den Referenz-Skalierungsfaktor basierend auf der kleineren Dimension
    // Dies stellt sicher, dass Linienbreiten und Text proportional bleiben
    const refScale = Math.min(compWidth, compHeight);
    
    // Get all shapes to render (base + active variation)
    let shapesToRender = [...component.shapes];
    if (tile.activeVariationId && component.variations) {
      const activeVariation = component.variations.find(v => v.id === tile.activeVariationId);
      if (activeVariation) {
        shapesToRender = [...shapesToRender, ...activeVariation.shapes];
      }
    }
    
    return shapesToRender.map((shape, idx) => {
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
          const isSelected = selectedTileIds.has(tile.id);
          const isConnectStart = activeTool === 'connect' && tile.id === connectStartTileId;
          const isBeingConnected = activeTool === 'connect' && connectedTileIds.has(tile.id);
          
          return (
            <g
              key={tile.id}
              transform={`translate(${x}, ${y})`}
              onMouseDown={(e) => handleTileMouseDown(e, tile)}
              onClick={(e) => handleTileClick(e, tile)}
              style={{ cursor: activeTool === 'select' || activeTool === 'connect' ? 'pointer' : 'inherit' }}
            >
              {/* Tile background - sized for multi-cell components */}
              <rect
                width={compWidth}
                height={compHeight}
                fill={
                  isConnectStart 
                    ? "hsl(var(--primary) / 0.2)" 
                    : isBeingConnected 
                      ? "hsl(var(--primary) / 0.1)" 
                      : isSelected 
                        ? "hsl(var(--primary) / 0.1)" 
                        : "hsl(var(--muted) / 0.3)"
                }
                stroke={
                  isConnectStart || isBeingConnected 
                    ? "hsl(var(--primary))" 
                    : isSelected 
                      ? "hsl(var(--primary))" 
                      : "transparent"
                }
                strokeWidth={2}
              />
              {/* Component shapes */}
              {renderTileShapes(tile)}
            </g>
          );
        })}

        {/* Selection box */}
        {isSelectionBox && (
          <rect
            x={Math.min(selectionBoxStart.x, selectionBoxEnd.x)}
            y={Math.min(selectionBoxStart.y, selectionBoxEnd.y)}
            width={Math.abs(selectionBoxEnd.x - selectionBoxStart.x)}
            height={Math.abs(selectionBoxEnd.y - selectionBoxStart.y)}
            fill="hsl(var(--primary) / 0.1)"
            stroke="hsl(var(--primary))"
            strokeWidth={1}
            strokeDasharray="4 2"
          />
        )}

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
