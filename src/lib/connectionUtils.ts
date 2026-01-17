import { Shape } from "@/types/schematic";

/**
 * Find text shapes that intersect a horizontal line
 */
function findTextIntersectionsHorizontal(
  shapes: Shape[],
  y: number
): { minX: number; maxX: number }[] {
  const textShapes = shapes.filter(s => s.type === 'text');
  const intersections: { minX: number; maxX: number }[] = [];
  
  for (const text of textShapes) {
    const textTop = text.y;
    const textBottom = text.y + (text.height || 0.1);
    
    if (y >= textTop && y <= textBottom) {
      intersections.push({
        minX: text.x,
        maxX: text.x + (text.width || 0.1)
      });
    }
  }
  
  return intersections.sort((a, b) => a.minX - b.minX);
}

/**
 * Find text shapes that intersect a vertical line
 */
function findTextIntersectionsVertical(
  shapes: Shape[],
  x: number
): { minY: number; maxY: number }[] {
  const textShapes = shapes.filter(s => s.type === 'text');
  const intersections: { minY: number; maxY: number }[] = [];
  
  for (const text of textShapes) {
    const textLeft = text.x;
    const textRight = text.x + (text.width || 0.1);
    
    if (x >= textLeft && x <= textRight) {
      intersections.push({
        minY: text.y,
        maxY: text.y + (text.height || 0.1)
      });
    }
  }
  
  return intersections.sort((a, b) => a.minY - b.minY);
}

/**
 * Generate a single connection line from component edge to tile edge
 * with proper cell-based positioning for multi-cell components
 */
