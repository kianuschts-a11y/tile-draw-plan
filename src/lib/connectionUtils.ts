import { Shape } from "@/types/schematic";

/**
 * Find the intersection point between two line segments
 * Returns the intersection point or null if no intersection
 */
function lineSegmentIntersection(
  ax1: number, ay1: number, ax2: number, ay2: number,  // Line A
  bx1: number, by1: number, bx2: number, by2: number   // Line B
): { x: number; y: number } | null {
  const dAx = ax2 - ax1;
  const dAy = ay2 - ay1;
  const dBx = bx2 - bx1;
  const dBy = by2 - by1;
  
  const cross = dAx * dBy - dAy * dBx;
  if (Math.abs(cross) < 1e-10) return null; // Parallel
  
  const dx = bx1 - ax1;
  const dy = by1 - ay1;
  
  const t = (dx * dBy - dy * dBx) / cross;
  const u = (dx * dAy - dy * dAx) / cross;
  
  // Check if intersection is within both segments
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: ax1 + t * dAx,
      y: ay1 + t * dAy
    };
  }
  return null;
}

/**
 * Get all edges of a shape as line segments
 */
function getShapeEdges(shape: Shape): Array<{ x1: number; y1: number; x2: number; y2: number }> {
  const { x, y, width, height, type } = shape;
  
  switch (type) {
    case 'rectangle':
      return [
        { x1: x, y1: y, x2: x + width, y2: y },           // Top
        { x1: x + width, y1: y, x2: x + width, y2: y + height }, // Right
        { x1: x + width, y1: y + height, x2: x, y2: y + height }, // Bottom
        { x1: x, y1: y + height, x2: x, y2: y }           // Left
      ];
      
    case 'triangle':
      // Triangle with apex at top center
      return [
        { x1: x + width / 2, y1: y, x2: x, y2: y + height },           // Left edge
        { x1: x + width / 2, y1: y, x2: x + width, y2: y + height },   // Right edge
        { x1: x, y1: y + height, x2: x + width, y2: y + height }       // Bottom edge
      ];
      
    case 'diamond':
      return [
        { x1: x + width / 2, y1: y, x2: x + width, y2: y + height / 2 },     // Top-right
        { x1: x + width, y1: y + height / 2, x2: x + width / 2, y2: y + height }, // Bottom-right
        { x1: x + width / 2, y1: y + height, x2: x, y2: y + height / 2 },    // Bottom-left
        { x1: x, y1: y + height / 2, x2: x + width / 2, y2: y }              // Top-left
      ];
      
    case 'line':
    case 'polyline':
      // A line is itself an edge
      return [{ x1: x, y1: y, x2: x + width, y2: y + height }];
      
    default:
      // For other shapes (circle, ellipse, etc.), approximate with bounding box
      return [
        { x1: x, y1: y, x2: x + width, y2: y },
        { x1: x + width, y1: y, x2: x + width, y2: y + height },
        { x1: x + width, y1: y + height, x2: x, y2: y + height },
        { x1: x, y1: y + height, x2: x, y2: y }
      ];
  }
}

/**
 * Find intersection of a ray with an ellipse
 */
function rayEllipseIntersection(
  rayX1: number, rayY1: number, rayX2: number, rayY2: number,
  cx: number, cy: number, rx: number, ry: number
): { x: number; y: number } | null {
  // Normalize ray direction
  const dx = rayX2 - rayX1;
  const dy = rayY2 - rayY1;
  
  // Transform to unit circle space
  const a = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
  const b = 2 * ((rayX1 - cx) * dx / (rx * rx) + (rayY1 - cy) * dy / (ry * ry));
  const c = ((rayX1 - cx) * (rayX1 - cx)) / (rx * rx) + ((rayY1 - cy) * (rayY1 - cy)) / (ry * ry) - 1;
  
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  
  const sqrtD = Math.sqrt(discriminant);
  const t1 = (-b - sqrtD) / (2 * a);
  const t2 = (-b + sqrtD) / (2 * a);
  
  // Find the intersection point that's in the direction of the ray (t >= 0) and within segment (t <= 1)
  let t: number | null = null;
  if (t1 >= 0 && t1 <= 1) t = t1;
  else if (t2 >= 0 && t2 <= 1) t = t2;
  
  if (t === null) return null;
  
  return {
    x: rayX1 + t * dx,
    y: rayY1 + t * dy
  };
}

/**
 * Find ALL intersection points between a connection line and a shape
 */
