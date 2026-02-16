import { ZoomIn, ZoomOut, RotateCcw, Download, FileText, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

interface HeaderActionsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onExport: () => void;
  onOpenBOM: () => void;
  onOpenMesskonzept: () => void;
}

export function HeaderActions({
  onZoomIn,
  onZoomOut,
  onResetView,
  onExport,
  onOpenBOM,
  onOpenMesskonzept
}: HeaderActionsProps) {
  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onZoomIn}
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Vergrößern (+)</TooltipContent>
      </Tooltip>
      
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onZoomOut}
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Verkleinern (-)</TooltipContent>
      </Tooltip>
      
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onResetView}
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Ansicht zurücksetzen (0)</TooltipContent>
      </Tooltip>
      
      <Separator orientation="vertical" className="h-6 mx-1" />
      
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onExport}
          >
            <Download className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Exportieren (E)</TooltipContent>
      </Tooltip>
      
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onOpenBOM}
          >
            <FileText className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Stückliste (B)</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onOpenMesskonzept}
          >
            <Activity className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Messkonzept (M)</TooltipContent>
      </Tooltip>
    </div>
  );
}