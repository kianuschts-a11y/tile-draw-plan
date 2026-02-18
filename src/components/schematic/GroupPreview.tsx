import { ComponentGroup, Component, Shape } from "@/types/schematic";
import { CONNECTION_BLOCKS } from "@/lib/connectionBlocks";
import { Folder } from "lucide-react";

interface GroupPreviewProps {
  group: ComponentGroup;
  components: Component[];
  maxSize?: number;
  showBorder?: boolean;
}

function renderShape(shape: Shape, scaleX: number = 50, scaleY: number = 50) {
  const x = shape.x * scaleX;
  const y = shape.y * scaleY;
  const width = shape.width * scaleX;
  const height = shape.height * scaleY;
  const refScale = Math.min(scaleX, scaleY);
  const sw = shape.strokeWidth ? shape.strokeWidth * refScale : 1.5;

  const style = {
    fill: shape.fillColor || shape.fill || 'none',
    stroke: 'hsl(220, 25%, 20%)',
    strokeWidth: Math.max(0.5, sw)
  };

  const rotation = shape.rotation || 0;
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const rotationTransform = rotation !== 0 ? `rotate(${rotation}, ${centerX}, ${centerY})` : undefined;

  let element: React.ReactNode = null;

  switch (shape.type) {
    case 'rectangle':
      element = <rect x={x} y={y} width={width} height={height} {...style} />;
      break;
    case 'circle':
    case 'ellipse':
      element = <ellipse cx={x + width / 2} cy={y + height / 2} rx={width / 2} ry={height / 2} {...style} />;
      break;
    case 'line': {
      if (shape.curveOffset && (shape.curveOffset.x !== 0 || shape.curveOffset.y !== 0)) {
        const lx1 = x;
        const ly1 = y;
        const lx2 = x + width;
        const ly2 = y + height;
        const midX = (lx1 + lx2) / 2;
        const midY = (ly1 + ly2) / 2;
        const cx = midX + shape.curveOffset.x * scaleX;
        const cy = midY + shape.curveOffset.y * scaleY;
        element = <path d={`M ${lx1} ${ly1} Q ${cx} ${cy} ${lx2} ${ly2}`} fill="none" stroke={style.stroke} strokeWidth={style.strokeWidth} strokeLinecap="round" />;
      } else {
        element = <line x1={x} y1={y} x2={x + width} y2={y + height} {...style} strokeLinecap="round" />;
      }
      break;
    }
    case 'triangle':
      element = <polygon points={`${x + width / 2},${y} ${x},${y + height} ${x + width},${y + height}`} {...style} />;
      break;
    case 'diamond':
      element = <polygon points={`${x + width / 2},${y} ${x + width},${y + height / 2} ${x + width / 2},${y + height} ${x},${y + height / 2}`} {...style} />;
      break;
    case 'text':
      if (shape.text) {
        const fs = shape.fontSize ? shape.fontSize * refScale : 10;
        element = (
          <text x={x + width / 2} y={y + height / 2 + fs / 3} fontSize={fs} textAnchor="middle" fill={style.stroke}>
            {shape.text}
          </text>
        );
      }
      break;
    default:
      element = <rect x={x} y={y} width={width} height={height} {...style} />;
  }

  if (rotationTransform) {
    return <g transform={rotationTransform}>{element}</g>;
  }
  return element;
}

