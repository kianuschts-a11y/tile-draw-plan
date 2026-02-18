import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { FolderPlus, Download, Image, FileText, FileSpreadsheet, Activity, Database, Settings, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface PdfOptions {
  includeBOM?: boolean;
  includeMesskonzept?: boolean;
}

interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  isCustom?: boolean;
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'position', label: 'Pos.', visible: true },
  { id: 'name', label: 'Komponente', visible: true },
  { id: 'kategorie', label: 'Kategorie', visible: true },
  { id: 'marke', label: 'Marke', visible: true },
  { id: 'modell', label: 'Modell', visible: true },
  { id: 'quantity', label: 'Menge', visible: true },
  { id: 'preis', label: 'Preis', visible: true },
  { id: 'gesamtkosten', label: 'Gesamt', visible: true },
];

const BOM_COLUMNS_STORAGE_KEY = 'bom-column-visibility';

type DrawingFormat = 'png' | 'pdf';
type TableFormat = 'excel' | 'pdf';

interface ExportGroupDialogProps {
  open: boolean;
  onClose: () => void;
  onExportImage: () => void;
  onExportPdf: (options?: PdfOptions) => void;
  onExportBOMExcel: () => void;
  onExportMesskonzeptExcel: () => void;
  onExportMopCsv: () => void;
  onSaveProjectAndExportImage: (projectName: string) => void;
  onSaveProjectAndExportPdf: (projectName: string, options?: PdfOptions) => void;
  hasTiles: boolean;
  hasMesskonzeptItems: boolean;
  customFieldKeys?: string[];
}

