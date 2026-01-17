import { Shape, ComponentVariation, ConnectionDirection } from "@/types/schematic";

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

// Calculate the visual bounding box of component shapes
export function getComponentBounds(shapes: Shape[]): { minX: number; maxX: number; minY: number; maxY: number } {
  if (shapes.length === 0) {
    return { minX: 0.1, maxX: 0.9, minY: 0.1, maxY: 0.9 };
  }
  
  let minX = 1, maxX = 0, minY = 1, maxY = 0;
  
  for (const shape of shapes) {
    const shapeMinX = shape.x;
    const shapeMaxX = shape.x + shape.width;
    const shapeMinY = shape.y;
    const shapeMaxY = shape.y + shape.height;
    
    minX = Math.min(minX, shapeMinX);
    maxX = Math.max(maxX, shapeMaxX);
    minY = Math.min(minY, shapeMinY);
    maxY = Math.max(maxY, shapeMaxY);
  }
  
  return { minX, maxX, minY, maxY };
}

// Find text shapes that intersect with a horizontal line at given y
// Uses the actual bounding box stored in the shape (width/height)
function findTextIntersectionsHorizontal(shapes: Shape[], y: number): { minX: number; maxX: number }[] {
  const textShapes = shapes.filter(s => s.type === 'text');
  const intersections: { minX: number; maxX: number }[] = [];
  
  for (const text of textShapes) {
    // Use actual stored dimensions (x, y is top-left corner, width/height define the box)
    const textMinX = text.x;
    const textMaxX = text.x + text.width;
    const textMinY = text.y;
    const textMaxY = text.y + text.height;
    
    // Check if horizontal line at y intersects the text bounding box
    if (y >= textMinY && y <= textMaxY) {
      intersections.push({ minX: textMinX, maxX: textMaxX });
    }
  }
  
  return intersections.sort((a, b) => a.minX - b.minX);
}

// Find text shapes that intersect with a vertical line at given x
// Uses the actual bounding box stored in the shape (width/height)
function findTextIntersectionsVertical(shapes: Shape[], x: number): { minY: number; maxY: number }[] {
  const textShapes = shapes.filter(s => s.type === 'text');
  const intersections: { minY: number; maxY: number }[] = [];
  
  for (const text of textShapes) {
    // Use actual stored dimensions
    const textMinX = text.x;
    const textMaxX = text.x + text.width;
    const textMinY = text.y;
    const textMaxY = text.y + text.height;
    
    // Check if vertical line at x intersects the text bounding box
    if (x >= textMinX && x <= textMaxX) {
      intersections.push({ minY: textMinY, maxY: textMaxY });
    }
  }
  
  return intersections.sort((a, b) => a.minY - b.minY);
}

