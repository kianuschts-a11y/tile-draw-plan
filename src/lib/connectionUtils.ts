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
      // Determine triangle orientation based on aspect ratio and shape dimensions
      // Check if the shape has a rotation or specific pattern
      // Default: apex at top center (pointing up)
      // We'll detect orientation based on width vs height ratio
      const isWide = width > height * 1.5;
      const isTall = height > width * 1.5;
      
      if (isWide) {
        // Horizontal triangle - apex pointing right
        return [
          { x1: x, y1: y, x2: x + width, y2: y + height / 2 },           // Top edge to apex
          { x1: x + width, y1: y + height / 2, x2: x, y2: y + height },  // Apex to bottom
          { x1: x, y1: y + height, x2: x, y2: y }                         // Left edge (base)
        ];
      } else if (isTall) {
        // Vertical triangle - apex at top
        return [
          { x1: x + width / 2, y1: y, x2: x, y2: y + height },           // Left edge
          { x1: x + width / 2, y1: y, x2: x + width, y2: y + height },   // Right edge
          { x1: x, y1: y + height, x2: x + width, y2: y + height }       // Bottom edge
        ];
      } else {
        // Square-ish triangle - default to apex at top
        return [
          { x1: x + width / 2, y1: y, x2: x, y2: y + height },           // Left edge
          { x1: x + width / 2, y1: y, x2: x + width, y2: y + height },   // Right edge
          { x1: x, y1: y + height, x2: x + width, y2: y + height }       // Bottom edge
        ];
      }
      
    case 'diamond':
      return [
        { x1: x + width / 2, y1: y, x2: x + width, y2: y + height / 2 },     // Top-right
        { x1: x + width, y1: y + height / 2, x2: x + width / 2, y2: y + height }, // Bottom-right
        { x1: x + width / 2, y1: y + height, x2: x, y2: y + height / 2 },    // Bottom-left
        { x1: x, y1: y + height / 2, x2: x + width / 2, y2: y }              // Top-left
      ];
      
    case 'line':
      // A line is itself an edge
      return [{ x1: x, y1: y, x2: x + width, y2: y + height }];
      
    case 'polyline':
      // Use the actual polyline points if available
      if (shape.points && shape.points.length >= 2) {
        const edges: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
        for (let i = 0; i < shape.points.length - 1; i++) {
          edges.push({
            x1: shape.points[i].x,
            y1: shape.points[i].y,
            x2: shape.points[i + 1].x,
            y2: shape.points[i + 1].y
          });
        }
        return edges;
      }
      return [{ x1: x, y1: y, x2: x + width, y2: y + height }];
      
    case 'polygon':
      // Use the actual polygon points to create edges
      if (shape.points && shape.points.length >= 3) {
        const edges: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
        for (let i = 0; i < shape.points.length; i++) {
          const next = (i + 1) % shape.points.length;
          edges.push({
            x1: shape.points[i].x,
            y1: shape.points[i].y,
            x2: shape.points[next].x,
            y2: shape.points[next].y
          });
        }
        return edges;
      }
      // Fallback to bounding box if no points
      return [
        { x1: x, y1: y, x2: x + width, y2: y },
        { x1: x + width, y1: y, x2: x + width, y2: y + height },
        { x1: x + width, y1: y + height, x2: x, y2: y + height },
        { x1: x, y1: y + height, x2: x, y2: y }
      ];
      
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
 * Get the minimum Y coordinate of a shape (top edge)
 */
function getShapeMinY(shape: Shape): number {
  if (shape.type === 'polygon' && shape.points && shape.points.length > 0) {
    return Math.min(...shape.points.map(p => p.y));
  }
  if (shape.type === 'polyline' && shape.points && shape.points.length > 0) {
    return Math.min(...shape.points.map(p => p.y));
  }
  return shape.y;
}

/**
 * Get the maximum Y coordinate of a shape (bottom edge)
 */
function getShapeMaxY(shape: Shape): number {
  if (shape.type === 'polygon' && shape.points && shape.points.length > 0) {
    return Math.max(...shape.points.map(p => p.y));
  }
  if (shape.type === 'polyline' && shape.points && shape.points.length > 0) {
    return Math.max(...shape.points.map(p => p.y));
  }
  return shape.y + shape.height;
}

/**
 * Get the minimum X coordinate of a shape (left edge)
 */
