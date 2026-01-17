import { Shape } from "@/types/schematic";

/**
 * Generate a single connection line from component edge to tile edge
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

  // Filter only geometric shapes
  const geometricShapes = componentShapes.filter(s => 
    !['text', 'line', 'arrow', 'polyline'].includes(s.type)
  );

  if (side === 'left' || side === 'right') {
    const yNorm = (cellY + 0.5) / tileHeight;
    let intersection = side === 'left' ? 0 : 1;
    
    for (const shape of geometricShapes) {
      if (yNorm >= shape.y && yNorm <= shape.y + shape.height) {
        if (side === 'left') {
          intersection = Math.max(intersection, shape.x);
        } else {
          intersection = Math.min(intersection, shape.x + shape.width);
        }
      }
    }
    
    const edgeX = side === 'left' ? 0 : 1;
    shapes.push({
      id: `conn-${side}-${cellY}`,
      type: 'line',
      x: Math.min(edgeX, intersection),
      y: yNorm,
      width: Math.abs(intersection - edgeX),
      height: 0,
      strokeWidth
    });
  } else {
    const xNorm = (cellX + 0.5) / tileWidth;
    let intersection = side === 'top' ? 0 : 1;
    
    for (const shape of geometricShapes) {
      if (xNorm >= shape.x && xNorm <= shape.x + shape.width) {
        if (side === 'top') {
          intersection = Math.max(intersection, shape.y);
        } else {
          intersection = Math.min(intersection, shape.y + shape.height);
        }
      }
    }
    
    const edgeY = side === 'top' ? 0 : 1;
    shapes.push({
      id: `conn-${side}-${cellX}`,
      type: 'line',
      x: xNorm,
      y: Math.min(edgeY, intersection),
      width: 0,
      height: Math.abs(intersection - edgeY),
      strokeWidth
    });
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