// Calculate intersection point for horizontal line at given Y with shape edge
// Excludes text, lines, arrows, and polylines from intersection calculation
export function getHorizontalIntersection(shapes: Shape[], y: number, side: 'left' | 'right'): number {
  let intersectionX = side === 'left' ? 1 : 0;
  
  // Filter out shapes that shouldn't affect connection boundaries
  const boundaryShapes = shapes.filter(s => 
    s.type !== 'text' && s.type !== 'line' && s.type !== 'arrow' && s.type !== 'polyline'
  );
  
  for (const shape of boundaryShapes) {
    const shapeMinY = shape.y;
    const shapeMaxY = shape.y + shape.height;
    
    if (y < shapeMinY || y > shapeMaxY) continue;
    
    const relativeY = (y - shape.y) / shape.height;
    
    if (shape.type === 'triangle') {
      const halfWidthAtY = (shape.width / 2) * relativeY;
      const leftEdge = shape.x + shape.width / 2 - halfWidthAtY;
      const rightEdge = shape.x + shape.width / 2 + halfWidthAtY;
      
      if (side === 'left') {
        intersectionX = Math.min(intersectionX, leftEdge);
      } else {
        intersectionX = Math.max(intersectionX, rightEdge);
      }
    } else if (shape.type === 'diamond') {
      const halfWidthAtY = shape.width / 2 * (1 - Math.abs(relativeY * 2 - 1));
      const leftEdge = shape.x + shape.width / 2 - halfWidthAtY;
      const rightEdge = shape.x + shape.width / 2 + halfWidthAtY;
      
      if (side === 'left') {
        intersectionX = Math.min(intersectionX, leftEdge);
      } else {
        intersectionX = Math.max(intersectionX, rightEdge);
      }
    } else if (shape.type === 'circle' || shape.type === 'ellipse') {
      // For circles/ellipses, calculate actual edge at given y
      const cx = shape.x + shape.width / 2;
      const cy = shape.y + shape.height / 2;
      const rx = shape.width / 2;
      const ry = shape.height / 2;
      
      // Check if y intersects the ellipse
      const dy = y - cy;
      if (Math.abs(dy) <= ry) {
        // x = cx ± rx * sqrt(1 - (dy/ry)²)
        const factor = Math.sqrt(1 - (dy * dy) / (ry * ry));
        const leftEdge = cx - rx * factor;
        const rightEdge = cx + rx * factor;
        
        if (side === 'left') {
          intersectionX = Math.min(intersectionX, leftEdge);
        } else {
          intersectionX = Math.max(intersectionX, rightEdge);
        }
      }
    } else {
      // Rectangle and other shapes - use bounding box
      if (side === 'left') {
        intersectionX = Math.min(intersectionX, shape.x);
      } else {
        intersectionX = Math.max(intersectionX, shape.x + shape.width);
      }
    }
  }
  
  if ((side === 'left' && intersectionX === 1) || (side === 'right' && intersectionX === 0)) {
    const filteredShapes = shapes.filter(s => 
      s.type !== 'text' && s.type !== 'line' && s.type !== 'arrow' && s.type !== 'polyline'
    );
    const bounds = getComponentBounds(filteredShapes.length > 0 ? filteredShapes : shapes);
    return side === 'left' ? bounds.minX : bounds.maxX;
  }
  
  return intersectionX;
}

// Calculate intersection point for vertical line at given X with shape edge
// Excludes text, lines, arrows, and polylines from intersection calculation
export function getVerticalIntersection(shapes: Shape[], x: number, side: 'top' | 'bottom'): number {
  let intersectionY = side === 'top' ? 1 : 0;
  
  // Filter out shapes that shouldn't affect connection boundaries
  const boundaryShapes = shapes.filter(s => 
    s.type !== 'text' && s.type !== 'line' && s.type !== 'arrow' && s.type !== 'polyline'
  );
  
  for (const shape of boundaryShapes) {
    const shapeMinX = shape.x;
    const shapeMaxX = shape.x + shape.width;
    
    if (x < shapeMinX || x > shapeMaxX) continue;
    
    const relativeX = (x - shape.x) / shape.width;
    
    if (shape.type === 'triangle') {
      const distFromCenter = Math.abs(relativeX - 0.5) * 2;
      const topEdge = shape.y + shape.height * distFromCenter;
      const bottomEdge = shape.y + shape.height;
      
      if (side === 'top') {
        intersectionY = Math.min(intersectionY, topEdge);
      } else {
        intersectionY = Math.max(intersectionY, bottomEdge);
      }
    } else if (shape.type === 'diamond') {
      const distFromCenter = Math.abs(relativeX - 0.5) * 2;
      const halfHeightAtX = shape.height / 2 * (1 - distFromCenter);
      const topEdge = shape.y + shape.height / 2 - halfHeightAtX;
      const bottomEdge = shape.y + shape.height / 2 + halfHeightAtX;
      
      if (side === 'top') {
        intersectionY = Math.min(intersectionY, topEdge);
      } else {
        intersectionY = Math.max(intersectionY, bottomEdge);
      }
    } else if (shape.type === 'circle' || shape.type === 'ellipse') {
      // For circles/ellipses, calculate actual edge at given x
      const cx = shape.x + shape.width / 2;
      const cy = shape.y + shape.height / 2;
      const rx = shape.width / 2;
      const ry = shape.height / 2;
      
      // Check if x intersects the ellipse
      const dx = x - cx;
      if (Math.abs(dx) <= rx) {
        // y = cy ± ry * sqrt(1 - (dx/rx)²)
        const factor = Math.sqrt(1 - (dx * dx) / (rx * rx));
        const topEdge = cy - ry * factor;
        const bottomEdge = cy + ry * factor;
        
        if (side === 'top') {
          intersectionY = Math.min(intersectionY, topEdge);
        } else {
          intersectionY = Math.max(intersectionY, bottomEdge);
        }
      }
    } else {
      // Rectangle and other shapes
      if (side === 'top') {
        intersectionY = Math.min(intersectionY, shape.y);
      } else {
        intersectionY = Math.max(intersectionY, shape.y + shape.height);
      }
    }
  }
  
  if ((side === 'top' && intersectionY === 1) || (side === 'bottom' && intersectionY === 0)) {
    const filteredShapes = shapes.filter(s => 
      s.type !== 'text' && s.type !== 'line' && s.type !== 'arrow' && s.type !== 'polyline'
    );
    const bounds = getComponentBounds(filteredShapes.length > 0 ? filteredShapes : shapes);
    return side === 'top' ? bounds.minY : bounds.maxY;
  }
  
  return intersectionY;
}

