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

// Calculate intersection point for horizontal line at given Y with shape edge
export function getHorizontalIntersection(shapes: Shape[], y: number, side: 'left' | 'right'): number {
  let intersectionX = side === 'left' ? 1 : 0;
  
  for (const shape of shapes) {
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
    } else {
      if (side === 'left') {
        intersectionX = Math.min(intersectionX, shape.x);
      } else {
        intersectionX = Math.max(intersectionX, shape.x + shape.width);
      }
    }
  }
  
  if ((side === 'left' && intersectionX === 1) || (side === 'right' && intersectionX === 0)) {
    const bounds = getComponentBounds(shapes);
    return side === 'left' ? bounds.minX : bounds.maxX;
  }
  
  return intersectionX;
}

// Calculate intersection point for vertical line at given X with shape edge
export function getVerticalIntersection(shapes: Shape[], x: number, side: 'top' | 'bottom'): number {
  let intersectionY = side === 'top' ? 1 : 0;
  
  for (const shape of shapes) {
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
    } else {
      if (side === 'top') {
        intersectionY = Math.min(intersectionY, shape.y);
      } else {
        intersectionY = Math.max(intersectionY, shape.y + shape.height);
      }
    }
  }
  
  if ((side === 'top' && intersectionY === 1) || (side === 'bottom' && intersectionY === 0)) {
    const bounds = getComponentBounds(shapes);
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
    const yTop = cellHeight / 2;
    const yBottom = 1 - cellHeight / 2;
    const xLeft = cellWidth / 2;
    const xRight = 1 - cellWidth / 2;
    
    switch (typeStr) {
      case 'corner-tl': {
        const leftIntersect = getHorizontalIntersection(componentShapes, yTop, 'left');
        const topIntersect = getVerticalIntersection(componentShapes, xLeft, 'top');
        shapes.push(
          { id: generateId(), type: 'line', x: 0, y: yTop, width: leftIntersect, height: 0, strokeWidth: 2, stroke },
          { id: generateId(), type: 'line', x: xLeft, y: 0, width: 0, height: topIntersect, strokeWidth: 2, stroke }
        );
        break;
      }
      case 'corner-tr': {
        const rightIntersect = getHorizontalIntersection(componentShapes, yTop, 'right');
        const topIntersect = getVerticalIntersection(componentShapes, xRight, 'top');
        shapes.push(
          { id: generateId(), type: 'line', x: rightIntersect, y: yTop, width: 1 - rightIntersect, height: 0, strokeWidth: 2, stroke },
          { id: generateId(), type: 'line', x: xRight, y: 0, width: 0, height: topIntersect, strokeWidth: 2, stroke }
        );
        break;
      }
      case 'corner-bl': {
        const leftIntersect = getHorizontalIntersection(componentShapes, yBottom, 'left');
        const bottomIntersect = getVerticalIntersection(componentShapes, xLeft, 'bottom');
        shapes.push(
          { id: generateId(), type: 'line', x: 0, y: yBottom, width: leftIntersect, height: 0, strokeWidth: 2, stroke },
          { id: generateId(), type: 'line', x: xLeft, y: bottomIntersect, width: 0, height: 1 - bottomIntersect, strokeWidth: 2, stroke }
        );
        break;
      }
      case 'corner-br': {
        const rightIntersect = getHorizontalIntersection(componentShapes, yBottom, 'right');
        const bottomIntersect = getVerticalIntersection(componentShapes, xRight, 'bottom');
        shapes.push(
          { id: generateId(), type: 'line', x: rightIntersect, y: yBottom, width: 1 - rightIntersect, height: 0, strokeWidth: 2, stroke },
          { id: generateId(), type: 'line', x: xRight, y: bottomIntersect, width: 0, height: 1 - bottomIntersect, strokeWidth: 2, stroke }
        );
        break;
      }
    }
    return shapes;
  }
  
  if (isHorizontal) {
    typeInfo.indices.forEach(rowIndex => {
      const yCenter = cellHeight * rowIndex + cellHeight / 2;
      const leftIntersect = getHorizontalIntersection(componentShapes, yCenter, 'left');
      const rightIntersect = getHorizontalIntersection(componentShapes, yCenter, 'right');
      
      shapes.push({
        id: generateId(),
        type: 'line',
        x: 0,
        y: yCenter,
        width: leftIntersect,
        height: 0,
        strokeWidth: 2,
        stroke
      });
      shapes.push({
        id: generateId(),
        type: 'line',
        x: rightIntersect,
        y: yCenter,
        width: 1 - rightIntersect,
        height: 0,
        strokeWidth: 2,
        stroke
      });
    });
    return shapes;
  }
  
  if (isVertical) {
    typeInfo.indices.forEach(colIndex => {
      const xCenter = cellWidth * colIndex + cellWidth / 2;
      const topIntersect = getVerticalIntersection(componentShapes, xCenter, 'top');
      const bottomIntersect = getVerticalIntersection(componentShapes, xCenter, 'bottom');
      
      shapes.push({
        id: generateId(),
        type: 'line',
        x: xCenter,
        y: 0,
        width: 0,
        height: topIntersect,
        strokeWidth: 2,
        stroke
      });
      shapes.push({
        id: generateId(),
        type: 'line',
        x: xCenter,
        y: bottomIntersect,
        width: 0,
        height: 1 - bottomIntersect,
        strokeWidth: 2,
        stroke
      });
    });
    return shapes;
  }
  
  // Single side connections
  if (typeInfo.side === 'left') {
    typeInfo.indices.forEach(rowIndex => {
      const yCenter = cellHeight * rowIndex + cellHeight / 2;
      const leftIntersect = getHorizontalIntersection(componentShapes, yCenter, 'left');
      shapes.push({
        id: generateId(),
        type: 'line',
        x: 0,
        y: yCenter,
        width: leftIntersect,
        height: 0,
        strokeWidth: 2,
        stroke
      });
    });
  } else if (typeInfo.side === 'right') {
    typeInfo.indices.forEach(rowIndex => {
      const yCenter = cellHeight * rowIndex + cellHeight / 2;
      const rightIntersect = getHorizontalIntersection(componentShapes, yCenter, 'right');
      shapes.push({
        id: generateId(),
        type: 'line',
        x: rightIntersect,
        y: yCenter,
        width: 1 - rightIntersect,
        height: 0,
        strokeWidth: 2,
        stroke
      });
    });
  } else if (typeInfo.side === 'top') {
    typeInfo.indices.forEach(colIndex => {
      const xCenter = cellWidth * colIndex + cellWidth / 2;
      const topIntersect = getVerticalIntersection(componentShapes, xCenter, 'top');
      shapes.push({
        id: generateId(),
        type: 'line',
        x: xCenter,
        y: 0,
        width: 0,
        height: topIntersect,
        strokeWidth: 2,
        stroke
      });
    });
  } else if (typeInfo.side === 'bottom') {
    typeInfo.indices.forEach(colIndex => {
      const xCenter = cellWidth * colIndex + cellWidth / 2;
      const bottomIntersect = getVerticalIntersection(componentShapes, xCenter, 'bottom');
      shapes.push({
        id: generateId(),
        type: 'line',
        x: xCenter,
        y: bottomIntersect,
        width: 0,
        height: 1 - bottomIntersect,
        strokeWidth: 2,
        stroke
      });
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
