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

// BOM column config (mirrors BillOfMaterials.tsx)
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
  const [bundleAsPdf, setBundleAsPdf] = useState(true);

  // Individual export toggles
  const [exportDrawing, setExportDrawing] = useState(true);
  const [exportBOM, setExportBOM] = useState(true);
  const [exportMesskonzept, setExportMesskonzept] = useState(false);
  const [exportMopCsv, setExportMopCsv] = useState(false);

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

  // Persist column visibility
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
        id: `custom_${key}`,
        label: key,
        visible: columnVisibility[`custom_${key}`] !== false,
        isCustom: true,
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

  // --- Quick individual downloads ---
  const handleQuickDownloadDrawingPng = () => {
    onClose();
    onExportImage();
  };

  const handleQuickDownloadDrawingPdf = () => {
    onClose();
    onExportPdf({ includeBOM: false, includeMesskonzept: false });
  };

  const handleQuickDownloadBOM = () => {
    onExportBOMExcel();
  };

  const handleQuickDownloadMesskonzept = () => {
    onExportMesskonzeptExcel();
  };

  const handleQuickDownloadMop = () => {
    onClose();
    onExportMopCsv();
  };

  // --- Main export (bundled or individual) ---
  const handleExport = () => {
    if (exportMopCsv) {
      onExportMopCsv();
    }

    if (bundleAsPdf && (exportDrawing || exportBOM || exportMesskonzept)) {
      // Bundle as multi-page PDF
      const pdfOptions: PdfOptions = {
        includeBOM: exportBOM,
        includeMesskonzept: exportMesskonzept,
      };
      if (saveAsProject && projectName.trim()) {
        onSaveProjectAndExportPdf(projectName.trim(), pdfOptions);
      } else {
        onClose();
        onExportPdf(pdfOptions);
      }
    } else {
      // Export individually
      if (exportDrawing) {
        if (saveAsProject && projectName.trim()) {
          onSaveProjectAndExportImage(projectName.trim());
        } else {
          onClose();
          onExportImage();
        }
      } else if (saveAsProject && projectName.trim()) {
        // Save project without drawing export
        onSaveProjectAndExportImage(projectName.trim());
      } else {
        onClose();
      }
      if (exportBOM) onExportBOMExcel();
      if (exportMesskonzept) onExportMesskonzeptExcel();
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

  // Count bundled items
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
            <Switch
              checked={bundleAsPdf}
              onCheckedChange={setBundleAsPdf}
            />
          </div>

          <Separator />

          {/* --- Drawing --- */}
          <ExportRow
            icon={<Image className="w-4 h-4" />}
            label="Zeichnung"
            format={bundleAsPdf && exportDrawing ? "PDF-Seite" : "PNG / PDF"}
            checked={exportDrawing}
            onCheckedChange={setExportDrawing}
            onQuickDownload={handleQuickDownloadDrawingPng}
            secondaryDownload={
              <button
                type="button"
                onClick={handleQuickDownloadDrawingPdf}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
                title="Als PDF herunterladen"
              >
                PDF
              </button>
            }
            quickDownloadLabel="PNG"
          />

          {/* --- BOM --- */}
          <div className="space-y-0">
            <ExportRow
              icon={<FileSpreadsheet className="w-4 h-4" />}
              label="Stückliste"
              format={bundleAsPdf && exportBOM && exportDrawing ? "PDF-Seite" : "Excel"}
              checked={exportBOM}
              onCheckedChange={setExportBOM}
              onQuickDownload={handleQuickDownloadBOM}
              quickDownloadLabel="Excel"
            />
            {/* BOM column settings */}
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
          <ExportRow
            icon={<Activity className="w-4 h-4" />}
            label="Messkonzept"
            format={bundleAsPdf && exportMesskonzept && exportDrawing ? "PDF-Seite" : "Excel"}
            checked={exportMesskonzept}
            onCheckedChange={setExportMesskonzept}
            disabled={!hasMesskonzeptItems}
            disabledReason="Keine Messpunkte"
            onQuickDownload={handleQuickDownloadMesskonzept}
            quickDownloadLabel="Excel"
          />

          {/* --- M.O.P CSV --- */}
          <ExportRow
            icon={<Database className="w-4 h-4" />}
            label="M.O.P Import"
            format="CSV"
            checked={exportMopCsv}
            onCheckedChange={setExportMopCsv}
            onQuickDownload={handleQuickDownloadMop}
            quickDownloadLabel="CSV"
            noBundleInfo
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
          <Button
            onClick={handleExport}
            disabled={!canExport}
            className="gap-2"
          >
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

// --- Reusable row component ---

interface ExportRowProps {
  icon: React.ReactNode;
  label: string;
  format: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  onQuickDownload: () => void;
  quickDownloadLabel: string;
  disabled?: boolean;
  disabledReason?: string;
  secondaryDownload?: React.ReactNode;
  noBundleInfo?: boolean;
}

function ExportRow({
  icon,
  label,
  format,
  checked,
  onCheckedChange,
  onQuickDownload,
  quickDownloadLabel,
  disabled,
  disabledReason,
  secondaryDownload,
}: ExportRowProps) {
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
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
      </div>
      <Label className={cn("text-sm font-medium flex-1", disabled && "cursor-not-allowed")}>
        {label}
      </Label>
      <span className="text-xs text-muted-foreground">
        {disabled ? disabledReason : format}
      </span>
      {!disabled && (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onQuickDownload}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-muted"
            title={`${label} als ${quickDownloadLabel} herunterladen`}
          >
            <Download className="w-3 h-3" />
            <span>{quickDownloadLabel}</span>
          </button>
          {secondaryDownload}
        </div>
      )}
    </div>
  );
}
