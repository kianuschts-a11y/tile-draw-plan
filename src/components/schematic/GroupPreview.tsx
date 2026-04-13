import { ComponentGroup, Component, Shape, GroupConnectionData } from "@/types/schematic";
import { CONNECTION_BLOCKS } from "@/lib/connectionBlocks";
import { generateSingleConnectionLine } from "@/lib/connectionUtils";
import { Folder } from "lucide-react";

interface GroupPreviewProps {
  group: ComponentGroup;
  components: Component[];
  maxSize?: number;
  showBorder?: boolean;
}

function renderShape(shape: Shape, scaleX: number = 50, scaleY: number = 50, strokeOverride?: string) {
  const x = shape.x * scaleX;
  const y = shape.y * scaleY;
  const width = shape.width * scaleX;
  const height = shape.height * scaleY;
  const refScale = Math.min(scaleX, scaleY);
  const sw = shape.strokeWidth ? shape.strokeWidth * refScale : 1.5;

  const baseStroke = strokeOverride || shape.stroke || 'hsl(220, 25%, 20%)';
  const style = {
    fill: shape.fillColor || shape.fill || 'none',
    stroke: baseStroke,
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
        element = <line x1={x} y1={y} x2={x + width} y2={y + height} stroke={style.stroke} strokeWidth={style.strokeWidth} strokeLinecap="round" />;
      }
      break;
    }
    case 'arrow': {
      const ax1 = x;
      const ay1 = y;
      const ax2 = x + width;
      const ay2 = y + height;
      const arrowSize = shape.arrowSize ? shape.arrowSize * refScale : Math.max(4, sw * 4);
      const endAngle = Math.atan2(ay2 - ay1, ax2 - ax1);
      const arrowAngle = Math.PI / 6;
      const ahx1 = ax2 - arrowSize * Math.cos(endAngle - arrowAngle);
      const ahy1 = ay2 - arrowSize * Math.sin(endAngle - arrowAngle);
      const ahx2 = ax2 - arrowSize * Math.cos(endAngle + arrowAngle);
      const ahy2 = ay2 - arrowSize * Math.sin(endAngle + arrowAngle);
      element = (
        <g>
          <line x1={ax1} y1={ay1} x2={ax2} y2={ay2} stroke={style.stroke} strokeWidth={style.strokeWidth} strokeLinecap="round" />
          <polyline points={`${ahx1},${ahy1} ${ax2},${ay2} ${ahx2},${ahy2}`} stroke={style.stroke} fill="none" strokeWidth={style.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );
      break;
    }
    case 'triangle':
      element = <polygon points={`${x + width / 2},${y} ${x},${y + height} ${x + width},${y + height}`} {...style} />;
      break;
    case 'diamond':
      element = <polygon points={`${x + width / 2},${y} ${x + width},${y + height / 2} ${x + width / 2},${y + height} ${x},${y + height / 2}`} {...style} />;
      break;
    case 'polygon':
      if (!shape.points || shape.points.length < 3) return null;
      element = <polygon points={shape.points.map(p => `${p.x * scaleX},${p.y * scaleY}`).join(' ')} {...style} />;
      break;
    case 'polyline':
      if (!shape.points || shape.points.length < 2) return null;
      element = <polyline points={shape.points.map(p => `${p.x * scaleX},${p.y * scaleY}`).join(' ')} stroke={style.stroke} strokeWidth={style.strokeWidth} fill="none" />;
      break;
    case 'arc': {
      const rx = width / 2;
      const ry = height / 2;
      const acx = x + rx;
      const acy = y + ry;
      const startRad = ((shape.startAngle || 0) * Math.PI) / 180;
      const endRad = ((shape.endAngle || 180) * Math.PI) / 180;
      const ax1 = acx + rx * Math.cos(startRad);
      const ay1 = acy + ry * Math.sin(startRad);
      const ax2 = acx + rx * Math.cos(endRad);
      const ay2 = acy + ry * Math.sin(endRad);
      const largeArc = (shape.endAngle || 180) - (shape.startAngle || 0) > 180 ? 1 : 0;
      element = <path d={`M ${ax1} ${ay1} A ${rx} ${ry} 0 ${largeArc} 1 ${ax2} ${ay2}`} stroke={style.stroke} strokeWidth={style.strokeWidth} fill="none" />;
      break;
    }
    case 'text':
      if (shape.text) {
        const fs = shape.fontSize ? shape.fontSize * refScale : 10;
        const textLines = shape.text.split('\n');
        const lh = fs * 1.2;
        element = (
          <text x={x + width / 2} y={y + height / 2 + fs / 3} fontSize={fs} textAnchor="middle" fill={style.stroke}>
            {textLines.length === 1 ? shape.text : textLines.map((line, i) => (
              <tspan key={i} x={x + width / 2} dy={i === 0 ? 0 : lh}>{line}</tspan>
            ))}
          </text>
        );
      }
      break;
    default:
      break;
  }

  if (!element) return null;
  if (rotationTransform) {
    return <g transform={rotationTransform}>{element}</g>;
  }
  return element;
}

