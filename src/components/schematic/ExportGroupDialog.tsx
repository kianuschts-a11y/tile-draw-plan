import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { FolderPlus, Download, Image, FileText, CheckCircle2, FileSpreadsheet, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

type DrawingFormat = 'image' | 'pdf';

interface PdfOptions {
  includeBOM?: boolean;
  includeMesskonzept?: boolean;
}

interface ExportGroupDialogProps {
  open: boolean;
  onClose: () => void;
  onExportImage: () => void;
  onExportPdf: (options?: PdfOptions) => void;
  onExportBOMExcel: () => void;
  onExportMesskonzeptExcel: () => void;
  onSaveGroupAndExportImage: (groupName: string) => void;
  onSaveGroupAndExportPdf: (groupName: string, options?: PdfOptions) => void;
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
  const [drawingFormat, setDrawingFormat] = useState<DrawingFormat>('pdf');
  
  // Export checkboxes
  const [exportDrawing, setExportDrawing] = useState(true);
  const [exportBOM, setExportBOM] = useState(true);
  const [exportMesskonzept, setExportMesskonzept] = useState(false);

  const handleExport = () => {
    const isPdf = drawingFormat === 'pdf';
    const pdfOptions: PdfOptions = {
      includeBOM: exportBOM,
      includeMesskonzept: exportMesskonzept,
    };

    // When PDF format is selected: BOM and Messkonzept are included as PDF pages
    // When PNG format is selected: BOM and Messkonzept are exported as separate Excel files

    if (exportDrawing) {
      if (saveAsGroup && groupName.trim()) {
        if (isPdf) {
          onSaveGroupAndExportPdf(groupName.trim(), pdfOptions);
        } else {
          onSaveGroupAndExportImage(groupName.trim());
          // Export BOM/Messkonzept as separate Excel files for PNG
          if (exportBOM) onExportBOMExcel();
          if (exportMesskonzept) onExportMesskonzeptExcel();
        }
      } else {
        if (isPdf) {
          onExportPdf(pdfOptions);
        } else {
          onExportImage();
          // Export BOM/Messkonzept as separate Excel files for PNG
          if (exportBOM) onExportBOMExcel();
          if (exportMesskonzept) onExportMesskonzeptExcel();
        }
      }
    } else {
      // No drawing export - export BOM/Messkonzept as Excel
      if (exportBOM) onExportBOMExcel();
      if (exportMesskonzept) onExportMesskonzeptExcel();
      
      if (saveAsGroup && groupName.trim()) {
        onSaveGroupAndExportImage(groupName.trim());
      } else {
        onClose();
      }
    }

    // Reset state
    setGroupName("");
    setSaveAsGroup(false);
  };

  const handleClose = () => {
    setGroupName("");
    setSaveAsGroup(false);
    onClose();
  };

  const hasAnyExportSelected = exportDrawing || exportBOM || exportMesskonzept;
  const canExport = hasAnyExportSelected && (!saveAsGroup || groupName.trim().length > 0);

  // Determine what the user will get
  const isPdf = drawingFormat === 'pdf' && exportDrawing;
  const bomInPdf = isPdf && exportBOM;
  const messkonzeptInPdf = isPdf && exportMesskonzept;

  // Count output files
  const fileCount = (() => {
    let count = 0;
    if (exportDrawing) count++; // PNG or PDF
    if (exportBOM && !bomInPdf) count++; // Separate Excel
    if (exportMesskonzept && !messkonzeptInPdf) count++; // Separate Excel
    return count;
  })();

  // Count pages in PDF
  const pdfPageCount = (() => {
    if (!isPdf) return 0;
    let pages = 1; // Drawing
    if (bomInPdf) pages++;
    if (messkonzeptInPdf) pages++;
    return pages;
  })();

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
                        <p className="text-xs text-muted-foreground">Interaktiv</p>
                      </div>
                    </button>

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
                <span className="text-xs text-muted-foreground font-normal ml-auto">
                  {bomInPdf ? 'In PDF enthalten' : 'Excel'}
                </span>
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
                  {!hasMesskonzeptItems ? 'Keine Messpunkte' : messkonzeptInPdf ? 'In PDF enthalten' : 'Excel'}
                </span>
              </Label>
            </div>
          </div>

          {/* Info about combined PDF */}
          {isPdf && (bomInPdf || messkonzeptInPdf) && (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
              Zeichnung{bomInPdf ? ', Stückliste' : ''}{messkonzeptInPdf ? ', Messkonzept' : ''} werden als {pdfPageCount}-seitiges PDF exportiert.
            </p>
          )}

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
              : fileCount > 1
                ? `${fileCount} Dateien exportieren`
                : `Exportieren`
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
