import { useRef, useState, useCallback, useEffect } from "react";
import { CanvasState, Component, PAPER_SIZES, MM_TO_PX, Shape, CellConnection, ComponentGroup, GroupLayoutData } from "@/types/schematic";
import { ShapeRenderer } from "./ShapeRenderer";
import { MainToolType } from "./Toolbar";
import { generateSingleConnectionLine, areCellsAdjacent, generateConnectionId } from "@/lib/connectionUtils";
import { CONNECTION_BLOCKS } from "@/lib/connectionBlocks";

function generateTileId(): string {
  return Math.random().toString(36).substring(2, 11);
}

/**
 * Bestimmt den passenden Verbindungsblock für eine leere Zelle basierend auf
 * der vorherigen und nächsten Zelle im Pfad sowie benachbarten Komponenten
 */
function getConnectionBlockForPath(
  prevCell: { gridX: number; gridY: number } | null,
  currentCell: { gridX: number; gridY: number },
  nextCell: { gridX: number; gridY: number } | null,
  tiles: PlacedTile[] = []
): Component | null {
  if (!prevCell && !nextCell) return null;
  
  // Richtungen aus dem Pfad ermitteln
  const fromLeft = prevCell && prevCell.gridX < currentCell.gridX;
  const fromRight = prevCell && prevCell.gridX > currentCell.gridX;
  const fromTop = prevCell && prevCell.gridY < currentCell.gridY;
  const fromBottom = prevCell && prevCell.gridY > currentCell.gridY;
  
  const toLeft = nextCell && nextCell.gridX < currentCell.gridX;
  const toRight = nextCell && nextCell.gridX > currentCell.gridX;
  const toTop = nextCell && nextCell.gridY < currentCell.gridY;
  const toBottom = nextCell && nextCell.gridY > currentCell.gridY;
  
  // Prüfe ob es am Anfang oder Ende eine benachbarte Komponente gibt
  // Hilfsfunktion: Prüft ob eine Zelle von einer Komponente belegt ist
  const hasTileAt = (gx: number, gy: number): boolean => {
    return tiles.some(tile => {
      const w = tile.component.width || 1;
      const h = tile.component.height || 1;
      return gx >= tile.gridX && gx < tile.gridX + w &&
             gy >= tile.gridY && gy < tile.gridY + h;
    });
  };
  
  // Am Anfang des Pfads: Prüfe ob Komponente in der entgegengesetzten Richtung ist
  let adjacentLeft = false;
  let adjacentRight = false;
  let adjacentTop = false;
  let adjacentBottom = false;
  
  if (!prevCell) {
    // Anfang des Pfads - prüfe alle benachbarten Zellen auf Komponenten
    adjacentLeft = hasTileAt(currentCell.gridX - 1, currentCell.gridY);
    adjacentRight = hasTileAt(currentCell.gridX + 1, currentCell.gridY);
    adjacentTop = hasTileAt(currentCell.gridX, currentCell.gridY - 1);
    adjacentBottom = hasTileAt(currentCell.gridX, currentCell.gridY + 1);
  }
  
  if (!nextCell) {
    // Ende des Pfads - prüfe alle benachbarten Zellen auf Komponenten
    adjacentLeft = adjacentLeft || hasTileAt(currentCell.gridX - 1, currentCell.gridY);
    adjacentRight = adjacentRight || hasTileAt(currentCell.gridX + 1, currentCell.gridY);
    adjacentTop = adjacentTop || hasTileAt(currentCell.gridX, currentCell.gridY - 1);
    adjacentBottom = adjacentBottom || hasTileAt(currentCell.gridX, currentCell.gridY + 1);
  }
  
  // Alle aktiven Richtungen (Pfad + benachbarte Komponenten)
  const hasLeft = fromLeft || toLeft || adjacentLeft;
  const hasRight = fromRight || toRight || adjacentRight;
  const hasTop = fromTop || toTop || adjacentTop;
  const hasBottom = fromBottom || toBottom || adjacentBottom;
  
  // Zähle aktive Richtungen
  const directions = [hasLeft, hasRight, hasTop, hasBottom].filter(Boolean).length;
  
  if (directions === 4) {
    return CONNECTION_BLOCKS.find(b => b.id === 'connection-cross') || null;
  }
  
  if (directions === 3) {
    // T-Stück
    if (!hasTop) return CONNECTION_BLOCKS.find(b => b.id === 'connection-t-top') || null;
    if (!hasBottom) return CONNECTION_BLOCKS.find(b => b.id === 'connection-t-bottom') || null;
    if (!hasLeft) return CONNECTION_BLOCKS.find(b => b.id === 'connection-t-left') || null;
    if (!hasRight) return CONNECTION_BLOCKS.find(b => b.id === 'connection-t-right') || null;
  }
  
  if (directions === 2) {
    // Gerade Linie oder Ecke
    if (hasLeft && hasRight) return CONNECTION_BLOCKS.find(b => b.id === 'connection-horizontal') || null;
    if (hasTop && hasBottom) return CONNECTION_BLOCKS.find(b => b.id === 'connection-vertical') || null;
    
    // Ecken (Namensgebung nach der offenen Ecke)
    if (hasRight && hasBottom) return CONNECTION_BLOCKS.find(b => b.id === 'connection-corner-tr') || null;  // ┌
    if (hasLeft && hasBottom) return CONNECTION_BLOCKS.find(b => b.id === 'connection-corner-tl') || null;   // ┐
    if (hasRight && hasTop) return CONNECTION_BLOCKS.find(b => b.id === 'connection-corner-br') || null;     // └
    if (hasLeft && hasTop) return CONNECTION_BLOCKS.find(b => b.id === 'connection-corner-bl') || null;      // ┘
  }
  
  if (directions === 1) {
    // Einzelne Richtung - verlängere die Linie
    if (hasLeft || hasRight) return CONNECTION_BLOCKS.find(b => b.id === 'connection-horizontal') || null;
    if (hasTop || hasBottom) return CONNECTION_BLOCKS.find(b => b.id === 'connection-vertical') || null;
  }
  
  return null;
}