interface ConnectionTypeInfo {
  id: string;
  side: 'left' | 'right' | 'top' | 'bottom';
  indices: number[];
}

// Parse connection type from its ID string
function parseConnectionType(connectionType: ConnectionDirection, tileWidth: number, tileHeight: number): ConnectionTypeInfo | null {
  const typeStr = connectionType as string;
  
  // Handle corner types
  if (typeStr.startsWith('corner-')) {
    const corner = typeStr.replace('corner-', '');
    switch (corner) {
      case 'tl': return { id: typeStr, side: 'left', indices: [0] };
      case 'tr': return { id: typeStr, side: 'right', indices: [0] };
      case 'bl': return { id: typeStr, side: 'left', indices: [tileHeight - 1] };
      case 'br': return { id: typeStr, side: 'right', indices: [tileHeight - 1] };
    }
    return null;
  }
  
  // Handle horizontal/vertical through connections
  if (typeStr.startsWith('horizontal-')) {
    const indicesStr = typeStr.replace('horizontal-', '');
    const indices = indicesStr.split('-').map(Number);
    return { id: typeStr, side: 'left', indices };
  }
  
  if (typeStr.startsWith('vertical-')) {
    const indicesStr = typeStr.replace('vertical-', '');
    const indices = indicesStr.split('-').map(Number);
    return { id: typeStr, side: 'top', indices };
  }
  
  // Handle single side connections
  const parts = typeStr.split('-');
  if (parts.length >= 2) {
    const side = parts[0] as 'left' | 'right' | 'top' | 'bottom';
    const indices = parts.slice(1).map(Number);
    return { id: typeStr, side, indices };
  }
  
  return null;
}

// Create horizontal line segments, breaking at text positions
function createHorizontalLineWithTextBreaks(
  componentShapes: Shape[],
  y: number,
  startX: number,
  endX: number,
  stroke: string
): Shape[] {
  const shapes: Shape[] = [];
  const textIntersections = findTextIntersectionsHorizontal(componentShapes, y);
  
  if (textIntersections.length === 0) {
    // No text intersection, create single line
    shapes.push({
      id: generateId(),
      type: 'line',
      x: startX,
      y: y,
      width: endX - startX,
      height: 0,
      strokeWidth: 2,
      stroke
    });
    return shapes;
  }
  
  // Create line segments that break at text
  let currentX = startX;
  
  for (const textBounds of textIntersections) {
    // Only consider text that's in our line range
    if (textBounds.maxX < startX || textBounds.minX > endX) continue;
    
    const gapStart = Math.max(startX, textBounds.minX);
    const gapEnd = Math.min(endX, textBounds.maxX);
    
    // Line segment before text
    if (currentX < gapStart) {
      shapes.push({
        id: generateId(),
        type: 'line',
        x: currentX,
        y: y,
        width: gapStart - currentX,
        height: 0,
        strokeWidth: 2,
        stroke
      });
    }
    
    currentX = gapEnd;
  }
  
  // Final segment after last text
  if (currentX < endX) {
    shapes.push({
      id: generateId(),
      type: 'line',
      x: currentX,
      y: y,
      width: endX - currentX,
      height: 0,
      strokeWidth: 2,
      stroke
    });
  }
  
  return shapes;
}

