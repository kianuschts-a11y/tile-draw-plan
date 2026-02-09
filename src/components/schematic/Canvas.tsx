import { useRef, useState, useCallback, useEffect } from "react";
import { CanvasState, Component, PAPER_SIZES, MM_TO_PX, Shape, CellConnection, ComponentGroup, GroupLayoutData, TitleBlockData } from "@/types/schematic";
import { AnnotationLine, AnnotationText, LineStyle } from "@/types/annotations";
import { ShapeRenderer } from "./ShapeRenderer";
import { TitleBlock } from "./TitleBlock";
import { MainToolType } from "./Toolbar";
import { generateSingleConnectionLine, areCellsAdjacent, generateConnectionId } from "@/lib/connectionUtils";
import { CONNECTION_BLOCKS, isConnectionBlock } from "@/lib/connectionBlocks";

function generateTileId(): string {
  return Math.random().toString(36).substring(2, 11);
}

/**
 * Ermittelt welche Richtungen ein bestehender Verbindungsblock hat.
 * Basierend auf den tatsächlichen Shape-Definitionen in connectionBlocks.ts:
 * - horizontal: LEFT + RIGHT
 * - vertical: TOP + BOTTOM
 * - corner-tl (┐): RIGHT + BOTTOM (Linie von rechts zur Mitte, dann nach unten)
 * - corner-tr (┌): LEFT + BOTTOM (Linie von links zur Mitte, dann nach unten)
 * - corner-bl (┘): RIGHT + TOP (Linie von rechts zur Mitte, dann nach oben)
 * - corner-br (└): LEFT + TOP (Linie von links zur Mitte, dann nach oben)
 * - t-top (┬): LEFT + RIGHT + BOTTOM
 * - t-bottom (┴): LEFT + RIGHT + TOP
 * - t-left (├): TOP + BOTTOM + RIGHT
 * - t-right (┤): TOP + BOTTOM + LEFT
 * - cross (┼): ALL
 */
function getExistingBlockDirections(component: Component): { left: boolean; right: boolean; top: boolean; bottom: boolean } {
  const id = component.id;
  
  // Exakte ID-Prüfung statt .includes() um Fehler zu vermeiden
  const isHorizontal = id === 'connection-horizontal';
  const isVertical = id === 'connection-vertical';
  const isCornerTL = id === 'connection-corner-tl';  // ┐
  const isCornerTR = id === 'connection-corner-tr';  // ┌
  const isCornerBL = id === 'connection-corner-bl';  // ┘
  const isCornerBR = id === 'connection-corner-br';  // └
  const isTTop = id === 'connection-t-top';          // ┬
  const isTBottom = id === 'connection-t-bottom';    // ┴
  const isTLeft = id === 'connection-t-left';        // ├
  const isTRight = id === 'connection-t-right';      // ┤
  const isCross = id === 'connection-cross';         // ┼
  
  return {
    left: isHorizontal || isCornerTR || isCornerBR || isTTop || isTBottom || isTRight || isCross,
    right: isHorizontal || isCornerTL || isCornerBL || isTTop || isTBottom || isTLeft || isCross,
    top: isVertical || isCornerBL || isCornerBR || isTBottom || isTLeft || isTRight || isCross,
    bottom: isVertical || isCornerTL || isCornerTR || isTTop || isTLeft || isTRight || isCross
  };
}

/**
 * Bestimmt den passenden Verbindungsblock für eine Zelle basierend auf
 * dem aktuellen Pfad UND einem eventuell bestehenden Verbindungsblock.
 * 
 * WICHTIG: 
 * - Ein einzelner Pfad kann nur 2 Richtungen haben (Linie oder Ecke)
 * - T-Stücke (3 Richtungen) nur wenn neuer Pfad + bestehender Block = 3
 * - Kreuzung (4 Richtungen) nur wenn neuer Pfad + bestehender Block = 4
 */