function findShapeIntersections(
  lineX1: number, lineY1: number, lineX2: number, lineY2: number,
  shape: Shape
): Array<{ x: number; y: number }> {
  const intersections: Array<{ x: number; y: number }> = [];
  
  // Handle circles/ellipses specially
  if (shape.type === 'circle' || shape.type === 'ellipse') {
    const cx = shape.x + shape.width / 2;
    const cy = shape.y + shape.height / 2;
    const rx = shape.width / 2;
    const ry = shape.height / 2;
    
    const intersection = rayEllipseIntersection(lineX1, lineY1, lineX2, lineY2, cx, cy, rx, ry);
    if (intersection) {
      intersections.push(intersection);
    }
    // Check the other direction too
    const intersection2 = rayEllipseIntersection(lineX2, lineY2, lineX1, lineY1, cx, cy, rx, ry);
    if (intersection2) {
      intersections.push(intersection2);
    }
    return intersections;
  }
  
  // For polygon-based shapes, check each edge
  const edges = getShapeEdges(shape);
  for (const edge of edges) {
    const intersection = lineSegmentIntersection(
      lineX1, lineY1, lineX2, lineY2,
      edge.x1, edge.y1, edge.x2, edge.y2
    );
    if (intersection) {
      intersections.push(intersection);
    }
  }
  
  return intersections;
}

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
 * Generate a single connection line from tile edge to the FIRST shape intersection
 * This ensures lines never pass through any shape
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

  const cellWidthNorm = 1 / tileWidth;
  const cellHeightNorm = 1 / tileHeight;

  // Get all non-text, non-arrow shapes that could block the connection
  const blockingShapes = componentShapes.filter(s => !['text', 'arrow'].includes(s.type));

  if (side === 'left' || side === 'right') {
    const yNorm = (cellY + 0.5) * cellHeightNorm;
    const startX = side === 'left' ? 0 : 1;
    const endX = side === 'left' ? 1 : 0;
    
    // Find the FIRST intersection from the edge towards center
    let closestIntersectionX: number | null = null;
    
    for (const shape of blockingShapes) {
      const intersections = findShapeIntersections(startX, yNorm, endX, yNorm, shape);
      
      for (const intersection of intersections) {
        if (side === 'left') {
          // Coming from left, find the smallest X that's > startX
          if (closestIntersectionX === null || intersection.x < closestIntersectionX) {
            closestIntersectionX = intersection.x;
          }
        } else {
          // Coming from right, find the largest X that's < startX (=1)
          if (closestIntersectionX === null || intersection.x > closestIntersectionX) {
            closestIntersectionX = intersection.x;
          }
        }
      }
    }
    
    // If no intersection found, line would go all the way across - that's wrong
    // We should stop at the center or find the edge properly
    if (closestIntersectionX === null) {
      return shapes; // No valid connection
    }
    
    const lineStartX = side === 'left' ? 0 : closestIntersectionX;
    const lineEndX = side === 'left' ? closestIntersectionX : 1;
    
    if (Math.abs(lineEndX - lineStartX) < 0.001) return shapes;
    
    // Handle text breaks
    const textBreaks = findTextIntersectionsHorizontal(componentShapes, yNorm);
    
    if (textBreaks.length === 0) {
      shapes.push({
        id: `conn-${side}-${cellX}-${cellY}`,
        type: 'line',
        x: lineStartX,
        y: yNorm,
        width: lineEndX - lineStartX,
        height: 0,
        strokeWidth
      });
    } else {
      let currentX = lineStartX;
      for (const textBreak of textBreaks) {
        if (textBreak.minX > currentX && textBreak.minX < lineEndX) {
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
      if (currentX < lineEndX) {
        shapes.push({
          id: `conn-${side}-${cellX}-${cellY}-seg-end`,
          type: 'line',
          x: currentX,
          y: yNorm,
          width: lineEndX - currentX,
          height: 0,
          strokeWidth
        });
      }
    }
  } else {
    // Top or bottom connection
    const xNorm = (cellX + 0.5) * cellWidthNorm;
    const startY = side === 'top' ? 0 : 1;
    const endY = side === 'top' ? 1 : 0;
    
    // Find the FIRST intersection from the edge towards center
    let closestIntersectionY: number | null = null;
    
    for (const shape of blockingShapes) {
      const intersections = findShapeIntersections(xNorm, startY, xNorm, endY, shape);
      
      for (const intersection of intersections) {
        if (side === 'top') {
          // Coming from top, find the smallest Y that's > startY (=0)
          if (closestIntersectionY === null || intersection.y < closestIntersectionY) {
            closestIntersectionY = intersection.y;
          }
        } else {
          // Coming from bottom, find the largest Y that's < startY (=1)
          if (closestIntersectionY === null || intersection.y > closestIntersectionY) {
            closestIntersectionY = intersection.y;
          }
        }
      }
    }
    
    if (closestIntersectionY === null) {
      return shapes; // No valid connection
    }
    
    const lineStartY = side === 'top' ? 0 : closestIntersectionY;
    const lineEndY = side === 'top' ? closestIntersectionY : 1;
    
    if (Math.abs(lineEndY - lineStartY) < 0.001) return shapes;
    
    // Handle text breaks
    const textBreaks = findTextIntersectionsVertical(componentShapes, xNorm);
    
    if (textBreaks.length === 0) {
      shapes.push({
        id: `conn-${side}-${cellX}-${cellY}`,
        type: 'line',
        x: xNorm,
        y: lineStartY,
        width: 0,
        height: lineEndY - lineStartY,
        strokeWidth
      });
    } else {
      let currentY = lineStartY;
      for (const textBreak of textBreaks) {
        if (textBreak.minY > currentY && textBreak.minY < lineEndY) {
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
      if (currentY < lineEndY) {
        shapes.push({
          id: `conn-${side}-${cellX}-${cellY}-seg-end`,
          type: 'line',
          x: xNorm,
          y: currentY,
          width: 0,
          height: lineEndY - currentY,
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
