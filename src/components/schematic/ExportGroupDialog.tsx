import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FolderPlus, Download } from "lucide-react";

interface ExportGroupDialogProps {
  open: boolean;
  onClose: () => void;
  onExportOnly: () => void;
  onSaveGroupAndExport: (groupName: string) => void;
  hasTiles: boolean;
}

export function ExportGroupDialog({
  open,
  onClose,
  onExportOnly,
  onSaveGroupAndExport,
  hasTiles,
}: ExportGroupDialogProps) {
  const [groupName, setGroupName] = useState("");

  const handleSaveAndExport = () => {
    if (!groupName.trim()) return;
    onSaveGroupAndExport(groupName.trim());
    setGroupName("");
  };

  const handleExportOnly = () => {
    onExportOnly();
    setGroupName("");
  };

  const handleClose = () => {
    setGroupName("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Zeichnung exportieren</DialogTitle>
          <DialogDescription>
            Möchten Sie die aktuelle Zeichnung als Gruppe speichern? 
            Gespeicherte Gruppen verbessern zukünftige Vorschläge.
          </DialogDescription>
        </DialogHeader>

        {hasTiles && (
          <div className="space-y-3 py-2">
            <Label htmlFor="group-name">Gruppenname</Label>
            <Input
              id="group-name"
              placeholder="z.B. Standardschaltung Wohnzimmer"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && groupName.trim()) {
                  handleSaveAndExport();
                }
              }}
            />
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:gap-2">
          {hasTiles && (
            <Button
              onClick={handleSaveAndExport}
              disabled={!groupName.trim()}
              className="gap-2"
            >
              <FolderPlus className="w-4 h-4" />
              Als Gruppe speichern & exportieren
            </Button>
          )}
          <Button variant="outline" onClick={handleExportOnly} className="gap-2">
            <Download className="w-4 h-4" />
            Nur exportieren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
