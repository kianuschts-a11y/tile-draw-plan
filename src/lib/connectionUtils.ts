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
  // cellX/cellY are 0-indexed cell positions within the tile
  const cellWidthNorm = 1 / tileWidth;
  const cellHeightNorm = 1 / tileHeight;

  if (side === 'left' || side === 'right') {
    // Y position at center of the cell
    const yNorm = (cellY + 0.5) * cellHeightNorm;
    
    // X edge position based on side and cell
    const cellEdgeX = side === 'left' 
      ? cellX * cellWidthNorm  // left edge of cell
      : (cellX + 1) * cellWidthNorm;  // right edge of cell
    
    // Find where the component shape intersects at this Y
    let componentIntersection = cellEdgeX; // default: no intersection found
    
    for (const shape of geometricShapes) {
      const shapeTop = shape.y;
      const shapeBottom = shape.y + shape.height;
      
      // Check if this Y intersects the shape
      if (yNorm >= shapeTop && yNorm <= shapeBottom) {
        if (side === 'left') {
          // For left side, find rightmost edge of shapes
          const shapeRight = shape.x + shape.width;
          if (shape.x <= cellEdgeX && shapeRight >= cellEdgeX) {
            componentIntersection = Math.max(componentIntersection, shape.x);
          } else if (shapeRight <= cellEdgeX) {
            componentIntersection = Math.max(componentIntersection, shapeRight);
          }
        } else {
          // For right side, find leftmost edge of shapes
          const shapeLeft = shape.x;
          if (shapeLeft <= cellEdgeX && shape.x + shape.width >= cellEdgeX) {
            componentIntersection = Math.min(componentIntersection, shape.x + shape.width);
          } else if (shapeLeft >= cellEdgeX) {
            componentIntersection = Math.min(componentIntersection, shapeLeft);
          }
        }
      }
    }
    
    // Create line segments with text breaks
    const startX = side === 'left' ? 0 : componentIntersection;
    const endX = side === 'left' ? componentIntersection : 1;
    
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
    
    const cellEdgeY = side === 'top'
      ? cellY * cellHeightNorm
      : (cellY + 1) * cellHeightNorm;
    
    let componentIntersection = cellEdgeY;
    
    for (const shape of geometricShapes) {
      const shapeLeft = shape.x;
      const shapeRight = shape.x + shape.width;
      
      if (xNorm >= shapeLeft && xNorm <= shapeRight) {
        if (side === 'top') {
          const shapeBottom = shape.y + shape.height;
          if (shape.y <= cellEdgeY && shapeBottom >= cellEdgeY) {
            componentIntersection = Math.max(componentIntersection, shape.y);
          } else if (shapeBottom <= cellEdgeY) {
            componentIntersection = Math.max(componentIntersection, shapeBottom);
          }
        } else {
          const shapeTop = shape.y;
          if (shapeTop <= cellEdgeY && shape.y + shape.height >= cellEdgeY) {
            componentIntersection = Math.min(componentIntersection, shape.y + shape.height);
          } else if (shapeTop >= cellEdgeY) {
            componentIntersection = Math.min(componentIntersection, shapeTop);
          }
        }
      }
    }
    
    const startY = side === 'top' ? 0 : componentIntersection;
    const endY = side === 'top' ? componentIntersection : 1;
    
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
