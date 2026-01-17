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
 * Calculate intersection point of two line segments
 * Returns the x or y coordinate of intersection, or null if no intersection
 */
function lineIntersectsHorizontal(
  x1: number, y1: number, x2: number, y2: number, // Line segment
  hY: number, hMinX: number, hMaxX: number // Horizontal line
): number | null {
  // Check if the line segment crosses the horizontal Y
  if ((y1 <= hY && y2 >= hY) || (y1 >= hY && y2 <= hY)) {
    if (y1 === y2) return null; // Parallel
    // Calculate x at intersection
    const t = (hY - y1) / (y2 - y1);
    const intersectX = x1 + t * (x2 - x1);
    if (intersectX >= hMinX && intersectX <= hMaxX) {
      return intersectX;
    }
  }
  return null;
}

function lineIntersectsVertical(
  x1: number, y1: number, x2: number, y2: number, // Line segment
  vX: number, vMinY: number, vMaxY: number // Vertical line
): number | null {
  // Check if the line segment crosses the vertical X
  if ((x1 <= vX && x2 >= vX) || (x1 >= vX && x2 <= vX)) {
    if (x1 === x2) return null; // Parallel
    const t = (vX - x1) / (x2 - x1);
    const intersectY = y1 + t * (y2 - y1);
    if (intersectY >= vMinY && intersectY <= vMaxY) {
      return intersectY;
    }
  }
  return null;
}

/**
 * Get triangle edges as line segments
 * Triangle points up by default: apex at top center, base at bottom
 */
function getTriangleEdges(x: number, y: number, width: number, height: number): Array<{x1: number, y1: number, x2: number, y2: number}> {
  // Apex at top center
  const apex = { x: x + width / 2, y: y };
  // Bottom left and right corners
  const bottomLeft = { x: x, y: y + height };
  const bottomRight = { x: x + width, y: y + height };
  
  return [
    { x1: apex.x, y1: apex.y, x2: bottomLeft.x, y2: bottomLeft.y },     // Left edge
    { x1: apex.x, y1: apex.y, x2: bottomRight.x, y2: bottomRight.y },   // Right edge
    { x1: bottomLeft.x, y1: bottomLeft.y, x2: bottomRight.x, y2: bottomRight.y } // Bottom edge
  ];
}

/**
 * Get diamond edges as line segments
 */
function getDiamondEdges(x: number, y: number, width: number, height: number): Array<{x1: number, y1: number, x2: number, y2: number}> {
  const top = { x: x + width / 2, y: y };
  const right = { x: x + width, y: y + height / 2 };
  const bottom = { x: x + width / 2, y: y + height };
  const left = { x: x, y: y + height / 2 };
  
  return [
    { x1: top.x, y1: top.y, x2: right.x, y2: right.y },
    { x1: right.x, y1: right.y, x2: bottom.x, y2: bottom.y },
    { x1: bottom.x, y1: bottom.y, x2: left.x, y2: left.y },
    { x1: left.x, y1: left.y, x2: top.x, y2: top.y }
  ];
}

