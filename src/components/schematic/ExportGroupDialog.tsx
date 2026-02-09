import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { FolderPlus, Download, Image, FileText, CheckCircle2, FileSpreadsheet, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

type DrawingFormat = 'image' | 'pdf';

interface ExportGroupDialogProps {
  open: boolean;
  onClose: () => void;
  onExportImage: () => void;
  onExportPdf: () => void;
  onExportBOMExcel: () => void;
  onExportMesskonzeptExcel: () => void;
  onSaveGroupAndExportImage: (groupName: string) => void;
  onSaveGroupAndExportPdf: (groupName: string) => void;
  hasTiles: boolean;
  hasMesskonzeptItems: boolean;
}

export function ExportGroupDialog({
  open,
  onClose,
  onExportImage,
  onExportPdf,
  onExportBOMExcel,
  onExportMesskonzeptExcel,
  onSaveGroupAndExportImage,
  onSaveGroupAndExportPdf,
  hasTiles,
  hasMesskonzeptItems,
}: ExportGroupDialogProps) {
  const [groupName, setGroupName] = useState("");
  const [saveAsGroup, setSaveAsGroup] = useState(false);
  const [drawingFormat, setDrawingFormat] = useState<DrawingFormat>('image');
  
  // Export checkboxes
  const [exportDrawing, setExportDrawing] = useState(true);
  const [exportBOM, setExportBOM] = useState(false);
  const [exportMesskonzept, setExportMesskonzept] = useState(false);

  const handleExport = () => {
    // Export drawing
    if (exportDrawing) {
      if (saveAsGroup && groupName.trim()) {
        if (drawingFormat === 'pdf') {
          onSaveGroupAndExportPdf(groupName.trim());
        } else {
          onSaveGroupAndExportImage(groupName.trim());
        }
      } else {
        if (drawingFormat === 'pdf') {
          onExportPdf();
        } else {
          onExportImage();
        }
      }
    } else if (saveAsGroup && groupName.trim()) {
      // If only saving group without drawing export, still save the group
      // Use image export path which also saves the group
      onSaveGroupAndExportImage(groupName.trim());
    }

    // Export BOM
    if (exportBOM) {
      onExportBOMExcel();
    }

    // Export Messkonzept
    if (exportMesskonzept) {
      onExportMesskonzeptExcel();
    }

    // Close dialog if no drawing export was triggered (those close via their own handlers)
    if (!exportDrawing && !saveAsGroup) {
      onClose();
    }

    // Reset state
    setGroupName("");
    setSaveAsGroup(false);
  };

  const handleClose = () => {
    setGroupName("");
    setSaveAsGroup(false);
    setExportDrawing(true);
    setExportBOM(false);
    setExportMesskonzept(false);
    onClose();
  };

  const hasAnyExportSelected = exportDrawing || exportBOM || exportMesskonzept;
  const canExport = hasAnyExportSelected && (!saveAsGroup || groupName.trim().length > 0);

  // Count selected exports
  const selectedCount = [exportDrawing, exportBOM, exportMesskonzept].filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Exportieren</DialogTitle>
          <DialogDescription>
            Wählen Sie, was exportiert werden soll.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Export Items Selection */}
          <div className="space-y-3">
            {/* Drawing Export */}
            <div className="space-y-3">
              <div
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                  exportDrawing ? "border-primary/50 bg-primary/5" : "border-border"
                )}
              >
                <Checkbox
                  id="export-drawing"
                  checked={exportDrawing}
                  onCheckedChange={(checked) => setExportDrawing(checked === true)}
                  className="mt-0.5"
                />
                <div className="flex-1 space-y-2.5">
                  <Label htmlFor="export-drawing" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                    <Image className="w-4 h-4 text-muted-foreground" />
                    Zeichnung
                  </Label>
                  
                  {/* Format Selection - only shown when drawing is checked */}
                  {exportDrawing && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setDrawingFormat('image')}
                        className={cn(
                          "relative flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all text-sm",
                          drawingFormat === 'image'
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-muted-foreground/30"
                        )}
                      >
                        {drawingFormat === 'image' && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        )}
                        <div>
                          <p className="font-medium">PNG</p>
                          <p className="text-xs text-muted-foreground">Hochauflösend</p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDrawingFormat('pdf')}
                        className={cn(
                          "relative flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all text-sm",
                          drawingFormat === 'pdf'
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-muted-foreground/30"
                        )}
                      >
                        {drawingFormat === 'pdf' && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        )}
                        <div>
                          <p className="font-medium">PDF</p>
                          <p className="text-xs text-muted-foreground">Interaktiv + Stückliste</p>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* BOM Export */}
              <div
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3 transition-colors",
                  exportBOM ? "border-primary/50 bg-primary/5" : "border-border"
                )}
              >
                <Checkbox
                  id="export-bom"
                  checked={exportBOM}
                  onCheckedChange={(checked) => setExportBOM(checked === true)}
                />
                <Label htmlFor="export-bom" className="text-sm font-medium cursor-pointer flex items-center gap-2 flex-1">
                  <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
                  Stückliste
                  <span className="text-xs text-muted-foreground font-normal ml-auto">Excel</span>
                </Label>
              </div>

              {/* Messkonzept Export */}
              <div
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3 transition-colors",
                  exportMesskonzept ? "border-primary/50 bg-primary/5" : "border-border",
                  !hasMesskonzeptItems && "opacity-50"
                )}
              >
                <Checkbox
                  id="export-messkonzept"
                  checked={exportMesskonzept}
                  onCheckedChange={(checked) => setExportMesskonzept(checked === true)}
                  disabled={!hasMesskonzeptItems}
                />
                <Label 
                  htmlFor="export-messkonzept" 
                  className={cn(
                    "text-sm font-medium cursor-pointer flex items-center gap-2 flex-1",
                    !hasMesskonzeptItems && "cursor-not-allowed"
                  )}
                >
                  <Activity className="w-4 h-4 text-muted-foreground" />
                  Messkonzept
                  <span className="text-xs text-muted-foreground font-normal ml-auto">
                    {hasMesskonzeptItems ? 'Excel' : 'Keine Messpunkte'}
                  </span>
                </Label>
              </div>
            </div>
          </div>

          {/* Save as Group Section */}
          {hasTiles && (
            <div className="space-y-2.5 border-t pt-4">
              <div className="flex items-center gap-2.5">
                <Checkbox
                  id="save-as-group"
                  checked={saveAsGroup}
                  onCheckedChange={(checked) => setSaveAsGroup(checked === true)}
                />
                <Label htmlFor="save-as-group" className="text-sm font-medium cursor-pointer">
                  Zeichnung als Gruppe speichern
                </Label>
              </div>
              {saveAsGroup && (
                <div className="pl-7">
                  <Input
                    id="group-name"
                    placeholder="z.B. Standardschaltung Wohnzimmer"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && canExport) {
                        handleExport();
                      }
                    }}
                    autoFocus
                    className="text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Gespeicherte Gruppen verbessern zukünftige Vorschläge.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>
            Abbrechen
          </Button>
          <Button
            onClick={handleExport}
            disabled={!canExport}
            className="gap-2"
          >
            {saveAsGroup ? <FolderPlus className="w-4 h-4" /> : <Download className="w-4 h-4" />}
            {saveAsGroup
              ? `Speichern & exportieren`
              : selectedCount > 1
                ? `${selectedCount} Dateien exportieren`
                : `Exportieren`
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
