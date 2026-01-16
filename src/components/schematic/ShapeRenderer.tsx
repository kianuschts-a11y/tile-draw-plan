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
    switch (shape.type) {
      case 'rectangle':
        return (
          <rect
            x={shape.x}
            y={shape.y}
            width={shape.width}
            height={shape.height}
            className={baseClass}
            strokeWidth={shape.strokeWidth || 2}
          />
        );
      
      case 'circle':
        return (
          <ellipse
            cx={shape.x + shape.width / 2}
            cy={shape.y + shape.height / 2}
            rx={shape.width / 2}
            ry={shape.height / 2}
            className={baseClass}
            strokeWidth={shape.strokeWidth || 2}
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
            strokeWidth={shape.strokeWidth || 2}
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
            strokeWidth={shape.strokeWidth || 2}
          />
        );
      
      case 'ellipse':
        return (
          <ellipse
            cx={shape.x + shape.width / 2}
            cy={shape.y + shape.height / 2}
            rx={shape.width / 2}
            ry={shape.height / 2}
            className={baseClass}
            strokeWidth={shape.strokeWidth || 2}
          />
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
      transform={shape.rotation ? `rotate(${shape.rotation} ${shape.x + shape.width/2} ${shape.y + shape.height/2})` : undefined}
    >
      {renderShape()}
    </g>
  );
}
