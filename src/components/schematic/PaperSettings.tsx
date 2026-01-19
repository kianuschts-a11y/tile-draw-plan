import { PaperFormat, Orientation, PAPER_SIZES, MM_TO_PX, TitleBlockData } from "@/types/schematic";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RotateCw, Plus, Minus, Grid3X3, FileText, Edit } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface PaperSettingsProps {
  paperFormat: PaperFormat;
  orientation: Orientation;
  gridSize: number;
  titleBlockData?: TitleBlockData;
  onPaperFormatChange: (format: PaperFormat) => void;
  onOrientationChange: (orientation: Orientation) => void;
  onGridSizeChange: (size: number) => void;
  onTitleBlockToggle?: (enabled: boolean) => void;
  onEditTitleBlock?: () => void;
}

const MIN_GRID_SIZE = 20;
const MAX_GRID_SIZE = 80;
const GRID_STEP = 10;

export function PaperSettings({
  paperFormat,
  orientation,
  gridSize,
  titleBlockData,
  onPaperFormatChange,
  onOrientationChange,
  onGridSizeChange,
  onTitleBlockToggle,
  onEditTitleBlock
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

  // Calculate grid dimensions for display
  const paperSize = PAPER_SIZES[paperFormat];
  const paperWidth = orientation === 'portrait' ? paperSize.width * MM_TO_PX : paperSize.height * MM_TO_PX;
  const paperHeight = orientation === 'portrait' ? paperSize.height * MM_TO_PX : paperSize.width * MM_TO_PX;
  const gridCols = Math.floor(paperWidth / gridSize);
  const gridRows = Math.floor(paperHeight / gridSize);

  return (
    <div className="flex items-center gap-3 flex-wrap">
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
        <span className="text-xs text-muted-foreground">Kacheln:</span>
        
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
          <TooltipContent>Kleinere Kacheln (mehr Felder)</TooltipContent>
        </Tooltip>

        <span className="text-xs font-mono w-20 text-center">
          {gridCols}×{gridRows}
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
          <TooltipContent>Größere Kacheln (weniger Felder)</TooltipContent>
        </Tooltip>
      </div>

      {/* Title Block Toggle */}
      {onTitleBlockToggle && (
        <div className="flex items-center gap-2 ml-4 border-l pl-4">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <Label htmlFor="title-block-toggle" className="text-xs text-muted-foreground">
            Zeichenkopf
          </Label>
          <Switch
            id="title-block-toggle"
            checked={titleBlockData?.enabled || false}
            onCheckedChange={onTitleBlockToggle}
          />
          {titleBlockData?.enabled && onEditTitleBlock && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onEditTitleBlock}
                >
                  <Edit className="w-3 h-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zeichenkopf bearbeiten</TooltipContent>
            </Tooltip>
          )}
        </div>
      )}
    </div>
  );
}
