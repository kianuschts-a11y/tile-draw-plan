import { Shape } from "@/types/schematic";
import { cn } from "@/lib/utils";

interface ShapeRendererProps {
  shape: Shape;
  isSelected?: boolean;
  onClick?: () => void;
  onMouseDown?: (e: React.MouseEvent) => void;
}

export function ShapeRenderer({ shape, isSelected, onClick, onMouseDown }: ShapeRendererProps) {
  const baseClass = cn(
    "component-tile",
    isSelected && "selected"
  );

  const renderShape = () => {
    const transform = shape.rotation 
      ? `rotate(${shape.rotation} ${shape.x + shape.width/2} ${shape.y + shape.height/2})` 
      : undefined;
    const fill = shape.fillColor || "none";

    switch (shape.type) {
      case 'rectangle':
        return (
          <rect
            x={shape.x}
            y={shape.y}
            width={shape.width}
            height={shape.height}
            className={baseClass}
            fill={fill}
            strokeWidth={shape.strokeWidth || 2}
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
            className={baseClass}
            fill={fill}
            strokeWidth={shape.strokeWidth || 2}
            transform={transform}
          />
        );
      
      case 'line':
        return (
          <line
            x1={shape.x}
            y1={shape.y}
            x2={shape.x + shape.width}
            y2={shape.y + shape.height}
            className={baseClass}
            strokeWidth={shape.strokeWidth || 2}
          />
        );
      
      case 'arrow': {
        const x1 = shape.x;
        const y1 = shape.y;
        const x2 = shape.x + shape.width;
        const y2 = shape.y + shape.height;
        const arrowSize = shape.arrowSize || Math.max(8, (shape.strokeWidth || 2) * 4);
        
        // Calculate arrow head
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const arrowAngle = Math.PI / 6; // 30 degrees
        
        const ax1 = x2 - arrowSize * Math.cos(angle - arrowAngle);
        const ay1 = y2 - arrowSize * Math.sin(angle - arrowAngle);
        const ax2 = x2 - arrowSize * Math.cos(angle + arrowAngle);
        const ay2 = y2 - arrowSize * Math.sin(angle + arrowAngle);
        
        return (
          <g>
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              className={baseClass}
              strokeWidth={shape.strokeWidth || 2}
              strokeLinecap="round"
            />
            <polyline
              points={`${ax1},${ay1} ${x2},${y2} ${ax2},${ay2}`}
              className={baseClass}
              fill="none"
              strokeWidth={shape.strokeWidth || 2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        );
      }
      
      case 'triangle':
        const triPoints = [
          `${shape.x + shape.width / 2},${shape.y}`,
          `${shape.x},${shape.y + shape.height}`,
          `${shape.x + shape.width},${shape.y + shape.height}`
        ].join(' ');
        return (
          <polygon
            points={triPoints}
            className={baseClass}
            fill={fill}
            strokeWidth={shape.strokeWidth || 2}
            transform={transform}
          />
        );
      
      case 'diamond':
        const diaPoints = [
          `${shape.x + shape.width / 2},${shape.y}`,
          `${shape.x + shape.width},${shape.y + shape.height / 2}`,
          `${shape.x + shape.width / 2},${shape.y + shape.height}`,
          `${shape.x},${shape.y + shape.height / 2}`
        ].join(' ');
        return (
          <polygon
            points={diaPoints}
            className={baseClass}
            fill={fill}
            strokeWidth={shape.strokeWidth || 2}
            transform={transform}
          />
        );
      
      case 'polyline':
        if (!shape.points || shape.points.length < 2) return null;
        return (
          <polyline
            points={shape.points.map(p => `${p.x},${p.y}`).join(' ')}
            className={baseClass}
            strokeWidth={shape.strokeWidth || 2}
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
            className={baseClass}
            strokeWidth={shape.strokeWidth || 2}
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
            className="fill-current"
            style={{ stroke: 'none', fill: 'hsl(var(--component-stroke))' }}
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