function getConnectionBlockForPath(
  prevCell: { gridX: number; gridY: number } | null,
  currentCell: { gridX: number; gridY: number },
  nextCell: { gridX: number; gridY: number } | null,
  tiles: PlacedTile[] = []
): Component | null {
  if (!prevCell && !nextCell) return null;
  
  // Richtungen aus dem aktuellen Pfad ermitteln
  // pathLeft = true wenn es einen Nachbarn auf der LINKEN Seite gibt
  const pathLeft = (prevCell && prevCell.gridX < currentCell.gridX) || (nextCell && nextCell.gridX < currentCell.gridX);
  const pathRight = (prevCell && prevCell.gridX > currentCell.gridX) || (nextCell && nextCell.gridX > currentCell.gridX);
  const pathTop = (prevCell && prevCell.gridY < currentCell.gridY) || (nextCell && nextCell.gridY < currentCell.gridY);
  const pathBottom = (prevCell && prevCell.gridY > currentCell.gridY) || (nextCell && nextCell.gridY > currentCell.gridY);
  
  // DEBUG: Log zur Fehlersuche
  console.log(`getConnectionBlockForPath at (${currentCell.gridX}, ${currentCell.gridY}):`, {
    prevCell: prevCell ? `(${prevCell.gridX}, ${prevCell.gridY})` : 'null',
    nextCell: nextCell ? `(${nextCell.gridX}, ${nextCell.gridY})` : 'null',
    pathLeft, pathRight, pathTop, pathBottom,
    tilesCount: tiles.length
  });
  
  // Prüfen ob bereits ein Verbindungsblock an dieser Position existiert
  const existingTile = tiles.find(tile => {
    const w = tile.component.width || 1;
    const h = tile.component.height || 1;
    return currentCell.gridX >= tile.gridX && currentCell.gridX < tile.gridX + w &&
           currentCell.gridY >= tile.gridY && currentCell.gridY < tile.gridY + h &&
           isConnectionBlock(tile.component);
  });
  
  // Bestehende Richtungen vom Block (falls vorhanden)
  let existingLeft = false, existingRight = false, existingTop = false, existingBottom = false;
  if (existingTile) {
    const existing = getExistingBlockDirections(existingTile.component);
    existingLeft = existing.left;
    existingRight = existing.right;
    existingTop = existing.top;
    existingBottom = existing.bottom;
    console.log(`  Existing tile: ${existingTile.component.id}`, existing);
  }
  
  // Kombiniere Pfad-Richtungen mit bestehenden Richtungen
  const hasLeft = pathLeft || existingLeft;
  const hasRight = pathRight || existingRight;
  const hasTop = pathTop || existingTop;
  const hasBottom = pathBottom || existingBottom;
  
  // Zähle aktive Richtungen
  const directions = [hasLeft, hasRight, hasTop, hasBottom].filter(Boolean).length;
  
  console.log(`  Combined: L=${hasLeft} R=${hasRight} T=${hasTop} B=${hasBottom} => ${directions} directions`);
  
  if (directions === 4) {
    console.log(`  => connection-cross`);
    return CONNECTION_BLOCKS.find(b => b.id === 'connection-cross') || null;
  }
  
  if (directions === 3) {
    // T-Stück
    if (!hasTop) { console.log(`  => connection-t-top`); return CONNECTION_BLOCKS.find(b => b.id === 'connection-t-top') || null; }
    if (!hasBottom) { console.log(`  => connection-t-bottom`); return CONNECTION_BLOCKS.find(b => b.id === 'connection-t-bottom') || null; }
    if (!hasLeft) { console.log(`  => connection-t-left`); return CONNECTION_BLOCKS.find(b => b.id === 'connection-t-left') || null; }
    if (!hasRight) { console.log(`  => connection-t-right`); return CONNECTION_BLOCKS.find(b => b.id === 'connection-t-right') || null; }
  }
  
  if (directions === 2) {
    // Gerade Linie oder Ecke
    if (hasLeft && hasRight) return CONNECTION_BLOCKS.find(b => b.id === 'connection-horizontal') || null;
    if (hasTop && hasBottom) return CONNECTION_BLOCKS.find(b => b.id === 'connection-vertical') || null;
    
    // Ecken - basierend auf connectionBlocks.ts:
    // corner-tl: RIGHT + BOTTOM (von rechts zur Mitte, dann nach unten)
    // corner-tr: LEFT + BOTTOM (von links zur Mitte, dann nach unten)
    // corner-bl: RIGHT + TOP (von rechts zur Mitte, dann nach oben)
    // corner-br: LEFT + TOP (von links zur Mitte, dann nach oben)
    if (hasRight && hasBottom) return CONNECTION_BLOCKS.find(b => b.id === 'connection-corner-tl') || null;
    if (hasLeft && hasBottom) return CONNECTION_BLOCKS.find(b => b.id === 'connection-corner-tr') || null;
    if (hasRight && hasTop) return CONNECTION_BLOCKS.find(b => b.id === 'connection-corner-bl') || null;
    if (hasLeft && hasTop) return CONNECTION_BLOCKS.find(b => b.id === 'connection-corner-br') || null;
  }
  
  if (directions === 1) {
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
  rotation?: number; // Rotation angle in degrees (0, 90, 180, 270)
}

// Auto-Verbindungslinie (gestrichelt) - orthogonal (horizontal + vertikal)
export interface AutoConnectionLine {
  fromTileId: string;
  toTileId: string;
  fromX: number; // Grid-basierte Koordinaten (Zentrum)
  fromY: number;
  midX: number;  // Eckpunkt für orthogonale Linienführung
  midY: number;
  toX: number;
  toY: number;
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
  titleBlockData?: TitleBlockData;
  tileLabels?: Map<string, { label: string; color: string }>;
  excessTileIds?: Set<string>;
  autoConnectionLines?: AutoConnectionLine[];
  // Annotation props
  annotationLines?: AnnotationLine[];
  annotationTexts?: AnnotationText[];
  annotationLineStyle?: LineStyle;
  annotationColor?: string;
  annotationFontSize?: number;
  selectedAnnotationId?: string | null;
  onAnnotationLineCreate?: (line: Omit<AnnotationLine, 'id'>) => void;
  onAnnotationTextCreate?: (text: Omit<AnnotationText, 'id'>) => void;
  onAnnotationSelect?: (id: string | null, type?: 'line' | 'text') => void;
  onAnnotationLineMove?: (id: string, dx: number, dy: number) => void;
  onAnnotationTextMove?: (id: string, dx: number, dy: number) => void;
  onTilesChange: (tiles: PlacedTile[]) => void;
  onSelectionChange: (ids: Set<string>) => void;
  onCanvasStateChange: (state: CanvasState) => void;
  onDropComponent: (component: Component, gridX: number, gridY: number) => void;
  onDropGroup?: (group: ComponentGroup, gridX: number, gridY: number) => void;
  onConnectionsChange: (connections: CellConnection[]) => void;
  onDragEnd: () => void;
  onConnectionArrowToggle?: (connectionId: string) => void;
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
  titleBlockData,
  tileLabels = new Map(),
  excessTileIds = new Set(),
  autoConnectionLines = [],
  annotationLines = [],
  annotationTexts = [],
  annotationLineStyle = 'solid',
  annotationColor = '#000000',
  annotationFontSize = 14,
  selectedAnnotationId = null,
  onAnnotationLineCreate,
  onAnnotationTextCreate,
  onAnnotationSelect,
  onAnnotationLineMove,
  onAnnotationTextMove,
  onTilesChange,
  onSelectionChange,
  onCanvasStateChange,
  onDropComponent,
  onDropGroup,
  onConnectionsChange,
  onDragEnd,
  onConnectionArrowToggle
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

  // Annotation drawing state - grid-cell based like connection tool
  const [isDrawingAnnotationLine, setIsDrawingAnnotationLine] = useState(false);
  const [annotationLinePath, setAnnotationLinePath] = useState<{ gridX: number; gridY: number }[]>([]);
  const [textInputPosition, setTextInputPosition] = useState<{ gridX: number; gridY: number } | null>(null);
  const [textInputValue, setTextInputValue] = useState('');
  const textInputRef = useRef<HTMLInputElement>(null);
  // Annotation dragging
  const [isDraggingAnnotation, setIsDraggingAnnotation] = useState(false);
  const [annotationDragStart, setAnnotationDragStart] = useState<{ gridX: number; gridY: number } | null>(null);

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

  // Check if a position has only connection blocks (which can be replaced)
  const getConnectionBlocksAtPosition = useCallback((component: Component, gridX: number, gridY: number): PlacedTile[] => {
    const compWidth = component.width || 1;
    const compHeight = component.height || 1;
    const connectionBlocks: PlacedTile[] = [];
    
    for (let dx = 0; dx < compWidth; dx++) {
      for (let dy = 0; dy < compHeight; dy++) {
        const checkX = gridX + dx;
        const checkY = gridY + dy;
        
        for (const tile of tiles) {
          const tileWidth = tile.component.width || 1;
          const tileHeight = tile.component.height || 1;
          
          if (checkX >= tile.gridX && checkX < tile.gridX + tileWidth &&
              checkY >= tile.gridY && checkY < tile.gridY + tileHeight) {
            // Only add if it's a connection block
            if (isConnectionBlock(tile.component)) {
              if (!connectionBlocks.find(cb => cb.id === tile.id)) {
                connectionBlocks.push(tile);
              }
            }
          }
        }
      }
    }
    
    return connectionBlocks;
  }, [tiles]);

  // Check if a component can be placed at a position (allows replacing connection blocks)
  const canPlaceComponent = useCallback((component: Component, gridX: number, gridY: number, excludeTileId?: string): boolean => {
    const compWidth = component.width || 1;
    const compHeight = component.height || 1;
    
    if (gridX + compWidth > gridCols || gridY + compHeight > gridRows) {
      return false;
    }
    
    for (let dx = 0; dx < compWidth; dx++) {
      for (let dy = 0; dy < compHeight; dy++) {
        const checkX = gridX + dx;
        const checkY = gridY + dy;
        
        // Check if position is occupied
        for (const tile of tiles) {
          if (tile.id === excludeTileId) continue;
          
          const tileWidth = tile.component.width || 1;
          const tileHeight = tile.component.height || 1;
          
          if (checkX >= tile.gridX && checkX < tile.gridX + tileWidth &&
              checkY >= tile.gridY && checkY < tile.gridY + tileHeight) {
            // Allow if it's a connection block (can be replaced)
            if (!isConnectionBlock(tile.component)) {
              return false;
            }
          }
        }
      }
    }
    return true;
  }, [gridCols, gridRows, tiles]);

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

  // Find connection at a specific grid position
  const findConnectionAtPosition = useCallback((gridX: number, gridY: number): CellConnection | null => {
    // Look for connections that pass through this cell
    for (const conn of connections) {
      // Check "from" side
      const fromTile = tiles.find(t => t.id === conn.fromTileId);
      if (fromTile) {
        const fromGridX = fromTile.gridX + conn.fromCellX;
        const fromGridY = fromTile.gridY + conn.fromCellY;
        if (fromGridX === gridX && fromGridY === gridY) {
          return conn;
        }
      }
      
      // Check "to" side
      const toTile = tiles.find(t => t.id === conn.toTileId);
      if (toTile) {
        const toGridX = toTile.gridX + conn.toCellX;
        const toGridY = toTile.gridY + conn.toCellY;
        if (toGridX === gridX && toGridY === gridY) {
          return conn;
        }
      }
    }
    return null;
  }, [connections, tiles]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;

    // Annotation line drawing - grid-cell based like connection tool
    if (activeTool === 'annotate-line') {
      const { x, y } = getCanvasPosition(e);
      const { gridX, gridY } = getGridFromCanvas(x, y);
      setAnnotationLinePath([{ gridX, gridY }]);
      setIsDrawingAnnotationLine(true);
      return;
    }

    // Annotation text placement - grid-cell based
    if (activeTool === 'annotate-text') {
      const { x, y } = getCanvasPosition(e);
      const { gridX, gridY } = getGridFromCanvas(x, y);
      setTextInputPosition({ gridX, gridY });
      setTextInputValue('');
      // Focus will happen via autoFocus on the input
      return;
    }

    // Pan tool - start panning
    if (activeTool === 'pan') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - canvasState.panX, y: e.clientY - canvasState.panY });
      return;
    }

    const { x, y } = getCanvasPosition(e);
    const { gridX, gridY } = getGridFromCanvas(x, y);
    
    // Arrow tool - toggle arrow on clicked connection
    if (activeTool === 'arrow') {
      const conn = findConnectionAtPosition(gridX, gridY);
      if (conn && onConnectionArrowToggle) {
        onConnectionArrowToggle(conn.id);
      }
      return;
    }
    
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
  }, [activeTool, canvasState.panX, canvasState.panY, getCanvasPosition, getGridFromCanvas, getTileAndCellAtPosition, tileSize, onSelectionChange, findConnectionAtPosition, onConnectionArrowToggle]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // Annotation line path drawing - grid cell based like connection tool
    if (isDrawingAnnotationLine && activeTool === 'annotate-line') {
      const { x, y } = getCanvasPosition(e);
      const { gridX, gridY } = getGridFromCanvas(x, y);
      const clampedX = Math.max(0, Math.min(gridX, gridCols - 1));
      const clampedY = Math.max(0, Math.min(gridY, gridRows - 1));
      
      setAnnotationLinePath(prev => {
        if (prev.length === 0) return [{ gridX: clampedX, gridY: clampedY }];
        const lastCell = prev[prev.length - 1];
        if (lastCell.gridX === clampedX && lastCell.gridY === clampedY) return prev;
        
        // Allow going back
        const existingIndex = prev.findIndex(c => c.gridX === clampedX && c.gridY === clampedY);
        if (existingIndex !== -1) return prev.slice(0, existingIndex + 1);
        
        // Only add if adjacent (orthogonally)
        const dx = Math.abs(clampedX - lastCell.gridX);
        const dy = Math.abs(clampedY - lastCell.gridY);
        if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
          return [...prev, { gridX: clampedX, gridY: clampedY }];
        }
        
        // Fill gaps
        const newCells: { gridX: number; gridY: number }[] = [];
        let cx = lastCell.gridX;
        let cy = lastCell.gridY;
        while (cx !== clampedX || cy !== clampedY) {
          if (cx < clampedX) cx++;
          else if (cx > clampedX) cx--;
          else if (cy < clampedY) cy++;
          else if (cy > clampedY) cy--;
          if (!prev.some(c => c.gridX === cx && c.gridY === cy)) {
            newCells.push({ gridX: cx, gridY: cy });
          }
        }
        return [...prev, ...newCells];
      });
      return;
    }

    // Annotation dragging (grid-based)
    if (isDraggingAnnotation && selectedAnnotationId && annotationDragStart) {
      const { x, y } = getCanvasPosition(e);
      const { gridX, gridY } = getGridFromCanvas(x, y);
      const dx = gridX - annotationDragStart.gridX;
      const dy = gridY - annotationDragStart.gridY;
      if (dx !== 0 || dy !== 0) {
        const isLine = annotationLines.some(l => l.id === selectedAnnotationId);
        if (isLine) {
          onAnnotationLineMove?.(selectedAnnotationId, dx, dy);
        } else {
          onAnnotationTextMove?.(selectedAnnotationId, dx, dy);
        }
        setAnnotationDragStart({ gridX, gridY });
      }
      return;
    }

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
        // WICHTIG: Erst die aktuelle Bewegungsrichtung fortsetzen, um T-Stücke zu vermeiden!
        const newCells: { gridX: number; gridY: number }[] = [];
        let cx = lastCell.gridX;
        let cy = lastCell.gridY;
        
        // Bestimme die letzte Bewegungsrichtung aus dem Pfad
        let lastMoveWasHorizontal = true; // Default
        if (prev.length >= 2) {
          const prevPrev = prev[prev.length - 2];
          const dxLast = lastCell.gridX - prevPrev.gridX;
          const dyLast = lastCell.gridY - prevPrev.gridY;
          lastMoveWasHorizontal = dxLast !== 0;
        }
        
        while (cx !== clampedX || cy !== clampedY) {
          // Setze die letzte Bewegungsrichtung fort, wenn möglich
          if (lastMoveWasHorizontal) {
            // Erst horizontal, dann vertikal
            if (cx < clampedX) cx++;
            else if (cx > clampedX) cx--;
            else if (cy < clampedY) cy++;
            else if (cy > clampedY) cy--;
          } else {
            // Erst vertikal, dann horizontal
            if (cy < clampedY) cy++;
            else if (cy > clampedY) cy--;
            else if (cx < clampedX) cx++;
            else if (cx > clampedX) cx--;
          }
          
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
  }, [isPanning, isDragging, isSelectionBox, isConnecting, selectedTileIds, canvasState, panStart, getCanvasPosition, getGridFromCanvas, tiles, onCanvasStateChange, onTilesChange, onSelectionChange, activeTool, selectionBoxStart, tileSize, gridCols, gridRows, dragStartMousePos, dragStartPositions, isDrawingAnnotationLine, isDraggingAnnotation, selectedAnnotationId, annotationDragStart, annotationLines, onAnnotationLineMove, onAnnotationTextMove]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    // Finish annotation line drawing - create from path
    if (isDrawingAnnotationLine && annotationLinePath.length >= 2) {
      onAnnotationLineCreate?.({
        path: [...annotationLinePath],
        color: annotationColor,
        strokeWidth: 2,
        lineStyle: annotationLineStyle
      });
      setIsDrawingAnnotationLine(false);
      setAnnotationLinePath([]);
    } else if (isDrawingAnnotationLine) {
      setIsDrawingAnnotationLine(false);
      setAnnotationLinePath([]);
    }

    // Finish annotation dragging
    if (isDraggingAnnotation) {
      setIsDraggingAnnotation(false);
      setAnnotationDragStart(null);
    }

    // Handle connection path completion
    if (isConnecting && connectionPath.length >= 2 && (activeTool === 'connect' || activeTool === 'disconnect')) {
      if (activeTool === 'connect') {
        // WICHTIG: Für NEUE Verbindungsblöcke dürfen wir NUR den aktuellen Pfad betrachten,
        // NICHT bestehende Blöcke kombinieren. Das würde sonst T-Stücke erzeugen.
        // Bestehende Blöcke werden nur erweitert wenn der Pfad ÜBER sie verläuft.
        
        const tilesToRemove: Set<string> = new Set();
        // Map von gridX,gridY -> Block für neue/aktualisierte Blöcke (mit optionaler alter Tile-ID)
        const blockUpdates: Map<string, { component: Component; gridX: number; gridY: number; oldTileId?: string }> = new Map();
        let updatedTiles = [...tiles];
        
        // Check each cell in the path for empty cells or existing connection blocks
        for (let i = 0; i < connectionPath.length; i++) {
          const cell = connectionPath[i];
          const tileInfo = getTileAndCellAtPosition(cell.gridX, cell.gridY);
          
          const prevCell = i > 0 ? connectionPath[i - 1] : null;
          const nextCell = i < connectionPath.length - 1 ? connectionPath[i + 1] : null;
          
          const cellKey = `${cell.gridX},${cell.gridY}`;
          
          // Fall 1: Keine Tile an dieser Position - neuen Verbindungsblock hinzufügen
          // WICHTIG: NUR Pfad-Richtungen, KEINE Kombination mit anderen Blöcken!
          if (!tileInfo) {
            // Übergebe leeres Array - wir wollen NUR prevCell und nextCell berücksichtigen
            const connectionBlock = getConnectionBlockForPath(prevCell, cell, nextCell, []);
            
            if (connectionBlock) {
              // Einfach setzen - KEINE Kombination! Überschreibe bei Duplikaten
              blockUpdates.set(cellKey, { component: connectionBlock, gridX: cell.gridX, gridY: cell.gridY });
            }
          }
          // Fall 2: Bestehender Verbindungsblock - erweitern wenn nötig
          else if (isConnectionBlock(tileInfo.tile.component)) {
            const updatedBlock = getConnectionBlockForPath(prevCell, cell, nextCell, tiles);
            
            if (updatedBlock && updatedBlock.id !== tileInfo.tile.component.id) {
              // Block muss aktualisiert werden (z.B. Linie → T-Stück)
              // Speichere die alte Tile-ID für spätere Connection-Aktualisierung
              tilesToRemove.add(tileInfo.tile.id);
              blockUpdates.set(cellKey, { 
                component: updatedBlock, 
                gridX: cell.gridX, 
                gridY: cell.gridY,
                oldTileId: tileInfo.tile.id  // Merke alte ID für Connection-Migration
              });
            }
          }
        }
        
        // Erstelle Mapping von alten zu neuen Tile-IDs
        const oldToNewTileIdMap = new Map<string, string>();
        
        // Remove tiles that need to be replaced, then add new tiles
        if (tilesToRemove.size > 0 || blockUpdates.size > 0) {
          updatedTiles = updatedTiles.filter(t => !tilesToRemove.has(t.id));
          const newTilesToAdd: PlacedTile[] = Array.from(blockUpdates.values()).map(update => {
            const newId = generateTileId();
            // Speichere Mapping von alter zu neuer ID
            if (update.oldTileId) {
              oldToNewTileIdMap.set(update.oldTileId, newId);
            }
            return {
              id: newId,
              component: update.component,
              gridX: update.gridX,
              gridY: update.gridY
            };
          });
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
        
        // Migriere bestehende Connections: ersetze alte Tile-IDs durch neue
        let currentConnections = connections.map(conn => {
          let updatedConn = { ...conn };
          const newFromId = oldToNewTileIdMap.get(conn.fromTileId);
          const newToId = oldToNewTileIdMap.get(conn.toTileId);
          if (newFromId) {
            updatedConn = { ...updatedConn, fromTileId: newFromId };
          }
          if (newToId) {
            updatedConn = { ...updatedConn, toTileId: newToId };
          }
          return updatedConn;
        });
        
        // Collect all new connections to add at once
        const newConnectionsToAdd: CellConnection[] = [];
        
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
              // Remove existing connection between these cells (auch mit alten IDs prüfen)
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
        
        // Update connections once with all new connections + migrated old connections
        if (newConnectionsToAdd.length > 0 || oldToNewTileIdMap.size > 0) {
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
  }, [isConnecting, connectionPath, activeTool, getTileAndCellAtPosition, connections, connectionColor, onConnectionsChange, isDrawingAnnotationLine, annotationLinePath, annotationColor, annotationLineStyle, onAnnotationLineCreate, isDraggingAnnotation]);

  const handleTileMouseDown = useCallback((e: React.MouseEvent, tile: PlacedTile) => {
    e.stopPropagation();
    
    const { x, y } = getCanvasPosition(e);
    const { gridX, gridY } = getGridFromCanvas(x, y);
    const cellX = gridX - tile.gridX;
    const cellY = gridY - tile.gridY;
    
    // Arrow tool - toggle arrow on clicked connection
    if (activeTool === 'arrow') {
      const conn = findConnectionAtPosition(gridX, gridY);
      if (conn && onConnectionArrowToggle) {
        onConnectionArrowToggle(conn.id);
      }
      return;
    }
    
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
  }, [activeTool, getCanvasPosition, getGridFromCanvas, onSelectionChange, selectedTileIds, tiles, tileSize, isGroupMode, findConnectionAtPosition, onConnectionArrowToggle]);

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
        // Check if we're replacing connection blocks
        const connectionBlocksToReplace = getConnectionBlocksAtPosition(component, gridX, gridY);
        
        if (connectionBlocksToReplace.length > 0) {
          // Collect all connections from the replaced connection blocks
          const connectionsToTransfer: CellConnection[] = [];
          const connectionBlockIds = new Set(connectionBlocksToReplace.map(cb => cb.id));
          
          // Find all connections involving the connection blocks
          for (const conn of connections) {
            const fromIsConnectionBlock = connectionBlockIds.has(conn.fromTileId);
            const toIsConnectionBlock = connectionBlockIds.has(conn.toTileId);
            
            // We need to transfer connections that go TO or FROM the connection blocks
            // but connect to OTHER tiles (not the connection blocks themselves)
            if (fromIsConnectionBlock && !toIsConnectionBlock) {
              // Connection goes FROM connection block TO another tile
              // We'll create a new connection from the new tile to that tile
              const fromBlock = connectionBlocksToReplace.find(cb => cb.id === conn.fromTileId);
              if (fromBlock) {
                // Calculate the relative cell position within the new component
                const relCellX = fromBlock.gridX - gridX + conn.fromCellX;
                const relCellY = fromBlock.gridY - gridY + conn.fromCellY;
                
                // Only transfer if the cell position is within the new component
                const compWidth = component.width || 1;
                const compHeight = component.height || 1;
                if (relCellX >= 0 && relCellX < compWidth && relCellY >= 0 && relCellY < compHeight) {
                  connectionsToTransfer.push({
                    ...conn,
                    // Will be updated with new tile ID after creation
                    __fromCellX: relCellX,
                    __fromCellY: relCellY,
                    __transferType: 'from'
                  } as any);
                }
              }
            } else if (toIsConnectionBlock && !fromIsConnectionBlock) {
              // Connection goes FROM another tile TO a connection block
              const toBlock = connectionBlocksToReplace.find(cb => cb.id === conn.toTileId);
              if (toBlock) {
                const relCellX = toBlock.gridX - gridX + conn.toCellX;
                const relCellY = toBlock.gridY - gridY + conn.toCellY;
                
                const compWidth = component.width || 1;
                const compHeight = component.height || 1;
                if (relCellX >= 0 && relCellX < compWidth && relCellY >= 0 && relCellY < compHeight) {
                  connectionsToTransfer.push({
                    ...conn,
                    __toCellX: relCellX,
                    __toCellY: relCellY,
                    __transferType: 'to'
                  } as any);
                }
              }
            }
          }
          
          // Remove the connection blocks and their connections
          const newTiles = tiles.filter(t => !connectionBlockIds.has(t.id));
          const newConnections = connections.filter(c => 
            !connectionBlockIds.has(c.fromTileId) && !connectionBlockIds.has(c.toTileId)
          );
          
          // Create the new tile
          const newTileId = Math.random().toString(36).substring(2, 11);
          const newTile: PlacedTile = { id: newTileId, component, gridX, gridY };
          
          // Transfer the connections with the new tile ID
          const transferredConnections: CellConnection[] = connectionsToTransfer.map((conn: any) => {
            if (conn.__transferType === 'from') {
              return {
                id: generateConnectionId(),
                fromTileId: newTileId,
                fromCellX: conn.__fromCellX,
                fromCellY: conn.__fromCellY,
                fromSide: conn.fromSide,
                toTileId: conn.toTileId,
                toCellX: conn.toCellX,
                toCellY: conn.toCellY,
                toSide: conn.toSide,
                color: conn.color
              };
            } else {
              return {
                id: generateConnectionId(),
                fromTileId: conn.fromTileId,
                fromCellX: conn.fromCellX,
                fromCellY: conn.fromCellY,
                fromSide: conn.fromSide,
                toTileId: newTileId,
                toCellX: conn.__toCellX,
                toCellY: conn.__toCellY,
                toSide: conn.toSide,
                color: conn.color
              };
            }
          });
          
          // Update tiles and connections
          onTilesChange([...newTiles, newTile]);
          onConnectionsChange([...newConnections, ...transferredConnections]);
          onSelectionChange(new Set([newTileId]));
        } else {
          // Normal drop without replacing connection blocks
          onDropComponent(component, gridX, gridY);
        }
      }
    } catch (err) {
      console.error('Failed to parse dropped data:', err);
    }
  }, [getGridPosition, canPlaceComponent, getConnectionBlocksAtPosition, onDropComponent, onDropGroup, onDragEnd, tiles, connections, onTilesChange, onConnectionsChange, onSelectionChange]);

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
    if (activeTool === 'arrow') return 'pointer';
    if (activeTool === 'annotate-line') return 'crosshair';
    if (activeTool === 'annotate-text') return 'text';
    if (isDragging || isDraggingAnnotation) return 'grabbing';
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
    // WICHTIG: Diese Berechnung muss mit renderTileShapes für Verbindungsblöcke übereinstimmen!
    // Erhöht von 0.03 auf 0.04 für bessere Sichtbarkeit
    const connectionStrokeWidth = tileSize * 0.04;
    
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
    
    // Prüfen ob es ein Verbindungsblock ist - dann einheitliche Liniendicke verwenden
    const isConnBlock = isConnectionBlock(component);
    
    // Für Verbindungsblöcke: Farben aus den zugehörigen Connections ermitteln
    // Unterscheide zwischen horizontalen und vertikalen Verbindungen
    let horizontalColor: string | undefined;
    let verticalColor: string | undefined;
    if (isConnBlock) {
      // Finde alle Connections die diesen Block berühren
      const tileConnections = connections.filter(c => 
        c.fromTileId === tile.id || c.toTileId === tile.id
      );
      
      for (const conn of tileConnections) {
        // Bestimme ob diese Connection horizontal oder vertikal ist
        const side = conn.fromTileId === tile.id ? conn.fromSide : conn.toSide;
        if (side === 'left' || side === 'right') {
          // Horizontale Verbindung
          if (!horizontalColor) horizontalColor = conn.color;
        } else {
          // Vertikale Verbindung
          if (!verticalColor) verticalColor = conn.color;
        }
      }
    }
    
    // WICHTIG: Alle Verbindungslinien (Connection-Blöcke UND dynamische Linien)
    // müssen dieselbe einheitliche Strichstärke haben: tileSize * 0.04
    // Dies entspricht der Berechnung in renderConnectionLines
    const uniformConnectionStrokeWidth = tileSize * 0.04;
    
    // Für normale Komponenten: Skalierung basierend auf Vorschaugröße
    const libraryPreviewSize = 50;
    const scaleRatio = refScale / libraryPreviewSize;
    const defaultStrokeWidth = 1.5 * scaleRatio;
    
    return component.shapes.map((shape, idx) => {
      // Für Verbindungsblöcke: Immer einheitliche Liniendicke und Farbe
      // Für normale Komponenten: Skaliert wie bisher
      let sw: number;
      let strokeColor: string | undefined;
      if (isConnBlock) {
        sw = uniformConnectionStrokeWidth;
        // Farbe basierend auf der Richtung der Shape zuweisen
        // Shape-IDs enden mit -h für horizontal, -v für vertikal
        const shapeId = shape.id || '';
        if (shapeId.endsWith('-h')) {
          strokeColor = horizontalColor;
        } else if (shapeId.endsWith('-v')) {
          strokeColor = verticalColor;
        } else {
          // Fallback: erste verfügbare Farbe
          strokeColor = horizontalColor || verticalColor;
        }
      } else {
        sw = shape.strokeWidth 
          ? shape.strokeWidth * refScale 
          : defaultStrokeWidth;
      }
      
      const scaledShape: Shape = {
        ...shape,
        x: shape.x * compWidth,
        y: shape.y * compHeight,
        width: shape.width * compWidth,
        height: shape.height * compHeight,
        strokeWidth: Math.max(0.5, sw),
        // Für Verbindungsblöcke: Farbe aus Connection verwenden
        stroke: strokeColor || shape.stroke,
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
        
        {/* Grid overlay - excluded from export */}
        <rect
          x={0}
          y={0}
          width={gridCols * tileSize}
          height={gridRows * tileSize}
          fill="url(#tile-grid)"
          data-export-ignore="true"
        />
        {/* Right and bottom edge lines to complete the grid - excluded from export */}
        <line 
          x1={gridCols * tileSize} 
          y1={0} 
          x2={gridCols * tileSize} 
          y2={gridRows * tileSize} 
          stroke="hsl(var(--canvas-grid))" 
          strokeWidth="1"
          data-export-ignore="true"
        />
        <line 
          x1={0} 
          y1={gridRows * tileSize} 
          x2={gridCols * tileSize} 
          y2={gridRows * tileSize} 
          stroke="hsl(var(--canvas-grid))" 
          strokeWidth="1"
          data-export-ignore="true"
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
          const isExcess = excessTileIds.has(tile.id);
          const rotation = tile.rotation || 0;
          
          // Calculate rotation center (center of the tile)
          const centerX = compWidth / 2;
          const centerY = compHeight / 2;
          
          // Check if any cell of this tile is in the connection path
          const isTileInPath = isConnecting && connectionPath.some(cell => {
            const tileWidth = tile.component.width || 1;
            const tileHeight = tile.component.height || 1;
            return cell.gridX >= tile.gridX && cell.gridX < tile.gridX + tileWidth &&
                   cell.gridY >= tile.gridY && cell.gridY < tile.gridY + tileHeight;
          });

          // Determine stroke color and style
          let strokeColor = "transparent";
          let strokeDasharray: string | undefined = undefined;
          if (isExcess) {
            strokeColor = "hsl(0, 84%, 50%)"; // Red for excess
          } else if (isTileInPath || isSelected) {
            strokeColor = "hsl(var(--primary))";
          }
          
          return (
            <g
              key={tile.id}
              transform={`translate(${x}, ${y})`}
              onMouseDown={(e) => handleTileMouseDown(e, tile)}
              style={{ cursor: activeTool === 'select' || activeTool === 'connect' || activeTool === 'disconnect' || activeTool === 'arrow' ? 'pointer' : 'inherit' }}
            >
              {/* Tile background - not rotated */}
              <rect
                width={compWidth}
                height={compHeight}
                fill={
                  isSelected 
                    ? "hsl(var(--primary) / 0.1)" 
                    : isExcess
                      ? "hsl(0, 84%, 50%, 0.1)"
                      : "hsl(var(--muted) / 0.3)"
                }
                stroke={strokeColor}
                strokeWidth={isExcess ? 3 : 2}
                strokeDasharray={strokeDasharray}
              />
              {/* Component shapes - rotated around center */}
              <g transform={rotation !== 0 ? `rotate(${rotation}, ${centerX}, ${centerY})` : undefined}>
                {renderTileShapes(tile)}
              </g>
              {/* Connection lines - NOT rotated, stay at absolute positions */}
              {renderConnectionLines(tile)}
            </g>
          );
        })}

        {/* Auto-generated tile labels */}
        {tileLabels.size > 0 && tiles.map(tile => {
          const labelData = tileLabels.get(tile.id);
          if (!labelData) return null;
          
          const x = tile.gridX * tileSize;
          const y = tile.gridY * tileSize;
          const compWidth = (tile.component.width || 1) * tileSize;
          
          // Position label at top-right corner, extending beyond tile boundaries
          const fontSize = Math.max(10, tileSize * 0.3);
          const labelX = x + compWidth + 2; // Extend slightly beyond right edge
          const labelY = y + fontSize * 0.8; // Position near top edge
          
          return (
            <g key={`label-${tile.id}`}>
              {/* Label text only - no background/border */}
              <text
                x={labelX}
                y={labelY}
                fontSize={fontSize}
                fontFamily="sans-serif"
                fontWeight="bold"
                fill={labelData.color}
                textAnchor="end"
              >
                {labelData.label}
              </text>
            </g>
          );
        })}

        {/* Auto-Verbindungslinien (gestrichelt, orthogonal) */}
        {autoConnectionLines.length > 0 && autoConnectionLines.map((line, index) => {
          // Konvertiere Grid-Koordinaten zu Pixel-Koordinaten
          const fromX = line.fromX * tileSize;
          const fromY = line.fromY * tileSize;
          const midX = line.midX * tileSize;
          const midY = line.midY * tileSize;
          const toX = line.toX * tileSize;
          const toY = line.toY * tileSize;
          
          const strokeWidth = tileSize * 0.02; // Dünne Linie
          const dashArray = `${tileSize * 0.1} ${tileSize * 0.05}`; // Gestrichelt
          
          // Orthogonale Linie: erst horizontal, dann vertikal (oder direkt wenn auf einer Achse)
          const points = `${fromX},${fromY} ${midX},${midY} ${toX},${toY}`;
          
          return (
            <polyline
              key={`auto-conn-${line.fromTileId}-${line.toTileId}-${index}`}
              points={points}
              fill="none"
              stroke="#666666"
              strokeWidth={strokeWidth}
              strokeDasharray={dashArray}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.7}
            />
          );
        })}

        {/* Annotationsebene - Markierungslinien (path-based) */}
        {annotationLines.map(line => {
          const isSelected = selectedAnnotationId === line.id;
          const unit = tileSize * 0.1;
          let dashArray: string | undefined;
          switch (line.lineStyle) {
            case 'dashed': dashArray = `${unit * 2} ${unit}`; break;
            case 'dotted': dashArray = `${unit * 0.5} ${unit}`; break;
            case 'dash-dot': dashArray = `${unit * 2} ${unit} ${unit * 0.5} ${unit}`; break;
            default: dashArray = undefined;
          }
          // Build polyline points from path (cell centers)
          const points = line.path.map(p => `${(p.gridX + 0.5) * tileSize},${(p.gridY + 0.5) * tileSize}`).join(' ');
          return (
            <g key={`ann-line-${line.id}`}>
              {/* Invisible wider hit area for easier selection */}
              <polyline
                points={points}
                fill="none"
                stroke="transparent"
                strokeWidth={Math.max(line.strokeWidth + 8, 12)}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  if (activeTool === 'select') {
                    onAnnotationSelect?.(line.id, 'line');
                    const { x, y } = getCanvasPosition(e);
                    const { gridX, gridY } = getGridFromCanvas(x, y);
                    setIsDraggingAnnotation(true);
                    setAnnotationDragStart({ gridX, gridY });
                  }
                }}
                style={{ cursor: activeTool === 'select' ? 'move' : 'inherit' }}
              />
              <polyline
                points={points}
                fill="none"
                stroke={line.color}
                strokeWidth={line.strokeWidth}
                strokeDasharray={dashArray}
                strokeLinecap="round"
                strokeLinejoin="round"
                pointerEvents="none"
              />
              {isSelected && line.path.length > 0 && (
                <>
                  <circle cx={(line.path[0].gridX + 0.5) * tileSize} cy={(line.path[0].gridY + 0.5) * tileSize} r={4} fill="hsl(var(--primary))" />
                  <circle cx={(line.path[line.path.length - 1].gridX + 0.5) * tileSize} cy={(line.path[line.path.length - 1].gridY + 0.5) * tileSize} r={4} fill="hsl(var(--primary))" />
                </>
              )}
            </g>
          );
        })}

        {/* Annotationsebene - Textfelder */}
        {annotationTexts.map(text => {
          const isSelected = selectedAnnotationId === text.id;
          return (
            <g key={`ann-text-${text.id}`}>
              <text
                x={(text.gridX + 0.5) * tileSize}
                y={(text.gridY + 0.5) * tileSize}
                fontSize={text.fontSize}
                fontWeight={text.fontWeight || 'normal'}
                fill={text.color}
                fontFamily="sans-serif"
                dominantBaseline="middle"
                textAnchor="middle"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  if (activeTool === 'select') {
                    onAnnotationSelect?.(text.id, 'text');
                    const pos = getCanvasPosition(e);
                    const grid = getGridFromCanvas(pos.x, pos.y);
                    setIsDraggingAnnotation(true);
                    setAnnotationDragStart({ gridX: grid.gridX, gridY: grid.gridY });
                  }
                }}
                style={{ cursor: activeTool === 'select' ? 'move' : 'inherit', userSelect: 'none' }}
              >
                {text.text}
              </text>
              {isSelected && (
                <rect
                  x={text.gridX * tileSize}
                  y={text.gridY * tileSize}
                  width={tileSize}
                  height={tileSize}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  rx={2}
                />
              )}
            </g>
          );
        })}

        {/* Annotation line path preview while drawing */}
        {isDrawingAnnotationLine && annotationLinePath.length > 0 && (
          <g data-export-ignore="true">
            {annotationLinePath.map((cell, idx) => (
              <rect
                key={`ann-path-${idx}`}
                x={cell.gridX * tileSize}
                y={cell.gridY * tileSize}
                width={tileSize}
                height={tileSize}
                fill="hsl(var(--primary) / 0.15)"
                stroke="hsl(var(--primary))"
                strokeWidth={1.5}
                rx={2}
              />
            ))}
          </g>
        )}

        {/* Text input for annotation text placement */}
        {textInputPosition && (
          <foreignObject
            x={textInputPosition.gridX * tileSize}
            y={textInputPosition.gridY * tileSize}
            width={Math.max(200, 8 * tileSize)}
            height={Math.max(annotationFontSize + 16, tileSize)}
            data-export-ignore="true"
          >
            <div style={{ width: '100%', height: '100%' }}>
              <input
                ref={textInputRef}
                autoFocus
                value={textInputValue}
                onChange={(e) => setTextInputValue((e.target as HTMLInputElement).value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter' && textInputValue.trim()) {
                    onAnnotationTextCreate?.({
                      gridX: textInputPosition.gridX,
                      gridY: textInputPosition.gridY,
                      text: textInputValue.trim(),
                      fontSize: annotationFontSize,
                      color: annotationColor,
                    });
                    setTextInputPosition(null);
                    setTextInputValue('');
                  }
                  if (e.key === 'Escape') {
                    setTextInputPosition(null);
                    setTextInputValue('');
                  }
                }}
                onBlur={() => {
                  if (textInputValue.trim()) {
                    onAnnotationTextCreate?.({
                      gridX: textInputPosition.gridX,
                      gridY: textInputPosition.gridY,
                      text: textInputValue.trim(),
                      fontSize: annotationFontSize,
                      color: annotationColor,
                    });
                  }
                  setTextInputPosition(null);
                  setTextInputValue('');
                }}
                style={{
                  fontSize: `${annotationFontSize}px`,
                  border: '2px solid hsl(221.2, 83.2%, 53.3%)',
                  outline: 'none',
                  padding: '2px 4px',
                  backgroundColor: 'white',
                  color: annotationColor,
                  width: '100%',
                  fontFamily: 'sans-serif',
                  borderRadius: '3px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </foreignObject>
        )}
        {connections.filter(c => c.arrowDirection && c.arrowDirection !== 'none').map(conn => {
          const fromTile = tiles.find(t => t.id === conn.fromTileId);
          const toTile = tiles.find(t => t.id === conn.toTileId);
          if (!fromTile || !toTile) return null;
          
          // Calculate the midpoint between the two connected cells
          const fromGridX = fromTile.gridX + conn.fromCellX;
          const fromGridY = fromTile.gridY + conn.fromCellY;
          const toGridX = toTile.gridX + conn.toCellX;
          const toGridY = toTile.gridY + conn.toCellY;
          
          // Calculate pixel positions (cell centers)
          const fromCenterX = (fromGridX + 0.5) * tileSize;
          const fromCenterY = (fromGridY + 0.5) * tileSize;
          const toCenterX = (toGridX + 0.5) * tileSize;
          const toCenterY = (toGridY + 0.5) * tileSize;
          
          // Midpoint for arrow placement
          const midX = (fromCenterX + toCenterX) / 2;
          const midY = (fromCenterY + toCenterY) / 2;
          
          // Calculate arrow direction angle
          let angle = Math.atan2(toCenterY - fromCenterY, toCenterX - fromCenterX) * (180 / Math.PI);
          
          // Reverse if backward
          if (conn.arrowDirection === 'backward') {
            angle += 180;
          }
          
          const arrowSize = tileSize * 0.15;
          const strokeWidth = tileSize * 0.04;
          const color = conn.color || '#000000';
          
          return (
            <g key={`arrow-${conn.id}`} transform={`translate(${midX}, ${midY}) rotate(${angle})`}>
              {/* Arrow head (triangle) */}
              <polygon
                points={`${arrowSize},0 ${-arrowSize * 0.5},${-arrowSize * 0.6} ${-arrowSize * 0.5},${arrowSize * 0.6}`}
                fill={color}
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinejoin="round"
              />
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

        {/* Title Block (Zeichenkopf) */}
        {titleBlockData?.enabled && (
          <TitleBlock
            data={titleBlockData}
            paperWidth={gridCols * tileSize}
            paperHeight={gridRows * tileSize}
            tileSize={tileSize}
            onDataChange={() => {}}
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