// Create vertical line segments, breaking at text positions
function createVerticalLineWithTextBreaks(
  componentShapes: Shape[],
  x: number,
  startY: number,
  endY: number,
  stroke: string
): Shape[] {
  const shapes: Shape[] = [];
  const textIntersections = findTextIntersectionsVertical(componentShapes, x);
  
  if (textIntersections.length === 0) {
    // No text intersection, create single line
    shapes.push({
      id: generateId(),
      type: 'line',
      x: x,
      y: startY,
      width: 0,
      height: endY - startY,
      strokeWidth: 2,
      stroke
    });
    return shapes;
  }
  
  // Create line segments that break at text
  let currentY = startY;
  
  for (const textBounds of textIntersections) {
    // Only consider text that's in our line range
    if (textBounds.maxY < startY || textBounds.minY > endY) continue;
    
    const gapStart = Math.max(startY, textBounds.minY);
    const gapEnd = Math.min(endY, textBounds.maxY);
    
    // Line segment before text
    if (currentY < gapStart) {
      shapes.push({
        id: generateId(),
        type: 'line',
        x: x,
        y: currentY,
        width: 0,
        height: gapStart - currentY,
        strokeWidth: 2,
        stroke
      });
    }
    
    currentY = gapEnd;
  }
  
  // Final segment after last text
  if (currentY < endY) {
    shapes.push({
      id: generateId(),
      type: 'line',
      x: x,
      y: currentY,
      width: 0,
      height: endY - currentY,
      strokeWidth: 2,
      stroke
    });
  }
  
  return shapes;
}

