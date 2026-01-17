import { useRef, useState, useCallback, useEffect } from "react";
import { CanvasState, Component, PAPER_SIZES, MM_TO_PX, Shape, CellConnection } from "@/types/schematic";
import { ShapeRenderer } from "./ShapeRenderer";
import { MainToolType } from "./Toolbar";
import { generateSingleConnectionLine, areCellsAdjacent, generateConnectionId } from "@/lib/connectionUtils";

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
  onTilesChange: (tiles: PlacedTile[]) => void;
  onSelectionChange: (ids: Set<string>) => void;
  onCanvasStateChange: (state: CanvasState) => void;
  onDropComponent: (component: Component, gridX: number, gridY: number) => void;
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
  onTilesChange,
  onSelectionChange,
  onCanvasStateChange,
  onDropComponent,
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
  
  // Connect tool state - now tracks specific cell positions
  const [connectStartInfo, setConnectStartInfo] = useState<{
    tileId: string;
    cellX: number;
    cellY: number;
    absGridX: number;
    absGridY: number;
  } | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectLine, setConnectLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

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
    
    console.log('Creating connection:', {
      from: { tileId: fromTile.id, gridX: fromTile.gridX, gridY: fromTile.gridY, cellX: fromCellX, cellY: fromCellY, width: fromWidth, height: fromHeight },
      to: { tileId: toTile.id, gridX: toTile.gridX, gridY: toTile.gridY, cellX: toCellX, cellY: toCellY, width: toWidth, height: toHeight }
    });
    
    const adjacency = areCellsAdjacent(
      fromTile.gridX, fromTile.gridY, fromWidth, fromHeight, fromCellX, fromCellY,
      toTile.gridX, toTile.gridY, toWidth, toHeight, toCellX, toCellY
    );
    
    console.log('Adjacency result:', adjacency);
    
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
    
    console.log('New connection created:', newConnection);
    
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
      const tileAndCell = getTileAndCellAtPosition(gridX, gridY);
      if (tileAndCell) {
        setConnectStartInfo({
          tileId: tileAndCell.tile.id,
          cellX: tileAndCell.cellX,
          cellY: tileAndCell.cellY,
          absGridX: gridX,
          absGridY: gridY
        });
        setIsConnecting(true);
        const cellCenterX = (gridX + 0.5) * tileSize;
        const cellCenterY = (gridY + 0.5) * tileSize;
        setConnectLine({ x1: cellCenterX, y1: cellCenterY, x2: cellCenterX, y2: cellCenterY });
      }
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

    // Update connect line preview
    if (isConnecting && connectStartInfo && (activeTool === 'connect' || activeTool === 'disconnect')) {
      const { x, y } = getCanvasPosition(e);
      setConnectLine(prev => prev ? { ...prev, x2: x, y2: y } : null);
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
  }, [isPanning, isDragging, isSelectionBox, isConnecting, connectStartInfo, selectedTileIds, canvasState, panStart, getCanvasPosition, getGridFromCanvas, tiles, onCanvasStateChange, onTilesChange, onSelectionChange, activeTool, selectionBoxStart, tileSize, gridCols, gridRows, dragStartMousePos, dragStartPositions]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    // Handle connection completion
    if (isConnecting && connectStartInfo && (activeTool === 'connect' || activeTool === 'disconnect')) {
      const { x, y } = getCanvasPosition(e);
      const { gridX, gridY } = getGridFromCanvas(x, y);
      const endTileAndCell = getTileAndCellAtPosition(gridX, gridY);
      
      if (endTileAndCell && endTileAndCell.tile.id !== connectStartInfo.tileId) {
        const startTile = tiles.find(t => t.id === connectStartInfo.tileId);
        
        if (startTile) {
          if (activeTool === 'connect') {
            createConnection(
              startTile, connectStartInfo.cellX, connectStartInfo.cellY,
              endTileAndCell.tile, endTileAndCell.cellX, endTileAndCell.cellY
            );
          } else if (activeTool === 'disconnect') {
            const fromWidth = startTile.component.width || 1;
            const fromHeight = startTile.component.height || 1;
            const toWidth = endTileAndCell.tile.component.width || 1;
            const toHeight = endTileAndCell.tile.component.height || 1;
            
            const adjacency = areCellsAdjacent(
              startTile.gridX, startTile.gridY, fromWidth, fromHeight,
              connectStartInfo.cellX, connectStartInfo.cellY,
              endTileAndCell.tile.gridX, endTileAndCell.tile.gridY, toWidth, toHeight,
              endTileAndCell.cellX, endTileAndCell.cellY
            );
            
            if (adjacency) {
              removeConnectionAtCell(
                connectStartInfo.tileId, 
                connectStartInfo.cellX, 
                connectStartInfo.cellY, 
                adjacency.fromSide
              );
            }
          }
        }
      }
    }
    
    setIsPanning(false);
    setIsDragging(false);
    setIsSelectionBox(false);
    setIsConnecting(false);
    setConnectStartInfo(null);
    setConnectLine(null);
  }, [isConnecting, connectStartInfo, activeTool, getCanvasPosition, getGridFromCanvas, getTileAndCellAtPosition, tiles, createConnection, removeConnectionAtCell]);

  const handleTileMouseDown = useCallback((e: React.MouseEvent, tile: PlacedTile) => {
    e.stopPropagation();
    
    const { x, y } = getCanvasPosition(e);
    const { gridX, gridY } = getGridFromCanvas(x, y);
    const cellX = gridX - tile.gridX;
    const cellY = gridY - tile.gridY;
    
    if (activeTool === 'connect' || activeTool === 'disconnect') {
      setConnectStartInfo({
        tileId: tile.id,
        cellX,
        cellY,
        absGridX: gridX,
        absGridY: gridY
      });
      setIsConnecting(true);
      const cellCenterX = (gridX + 0.5) * tileSize;
      const cellCenterY = (gridY + 0.5) * tileSize;
      setConnectLine({ x1: cellCenterX, y1: cellCenterY, x2: cellCenterX, y2: cellCenterY });
      return;
    }
    
    if (activeTool !== 'select') return;
    
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
  }, [activeTool, getCanvasPosition, getGridFromCanvas, onSelectionChange, selectedTileIds, tiles, tileSize]);

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
      const component: Component = JSON.parse(componentData);
      const { gridX, gridY } = getGridPosition(e);
      
      if (canPlaceComponent(component, gridX, gridY)) {
        onDropComponent(component, gridX, gridY);
      }
    } catch (err) {
      console.error('Failed to parse dropped component:', err);
    }
  }, [getGridPosition, canPlaceComponent, onDropComponent, onDragEnd]);

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
      console.log('Rendering FROM connection:', {
        tileId: tile.id,
        tileName: tile.component.name,
        cellX: conn.fromCellX,
        cellY: conn.fromCellY,
        side: conn.fromSide,
        tileWidth: tile.component.width || 1,
        tileHeight: tile.component.height || 1,
        shapesCount: tile.component.shapes.length
      });
      const lineShapes = generateSingleConnectionLine(
        tile.component.shapes,
        conn.fromCellX,
        conn.fromCellY,
        conn.fromSide,
        tile.component.width || 1,
        tile.component.height || 1
      );
      console.log('Generated shapes for FROM:', lineShapes.length, lineShapes);
      connectionShapeGroups.push({ shapes: lineShapes, color: conn.color || '#000000' });
    }
    
    // Also render "to" side connections
    const toConnections = connections.filter(c => c.toTileId === tile.id);
    for (const conn of toConnections) {
      console.log('Rendering TO connection:', {
        tileId: tile.id,
        tileName: tile.component.name,
        cellX: conn.toCellX,
        cellY: conn.toCellY,
        side: conn.toSide,
        tileWidth: tile.component.width || 1,
        tileHeight: tile.component.height || 1,
        shapesCount: tile.component.shapes.length,
        shapes: tile.component.shapes
      });
      const lineShapes = generateSingleConnectionLine(
        tile.component.shapes,
        conn.toCellX,
        conn.toCellY,
        conn.toSide,
        tile.component.width || 1,
        tile.component.height || 1
      );
      console.log('Generated shapes for TO:', lineShapes.length, lineShapes);
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
        
        {/* Grid overlay */}
        <rect
          x={0}
          y={0}
          width={gridCols * tileSize}
          height={gridRows * tileSize}
          fill="url(#tile-grid)"
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
          const isConnectStart = (activeTool === 'connect' || activeTool === 'disconnect') && 
            connectStartInfo?.tileId === tile.id;
          
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
                  isConnectStart 
                    ? "hsl(var(--primary) / 0.2)" 
                    : isSelected 
                      ? "hsl(var(--primary) / 0.1)" 
                      : "hsl(var(--muted) / 0.3)"
                }
                stroke={
                  isConnectStart || isSelected 
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

        {/* Connection line preview */}
        {connectLine && isConnecting && (
          <line
            x1={connectLine.x1}
            y1={connectLine.y1}
            x2={connectLine.x2}
            y2={connectLine.y2}
            stroke={activeTool === 'disconnect' ? "hsl(var(--destructive))" : "hsl(var(--primary))"}
            strokeWidth={2}
            strokeDasharray="4 2"
          />
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
