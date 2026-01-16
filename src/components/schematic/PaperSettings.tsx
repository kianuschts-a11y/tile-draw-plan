import { PaperFormat, Orientation, PAPER_SIZES } from "@/types/schematic";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RotateCw, Plus, Minus, Grid3X3 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface PaperSettingsProps {
  paperFormat: PaperFormat;
  orientation: Orientation;
  gridSize: number;
  onPaperFormatChange: (format: PaperFormat) => void;
  onOrientationChange: (orientation: Orientation) => void;
  onGridSizeChange: (size: number) => void;
}

const MIN_GRID_SIZE = 5;
const MAX_GRID_SIZE = 50;
const GRID_STEP = 5;

export function PaperSettings({
  paperFormat,
  orientation,
  gridSize,
  onPaperFormatChange,
  onOrientationChange,
  onGridSizeChange
}: PaperSettingsProps) {
  const handleGridIncrease = () => {
    onGridSizeChange(Math.min(gridSize + GRID_STEP, MAX_GRID_SIZE));
  };

  const handleGridDecrease = () => {
    onGridSizeChange(Math.max(gridSize - GRID_STEP, MIN_GRID_SIZE));
  };

  const toggleOrientation = () => {
    onOrientationChange(orientation === 'portrait' ? 'landscape' : 'portrait');
  };

  return (
    <div className="flex items-center gap-3">
      {/* Paper Format Selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Format:</span>
        <Select value={paperFormat} onValueChange={(v) => onPaperFormatChange(v as PaperFormat)}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PAPER_SIZES) as PaperFormat[]).map((format) => (
              <SelectItem key={format} value={format} className="text-xs">
                {PAPER_SIZES[format].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Orientation Toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 gap-2"
            onClick={toggleOrientation}
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span className="text-xs">
              {orientation === 'portrait' ? 'Hochformat' : 'Querformat'}
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          Zwischen Hoch- und Querformat wechseln
        </TooltipContent>
      </Tooltip>

      {/* Grid Size Controls */}
      <div className="flex items-center gap-1 ml-2">
        <Grid3X3 className="w-4 h-4 text-muted-foreground mr-1" />
        <span className="text-xs text-muted-foreground">Raster:</span>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={handleGridDecrease}
              disabled={gridSize <= MIN_GRID_SIZE}
            >
              <Minus className="w-3 h-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Raster verkleinern</TooltipContent>
        </Tooltip>

        <span className="text-xs font-mono w-10 text-center">
          {gridSize}px
        </span>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={handleGridIncrease}
              disabled={gridSize >= MAX_GRID_SIZE}
            >
              <Plus className="w-3 h-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Raster vergrößern</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
