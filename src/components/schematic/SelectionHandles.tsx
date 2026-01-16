import { Shape } from "@/types/schematic";

interface SelectionHandlesProps {
  shape: Shape;
}

export function SelectionHandles({ shape }: SelectionHandlesProps) {
  const handleSize = 8;
  const handles = [
    { x: shape.x - handleSize/2, y: shape.y - handleSize/2, cursor: 'nw-resize' },
    { x: shape.x + shape.width/2 - handleSize/2, y: shape.y - handleSize/2, cursor: 'n-resize' },
    { x: shape.x + shape.width - handleSize/2, y: shape.y - handleSize/2, cursor: 'ne-resize' },
    { x: shape.x + shape.width - handleSize/2, y: shape.y + shape.height/2 - handleSize/2, cursor: 'e-resize' },
    { x: shape.x + shape.width - handleSize/2, y: shape.y + shape.height - handleSize/2, cursor: 'se-resize' },
    { x: shape.x + shape.width/2 - handleSize/2, y: shape.y + shape.height - handleSize/2, cursor: 's-resize' },
    { x: shape.x - handleSize/2, y: shape.y + shape.height - handleSize/2, cursor: 'sw-resize' },
    { x: shape.x - handleSize/2, y: shape.y + shape.height/2 - handleSize/2, cursor: 'w-resize' },
  ];

  return (
    <g>
      {/* Selection bounding box */}
      <rect
        x={shape.x}
        y={shape.y}
        width={shape.width}
        height={shape.height}
        fill="none"
        stroke="hsl(var(--component-selected))"
        strokeWidth={1}
        strokeDasharray="4 2"
      />
      
      {/* Resize handles */}
      {handles.map((handle, index) => (
        <rect
          key={index}
          x={handle.x}
          y={handle.y}
          width={handleSize}
          height={handleSize}
          className="selection-handle"
          style={{ cursor: handle.cursor }}
          rx={2}
        />
      ))}
    </g>
  );
}