function getShapeMinX(shape: Shape): number {
  if (shape.type === 'polygon' && shape.points && shape.points.length > 0) {
    return Math.min(...shape.points.map(p => p.x));
  }
  if (shape.type === 'polyline' && shape.points && shape.points.length > 0) {
    return Math.min(...shape.points.map(p => p.x));
  }
  return shape.x;
}

/**
 * Get the maximum X coordinate of a shape (right edge)
 */
function getShapeMaxX(shape: Shape): number {
  if (shape.type === 'polygon' && shape.points && shape.points.length > 0) {
    return Math.max(...shape.points.map(p => p.x));
  }
  if (shape.type === 'polyline' && shape.points && shape.points.length > 0) {
    return Math.max(...shape.points.map(p => p.x));
  }
  return shape.x + shape.width;
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
  
  // Determine if the line is vertical or horizontal
  const isVerticalLine = Math.abs(lineX2 - lineX1) < 1e-6;
  const isHorizontalLine = Math.abs(lineY2 - lineY1) < 1e-6;
  
  for (const edge of edges) {
    const isVerticalEdge = Math.abs(edge.x2 - edge.x1) < 1e-6;
    const isHorizontalEdge = Math.abs(edge.y2 - edge.y1) < 1e-6;
    
    // Handle collinear case: vertical line intersecting vertical edge
    if (isVerticalLine && isVerticalEdge && Math.abs(lineX1 - edge.x1) < 1e-6) {
      // Lines are collinear - find overlap
      const minLineY = Math.min(lineY1, lineY2);
      const maxLineY = Math.max(lineY1, lineY2);
      const minEdgeY = Math.min(edge.y1, edge.y2);
      const maxEdgeY = Math.max(edge.y1, edge.y2);
      
      // If they overlap, return the edge endpoints that are within the line range
      if (minLineY < maxEdgeY && maxLineY > minEdgeY) {
        // Use the edge's min/max Y as intersection points
        if (minEdgeY >= minLineY && minEdgeY <= maxLineY) {
          intersections.push({ x: edge.x1, y: minEdgeY });
        }
        if (maxEdgeY >= minLineY && maxEdgeY <= maxLineY && maxEdgeY !== minEdgeY) {
          intersections.push({ x: edge.x1, y: maxEdgeY });
        }
      }
      continue;
    }
    
    // Handle collinear case: horizontal line intersecting horizontal edge
    if (isHorizontalLine && isHorizontalEdge && Math.abs(lineY1 - edge.y1) < 1e-6) {
      const minLineX = Math.min(lineX1, lineX2);
      const maxLineX = Math.max(lineX1, lineX2);
      const minEdgeX = Math.min(edge.x1, edge.x2);
      const maxEdgeX = Math.max(edge.x1, edge.x2);
      
      if (minLineX < maxEdgeX && maxLineX > minEdgeX) {
        if (minEdgeX >= minLineX && minEdgeX <= maxLineX) {
          intersections.push({ x: minEdgeX, y: edge.y1 });
        }
        if (maxEdgeX >= minLineX && maxEdgeX <= maxLineX && maxEdgeX !== minEdgeX) {
          intersections.push({ x: maxEdgeX, y: edge.y1 });
        }
      }
      continue;
    }
    
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
 * SIMPLE RULE: Draw line from cell edge towards center, STOP at first shape intersection.
 * 
 * This is the ONLY rule that matters:
 * 1. Start at the cell edge (where the connection comes from)
 * 2. Draw towards the center of the cell
 * 3. STOP when hitting ANY geometric shape
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

  // Cell boundaries in normalized coordinates (0-1)
  const cellLeft = cellX * cellWidthNorm;
  const cellRight = (cellX + 1) * cellWidthNorm;
  const cellTop = cellY * cellHeightNorm;
  const cellBottom = (cellY + 1) * cellHeightNorm;
  const cellCenterX = (cellLeft + cellRight) / 2;
  const cellCenterY = (cellTop + cellBottom) / 2;

  // ALL shapes except text can block the connection line
  const blockingShapes = componentShapes.filter(s => s.type !== 'text');

  if (side === 'left' || side === 'right') {
    // Horizontal connection: scan line at cell's vertical center
    const y = cellCenterY;
    
    // Starting point (cell edge) and end point (opposite edge or center)
    const startX = side === 'left' ? cellLeft : cellRight;
    const endX = side === 'left' ? cellRight : cellLeft;
    
    // Find ALL intersections with the horizontal scan line
    let intersectionXValues: number[] = [];
    
    for (const shape of blockingShapes) {
      // Get all edges of this shape
      const edges = getShapeEdges(shape);
      
      for (const edge of edges) {
        // Check if horizontal line at y intersects this edge
        const intersection = lineSegmentIntersection(
          startX, y, endX, y,  // Our horizontal scan line
          edge.x1, edge.y1, edge.x2, edge.y2  // Shape edge
        );
        
        if (intersection) {
          intersectionXValues.push(intersection.x);
        }
      }
      
      // Also check ellipse/circle shapes specially
      if (shape.type === 'circle' || shape.type === 'ellipse') {
        const cx = shape.x + shape.width / 2;
        const cy = shape.y + shape.height / 2;
        const rx = shape.width / 2;
        const ry = shape.height / 2;
        
        // Check if y is within the ellipse's vertical range
        if (y >= shape.y && y <= shape.y + shape.height) {
          // Calculate x intersections using ellipse equation
          const dy = y - cy;
          const discriminant = 1 - (dy * dy) / (ry * ry);
          if (discriminant >= 0) {
            const sqrtD = Math.sqrt(discriminant);
            intersectionXValues.push(cx - rx * sqrtD);
            intersectionXValues.push(cx + rx * sqrtD);
          }
        }
      }
    }
    
    // Find the FIRST intersection from our starting edge
    let stopX: number | null = null;
    
    if (side === 'left') {
      // Coming from left, find smallest X that's > startX
      for (const x of intersectionXValues) {
        if (x > startX + 0.001 && x <= cellRight + 0.001) {
          if (stopX === null || x < stopX) {
            stopX = x;
          }
        }
      }
    } else {
      // Coming from right, find largest X that's < startX
      for (const x of intersectionXValues) {
        if (x < startX - 0.001 && x >= cellLeft - 0.001) {
          if (stopX === null || x > stopX) {
            stopX = x;
          }
        }
      }
    }
    
    // UNIVERSAL RULE: Line goes from cell edge towards center, stops at first shape
    // For 'left': line goes from cellLeft to stopX (or cellRight if no intersection)
    // For 'right': line goes from cellRight to stopX (or cellLeft if no intersection)
    let lineMinX: number;
    let lineMaxX: number;
    
    if (side === 'left') {
      lineMinX = cellLeft;
      lineMaxX = stopX !== null ? stopX : cellRight;
    } else {
      // side === 'right'
      lineMinX = stopX !== null ? stopX : cellLeft;
      lineMaxX = cellRight;
    }
    
    if (lineMaxX - lineMinX > 0.001) {
      // Handle text breaks
      const textBreaks = findTextIntersectionsHorizontal(componentShapes, y);
      const relevantTextBreaks = textBreaks.filter(tb => 
        tb.maxX > lineMinX && tb.minX < lineMaxX
      );
      
      if (relevantTextBreaks.length === 0) {
        shapes.push({
          id: `conn-${side}-${cellX}-${cellY}`,
          type: 'line',
          x: lineMinX,
          y: y,
          width: lineMaxX - lineMinX,
          height: 0,
          strokeWidth
        });
      } else {
        // Draw segments around text
        let currentX = lineMinX;
        for (const textBreak of relevantTextBreaks) {
          if (textBreak.minX > currentX && textBreak.minX < lineMaxX) {
            shapes.push({
              id: `conn-${side}-${cellX}-${cellY}-seg-${currentX}`,
              type: 'line',
              x: currentX,
              y: y,
              width: textBreak.minX - currentX,
              height: 0,
              strokeWidth
            });
          }
          currentX = Math.max(currentX, textBreak.maxX);
        }
        if (currentX < lineMaxX) {
          shapes.push({
            id: `conn-${side}-${cellX}-${cellY}-seg-end`,
            type: 'line',
            x: currentX,
            y: y,
            width: lineMaxX - currentX,
            height: 0,
            strokeWidth
          });
        }
      }
    }
  } else {
    // Vertical connection (top or bottom): scan line at cell's horizontal center
    const x = cellCenterX;
    
    // Starting point (cell edge) and end point (opposite edge)
    const startY = side === 'top' ? cellTop : cellBottom;
    const endY = side === 'top' ? cellBottom : cellTop;
    
    // Find ALL intersections with the vertical scan line
    let intersectionYValues: number[] = [];
    
    for (const shape of blockingShapes) {
      // Get all edges of this shape
      const edges = getShapeEdges(shape);
      
      for (const edge of edges) {
        // Check if vertical line at x intersects this edge
        const intersection = lineSegmentIntersection(
          x, startY, x, endY,  // Our vertical scan line
          edge.x1, edge.y1, edge.x2, edge.y2  // Shape edge
        );
        
        if (intersection) {
          intersectionYValues.push(intersection.y);
        }
      }
      
      // Also check ellipse/circle shapes specially
      if (shape.type === 'circle' || shape.type === 'ellipse') {
        const cx = shape.x + shape.width / 2;
        const cy = shape.y + shape.height / 2;
        const rx = shape.width / 2;
        const ry = shape.height / 2;
        
        // Check if x is within the ellipse's horizontal range
        if (x >= shape.x && x <= shape.x + shape.width) {
          // Calculate y intersections using ellipse equation
          const dx = x - cx;
          const discriminant = 1 - (dx * dx) / (rx * rx);
          if (discriminant >= 0) {
            const sqrtD = Math.sqrt(discriminant);
            intersectionYValues.push(cy - ry * sqrtD);
            intersectionYValues.push(cy + ry * sqrtD);
          }
        }
      }
    }
    
    // Find the FIRST intersection from our starting edge
    let stopY: number | null = null;
    
    if (side === 'top') {
      // Coming from top, find smallest Y that's > startY
      for (const y of intersectionYValues) {
        if (y > startY + 0.001 && y <= cellBottom + 0.001) {
          if (stopY === null || y < stopY) {
            stopY = y;
          }
        }
      }
    } else {
      // Coming from bottom, find largest Y that's < startY
      for (const y of intersectionYValues) {
        if (y < startY - 0.001 && y >= cellTop - 0.001) {
          if (stopY === null || y > stopY) {
            stopY = y;
          }
        }
      }
    }
    
    // UNIVERSAL RULE: Line goes from cell edge towards center, stops at first shape
    // For 'top': line goes from cellTop to stopY (or cellBottom if no intersection)
    // For 'bottom': line goes from cellBottom to stopY (or cellTop if no intersection)
    let lineStart: number;
    let lineEnd: number;
    
    if (side === 'top') {
      lineStart = cellTop;
      lineEnd = stopY !== null ? stopY : cellBottom;
    } else {
      // side === 'bottom'
      lineStart = cellBottom;
      lineEnd = stopY !== null ? stopY : cellTop;
    }
    
    const lineMinY = Math.min(lineStart, lineEnd);
    const lineMaxY = Math.max(lineStart, lineEnd);
    
    if (lineMaxY - lineMinY > 0.001) {
      // Handle text breaks
      const textBreaks = findTextIntersectionsVertical(componentShapes, x);
      const relevantTextBreaks = textBreaks.filter(tb => 
        tb.maxY > lineMinY && tb.minY < lineMaxY
      );
      
      if (relevantTextBreaks.length === 0) {
        shapes.push({
          id: `conn-${side}-${cellX}-${cellY}`,
          type: 'line',
          x: x,
          y: lineMinY,
          width: 0,
          height: lineMaxY - lineMinY,
          strokeWidth
        });
      } else {
        // Draw segments around text
        let currentY = lineMinY;
        for (const textBreak of relevantTextBreaks) {
          if (textBreak.minY > currentY && textBreak.minY < lineMaxY) {
            shapes.push({
              id: `conn-${side}-${cellX}-${cellY}-seg-${currentY}`,
              type: 'line',
              x: x,
              y: currentY,
              width: 0,
              height: textBreak.minY - currentY,
              strokeWidth
            });
          }
          currentY = Math.max(currentY, textBreak.maxY);
        }
        if (currentY < lineMaxY) {
          shapes.push({
            id: `conn-${side}-${cellX}-${cellY}-seg-end`,
            type: 'line',
            x: x,
            y: currentY,
            width: 0,
            height: lineMaxY - currentY,
            strokeWidth
          });
        }
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