export function generateSingleConnectionLine(
  componentShapes: Shape[],
  cellX: number,
  cellY: number,
  side: 'left' | 'right' | 'top' | 'bottom',
  tileWidth: number,
  tileHeight: number
): Shape[] {
  const shapes: Shape[] = [];
  const strokeWidth = 0.02;

  // Filter only geometric shapes (exclude text, lines, arrows)
  const geometricShapes = componentShapes.filter(s => 
    !['text', 'line', 'arrow', 'polyline'].includes(s.type)
  );

  // Calculate the normalized position within the tile based on cell
  const cellWidthNorm = 1 / tileWidth;
  const cellHeightNorm = 1 / tileHeight;

  if (side === 'left' || side === 'right') {
    // Y position at center of the cell (normalized 0-1)
    const yNorm = (cellY + 0.5) * cellHeightNorm;
    
    // Tile edge position (0 for left, 1 for right)
    const tileEdgeX = side === 'left' ? 0 : 1;
    
    // Find the component shape edge that intersects at this Y
    let componentEdgeX = tileEdgeX; // default: line goes to tile edge
    
    for (const shape of geometricShapes) {
      const shapeTop = shape.y;
      const shapeBottom = shape.y + shape.height;
      
      // Check if this Y intersects the shape
      if (yNorm >= shapeTop && yNorm <= shapeBottom) {
        if (side === 'left') {
          // For left side connection, find the leftmost edge of the shape
          componentEdgeX = Math.max(componentEdgeX, shape.x);
        } else {
          // For right side connection, find the rightmost edge of the shape
          const shapeRight = shape.x + shape.width;
          componentEdgeX = Math.min(componentEdgeX, shapeRight);
        }
      }
    }
    
    // Create line from tile edge to component edge
    const startX = side === 'left' ? 0 : componentEdgeX;
    const endX = side === 'left' ? componentEdgeX : 1;
    
    // Skip if no line to draw
    if (Math.abs(endX - startX) < 0.001) return shapes;
    
    const textBreaks = findTextIntersectionsHorizontal(componentShapes, yNorm);
    
    if (textBreaks.length === 0) {
      shapes.push({
        id: `conn-${side}-${cellX}-${cellY}`,
        type: 'line',
        x: startX,
        y: yNorm,
        width: endX - startX,
        height: 0,
        strokeWidth
      });
    } else {
      let currentX = startX;
      for (const textBreak of textBreaks) {
        if (textBreak.minX > currentX && textBreak.minX < endX) {
          shapes.push({
            id: `conn-${side}-${cellX}-${cellY}-seg-${currentX}`,
            type: 'line',
            x: currentX,
            y: yNorm,
            width: textBreak.minX - currentX,
            height: 0,
            strokeWidth
          });
        }
        currentX = Math.max(currentX, textBreak.maxX);
      }
      if (currentX < endX) {
        shapes.push({
          id: `conn-${side}-${cellX}-${cellY}-seg-end`,
          type: 'line',
          x: currentX,
          y: yNorm,
          width: endX - currentX,
          height: 0,
          strokeWidth
        });
      }
    }
  } else {
    // Top or bottom connection
    const xNorm = (cellX + 0.5) * cellWidthNorm;
    
    // Tile edge position (0 for top, 1 for bottom)
    const tileEdgeY = side === 'top' ? 0 : 1;
    
    let componentEdgeY = tileEdgeY;
    
    for (const shape of geometricShapes) {
      const shapeLeft = shape.x;
      const shapeRight = shape.x + shape.width;
      
      if (xNorm >= shapeLeft && xNorm <= shapeRight) {
        if (side === 'top') {
          // For top side, find the topmost edge of the shape
          componentEdgeY = Math.max(componentEdgeY, shape.y);
        } else {
          // For bottom side, find the bottommost edge of the shape
          const shapeBottom = shape.y + shape.height;
          componentEdgeY = Math.min(componentEdgeY, shapeBottom);
        }
      }
    }
    
    const startY = side === 'top' ? 0 : componentEdgeY;
    const endY = side === 'top' ? componentEdgeY : 1;
    
    // Skip if no line to draw
    if (Math.abs(endY - startY) < 0.001) return shapes;
    
    const textBreaks = findTextIntersectionsVertical(componentShapes, xNorm);
    
    if (textBreaks.length === 0) {
      shapes.push({
        id: `conn-${side}-${cellX}-${cellY}`,
        type: 'line',
        x: xNorm,
        y: startY,
        width: 0,
        height: endY - startY,
        strokeWidth
      });
    } else {
      let currentY = startY;
      for (const textBreak of textBreaks) {
        if (textBreak.minY > currentY && textBreak.minY < endY) {
          shapes.push({
            id: `conn-${side}-${cellX}-${cellY}-seg-${currentY}`,
            type: 'line',
            x: xNorm,
            y: currentY,
            width: 0,
            height: textBreak.minY - currentY,
            strokeWidth
          });
        }
        currentY = Math.max(currentY, textBreak.maxY);
      }
      if (currentY < endY) {
        shapes.push({
          id: `conn-${side}-${cellX}-${cellY}-seg-end`,
          type: 'line',
          x: xNorm,
          y: currentY,
          width: 0,
          height: endY - currentY,
          strokeWidth
        });
      }
    }
  }

  return shapes;
}

export function areCellsAdjacent(
  tile1GridX: number, tile1GridY: number, tile1Width: number, tile1Height: number,
  cell1X: number, cell1Y: number,
  tile2GridX: number, tile2GridY: number, tile2Width: number, tile2Height: number,
  cell2X: number, cell2Y: number
): { fromSide: 'left' | 'right' | 'top' | 'bottom'; toSide: 'left' | 'right' | 'top' | 'bottom' } | null {
  const abs1X = tile1GridX + cell1X;
  const abs1Y = tile1GridY + cell1Y;
  const abs2X = tile2GridX + cell2X;
  const abs2Y = tile2GridY + cell2Y;

  if (abs1Y === abs2Y) {
    if (abs1X + 1 === abs2X) return { fromSide: 'right', toSide: 'left' };
    if (abs2X + 1 === abs1X) return { fromSide: 'left', toSide: 'right' };
  }
  if (abs1X === abs2X) {
    if (abs1Y + 1 === abs2Y) return { fromSide: 'bottom', toSide: 'top' };
    if (abs2Y + 1 === abs1Y) return { fromSide: 'top', toSide: 'bottom' };
  }
  return null;
}

export function generateConnectionId(): string {
  return Math.random().toString(36).substring(2, 11);
}