// Regenerate connection shapes for a variation based on new component shapes
export function regenerateVariationShapes(
  variation: ComponentVariation,
  componentShapes: Shape[],
  tileWidth: number,
  tileHeight: number
): Shape[] {
  const stroke = "#000000";
  const cellHeight = 1 / tileHeight;
  const cellWidth = 1 / tileWidth;
  
  const typeInfo = parseConnectionType(variation.connectionType, tileWidth, tileHeight);
  if (!typeInfo) {
    return variation.shapes; // Return original if can't parse
  }
  
  const shapes: Shape[] = [];
  const typeStr = variation.connectionType as string;
  const isHorizontal = typeStr.startsWith('horizontal-');
  const isVertical = typeStr.startsWith('vertical-');
  const isCorner = typeStr.startsWith('corner-');
  
  if (isCorner) {
    const corner = typeStr.replace('corner-', '');
    
    // Determine the row/col indices for consistent calculation
    let rowIndex: number;
    let colIndex: number;
    
    switch (corner) {
      case 'tl':
        rowIndex = 0;
        colIndex = 0;
        break;
      case 'tr':
        rowIndex = 0;
        colIndex = tileWidth - 1;
        break;
      case 'bl':
        rowIndex = tileHeight - 1;
        colIndex = 0;
        break;
      case 'br':
        rowIndex = tileHeight - 1;
        colIndex = tileWidth - 1;
        break;
      default:
        return shapes;
    }
    
    const yCenter = cellHeight * rowIndex + cellHeight / 2;
    const xCenter = cellWidth * colIndex + cellWidth / 2;
    
    // Use same intersection calculation as horizontal/vertical for consistency
    const leftIntersect = getHorizontalIntersection(componentShapes, yCenter, 'left');
    const rightIntersect = getHorizontalIntersection(componentShapes, yCenter, 'right');
    const topIntersect = getVerticalIntersection(componentShapes, xCenter, 'top');
    const bottomIntersect = getVerticalIntersection(componentShapes, xCenter, 'bottom');
    
    switch (corner) {
      case 'tl':
        shapes.push(...createHorizontalLineWithTextBreaks(componentShapes, yCenter, 0, leftIntersect, stroke));
        shapes.push(...createVerticalLineWithTextBreaks(componentShapes, xCenter, 0, topIntersect, stroke));
        break;
      case 'tr':
        shapes.push(...createHorizontalLineWithTextBreaks(componentShapes, yCenter, rightIntersect, 1, stroke));
        shapes.push(...createVerticalLineWithTextBreaks(componentShapes, xCenter, 0, topIntersect, stroke));
        break;
      case 'bl':
        shapes.push(...createHorizontalLineWithTextBreaks(componentShapes, yCenter, 0, leftIntersect, stroke));
        shapes.push(...createVerticalLineWithTextBreaks(componentShapes, xCenter, bottomIntersect, 1, stroke));
        break;
      case 'br':
        shapes.push(...createHorizontalLineWithTextBreaks(componentShapes, yCenter, rightIntersect, 1, stroke));
        shapes.push(...createVerticalLineWithTextBreaks(componentShapes, xCenter, bottomIntersect, 1, stroke));
        break;
    }
    return shapes;
  }
  
  if (isHorizontal) {
    typeInfo.indices.forEach(rowIndex => {
      const yCenter = cellHeight * rowIndex + cellHeight / 2;
      const leftIntersect = getHorizontalIntersection(componentShapes, yCenter, 'left');
      const rightIntersect = getHorizontalIntersection(componentShapes, yCenter, 'right');
      
      // Left line with text breaks
      shapes.push(...createHorizontalLineWithTextBreaks(componentShapes, yCenter, 0, leftIntersect, stroke));
      // Right line with text breaks
      shapes.push(...createHorizontalLineWithTextBreaks(componentShapes, yCenter, rightIntersect, 1, stroke));
    });
    return shapes;
  }
  
  if (isVertical) {
    typeInfo.indices.forEach(colIndex => {
      const xCenter = cellWidth * colIndex + cellWidth / 2;
      const topIntersect = getVerticalIntersection(componentShapes, xCenter, 'top');
      const bottomIntersect = getVerticalIntersection(componentShapes, xCenter, 'bottom');
      
      // Top line with text breaks
      shapes.push(...createVerticalLineWithTextBreaks(componentShapes, xCenter, 0, topIntersect, stroke));
      // Bottom line with text breaks
      shapes.push(...createVerticalLineWithTextBreaks(componentShapes, xCenter, bottomIntersect, 1, stroke));
    });
    return shapes;
  }
  
  // Single side connections
  if (typeInfo.side === 'left') {
    typeInfo.indices.forEach(rowIndex => {
      const yCenter = cellHeight * rowIndex + cellHeight / 2;
      const leftIntersect = getHorizontalIntersection(componentShapes, yCenter, 'left');
      shapes.push(...createHorizontalLineWithTextBreaks(componentShapes, yCenter, 0, leftIntersect, stroke));
    });
  } else if (typeInfo.side === 'right') {
    typeInfo.indices.forEach(rowIndex => {
      const yCenter = cellHeight * rowIndex + cellHeight / 2;
      const rightIntersect = getHorizontalIntersection(componentShapes, yCenter, 'right');
      shapes.push(...createHorizontalLineWithTextBreaks(componentShapes, yCenter, rightIntersect, 1, stroke));
    });
  } else if (typeInfo.side === 'top') {
    typeInfo.indices.forEach(colIndex => {
      const xCenter = cellWidth * colIndex + cellWidth / 2;
      const topIntersect = getVerticalIntersection(componentShapes, xCenter, 'top');
      shapes.push(...createVerticalLineWithTextBreaks(componentShapes, xCenter, 0, topIntersect, stroke));
    });
  } else if (typeInfo.side === 'bottom') {
    typeInfo.indices.forEach(colIndex => {
      const xCenter = cellWidth * colIndex + cellWidth / 2;
      const bottomIntersect = getVerticalIntersection(componentShapes, xCenter, 'bottom');
      shapes.push(...createVerticalLineWithTextBreaks(componentShapes, xCenter, bottomIntersect, 1, stroke));
    });
  }
  
  return shapes;
}

// Update all variations of a component based on new shapes
export function updateComponentVariations(
  variations: ComponentVariation[] | undefined,
  newShapes: Shape[],
  tileWidth: number,
  tileHeight: number
): ComponentVariation[] | undefined {
  if (!variations || variations.length === 0) {
    return variations;
  }
  
  return variations.map(variation => ({
    ...variation,
    shapes: regenerateVariationShapes(variation, newShapes, tileWidth, tileHeight)
  }));
}
