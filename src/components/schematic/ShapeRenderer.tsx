import { Shape } from "@/types/schematic";

interface ShapeRendererProps {
  shape: Shape;
  isSelected?: boolean;
  onClick?: () => void;
  onMouseDown?: (e: React.MouseEvent) => void;
}

// Fixed color values for consistent rendering (including export)
const STROKE_COLOR = "#293341"; // hsl(220, 25%, 20%)
const SELECTED_STROKE_COLOR = "#1a74dc"; // hsl(215, 80%, 50%)
const TEXT_COLOR = "#293341";

export function ShapeRenderer({ shape, isSelected, onClick, onMouseDown }: ShapeRendererProps) {
  const strokeColor = isSelected ? SELECTED_STROKE_COLOR : STROKE_COLOR;
  const strokeWidth = isSelected ? 2.5 : (shape.strokeWidth || 2);

  const renderShape = () => {
    const transform = shape.rotation 
      ? `rotate(${shape.rotation} ${shape.x + shape.width/2} ${shape.y + shape.height/2})` 
      : undefined;
    // Support both fillColor and fill properties for backward compatibility
    const fill = shape.fillColor || shape.fill || "none";

    switch (shape.type) {
      case 'rectangle':
        return (
          <rect
            x={shape.x}
            y={shape.y}
            width={shape.width}
            height={shape.height}
            stroke={strokeColor}
            fill={fill}
            strokeWidth={strokeWidth}
            transform={transform}
          />
        );
      
      case 'circle':
      case 'ellipse':
        return (
          <ellipse
            cx={shape.x + shape.width / 2}
            cy={shape.y + shape.height / 2}
            rx={shape.width / 2}
            ry={shape.height / 2}
            stroke={strokeColor}
            fill={fill}
            strokeWidth={strokeWidth}
            transform={transform}
          />
        );
      
      case 'line': {
        const lx1 = shape.x;
        const ly1 = shape.y;
        const lx2 = shape.x + shape.width;
        const ly2 = shape.y + shape.height;
        
        // Check if this is a curved line
        if (shape.curveOffset && (shape.curveOffset.x !== 0 || shape.curveOffset.y !== 0)) {
          const midX = (lx1 + lx2) / 2;
          const midY = (ly1 + ly2) / 2;
          const cx = midX + shape.curveOffset.x;
          const cy = midY + shape.curveOffset.y;
          return (
            <path
              d={`M ${lx1} ${ly1} Q ${cx} ${cy} ${lx2} ${ly2}`}
              stroke={shape.stroke || strokeColor}
              strokeWidth={strokeWidth}
              fill="none"
            />
          );
        }
        
        return (
          <line
            x1={lx1}
            y1={ly1}
            x2={lx2}
            y2={ly2}
            stroke={shape.stroke || strokeColor}
            strokeWidth={strokeWidth}
          />
        );
      }
      
      case 'arrow': {
        const ax1 = shape.x;
        const ay1 = shape.y;
        const ax2 = shape.x + shape.width;
        const ay2 = shape.y + shape.height;
        const arrowSize = shape.arrowSize || Math.max(8, (shape.strokeWidth || 2) * 4);
        
        // Calculate arrow head angle - for curved lines, use tangent at end point
        let endAngle: number;
        if (shape.curveOffset && (shape.curveOffset.x !== 0 || shape.curveOffset.y !== 0)) {
          const midX = (ax1 + ax2) / 2;
          const midY = (ay1 + ay2) / 2;
          const cx = midX + shape.curveOffset.x;
          const cy = midY + shape.curveOffset.y;
          // Tangent at end of quadratic bezier: derivative at t=1 is 2*(P2-P1) = 2*((x2,y2)-(cx,cy))
          endAngle = Math.atan2(ay2 - cy, ax2 - cx);
        } else {
          endAngle = Math.atan2(ay2 - ay1, ax2 - ax1);
        }
        
        const arrowAngle = Math.PI / 6; // 30 degrees
        const ahx1 = ax2 - arrowSize * Math.cos(endAngle - arrowAngle);
        const ahy1 = ay2 - arrowSize * Math.sin(endAngle - arrowAngle);
        const ahx2 = ax2 - arrowSize * Math.cos(endAngle + arrowAngle);
        const ahy2 = ay2 - arrowSize * Math.sin(endAngle + arrowAngle);
        
        // Check if this is a curved arrow
        if (shape.curveOffset && (shape.curveOffset.x !== 0 || shape.curveOffset.y !== 0)) {
          const midX = (ax1 + ax2) / 2;
          const midY = (ay1 + ay2) / 2;
          const cx = midX + shape.curveOffset.x;
          const cy = midY + shape.curveOffset.y;
          return (
            <g>
              <path
                d={`M ${ax1} ${ay1} Q ${cx} ${cy} ${ax2} ${ay2}`}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                fill="none"
              />
              <polyline
                points={`${ahx1},${ahy1} ${ax2},${ay2} ${ahx2},${ahy2}`}
                stroke={strokeColor}
                fill="none"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          );
        }
        
        return (
          <g>
            <line
              x1={ax1}
              y1={ay1}
              x2={ax2}
              y2={ay2}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
            <polyline
              points={`${ahx1},${ahy1} ${ax2},${ay2} ${ahx2},${ahy2}`}
              stroke={strokeColor}
              fill="none"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        );
      }
      
      case 'triangle': {
        const triPoints = [
          `${shape.x + shape.width / 2},${shape.y}`,
          `${shape.x},${shape.y + shape.height}`,
          `${shape.x + shape.width},${shape.y + shape.height}`
        ].join(' ');
        return (
          <polygon
            points={triPoints}
            stroke={strokeColor}
            fill={fill}
            strokeWidth={strokeWidth}
            transform={transform}
          />
        );
      }
      
      case 'diamond': {
        const diaPoints = [
          `${shape.x + shape.width / 2},${shape.y}`,
          `${shape.x + shape.width},${shape.y + shape.height / 2}`,
          `${shape.x + shape.width / 2},${shape.y + shape.height}`,
          `${shape.x},${shape.y + shape.height / 2}`
        ].join(' ');
        return (
          <polygon
            points={diaPoints}
            stroke={strokeColor}
            fill={fill}
            strokeWidth={strokeWidth}
            transform={transform}
          />
        );
      }
      
      case 'polygon':
        if (!shape.points || shape.points.length < 3) return null;
        return (
          <polygon
            points={shape.points.map(p => `${p.x},${p.y}`).join(' ')}
            stroke={strokeColor}
            fill={fill}
            strokeWidth={strokeWidth}
            transform={transform}
          />
        );
      
      case 'polyline':
        if (!shape.points || shape.points.length < 2) return null;
        return (
          <polyline
            points={shape.points.map(p => `${p.x},${p.y}`).join(' ')}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
        );
      
      case 'arc':
        const rx = shape.width / 2;
        const ry = shape.height / 2;
        const cx = shape.x + rx;
        const cy = shape.y + ry;
        const startRad = ((shape.startAngle || 0) * Math.PI) / 180;
        const endRad = ((shape.endAngle || 180) * Math.PI) / 180;
        const x1 = cx + rx * Math.cos(startRad);
        const y1 = cy + ry * Math.sin(startRad);
        const x2 = cx + rx * Math.cos(endRad);
        const y2 = cy + ry * Math.sin(endRad);
        const largeArc = (shape.endAngle || 180) - (shape.startAngle || 0) > 180 ? 1 : 0;
        return (
          <path 
            d={`M ${x1} ${y1} A ${rx} ${ry} 0 ${largeArc} 1 ${x2} ${y2}`} 
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
        );
      
      case 'text':
        return (
          <text 
            x={shape.x} 
            y={shape.y + (shape.fontSize || 14)} 
            fontSize={shape.fontSize || 14}
            fontFamily={shape.fontFamily || 'sans-serif'}
            stroke="none"
            fill={TEXT_COLOR}
          >
            {shape.text}
          </text>
        );
      
      default:
        return null;
    }
  };

  return (
    <g 
      onClick={onClick} 
      onMouseDown={onMouseDown}
      style={{ cursor: 'pointer' }}
    >
      {renderShape()}
    </g>
  );
}