/**
 * Determine the colors for a connection block's horizontal and vertical shapes
 * based on which connections touch this tile.
 */
function getConnectionBlockColors(
  tileIndex: number,
  connections: GroupConnectionData[]
): { horizontalColor?: string; verticalColor?: string } {
  let horizontalColor: string | undefined;
  let verticalColor: string | undefined;

  for (const conn of connections) {
    if (conn.fromTileIndex === tileIndex || conn.toTileIndex === tileIndex) {
      const side = conn.fromTileIndex === tileIndex ? conn.fromSide : conn.toSide;
      const color = conn.color || '#293341';
      if (side === 'left' || side === 'right') {
        if (!horizontalColor) horizontalColor = color;
      } else {
        if (!verticalColor) verticalColor = color;
      }
    }
  }

  return { horizontalColor, verticalColor };
}

/**
 * Generate connection-to-body lines for a non-connection-block tile.
 * Uses generateSingleConnectionLine to compute where lines from cell edges
 * meet the component's shapes, then returns scaled SVG elements.
 */
function renderTileConnectionLines(
  tileIndex: number,
  comp: Component,
  tileW: number,
  tileH: number,
  connections: GroupConnectionData[],
  connectionStrokeWidth: number
): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  const compW = comp.width || 1;
  const compH = comp.height || 1;

  for (const conn of connections) {
    // Check "from" side
    if (conn.fromTileIndex === tileIndex) {
      const lineShapes = generateSingleConnectionLine(
        comp.shapes, conn.fromCellX, conn.fromCellY, conn.fromSide, compW, compH
      );
      for (let i = 0; i < lineShapes.length; i++) {
        const s = lineShapes[i];
        elements.push(
          <line
            key={`cl-from-${conn.fromTileIndex}-${conn.toTileIndex}-${i}`}
            x1={s.x * tileW}
            y1={s.y * tileH}
            x2={(s.x + s.width) * tileW}
            y2={(s.y + s.height) * tileH}
            stroke={conn.color || '#293341'}
            strokeWidth={connectionStrokeWidth}
            strokeLinecap="round"
          />
        );
      }
    }
    // Check "to" side
    if (conn.toTileIndex === tileIndex) {
      const lineShapes = generateSingleConnectionLine(
        comp.shapes, conn.toCellX, conn.toCellY, conn.toSide, compW, compH
      );
      for (let i = 0; i < lineShapes.length; i++) {
        const s = lineShapes[i];
        elements.push(
          <line
            key={`cl-to-${conn.fromTileIndex}-${conn.toTileIndex}-${i}`}
            x1={s.x * tileW}
            y1={s.y * tileH}
            x2={(s.x + s.width) * tileW}
            y2={(s.y + s.height) * tileH}
            stroke={conn.color || '#293341'}
            strokeWidth={connectionStrokeWidth}
            strokeLinecap="round"
          />
        );
      }
    }
  }

  return elements;
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
  
  const tiles = group.layoutData.tiles;
  const connections = group.layoutData.connections || [];
  let totalWidth = 0;
  let totalHeight = 0;
  
  tiles.forEach(tile => {
    const comp = components.find(c => c.id === tile.componentId) 
      || CONNECTION_BLOCKS.find(c => c.id === tile.componentId);
    if (comp) {
      totalWidth = Math.max(totalWidth, tile.relativeX + (comp.width || 1));
      totalHeight = Math.max(totalHeight, tile.relativeY + (comp.height || 1));
    }
  });
  
  const padding = 4;
  const availableSize = maxSize - padding * 2;
  const scale = Math.min(availableSize / totalWidth, availableSize / totalHeight, 20);
  const connectionStrokeWidth = Math.max(0.5, scale * 0.04);
  
  const svgWidth = totalWidth * scale + padding * 2;
  const svgHeight = totalHeight * scale + padding * 2;
  
  return (
    <svg 
      width={svgWidth} 
      height={svgHeight}
      className={showBorder ? "border border-dashed border-muted-foreground/30 rounded" : ""}
    >
      {tiles.map((tile, idx) => {
        const comp = components.find(c => c.id === tile.componentId)
          || CONNECTION_BLOCKS.find(c => c.id === tile.componentId);
        if (!comp) return null;
        
        const tileX = padding + tile.relativeX * scale;
        const tileY = padding + tile.relativeY * scale;
        const tileW = (comp.width || 1) * scale;
        const tileH = (comp.height || 1) * scale;
        
        const isConnBlock = comp.id.startsWith('connection-');

        // For connection blocks, determine colors from connections
        let blockColors: { horizontalColor?: string; verticalColor?: string } = {};
        if (isConnBlock) {
          blockColors = getConnectionBlockColors(idx, connections);
        }
        
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
            {/* Render component shapes */}
            {comp.shapes.map((shape, shapeIdx) => {
              let strokeOverride: string | undefined;
              if (isConnBlock) {
                const shapeId = shape.id || '';
                if (shapeId.endsWith('-h')) {
                  strokeOverride = blockColors.horizontalColor;
                } else if (shapeId.endsWith('-v')) {
                  strokeOverride = blockColors.verticalColor;
                } else {
                  strokeOverride = blockColors.horizontalColor || blockColors.verticalColor;
                }
              }
              return (
                <g key={shapeIdx}>{renderShape(shape, tileW, tileH, strokeOverride)}</g>
              );
            })}
            {/* Render connection-to-body lines for non-connection-block tiles */}
            {!isConnBlock && renderTileConnectionLines(idx, comp, tileW, tileH, connections, connectionStrokeWidth)}
          </g>
        );
      })}
      {/* Render connection lines between tiles (edge-to-edge) */}
      {connections.map((conn, connIdx) => {
        const fromTile = tiles[conn.fromTileIndex];
        const toTile = tiles[conn.toTileIndex];
        if (!fromTile || !toTile) return null;

        const fromComp = components.find(c => c.id === fromTile.componentId)
          || CONNECTION_BLOCKS.find(c => c.id === fromTile.componentId);
        const toComp = components.find(c => c.id === toTile.componentId)
          || CONNECTION_BLOCKS.find(c => c.id === toTile.componentId);
        if (!fromComp || !toComp) return null;

        const getConnectionPoint = (
          relX: number, relY: number, compW: number, compH: number,
          cellX: number, cellY: number, side: string
        ) => {
          const tileX = padding + relX * scale;
          const tileY = padding + relY * scale;
          const tileW = compW * scale;
          const tileH = compH * scale;
          const cellW = tileW / compW;
          const cellH = tileH / compH;
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

        const p1 = getConnectionPoint(fromTile.relativeX, fromTile.relativeY, fromComp.width || 1, fromComp.height || 1, conn.fromCellX, conn.fromCellY, conn.fromSide);
        const p2 = getConnectionPoint(toTile.relativeX, toTile.relativeY, toComp.width || 1, toComp.height || 1, conn.toCellX, conn.toCellY, conn.toSide);

        return (
          <line
            key={`conn-${connIdx}`}
            x1={p1.x}
            y1={p1.y}
            x2={p2.x}
            y2={p2.y}
            stroke={conn.color || '#293341'}
            strokeWidth={connectionStrokeWidth}
            strokeLinecap="round"
          />
        );
      })}
      {/* Render annotation lines */}
      {group.layoutData.annotationLines?.map((annLine, annIdx) => {
        const points = annLine.path.map(p => 
          `${padding + (p.relativeX + 0.5) * scale},${padding + (p.relativeY + 0.5) * scale}`
        ).join(' ');
        const unit = scale * 0.1;
        let dashArray: string | undefined;
        switch (annLine.lineStyle) {
          case 'dashed': dashArray = `${unit * 2} ${unit}`; break;
          case 'dotted': dashArray = `${unit * 0.5} ${unit}`; break;
          case 'dash-dot': dashArray = `${unit * 2} ${unit} ${unit * 0.5} ${unit}`; break;
          default: dashArray = undefined;
        }
        return (
          <polyline
            key={`ann-${annIdx}`}
            points={points}
            fill="none"
            stroke={annLine.color}
            strokeWidth={Math.max(0.5, annLine.strokeWidth * (scale / 20))}
            strokeDasharray={dashArray}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
    </svg>
  );
}
