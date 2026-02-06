import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { FolderPlus, Download, Image, FileText, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ExportFormat = 'image' | 'pdf';

interface ExportGroupDialogProps {
  open: boolean;
  onClose: () => void;
  onExportImage: () => void;
  onExportPdf: () => void;
  onSaveGroupAndExportImage: (groupName: string) => void;
  onSaveGroupAndExportPdf: (groupName: string) => void;
  hasTiles: boolean;
}

export function ExportGroupDialog({
  open,
  onClose,
  onExportImage,
  onExportPdf,
  onSaveGroupAndExportImage,
  onSaveGroupAndExportPdf,
  hasTiles,
}: ExportGroupDialogProps) {
  const [groupName, setGroupName] = useState("");
  const [saveAsGroup, setSaveAsGroup] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('image');

  const handleExport = () => {
    if (saveAsGroup && groupName.trim()) {
      if (selectedFormat === 'pdf') {
        onSaveGroupAndExportPdf(groupName.trim());
      } else {
        onSaveGroupAndExportImage(groupName.trim());
      }
    } else {
      if (selectedFormat === 'pdf') {
        onExportPdf();
      } else {
        onExportImage();
      }
    }
    setGroupName("");
    setSaveAsGroup(false);
  };

  const handleClose = () => {
    setGroupName("");
    setSaveAsGroup(false);
    onClose();
  };

  const canExport = !saveAsGroup || groupName.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Zeichnung exportieren</DialogTitle>
          <DialogDescription>
            Wählen Sie das Exportformat und speichern Sie optional die Zeichnung als Gruppe.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Format Selection */}
          <div className="space-y-2.5">
            <Label className="text-sm font-medium">Exportformat</Label>
            <div className="grid grid-cols-2 gap-3">
              {/* PNG Option */}
              <button
                type="button"
                onClick={() => setSelectedFormat('image')}
                className={cn(
                  "relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all hover:shadow-md",
                  selectedFormat === 'image'
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:border-muted-foreground/30"
                )}
              >
                {selectedFormat === 'image' && (
                  <CheckCircle2 className="absolute top-2 right-2 w-4 h-4 text-primary" />
                )}
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  selectedFormat === 'image' ? "bg-primary/10" : "bg-muted"
                )}>
                  <Image className={cn("w-5 h-5", selectedFormat === 'image' ? "text-primary" : "text-muted-foreground")} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">Bild (PNG)</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Hochauflösendes Bild</p>
                </div>
              </button>

              {/* PDF Option */}
              <button
                type="button"
                onClick={() => setSelectedFormat('pdf')}
                className={cn(
                  "relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all hover:shadow-md",
                  selectedFormat === 'pdf'
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:border-muted-foreground/30"
                )}
              >
                {selectedFormat === 'pdf' && (
                  <CheckCircle2 className="absolute top-2 right-2 w-4 h-4 text-primary" />
                )}
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  selectedFormat === 'pdf' ? "bg-primary/10" : "bg-muted"
                )}>
                  <FileText className={cn("w-5 h-5", selectedFormat === 'pdf' ? "text-primary" : "text-muted-foreground")} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">PDF (interaktiv)</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Klickbare Komponenten mit Stückliste</p>
                </div>
              </button>
            </div>
          </div>

          {/* Save as Group Section */}
          {hasTiles && (
            <div className="space-y-2.5">
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
            {saveAsGroup && <FolderPlus className="w-4 h-4" />}
            {!saveAsGroup && <Download className="w-4 h-4" />}
            {saveAsGroup
              ? `Speichern & als ${selectedFormat === 'pdf' ? 'PDF' : 'Bild'} exportieren`
              : `Als ${selectedFormat === 'pdf' ? 'PDF' : 'Bild'} exportieren`
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
