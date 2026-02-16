import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";
import {
  MopBereich,
  MopStatus,
  CsvDelimiter,
  MopComponent,
  MopExportParams,
  generateMopCsv,
  downloadCsv,
  extractProjectNumber,
} from "@/lib/mopCsvExport";

interface MopExportDialogProps {
  open: boolean;
  onClose: () => void;
  projectName: string;
  components: MopComponent[];
}

export function MopExportDialog({ open, onClose, projectName, components }: MopExportDialogProps) {
  const [projektNummer, setProjektNummer] = useState(() => extractProjectNumber(projectName));
  const [strasse, setStrasse] = useState("");
  const [bereich, setBereich] = useState<MopBereich>("Energielieferung");
  const [status, setStatus] = useState<MopStatus>("Realisierung");
  const [delimiter, setDelimiter] = useState<CsvDelimiter>(";");

  // Update project number when dialog opens with new project name
  const prevProjectName = useState(projectName)[0];
  if (projectName !== prevProjectName && open) {
    setProjektNummer(extractProjectNumber(projectName));
  }

  const canExport = projektNummer.trim().length > 0 && strasse.trim().length > 0;

  const preview = useMemo(() => {
    if (!canExport) return '';
    const params: MopExportParams = {
      projektNummer: projektNummer.trim(),
      strasse: strasse.trim(),
      bereich,
      status,
      delimiter,
      components: components.slice(0, 2), // Only preview first 2 components
    };
    return generateMopCsv(params);
  }, [projektNummer, strasse, bereich, status, delimiter, components, canExport]);

  const handleExport = () => {
    const params: MopExportParams = {
      projektNummer: projektNummer.trim(),
      strasse: strasse.trim(),
      bereich,
      status,
      delimiter,
      components,
    };
    const csv = generateMopCsv(params);
    const filename = `mop-import-${projektNummer.trim()}-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCsv(csv, filename);
    onClose();
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>M.O.P CSV-Export</DialogTitle>
          <DialogDescription>
            Projektdaten für den Import in M.O.P Technisches Objektmanagement exportieren.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="mop-projektnummer" className="text-sm">Projektnummer</Label>
              <Input
                id="mop-projektnummer"
                value={projektNummer}
                onChange={(e) => setProjektNummer(e.target.value)}
                placeholder="z.B. 10115"
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mop-strasse" className="text-sm">Straße / Adresse</Label>
              <Input
                id="mop-strasse"
                value={strasse}
                onChange={(e) => setStrasse(e.target.value)}
                placeholder="z.B. Musterstraße 1"
                className="text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Bereich</Label>
              <Select value={bereich} onValueChange={(v) => setBereich(v as MopBereich)}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Energielieferung">Energielieferung</SelectItem>
                  <SelectItem value="Fernwärmeoptimierung">Fernwärmeoptimierung</SelectItem>
                  <SelectItem value="Energiemonitoring">Energiemonitoring</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as MopStatus)}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Realisierung">Realisierung</SelectItem>
                  <SelectItem value="Betrieb">Betrieb</SelectItem>
                  <SelectItem value="Beendet">Beendet</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Trennzeichen</Label>
              <Select value={delimiter} onValueChange={(v) => setDelimiter(v as CsvDelimiter)}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=";">Semikolon (;)</SelectItem>
                  <SelectItem value=",">Komma (,)</SelectItem>
                  <SelectItem value={"\t"}>Tab</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Preview */}
          {canExport && (
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">Vorschau (erste Zeilen)</Label>
              <pre className="text-xs bg-muted/50 rounded-md p-3 overflow-x-auto max-h-40 font-mono whitespace-pre">
                {preview}
              </pre>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {components.length} Komponente{components.length !== 1 ? 'n' : ''} aus der Stückliste werden exportiert.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>
            Abbrechen
          </Button>
          <Button onClick={handleExport} disabled={!canExport} className="gap-2">
            <Download className="w-4 h-4" />
            CSV exportieren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