export function ExportGroupDialog({
  open,
  onClose,
  onExportImage,
  onExportPdf,
  onExportBOMExcel,
  onExportMesskonzeptExcel,
  onExportMopCsv,
  onSaveProjectAndExportImage,
  onSaveProjectAndExportPdf,
  hasTiles,
  hasMesskonzeptItems,
  customFieldKeys = [],
}: ExportGroupDialogProps) {
  const [projectName, setProjectName] = useState("");
  const [saveAsProject, setSaveAsProject] = useState(false);
  const [bundleAsPdf, setBundleAsPdf] = useState(false);

  // Individual toggles
  const [exportDrawing, setExportDrawing] = useState(true);
  const [exportBOM, setExportBOM] = useState(true);
  const [exportMesskonzept, setExportMesskonzept] = useState(false);
  const [exportMopCsv, setExportMopCsv] = useState(false);

  // Per-document format (only used when NOT bundled)
  const [drawingFormat, setDrawingFormat] = useState<DrawingFormat>('png');
  const [bomFormat, setBomFormat] = useState<TableFormat>('excel');
  const [messkonzeptFormat, setMesskonzeptFormat] = useState<TableFormat>('excel');

  // BOM column settings
  const [bomSettingsOpen, setBomSettingsOpen] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(BOM_COLUMNS_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    const defaults: Record<string, boolean> = {};
    for (const col of DEFAULT_COLUMNS) defaults[col.id] = col.visible;
    return defaults;
  });

  useEffect(() => {
    try {
      localStorage.setItem(BOM_COLUMNS_STORAGE_KEY, JSON.stringify(columnVisibility));
    } catch { /* ignore */ }
  }, [columnVisibility]);

  const allColumns = useMemo(() => {
    const columns: ColumnConfig[] = [];
    const insertIndex = DEFAULT_COLUMNS.findIndex(c => c.id === 'quantity');
    for (let i = 0; i < insertIndex; i++) {
      const col = DEFAULT_COLUMNS[i];
      columns.push({ ...col, visible: columnVisibility[col.id] !== false });
    }
    for (const key of customFieldKeys) {
      columns.push({
        id: `custom_${key}`, label: key,
        visible: columnVisibility[`custom_${key}`] !== false, isCustom: true,
      });
    }
    for (let i = insertIndex; i < DEFAULT_COLUMNS.length; i++) {
      const col = DEFAULT_COLUMNS[i];
      columns.push({ ...col, visible: columnVisibility[col.id] !== false });
    }
    return columns;
  }, [customFieldKeys, columnVisibility]);

  const toggleColumnVisibility = (columnId: string) => {
    setColumnVisibility(prev => ({ ...prev, [columnId]: !prev[columnId] }));
  };

  // --- Quick individual download (right-side button) ---
  const downloadDrawing = (fmt: DrawingFormat) => {
    onClose();
    if (fmt === 'pdf') {
      onExportPdf({ includeBOM: false, includeMesskonzept: false });
    } else {
      onExportImage();
    }
  };

  const downloadBOM = (fmt: TableFormat) => {
    if (fmt === 'excel') {
      onExportBOMExcel();
    } else {
      // PDF = bundled PDF with only BOM
      onClose();
      onExportPdf({ includeBOM: true, includeMesskonzept: false });
    }
  };

  const downloadMesskonzept = (fmt: TableFormat) => {
    if (fmt === 'excel') {
      onExportMesskonzeptExcel();
    } else {
      onClose();
      onExportPdf({ includeBOM: false, includeMesskonzept: true });
    }
  };

  const downloadMop = () => {
    onClose();
    onExportMopCsv();
  };

  // --- Main export button ---
  const handleExport = () => {
    if (exportMopCsv) onExportMopCsv();

    if (bundleAsPdf) {
      // Everything selected goes into one PDF
      const pdfOptions: PdfOptions = {
        includeBOM: exportBOM,
        includeMesskonzept: exportMesskonzept,
      };
      if (saveAsProject && projectName.trim()) {
        onSaveProjectAndExportPdf(projectName.trim(), pdfOptions);
      } else {
        onClose();
        if (exportDrawing || exportBOM || exportMesskonzept) {
          onExportPdf(pdfOptions);
        }
      }
    } else {
      // Individual exports in chosen formats
      if (exportDrawing) {
        if (saveAsProject && projectName.trim()) {
          if (drawingFormat === 'pdf') {
            onSaveProjectAndExportPdf(projectName.trim(), { includeBOM: false, includeMesskonzept: false });
          } else {
            onSaveProjectAndExportImage(projectName.trim());
          }
        } else {
          onClose();
          downloadDrawing(drawingFormat);
        }
      } else if (saveAsProject && projectName.trim()) {
        onSaveProjectAndExportImage(projectName.trim());
      } else if (!exportBOM && !exportMesskonzept && !exportMopCsv) {
        onClose();
      }

      if (exportBOM) {
        if (bomFormat === 'excel') onExportBOMExcel();
        // bomFormat === 'pdf' not applicable standalone without drawing
      }
      if (exportMesskonzept) {
        if (messkonzeptFormat === 'excel') onExportMesskonzeptExcel();
      }

      // Close if we haven't already
      if (!exportDrawing && (exportBOM || exportMesskonzept)) {
        // Excel downloads don't close, so close manually
      }
    }

    setProjectName("");
    setSaveAsProject(false);
  };

  const handleClose = () => {
    setProjectName("");
    setSaveAsProject(false);
    onClose();
  };

  const hasAnyExportSelected = exportDrawing || exportBOM || exportMesskonzept || exportMopCsv;
  const canExport = hasAnyExportSelected && (!saveAsProject || projectName.trim().length > 0);

  const bundledCount = (exportDrawing ? 1 : 0) + (exportBOM ? 1 : 0) + (exportMesskonzept ? 1 : 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Exportieren</DialogTitle>
          <DialogDescription>
            Wählen Sie die Dokumente und das Format für den Export.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Bundle toggle */}
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Gebündeltes PDF</p>
                <p className="text-xs text-muted-foreground">
                  Zeichnung, Stückliste & Messkonzept als ein Dokument
                </p>
              </div>
            </div>
            <Switch checked={bundleAsPdf} onCheckedChange={setBundleAsPdf} />
          </div>

          <Separator />

          {/* --- Drawing --- */}
          <ExportItemRow
            icon={<Image className="w-4 h-4" />}
            label="Zeichnung"
            checked={exportDrawing}
            onCheckedChange={setExportDrawing}
            bundled={bundleAsPdf}
            bundledFormat="PDF"
            formats={['PNG', 'PDF']}
            selectedFormat={drawingFormat === 'png' ? 'PNG' : 'PDF'}
            onFormatChange={(f) => setDrawingFormat(f === 'PNG' ? 'png' : 'pdf')}
            onQuickDownload={(f) => downloadDrawing(f === 'PNG' ? 'png' : 'pdf')}
          />

          {/* --- BOM --- */}
          <div className="space-y-0">
            <ExportItemRow
              icon={<FileSpreadsheet className="w-4 h-4" />}
              label="Stückliste"
              checked={exportBOM}
              onCheckedChange={setExportBOM}
              bundled={bundleAsPdf}
              bundledFormat="PDF"
              formats={['Excel']}
              selectedFormat="Excel"
              onFormatChange={() => setBomFormat('excel')}
              onQuickDownload={() => onExportBOMExcel()}
            />
            {exportBOM && (
              <Collapsible open={bomSettingsOpen} onOpenChange={setBomSettingsOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors ml-10 mt-1 mb-1"
                  >
                    <Settings className="w-3 h-3" />
                    Spalten konfigurieren
                    {bomSettingsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-10 grid grid-cols-2 gap-1.5 pb-2">
                    {allColumns.map(col => (
                      <div key={col.id} className="flex items-center gap-1.5">
                        <Checkbox
                          id={`export-col-${col.id}`}
                          checked={col.visible}
                          onCheckedChange={() => toggleColumnVisibility(col.id)}
                          className="h-3.5 w-3.5"
                        />
                        <Label htmlFor={`export-col-${col.id}`} className="text-xs cursor-pointer">
                          {col.label}
                          {col.isCustom && <span className="text-muted-foreground ml-0.5">(Import)</span>}
                        </Label>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>

          {/* --- Messkonzept --- */}
          <ExportItemRow
            icon={<Activity className="w-4 h-4" />}
            label="Messkonzept"
            checked={exportMesskonzept}
            onCheckedChange={setExportMesskonzept}
            disabled={!hasMesskonzeptItems}
            disabledReason="Keine Messpunkte"
            bundled={bundleAsPdf}
            bundledFormat="PDF"
            formats={['Excel']}
            selectedFormat="Excel"
            onFormatChange={() => setMesskonzeptFormat('excel')}
            onQuickDownload={() => onExportMesskonzeptExcel()}
          />

          {/* --- M.O.P CSV --- */}
          <ExportItemRow
            icon={<Database className="w-4 h-4" />}
            label="M.O.P Import"
            checked={exportMopCsv}
            onCheckedChange={setExportMopCsv}
            bundled={false}
            bundledFormat=""
            formats={['CSV']}
            selectedFormat="CSV"
            onFormatChange={() => {}}
            onQuickDownload={() => downloadMop()}
            alwaysIndividual
          />

          {/* Bundle info */}
          {bundleAsPdf && bundledCount >= 2 && (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
              {bundledCount} Dokumente werden als gebündeltes PDF exportiert.
              {exportMopCsv && " M.O.P CSV wird separat exportiert."}
            </p>
          )}

          {/* Save as project */}
          {hasTiles && (
            <div className="space-y-2.5 border-t pt-3">
              <div className="flex items-center gap-2.5">
                <Checkbox
                  id="save-as-project"
                  checked={saveAsProject}
                  onCheckedChange={(checked) => setSaveAsProject(checked === true)}
                />
                <Label htmlFor="save-as-project" className="text-sm font-medium cursor-pointer">
                  Zeichnung als Projekt speichern
                </Label>
              </div>
              {saveAsProject && (
                <div className="pl-7">
                  <Input
                    id="project-name"
                    placeholder="z.B. Heizungsanlage EFH Müller"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && canExport) handleExport();
                    }}
                    autoFocus
                    className="text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Gespeicherte Projekte können später wiederverwendet werden.
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
          <Button onClick={handleExport} disabled={!canExport} className="gap-2">
            {saveAsProject ? <FolderPlus className="w-4 h-4" /> : <Download className="w-4 h-4" />}
            {saveAsProject
              ? "Speichern & exportieren"
              : bundleAsPdf && bundledCount >= 2
                ? "Als PDF exportieren"
                : "Exportieren"
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Reusable row ---

interface ExportItemRowProps {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  disabledReason?: string;
  bundled: boolean;
  bundledFormat: string;
  formats: string[];
  selectedFormat: string;
  onFormatChange: (format: string) => void;
  onQuickDownload: (format: string) => void;
  alwaysIndividual?: boolean;
}

function ExportItemRow({
  icon, label, checked, onCheckedChange,
  disabled, disabledReason,
  bundled, bundledFormat,
  formats, selectedFormat,
  onFormatChange, onQuickDownload,
  alwaysIndividual,
}: ExportItemRowProps) {
  const isBundled = bundled && !alwaysIndividual;
  const displayFormat = isBundled ? bundledFormat : selectedFormat;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border p-3 transition-colors",
        checked ? "border-primary/50 bg-primary/5" : "border-border",
        disabled && "opacity-50"
      )}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(c) => onCheckedChange(c === true)}
        disabled={disabled}
      />
      <div className="flex items-center gap-2 text-muted-foreground">{icon}</div>
      <span className={cn("text-sm font-medium flex-1", disabled && "cursor-not-allowed")}>
        {label}
      </span>

      {disabled ? (
        <span className="text-xs text-muted-foreground">{disabledReason}</span>
      ) : isBundled ? (
        /* Bundled mode: just show "PDF" label */
        <span className="text-xs text-muted-foreground">{bundledFormat}</span>
      ) : (
        /* Individual mode: format selector + download button */
        <div className="flex items-center gap-1.5">
          {formats.length > 1 ? (
            <div className="flex rounded-md border border-border overflow-hidden">
              {formats.map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => onFormatChange(f)}
                  className={cn(
                    "px-2 py-0.5 text-xs transition-colors",
                    selectedFormat === f
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">{formats[0]}</span>
          )}
          <button
            type="button"
            onClick={() => onQuickDownload(displayFormat)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-muted"
            title={`${label} als ${displayFormat} herunterladen`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>{displayFormat}</span>
          </button>
        </div>
      )}
    </div>
  );
}