export function GroupPreview({ group, components, maxSize = 100, showBorder = false }: GroupPreviewProps) {
  const hasLayout = group.layoutData?.tiles && group.layoutData.tiles.length > 0;
  
  if (!hasLayout || !group.layoutData) {
    return (
      <div 
        className="flex items-center justify-center"
        style={{ width: maxSize, height: maxSize }}
      >
        <Folder className="w-6 h-6 text-muted-foreground" />
      </div>
    );
  }
  
  // Calculate bounds of the layout based on component sizes
  const tiles = group.layoutData.tiles;
  let totalWidth = 0;
  let totalHeight = 0;
  
  tiles.forEach(tile => {
    // Check both custom components and connection blocks
    const comp = components.find(c => c.id === tile.componentId) 
      || CONNECTION_BLOCKS.find(c => c.id === tile.componentId);
    if (comp) {
      const tileRight = tile.relativeX + (comp.width || 1);
      const tileBottom = tile.relativeY + (comp.height || 1);
      totalWidth = Math.max(totalWidth, tileRight);
      totalHeight = Math.max(totalHeight, tileBottom);
    }
  });
  
  // Calculate scale to fit in preview area
  const padding = 4;
  const availableSize = maxSize - padding * 2;
  const scale = Math.min(availableSize / totalWidth, availableSize / totalHeight, 20);
  
  const svgWidth = totalWidth * scale + padding * 2;
  const svgHeight = totalHeight * scale + padding * 2;
  
  return (
    <svg 
      width={svgWidth} 
      height={svgHeight}
      className={showBorder ? "border border-dashed border-muted-foreground/30 rounded" : ""}
    >
      {tiles.map((tile, idx) => {
        // Check both custom components and connection blocks
        const comp = components.find(c => c.id === tile.componentId)
          || CONNECTION_BLOCKS.find(c => c.id === tile.componentId);
        if (!comp) return null;
        
        const tileX = padding + tile.relativeX * scale;
        const tileY = padding + tile.relativeY * scale;
        const tileW = (comp.width || 1) * scale;
        const tileH = (comp.height || 1) * scale;
        
        const shapeScaleX = tileW;
        const shapeScaleY = tileH;
        
        return (
          <g key={idx} transform={`translate(${tileX}, ${tileY})`}>
            <rect
              x={0}
              y={0}
              width={tileW}
              height={tileH}
              fill="white"
              stroke="hsl(var(--border))"
              strokeWidth={0.5}
              strokeDasharray="2,1"
            />
            {comp.shapes.map((shape, shapeIdx) => (
              <g key={shapeIdx}>{renderShape(shape, shapeScaleX, shapeScaleY)}</g>
            ))}
          </g>
        );
      })}
      {/* Render connection lines */}
      {group.layoutData?.connections?.map((conn, connIdx) => {
        const fromTile = tiles[conn.fromTileIndex];
        const toTile = tiles[conn.toTileIndex];
        if (!fromTile || !toTile) return null;

        const fromComp = components.find(c => c.id === fromTile.componentId)
          || CONNECTION_BLOCKS.find(c => c.id === fromTile.componentId);
        const toComp = components.find(c => c.id === toTile.componentId)
          || CONNECTION_BLOCKS.find(c => c.id === toTile.componentId);
        if (!fromComp || !toComp) return null;

        const fromTileX = padding + fromTile.relativeX * scale;
        const fromTileY = padding + fromTile.relativeY * scale;
        const fromTileW = (fromComp.width || 1) * scale;
        const fromTileH = (fromComp.height || 1) * scale;

        const toTileX = padding + toTile.relativeX * scale;
        const toTileY = padding + toTile.relativeY * scale;
        const toTileW = (toComp.width || 1) * scale;
        const toTileH = (toComp.height || 1) * scale;

        // Calculate connection point positions on the tile edges
        let x1: number, y1: number, x2: number, y2: number;

        const getConnectionPoint = (
          tileX: number, tileY: number, tileW: number, tileH: number,
          compWidth: number, compHeight: number,
          cellX: number, cellY: number, side: string
        ) => {
          const cellW = tileW / compWidth;
          const cellH = tileH / compHeight;
          const cx = tileX + cellX * cellW + cellW / 2;
          const cy = tileY + cellY * cellH + cellH / 2;

          switch (side) {
            case 'left': return { x: tileX + cellX * cellW, y: cy };
            case 'right': return { x: tileX + (cellX + 1) * cellW, y: cy };
            case 'top': return { x: cx, y: tileY + cellY * cellH };
            case 'bottom': return { x: cx, y: tileY + (cellY + 1) * cellH };
            default: return { x: cx, y: cy };
          }
        };

        const p1 = getConnectionPoint(fromTileX, fromTileY, fromTileW, fromTileH, fromComp.width || 1, fromComp.height || 1, conn.fromCellX, conn.fromCellY, conn.fromSide);
        const p2 = getConnectionPoint(toTileX, toTileY, toTileW, toTileH, toComp.width || 1, toComp.height || 1, conn.toCellX, conn.toCellY, conn.toSide);

        return (
          <line
            key={`conn-${connIdx}`}
            x1={p1.x}
            y1={p1.y}
            x2={p2.x}
            y2={p2.y}
            stroke={conn.color || 'hsl(220, 25%, 20%)'}
            strokeWidth={Math.max(0.5, scale * 0.04)}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}