export interface PlacedTile {
  id: string;
  component: Component;
  gridX: number; // Grid cell X position
  gridY: number; // Grid cell Y position
}

interface CanvasProps {
  tiles: PlacedTile[];
  selectedTileIds: Set<string>;
  activeTool: MainToolType;
  canvasState: CanvasState;
  connections: CellConnection[];
  connectionColor: string;
  draggingComponent: Component | null;
  isGroupMode?: boolean;
  components?: Component[];
  onTilesChange: (tiles: PlacedTile[]) => void;
  onSelectionChange: (ids: Set<string>) => void;
  onCanvasStateChange: (state: CanvasState) => void;
  onDropComponent: (component: Component, gridX: number, gridY: number) => void;
  onDropGroup?: (group: ComponentGroup, gridX: number, gridY: number) => void;
  onConnectionsChange: (connections: CellConnection[]) => void;
  onDragEnd: () => void;
}

export function Canvas({
  tiles,
  selectedTileIds,
  activeTool,
  canvasState,
  connections,
  connectionColor,
  draggingComponent,
  isGroupMode = false,
  components = [],
  onTilesChange,
  onSelectionChange,
  onCanvasStateChange,
  onDropComponent,
  onDropGroup,
  onConnectionsChange,
  onDragEnd
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
  
  // Drop preview state
  const [dropPreview, setDropPreview] = useState<{
    gridX: number;
    gridY: number;
    width: number;
    height: number;
    canPlace: boolean;
  } | null>(null);
  
  // Connect tool state - path drawing mode
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionPath, setConnectionPath] = useState<{ gridX: number; gridY: number }[]>([]);

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

  // Get raw canvas position (not snapped to grid)
  const getCanvasPosition = useCallback((e: React.MouseEvent | React.DragEvent): { x: number; y: number } => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - canvasState.panX) / canvasState.zoom;
    const y = (e.clientY - rect.top - canvasState.panY) / canvasState.zoom;
    return { x, y };
  }, [canvasState]);

  // Get grid cell position from canvas position
  const getGridFromCanvas = useCallback((canvasX: number, canvasY: number): { gridX: number; gridY: number } => {
    return {
      gridX: Math.floor(canvasX / tileSize),
      gridY: Math.floor(canvasY / tileSize)
    };
  }, [tileSize]);

  const getGridPosition = useCallback((e: React.MouseEvent | React.DragEvent): { gridX: number; gridY: number } => {
    const { x, y } = getCanvasPosition(e);
    const gridX = Math.floor(x / tileSize);
    const gridY = Math.floor(y / tileSize);
    return { 
      gridX: Math.max(0, Math.min(gridX, gridCols - 1)), 
      gridY: Math.max(0, Math.min(gridY, gridRows - 1)) 
    };
  }, [getCanvasPosition, tileSize, gridCols, gridRows]);

  // Find tile at grid position and return the specific cell within that tile
  const getTileAndCellAtPosition = useCallback((gridX: number, gridY: number): {
    tile: PlacedTile;
    cellX: number;
    cellY: number;
  } | null => {
    for (const tile of tiles) {
      const tileWidth = tile.component.width || 1;
      const tileHeight = tile.component.height || 1;
      
      if (gridX >= tile.gridX && gridX < tile.gridX + tileWidth &&
          gridY >= tile.gridY && gridY < tile.gridY + tileHeight) {
        return {
          tile,
          cellX: gridX - tile.gridX,
          cellY: gridY - tile.gridY
        };
      }
    }
    return null;
  }, [tiles]);

  // Check if a position is occupied by any tile
  const isPositionOccupied = useCallback((gridX: number, gridY: number, excludeTileId?: string): boolean => {
    for (const tile of tiles) {
      if (tile.id === excludeTileId) continue;
      
      const tileWidth = tile.component.width || 1;
      const tileHeight = tile.component.height || 1;
      
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
    
    if (gridX + compWidth > gridCols || gridY + compHeight > gridRows) {
      return false;
    }
    
    for (let dx = 0; dx < compWidth; dx++) {
      for (let dy = 0; dy < compHeight; dy++) {
        if (isPositionOccupied(gridX + dx, gridY + dy, excludeTileId)) {
          return false;
        }
      }
    }
    return true;
  }, [gridCols, gridRows, isPositionOccupied]);

  // Check if a connection already exists between two cells
  const connectionExists = useCallback((
    tile1Id: string, cell1X: number, cell1Y: number,
    tile2Id: string, cell2X: number, cell2Y: number
  ): boolean => {
    return connections.some(c => 
      (c.fromTileId === tile1Id && c.fromCellX === cell1X && c.fromCellY === cell1Y &&
       c.toTileId === tile2Id && c.toCellX === cell2X && c.toCellY === cell2Y) ||
      (c.fromTileId === tile2Id && c.fromCellX === cell2X && c.fromCellY === cell2Y &&
       c.toTileId === tile1Id && c.toCellX === cell1X && c.toCellY === cell1Y)
    );
  }, [connections]);

  // Create a connection between two adjacent cells (replaces existing if any)
  const createConnection = useCallback((
    fromTile: PlacedTile, fromCellX: number, fromCellY: number,
    toTile: PlacedTile, toCellX: number, toCellY: number
  ) => {
    const fromWidth = fromTile.component.width || 1;
    const fromHeight = fromTile.component.height || 1;
    const toWidth = toTile.component.width || 1;
    const toHeight = toTile.component.height || 1;
    
    const adjacency = areCellsAdjacent(
      fromTile.gridX, fromTile.gridY, fromWidth, fromHeight, fromCellX, fromCellY,
      toTile.gridX, toTile.gridY, toWidth, toHeight, toCellX, toCellY
    );
    
    if (!adjacency) return; // Not adjacent
    
    // Remove existing connection between these cells (to allow color change)
    const filteredConnections = connections.filter(c => {
      const matchesForward = c.fromTileId === fromTile.id && c.fromCellX === fromCellX && c.fromCellY === fromCellY &&
                             c.toTileId === toTile.id && c.toCellX === toCellX && c.toCellY === toCellY;
      const matchesReverse = c.fromTileId === toTile.id && c.fromCellX === toCellX && c.fromCellY === toCellY &&
                             c.toTileId === fromTile.id && c.toCellX === fromCellX && c.toCellY === fromCellY;
      return !matchesForward && !matchesReverse;
    });
    
    const newConnection: CellConnection = {
      id: generateConnectionId(),
      fromTileId: fromTile.id,
      fromCellX,
      fromCellY,
      fromSide: adjacency.fromSide,
      toTileId: toTile.id,
      toCellX,
      toCellY,
      toSide: adjacency.toSide,
      color: connectionColor // Store the selected color
    };
    
    onConnectionsChange([...filteredConnections, newConnection]);
  }, [connections, onConnectionsChange, connectionColor]);

  // Remove a connection at a specific cell
  const removeConnectionAtCell = useCallback((tileId: string, cellX: number, cellY: number, side: 'left' | 'right' | 'top' | 'bottom') => {
    const newConnections = connections.filter(c => {
      // Remove connection if it involves this cell on this side
      if (c.fromTileId === tileId && c.fromCellX === cellX && c.fromCellY === cellY && c.fromSide === side) {
        return false;
      }
      if (c.toTileId === tileId && c.toCellX === cellX && c.toCellY === cellY && c.toSide === side) {
        return false;
      }
      return true;
    });
    onConnectionsChange(newConnections);
  }, [connections, onConnectionsChange]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;

    // Pan tool - start panning
    if (activeTool === 'pan') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - canvasState.panX, y: e.clientY - canvasState.panY });
      return;
    }

    const { x, y } = getCanvasPosition(e);
    const { gridX, gridY } = getGridFromCanvas(x, y);
    
    if (activeTool === 'connect' || activeTool === 'disconnect') {
      // Start path drawing - add starting cell to path
      setConnectionPath([{ gridX, gridY }]);
      setIsConnecting(true);
      return;
    }

    if (activeTool === 'select') {
      const pos = getCanvasPosition(e);
      setSelectionBoxStart(pos);
      setSelectionBoxEnd(pos);
      setIsSelectionBox(true);
      onSelectionChange(new Set());
    }
  }, [activeTool, canvasState.panX, canvasState.panY, getCanvasPosition, getGridFromCanvas, getTileAndCellAtPosition, tileSize, onSelectionChange]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      onCanvasStateChange({
        ...canvasState,
        panX: e.clientX - panStart.x,
        panY: e.clientY - panStart.y
      });
      return;
    }

    // Update connection path - add cells as mouse moves
    if (isConnecting && (activeTool === 'connect' || activeTool === 'disconnect')) {
      const { x, y } = getCanvasPosition(e);
      const { gridX, gridY } = getGridFromCanvas(x, y);
      
      // Clamp to grid bounds
      const clampedX = Math.max(0, Math.min(gridX, gridCols - 1));
      const clampedY = Math.max(0, Math.min(gridY, gridRows - 1));
      
      setConnectionPath(prev => {
        if (prev.length === 0) return [{ gridX: clampedX, gridY: clampedY }];
        
        const lastCell = prev[prev.length - 1];
        
        // If we're on the same cell, don't add
        if (lastCell.gridX === clampedX && lastCell.gridY === clampedY) {
          return prev;
        }
        
        // Check if this cell is already in the path (allow going back)
        const existingIndex = prev.findIndex(c => c.gridX === clampedX && c.gridY === clampedY);
        if (existingIndex !== -1) {
          // Trim the path back to this point
          return prev.slice(0, existingIndex + 1);
        }
        
        // Only add if adjacent to last cell (orthogonally)
        const dx = Math.abs(clampedX - lastCell.gridX);
        const dy = Math.abs(clampedY - lastCell.gridY);
        if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
          return [...prev, { gridX: clampedX, gridY: clampedY }];
        }
        
        // If not adjacent, fill in the gap with intermediate cells
        // Use Bresenham-like approach to fill horizontal/vertical path
        const newCells: { gridX: number; gridY: number }[] = [];
        let cx = lastCell.gridX;
        let cy = lastCell.gridY;
        
        while (cx !== clampedX || cy !== clampedY) {
          // Prioritize horizontal movement first, then vertical
          if (cx < clampedX) cx++;
          else if (cx > clampedX) cx--;
          else if (cy < clampedY) cy++;
          else if (cy > clampedY) cy--;
          
          // Check if cell is already in path
          const alreadyInPath = prev.some(c => c.gridX === cx && c.gridY === cy);
          if (!alreadyInPath) {
            newCells.push({ gridX: cx, gridY: cy });
          }
        }
        
        return [...prev, ...newCells];
      });
      return;
    }

    // Selection box mode
    if (isSelectionBox && activeTool === 'select') {
      const pos = getCanvasPosition(e);
      setSelectionBoxEnd(pos);
      
      const minX = Math.min(selectionBoxStart.x, pos.x);
      const maxX = Math.max(selectionBoxStart.x, pos.x);
      const minY = Math.min(selectionBoxStart.y, pos.y);
      const maxY = Math.max(selectionBoxStart.y, pos.y);
      
      const selectedIds = new Set<string>();
      for (const tile of tiles) {
        const tileX = tile.gridX * tileSize;
        const tileY = tile.gridY * tileSize;
        const tileWidth = (tile.component.width || 1) * tileSize;
        const tileHeight = (tile.component.height || 1) * tileSize;
        
        if (tileX < maxX && tileX + tileWidth > minX &&
            tileY < maxY && tileY + tileHeight > minY) {
          selectedIds.add(tile.id);
        }
      }
      onSelectionChange(selectedIds);
      return;
    }

    // Dragging selected tiles
    if (isDragging && selectedTileIds.size > 0) {
      const pos = getCanvasPosition(e);
      const dx = Math.floor((pos.x - dragStartMousePos.x) / tileSize);
      const dy = Math.floor((pos.y - dragStartMousePos.y) / tileSize);
      
      if (dx !== 0 || dy !== 0) {
        let canMove = true;
        const newPositions = new Map<string, { x: number; y: number }>();
        
        for (const tileId of selectedTileIds) {
          const startPos = dragStartPositions.get(tileId);
          const tile = tiles.find(t => t.id === tileId);
          if (!startPos || !tile) continue;
          
          const newX = startPos.x + dx;
          const newY = startPos.y + dy;
          
          if (newX < 0 || newY < 0 || 
              newX + (tile.component.width || 1) > gridCols ||
              newY + (tile.component.height || 1) > gridRows) {
            canMove = false;
            break;
          }
          
          for (let cx = 0; cx < (tile.component.width || 1); cx++) {
            for (let cy = 0; cy < (tile.component.height || 1); cy++) {
              for (const otherTile of tiles) {
                if (selectedTileIds.has(otherTile.id)) continue;
                
                const otherWidth = otherTile.component.width || 1;
                const otherHeight = otherTile.component.height || 1;
                
                if (newX + cx >= otherTile.gridX && newX + cx < otherTile.gridX + otherWidth &&
                    newY + cy >= otherTile.gridY && newY + cy < otherTile.gridY + otherHeight) {
                  canMove = false;
                  break;
                }
              }
              if (!canMove) break;
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
        }
      }
    }
  }, [isPanning, isDragging, isSelectionBox, isConnecting, selectedTileIds, canvasState, panStart, getCanvasPosition, getGridFromCanvas, tiles, onCanvasStateChange, onTilesChange, onSelectionChange, activeTool, selectionBoxStart, tileSize, gridCols, gridRows, dragStartMousePos, dragStartPositions]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    // Handle connection path completion
    if (isConnecting && connectionPath.length >= 2 && (activeTool === 'connect' || activeTool === 'disconnect')) {
      if (activeTool === 'connect') {
        // First, place connection blocks on empty cells
        const newTilesToAdd: PlacedTile[] = [];
        let updatedTiles = [...tiles];
        
        // Check each cell in the path for empty cells and add connection blocks
        for (let i = 0; i < connectionPath.length; i++) {
          const cell = connectionPath[i];
          const tileInfo = getTileAndCellAtPosition(cell.gridX, cell.gridY);
          
          // If no tile at this position, add a connection block
          if (!tileInfo) {
            const prevCell = i > 0 ? connectionPath[i - 1] : null;
            const nextCell = i < connectionPath.length - 1 ? connectionPath[i + 1] : null;
            
            const connectionBlock = getConnectionBlockForPath(prevCell, cell, nextCell, tiles);
            
            if (connectionBlock) {
              // Check if there's already a tile we just added at this position
              const existingNewTile = newTilesToAdd.find(t => t.gridX === cell.gridX && t.gridY === cell.gridY);
              if (!existingNewTile) {
                newTilesToAdd.push({
                  id: generateTileId(),
                  component: connectionBlock,
                  gridX: cell.gridX,
                  gridY: cell.gridY
                });
              }
            }
          }
        }
        
        // Add the new tiles
        if (newTilesToAdd.length > 0) {
          updatedTiles = [...updatedTiles, ...newTilesToAdd];
          onTilesChange(updatedTiles);
        }
        
        // Now process connections with the updated tile list
        // Need to use the updated tiles for connection lookup
        const getTileAtPos = (gx: number, gy: number) => {
          for (const tile of updatedTiles) {
            const w = tile.component.width || 1;
            const h = tile.component.height || 1;
            if (gx >= tile.gridX && gx < tile.gridX + w &&
                gy >= tile.gridY && gy < tile.gridY + h) {
              return {
                tile,
                cellX: gx - tile.gridX,
                cellY: gy - tile.gridY
              };
            }
          }
          return null;
        };
        
        // Collect all new connections to add at once
        const newConnectionsToAdd: CellConnection[] = [];
        let currentConnections = [...connections];
        
        for (let i = 0; i < connectionPath.length - 1; i++) {
          const cell1 = connectionPath[i];
          const cell2 = connectionPath[i + 1];
          
          const tile1Info = getTileAtPos(cell1.gridX, cell1.gridY);
          const tile2Info = getTileAtPos(cell2.gridX, cell2.gridY);
          
          // Only connect if both cells are on tiles and they're different tiles
          if (tile1Info && tile2Info && tile1Info.tile.id !== tile2Info.tile.id) {
            const fromWidth = tile1Info.tile.component.width || 1;
            const fromHeight = tile1Info.tile.component.height || 1;
            const toWidth = tile2Info.tile.component.width || 1;
            const toHeight = tile2Info.tile.component.height || 1;
            
            const adjacency = areCellsAdjacent(
              tile1Info.tile.gridX, tile1Info.tile.gridY, fromWidth, fromHeight,
              tile1Info.cellX, tile1Info.cellY,
              tile2Info.tile.gridX, tile2Info.tile.gridY, toWidth, toHeight,
              tile2Info.cellX, tile2Info.cellY
            );
            
            if (adjacency) {
              // Remove existing connection between these cells
              currentConnections = currentConnections.filter(c => {
                const matchesForward = c.fromTileId === tile1Info.tile.id && c.fromCellX === tile1Info.cellX && c.fromCellY === tile1Info.cellY &&
                                       c.toTileId === tile2Info.tile.id && c.toCellX === tile2Info.cellX && c.toCellY === tile2Info.cellY;
                const matchesReverse = c.fromTileId === tile2Info.tile.id && c.fromCellX === tile2Info.cellX && c.fromCellY === tile2Info.cellY &&
                                       c.toTileId === tile1Info.tile.id && c.toCellX === tile1Info.cellX && c.toCellY === tile1Info.cellY;
                return !matchesForward && !matchesReverse;
              });
              
              // Add new connection
              newConnectionsToAdd.push({
                id: generateConnectionId(),
                fromTileId: tile1Info.tile.id,
                fromCellX: tile1Info.cellX,
                fromCellY: tile1Info.cellY,
                fromSide: adjacency.fromSide,
                toTileId: tile2Info.tile.id,
                toCellX: tile2Info.cellX,
                toCellY: tile2Info.cellY,
                toSide: adjacency.toSide,
                color: connectionColor
              });
            }
          }
        }
        
        // Update connections once with all new connections
        if (newConnectionsToAdd.length > 0) {
          onConnectionsChange([...currentConnections, ...newConnectionsToAdd]);
        }
      } else if (activeTool === 'disconnect') {
        // Collect all connections to remove at once
        let currentConnections = [...connections];
        
        for (let i = 0; i < connectionPath.length - 1; i++) {
          const cell1 = connectionPath[i];
          const cell2 = connectionPath[i + 1];
          
          const tile1Info = getTileAndCellAtPosition(cell1.gridX, cell1.gridY);
          const tile2Info = getTileAndCellAtPosition(cell2.gridX, cell2.gridY);
          
          if (tile1Info && tile2Info && tile1Info.tile.id !== tile2Info.tile.id) {
            const fromWidth = tile1Info.tile.component.width || 1;
            const fromHeight = tile1Info.tile.component.height || 1;
            const toWidth = tile2Info.tile.component.width || 1;
            const toHeight = tile2Info.tile.component.height || 1;
            
            const adjacency = areCellsAdjacent(
              tile1Info.tile.gridX, tile1Info.tile.gridY, fromWidth, fromHeight,
              tile1Info.cellX, tile1Info.cellY,
              tile2Info.tile.gridX, tile2Info.tile.gridY, toWidth, toHeight,
              tile2Info.cellX, tile2Info.cellY
            );
            
            if (adjacency) {
              // Remove connection at this cell
              currentConnections = currentConnections.filter(c => {
                if (c.fromTileId === tile1Info.tile.id && c.fromCellX === tile1Info.cellX && 
                    c.fromCellY === tile1Info.cellY && c.fromSide === adjacency.fromSide) {
                  return false;
                }
                if (c.toTileId === tile1Info.tile.id && c.toCellX === tile1Info.cellX && 
                    c.toCellY === tile1Info.cellY && c.toSide === adjacency.fromSide) {
                  return false;
                }
                return true;
              });
            }
          }
        }
        
        onConnectionsChange(currentConnections);
      }
    }
    
    setIsPanning(false);
    setIsDragging(false);
    setIsSelectionBox(false);
    setIsConnecting(false);
    setConnectionPath([]);
  }, [isConnecting, connectionPath, activeTool, getTileAndCellAtPosition, connections, connectionColor, onConnectionsChange]);

  const handleTileMouseDown = useCallback((e: React.MouseEvent, tile: PlacedTile) => {
    e.stopPropagation();
    
    const { x, y } = getCanvasPosition(e);
    const { gridX, gridY } = getGridFromCanvas(x, y);
    const cellX = gridX - tile.gridX;
    const cellY = gridY - tile.gridY;
    
    if (activeTool === 'connect' || activeTool === 'disconnect') {
      // Start path drawing from this cell
      setConnectionPath([{ gridX, gridY }]);
      setIsConnecting(true);
      return;
    }
    
    if (activeTool !== 'select') return;
    
    // In group mode, toggle selection on click
    if (isGroupMode) {
      const newSelection = new Set(selectedTileIds);
      if (newSelection.has(tile.id)) {
        newSelection.delete(tile.id);
      } else {
        newSelection.add(tile.id);
      }
      onSelectionChange(newSelection);
      return;
    }
    
    if (selectedTileIds.has(tile.id)) {
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
      onSelectionChange(new Set([tile.id]));
      const pos = getCanvasPosition(e);
      setDragStartMousePos(pos);
      setDragStartPositions(new Map([[tile.id, { x: tile.gridX, y: tile.gridY }]]));
      setIsDragging(true);
    }
  }, [activeTool, getCanvasPosition, getGridFromCanvas, onSelectionChange, selectedTileIds, tiles, tileSize, isGroupMode]);

  // Track drag position for preview using draggingComponent from parent
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    
    if (draggingComponent) {
      const { gridX, gridY } = getGridPosition(e);
      const width = draggingComponent.width || 1;
      const height = draggingComponent.height || 1;
      const canPlace = canPlaceComponent(draggingComponent, gridX, gridY);
      setDropPreview({ gridX, gridY, width, height, canPlace });
    }
  }, [getGridPosition, canPlaceComponent, draggingComponent]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (draggingComponent) {
      const { gridX, gridY } = getGridPosition(e);
      const width = draggingComponent.width || 1;
      const height = draggingComponent.height || 1;
      const canPlace = canPlaceComponent(draggingComponent, gridX, gridY);
      setDropPreview({ gridX, gridY, width, height, canPlace });
    }
  }, [getGridPosition, draggingComponent, canPlaceComponent]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if we're leaving the SVG completely
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect && (e.clientX < rect.left || e.clientX > rect.right || 
                 e.clientY < rect.top || e.clientY > rect.bottom)) {
      setDropPreview(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDropPreview(null);
    onDragEnd();
    const componentData = e.dataTransfer.getData('application/json');
    if (!componentData) return;

    try {
      const parsed = JSON.parse(componentData);
      const { gridX, gridY } = getGridPosition(e);
      
      // Check if it's a group drop
      if (parsed.isGroup && parsed.groupId && onDropGroup) {
        onDropGroup(parsed as ComponentGroup & { isGroup: boolean; layoutData?: GroupLayoutData }, gridX, gridY);
        return;
      }
      
      // Regular component drop
      const component: Component = parsed;
      if (canPlaceComponent(component, gridX, gridY)) {
        onDropComponent(component, gridX, gridY);
      }
    } catch (err) {
      console.error('Failed to parse dropped data:', err);
    }
  }, [getGridPosition, canPlaceComponent, onDropComponent, onDropGroup, onDragEnd]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedTileIds.size > 0) {
        // Also remove connections involving deleted tiles
        const newConnections = connections.filter(c => 
          !selectedTileIds.has(c.fromTileId) && !selectedTileIds.has(c.toTileId)
        );
        onConnectionsChange(newConnections);
        onTilesChange(tiles.filter(t => !selectedTileIds.has(t.id)));
        onSelectionChange(new Set());
      }
      if (e.key === 'Escape') {
        onSelectionChange(new Set());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTileIds, tiles, connections, onTilesChange, onSelectionChange, onConnectionsChange]);

  const getCursor = () => {
    if (activeTool === 'pan') return isPanning ? 'grabbing' : 'grab';
    if (activeTool === 'connect') return 'crosshair';
    if (activeTool === 'disconnect') return 'not-allowed';
    if (isDragging) return 'grabbing';
    return 'default';
  };

  // Render connection lines for a tile
  const renderConnectionLines = (tile: PlacedTile) => {
    const tileConnections = connections.filter(c => c.fromTileId === tile.id);
    const connectionShapeGroups: { shapes: Shape[], color: string }[] = [];
    
    for (const conn of tileConnections) {
      const lineShapes = generateSingleConnectionLine(
        tile.component.shapes,
        conn.fromCellX,
        conn.fromCellY,
        conn.fromSide,
        tile.component.width || 1,
        tile.component.height || 1
      );
      connectionShapeGroups.push({ shapes: lineShapes, color: conn.color || '#000000' });
    }
    
    // Also render "to" side connections
    const toConnections = connections.filter(c => c.toTileId === tile.id);
    for (const conn of toConnections) {
      const lineShapes = generateSingleConnectionLine(
        tile.component.shapes,
        conn.toCellX,
        conn.toCellY,
        conn.toSide,
        tile.component.width || 1,
        tile.component.height || 1
      );
      connectionShapeGroups.push({ shapes: lineShapes, color: conn.color || '#000000' });
    }
    
    const compWidth = (tile.component.width || 1) * tileSize;
    const compHeight = (tile.component.height || 1) * tileSize;
    
    // Connection lines should have UNIFORM stroke width based on tileSize, 
    // not component size. This ensures lines from 1x1 and 2x2 components match.
    const connectionStrokeWidth = tileSize / 50 * 1.5; // Proportional to base tile size
    
    return connectionShapeGroups.flatMap((group, groupIdx) => 
      group.shapes.map((shape, idx) => {
        const scaledShape: Shape = {
          ...shape,
          x: shape.x * compWidth,
          y: shape.y * compHeight,
          width: shape.width * compWidth,
          height: shape.height * compHeight,
          strokeWidth: Math.max(0.5, connectionStrokeWidth),
          stroke: group.color // Use the connection's color
        };
        return <ShapeRenderer key={`conn-${groupIdx}-${idx}`} shape={scaledShape} />;
      })
    );
  };

  // Render a component's shapes scaled to tile size
  const renderTileShapes = (tile: PlacedTile) => {
    const component = tile.component;
    const compWidth = (component.width || 1) * tileSize;
    const compHeight = (component.height || 1) * tileSize;
    const refScale = Math.min(compWidth, compHeight);
    
    // Library preview size is 50x50 and uses 1.5 as default strokeWidth
    // We need to match that proportionally
    const libraryPreviewSize = 50;
    const scaleRatio = refScale / libraryPreviewSize;
    const defaultStrokeWidth = 1.5 * scaleRatio;
    
    return component.shapes.map((shape, idx) => {
      // Scale strokeWidth the same way as the library does
      const sw = shape.strokeWidth 
        ? shape.strokeWidth * refScale 
        : defaultStrokeWidth;
      
      const scaledShape: Shape = {
        ...shape,
        x: shape.x * compWidth,
        y: shape.y * compHeight,
        width: shape.width * compWidth,
        height: shape.height * compHeight,
        strokeWidth: Math.max(0.5, sw), // Match library's minimum
        fontSize: shape.fontSize ? shape.fontSize * refScale : undefined,
        arrowSize: shape.arrowSize ? shape.arrowSize * refScale : undefined,
        // Scale curveOffset for curved lines
        curveOffset: shape.curveOffset ? {
          x: shape.curveOffset.x * compWidth,
          y: shape.curveOffset.y * compHeight
        } : undefined,
        // Scale polygon points
        points: shape.points ? shape.points.map(p => ({
          x: p.x * compWidth,
          y: p.y * compHeight
        })) : undefined
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
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <defs>
        <pattern
          id="tile-grid"
          width={tileSize}
          height={tileSize}
          patternUnits="userSpaceOnUse"
        >
          <path 
            d={`M ${tileSize} 0 L 0 0 0 ${tileSize}`}
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
        
        {/* Grid overlay */}
        <rect
          x={0}
          y={0}
          width={gridCols * tileSize}
          height={gridRows * tileSize}
          fill="url(#tile-grid)"
        />
        {/* Right and bottom edge lines to complete the grid */}
        <line 
          x1={gridCols * tileSize} 
          y1={0} 
          x2={gridCols * tileSize} 
          y2={gridRows * tileSize} 
          stroke="hsl(var(--canvas-grid))" 
          strokeWidth="1" 
        />
        <line 
          x1={0} 
          y1={gridRows * tileSize} 
          x2={gridCols * tileSize} 
          y2={gridRows * tileSize} 
          stroke="hsl(var(--canvas-grid))" 
          strokeWidth="1" 
        />

        {/* Drop preview indicator */}
        {dropPreview && (
          <rect
            x={dropPreview.gridX * tileSize}
            y={dropPreview.gridY * tileSize}
            width={dropPreview.width * tileSize}
            height={dropPreview.height * tileSize}
            fill={dropPreview.canPlace ? "hsl(var(--primary) / 0.3)" : "hsl(0 84% 60% / 0.3)"}
            stroke={dropPreview.canPlace ? "hsl(var(--primary))" : "hsl(0 84% 60%)"}
            strokeWidth={2}
            strokeDasharray="4 4"
            rx={4}
          />
        )}

        {/* Placed tiles */}
        {tiles.map(tile => {
          const x = tile.gridX * tileSize;
          const y = tile.gridY * tileSize;
          const compWidth = (tile.component.width || 1) * tileSize;
          const compHeight = (tile.component.height || 1) * tileSize;
          const isSelected = selectedTileIds.has(tile.id);
          
          // Check if any cell of this tile is in the connection path
          const isTileInPath = isConnecting && connectionPath.some(cell => {
            const tileWidth = tile.component.width || 1;
            const tileHeight = tile.component.height || 1;
            return cell.gridX >= tile.gridX && cell.gridX < tile.gridX + tileWidth &&
                   cell.gridY >= tile.gridY && cell.gridY < tile.gridY + tileHeight;
          });
          
          return (
            <g
              key={tile.id}
              transform={`translate(${x}, ${y})`}
              onMouseDown={(e) => handleTileMouseDown(e, tile)}
              style={{ cursor: activeTool === 'select' || activeTool === 'connect' || activeTool === 'disconnect' ? 'pointer' : 'inherit' }}
            >
              {/* Tile background */}
              <rect
                width={compWidth}
                height={compHeight}
                fill={
                  isSelected 
                    ? "hsl(var(--primary) / 0.1)" 
                    : "hsl(var(--muted) / 0.3)"
                }
                stroke={
                  isTileInPath || isSelected 
                    ? "hsl(var(--primary))" 
                    : "transparent"
                }
                strokeWidth={2}
              />
              {/* Component shapes */}
              {renderTileShapes(tile)}
              {/* Connection lines */}
              {renderConnectionLines(tile)}
            </g>
          );
        })}

        {/* Connection path preview - glowing cells */}
        {isConnecting && connectionPath.length > 0 && (
          <g>
            {connectionPath.map((cell, idx) => {
              const isOnTile = getTileAndCellAtPosition(cell.gridX, cell.gridY) !== null;
              return (
                <rect
                  key={`path-${idx}`}
                  x={cell.gridX * tileSize}
                  y={cell.gridY * tileSize}
                  width={tileSize}
                  height={tileSize}
                  fill={
                    activeTool === 'disconnect'
                      ? "hsl(var(--destructive) / 0.3)"
                      : isOnTile
                        ? "hsl(var(--primary) / 0.4)"
                        : "hsl(var(--primary) / 0.15)"
                  }
                  stroke={
                    activeTool === 'disconnect'
                      ? "hsl(var(--destructive))"
                      : "hsl(var(--primary))"
                  }
                  strokeWidth={2}
                  rx={2}
                  style={{
                    filter: isOnTile ? 'drop-shadow(0 0 4px hsl(var(--primary) / 0.5))' : undefined
                  }}
                />
              );
            })}
          </g>
        )}

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
