import { CanvasState, PAPER_SIZES } from "@/types/schematic";

interface StatusBarProps {
  canvasState: CanvasState;
  shapeCount: number;
  selectedCount: number;
}

export function StatusBar({ canvasState, shapeCount, selectedCount }: StatusBarProps) {
  const paperSize = PAPER_SIZES[canvasState.paperFormat];
  const dimensions = canvasState.orientation === 'portrait'
    ? `${paperSize.width} × ${paperSize.height}`
    : `${paperSize.height} × ${paperSize.width}`;

  return (
    <div className="toolbar-panel h-8 border-t flex items-center px-4 gap-6 text-xs text-muted-foreground font-mono">
      <div className="flex items-center gap-2">
        <span className="text-foreground/70">Format:</span>
        <span>{canvasState.paperFormat}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-foreground/70">Größe:</span>
        <span>{dimensions} mm</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-foreground/70">Ausrichtung:</span>
        <span>{canvasState.orientation === 'portrait' ? 'Hochformat' : 'Querformat'}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-foreground/70">Zoom:</span>
        <span>{Math.round(canvasState.zoom * 100)}%</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-foreground/70">Raster:</span>
        <span>{canvasState.gridSize}px</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-foreground/70">Objekte:</span>
        <span>{shapeCount}</span>
      </div>
      {selectedCount > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-foreground/70">Ausgewählt:</span>
          <span className="text-primary">{selectedCount}</span>
        </div>
      )}
      <div className="flex-1" />
      <div className="text-muted-foreground/70">
        Anlagen-Schema Editor
      </div>
    </div>
  );
}
