import { Component, Shape, CellConnection } from "@/types/schematic";
import { SavedPlanData } from "@/hooks/useSavedPlans";
import { PlacedTile } from "./Canvas";
import { CONNECTION_BLOCKS } from "@/lib/connectionBlocks";
import { generateSingleConnectionLine } from "@/lib/connectionUtils";
import { FileText } from "lucide-react";
import { AnnotationLine } from "@/types/annotations";

interface PlanPreviewProps {
  plan: SavedPlanData;
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

function getConnectionBlockColors(
  tileId: string,
  connections: CellConnection[]
): { horizontalColor?: string; verticalColor?: string } {
  let horizontalColor: string | undefined;
  let verticalColor: string | undefined;

  for (const conn of connections) {
    if (conn.fromTileId === tileId || conn.toTileId === tileId) {
      const side = conn.fromTileId === tileId ? conn.fromSide : conn.toSide;
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

function renderTileConnectionLines(
  tileId: string,
  comp: Component,
  tileW: number,
  tileH: number,
  connections: CellConnection[],
  connectionStrokeWidth: number
): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  const compW = comp.width || 1;
  const compH = comp.height || 1;

  for (const conn of connections) {
    if (conn.fromTileId === tileId) {
      const lineShapes = generateSingleConnectionLine(
        comp.shapes, conn.fromCellX, conn.fromCellY, conn.fromSide, compW, compH
      );
      for (let i = 0; i < lineShapes.length; i++) {
        const s = lineShapes[i];
        elements.push(
          <line
            key={`cl-from-${conn.id}-${i}`}
            x1={s.x * tileW} y1={s.y * tileH}
            x2={(s.x + s.width) * tileW} y2={(s.y + s.height) * tileH}
            stroke={conn.color || '#293341'}
            strokeWidth={connectionStrokeWidth}
            strokeLinecap="round"
          />
        );
      }
    }
    if (conn.toTileId === tileId) {
      const lineShapes = generateSingleConnectionLine(
        comp.shapes, conn.toCellX, conn.toCellY, conn.toSide, compW, compH
      );
      for (let i = 0; i < lineShapes.length; i++) {
        const s = lineShapes[i];
        elements.push(
          <line
            key={`cl-to-${conn.id}-${i}`}
            x1={s.x * tileW} y1={s.y * tileH}
            x2={(s.x + s.width) * tileW} y2={(s.y + s.height) * tileH}
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

export function PlanPreview({ plan, components, maxSize = 100, showBorder = false }: PlanPreviewProps) {
  const tiles = plan.drawingData?.tiles;
  const connections = plan.drawingData?.connections || [];
  const annotationLines = plan.drawingData?.annotationLines || [];
  
  if (!tiles || tiles.length === 0) {
    return (
      <div 
        className="flex items-center justify-center"
        style={{ width: maxSize, height: maxSize }}
      >
        <FileText className="w-6 h-6 text-muted-foreground" />
      </div>
    );
  }
  
  // Calculate bounds from tiles AND annotation lines
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  
  for (const tile of tiles) {
    const comp = tile.component || components.find(c => c.id === (tile as any).componentId)
      || CONNECTION_BLOCKS.find(c => c.id === (tile as any).componentId);
    if (!comp) continue;
    const w = comp.width || 1;
    const h = comp.height || 1;
    minX = Math.min(minX, tile.gridX);
    maxX = Math.max(maxX, tile.gridX + w);
    minY = Math.min(minY, tile.gridY);
    maxY = Math.max(maxY, tile.gridY + h);
  }

  // Extend bounds for annotation lines
  for (const annLine of annotationLines) {
    for (const p of annLine.path) {
      minX = Math.min(minX, p.gridX);
      maxX = Math.max(maxX, p.gridX + 1);
      minY = Math.min(minY, p.gridY);
      maxY = Math.max(maxY, p.gridY + 1);
    }
  }
  
  if (minX === Infinity) {
    return (
      <div className="flex items-center justify-center" style={{ width: maxSize, height: maxSize }}>
        <FileText className="w-6 h-6 text-muted-foreground" />
      </div>
    );
  }
  
  const totalWidth = maxX - minX;
  const totalHeight = maxY - minY;
  
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
        const comp = tile.component || components.find(c => c.id === (tile as any).componentId)
          || CONNECTION_BLOCKS.find(c => c.id === (tile as any).componentId);
        if (!comp) return null;
        
        const tileX = padding + (tile.gridX - minX) * scale;
        const tileY = padding + (tile.gridY - minY) * scale;
        const tileW = (comp.width || 1) * scale;
        const tileH = (comp.height || 1) * scale;
        
        const isConnBlock = comp.id.startsWith('connection-');

        let blockColors: { horizontalColor?: string; verticalColor?: string } = {};
        if (isConnBlock) {
          blockColors = getConnectionBlockColors(tile.id, connections);
        }
        
        return (
          <g key={idx} transform={`translate(${tileX}, ${tileY})`}>
            <rect
              x={0} y={0}
              width={tileW} height={tileH}
              fill="white"
              stroke="hsl(var(--border))"
              strokeWidth={0.5}
              strokeDasharray="2,1"
            />
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
            {!isConnBlock && renderTileConnectionLines(tile.id, comp, tileW, tileH, connections, connectionStrokeWidth)}
          </g>
        );
      })}
      {/* Render connection lines between tiles */}
      {connections.map((conn, connIdx) => {
        const fromTile = tiles.find(t => t.id === conn.fromTileId);
        const toTile = tiles.find(t => t.id === conn.toTileId);
        if (!fromTile || !toTile) return null;

        const fromComp = fromTile.component || components.find(c => c.id === (fromTile as any).componentId)
          || CONNECTION_BLOCKS.find(c => c.id === (fromTile as any).componentId);
        const toComp = toTile.component || components.find(c => c.id === (toTile as any).componentId)
          || CONNECTION_BLOCKS.find(c => c.id === (toTile as any).componentId);
        if (!fromComp || !toComp) return null;

        const getConnectionPoint = (
          gridX: number, gridY: number, compW: number, compH: number,
          cellX: number, cellY: number, side: string
        ) => {
          const tx = padding + (gridX - minX) * scale;
          const ty = padding + (gridY - minY) * scale;
          const tw = compW * scale;
          const th = compH * scale;
          const cellW = tw / compW;
          const cellH = th / compH;
          const cx = tx + cellX * cellW + cellW / 2;
          const cy = ty + cellY * cellH + cellH / 2;

          switch (side) {
            case 'left': return { x: tx + cellX * cellW, y: cy };
            case 'right': return { x: tx + (cellX + 1) * cellW, y: cy };
            case 'top': return { x: cx, y: ty + cellY * cellH };
            case 'bottom': return { x: cx, y: ty + (cellY + 1) * cellH };
            default: return { x: cx, y: cy };
          }
        };

        const p1 = getConnectionPoint(fromTile.gridX, fromTile.gridY, fromComp.width || 1, fromComp.height || 1, conn.fromCellX, conn.fromCellY, conn.fromSide);
        const p2 = getConnectionPoint(toTile.gridX, toTile.gridY, toComp.width || 1, toComp.height || 1, conn.toCellX, conn.toCellY, conn.toSide);

        return (
          <line
            key={`conn-${connIdx}`}
            x1={p1.x} y1={p1.y}
            x2={p2.x} y2={p2.y}
            stroke={conn.color || '#293341'}
            strokeWidth={connectionStrokeWidth}
            strokeLinecap="round"
          />
        );
      })}
      {/* Render annotation lines */}
      {annotationLines.map((annLine, annIdx) => {
        const points = annLine.path.map(p =>
          `${padding + (p.gridX - minX + 0.5) * scale},${padding + (p.gridY - minY + 0.5) * scale}`
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