/**
 * Generate a single connection line from tile edge to component edge
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

  if (side === 'left' || side === 'right') {
    const yNorm = (cellY + 0.5) * cellHeightNorm;
    const tileEdgeX = side === 'left' ? 0 : 1;
    let componentEdgeX = tileEdgeX;
    
    for (const shape of componentShapes) {
      if (['text', 'arrow'].includes(shape.type)) continue;
      
      // For line/polyline shapes
      if (shape.type === 'line' || shape.type === 'polyline') {
        const intersectX = lineIntersectsHorizontal(
          shape.x, shape.y, shape.x + shape.width, shape.y + shape.height,
          yNorm, 0, 1
        );
        if (intersectX !== null) {
          if (side === 'left' && intersectX > componentEdgeX) {
            componentEdgeX = intersectX;
          } else if (side === 'right' && intersectX < componentEdgeX) {
            componentEdgeX = intersectX;
          }
        }
        continue;
      }
      
      // For triangles - check each edge
      if (shape.type === 'triangle') {
        const edges = getTriangleEdges(shape.x, shape.y, shape.width, shape.height);
        for (const edge of edges) {
          const intersectX = lineIntersectsHorizontal(
            edge.x1, edge.y1, edge.x2, edge.y2,
            yNorm, 0, 1
          );
          if (intersectX !== null) {
            if (side === 'left' && intersectX > componentEdgeX) {
              componentEdgeX = intersectX;
            } else if (side === 'right' && intersectX < componentEdgeX) {
              componentEdgeX = intersectX;
            }
          }
        }
        continue;
      }
      
      // For diamonds
      if (shape.type === 'diamond') {
        const edges = getDiamondEdges(shape.x, shape.y, shape.width, shape.height);
        for (const edge of edges) {
          const intersectX = lineIntersectsHorizontal(
            edge.x1, edge.y1, edge.x2, edge.y2,
            yNorm, 0, 1
          );
          if (intersectX !== null) {
            if (side === 'left' && intersectX > componentEdgeX) {
              componentEdgeX = intersectX;
            } else if (side === 'right' && intersectX < componentEdgeX) {
              componentEdgeX = intersectX;
            }
          }
        }
        continue;
      }
      
      // For circles/ellipses - calculate actual intersection
      if (shape.type === 'circle' || shape.type === 'ellipse') {
        const cx = shape.x + shape.width / 2;
        const cy = shape.y + shape.height / 2;
        const rx = shape.width / 2;
        const ry = shape.height / 2;
        
        // Check if horizontal line at yNorm intersects ellipse
        const dy = yNorm - cy;
        if (Math.abs(dy) <= ry) {
          // x = cx ± rx * sqrt(1 - (dy/ry)²)
          const factor = Math.sqrt(1 - (dy * dy) / (ry * ry));
          const xLeft = cx - rx * factor;
          const xRight = cx + rx * factor;
          
          if (side === 'left' && xLeft > componentEdgeX) {
            componentEdgeX = xLeft;
          } else if (side === 'right' && xRight < componentEdgeX) {
            componentEdgeX = xRight;
          }
        }
        continue;
      }
      
      // For rectangles and other solid shapes - use bounding box
      const shapeTop = shape.y;
      const shapeBottom = shape.y + shape.height;
      if (yNorm >= shapeTop && yNorm <= shapeBottom) {
        if (side === 'left') {
          componentEdgeX = Math.max(componentEdgeX, shape.x);
        } else {
          componentEdgeX = Math.min(componentEdgeX, shape.x + shape.width);
        }
      }
    }
    
    const startX = side === 'left' ? 0 : componentEdgeX;
    const endX = side === 'left' ? componentEdgeX : 1;
    
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
    const tileEdgeY = side === 'top' ? 0 : 1;
    let componentEdgeY = tileEdgeY;
    
    for (const shape of componentShapes) {
      if (['text', 'arrow'].includes(shape.type)) continue;
      
      // For line/polyline shapes
      if (shape.type === 'line' || shape.type === 'polyline') {
        const intersectY = lineIntersectsVertical(
          shape.x, shape.y, shape.x + shape.width, shape.y + shape.height,
          xNorm, 0, 1
        );
        if (intersectY !== null) {
          if (side === 'top' && intersectY > componentEdgeY) {
            componentEdgeY = intersectY;
          } else if (side === 'bottom' && intersectY < componentEdgeY) {
            componentEdgeY = intersectY;
          }
        }
        continue;
      }
      
      // For triangles
      if (shape.type === 'triangle') {
        const edges = getTriangleEdges(shape.x, shape.y, shape.width, shape.height);
        for (const edge of edges) {
          const intersectY = lineIntersectsVertical(
            edge.x1, edge.y1, edge.x2, edge.y2,
            xNorm, 0, 1
          );
          if (intersectY !== null) {
            if (side === 'top' && intersectY > componentEdgeY) {
              componentEdgeY = intersectY;
            } else if (side === 'bottom' && intersectY < componentEdgeY) {
              componentEdgeY = intersectY;
            }
          }
        }
        continue;
      }
      
      // For diamonds
      if (shape.type === 'diamond') {
        const edges = getDiamondEdges(shape.x, shape.y, shape.width, shape.height);
        for (const edge of edges) {
          const intersectY = lineIntersectsVertical(
            edge.x1, edge.y1, edge.x2, edge.y2,
            xNorm, 0, 1
          );
          if (intersectY !== null) {
            if (side === 'top' && intersectY > componentEdgeY) {
              componentEdgeY = intersectY;
            } else if (side === 'bottom' && intersectY < componentEdgeY) {
              componentEdgeY = intersectY;
            }
          }
        }
        continue;
      }
      
      // For circles/ellipses
      if (shape.type === 'circle' || shape.type === 'ellipse') {
        const cx = shape.x + shape.width / 2;
        const cy = shape.y + shape.height / 2;
        const rx = shape.width / 2;
        const ry = shape.height / 2;
        
        const dx = xNorm - cx;
        if (Math.abs(dx) <= rx) {
          const factor = Math.sqrt(1 - (dx * dx) / (rx * rx));
          const yTop = cy - ry * factor;
          const yBottom = cy + ry * factor;
          
          if (side === 'top' && yTop > componentEdgeY) {
            componentEdgeY = yTop;
          } else if (side === 'bottom' && yBottom < componentEdgeY) {
            componentEdgeY = yBottom;
          }
        }
        continue;
      }
      
      // For rectangles - bounding box
      const shapeLeft = shape.x;
      const shapeRight = shape.x + shape.width;
      if (xNorm >= shapeLeft && xNorm <= shapeRight) {
        if (side === 'top') {
          componentEdgeY = Math.max(componentEdgeY, shape.y);
        } else {
          componentEdgeY = Math.min(componentEdgeY, shape.y + shape.height);
        }
      }
    }
    
    const startY = side === 'top' ? 0 : componentEdgeY;
    const endY = side === 'top' ? componentEdgeY : 1;
    
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
