import { useState } from "react";
import { TitleBlockData } from "@/types/schematic";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface TitleBlockEditorProps {
  open: boolean;
  data: TitleBlockData;
  sheetCount?: number;
  allSheetData?: TitleBlockData[];
  onClose: () => void;
  onSave: (data: TitleBlockData, sheetIndex?: number) => void;
}

export function TitleBlockEditor({ open, data, sheetCount = 1, allSheetData, onClose, onSave }: TitleBlockEditorProps) {
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  
  // Get the data for the currently selected sheet
  const currentData = allSheetData && allSheetData[activeSheetIndex] ? allSheetData[activeSheetIndex] : data;
  
  // Format current date as DD.MM.YYYY
  const today = new Date();
  const currentDate = `${today.getDate().toString().padStart(2, '0')}.${(today.getMonth() + 1).toString().padStart(2, '0')}.${today.getFullYear()}`;
  
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const newData: TitleBlockData = {
      ...currentData,
      projekt: formData.get('projekt') as string || '',
      zeichnungsNr: formData.get('zeichnungsNr') as string || '',
      blattNr: String(activeSheetIndex + 1),
      blattzahl: String(sheetCount),
      aenderungen: formData.get('aenderungen') as string || '',
      gezeichnet: {
        name: formData.get('gezName') as string || '',
        datum: formData.get('gezDatum') as string || '',
      },
      geprueft: {
        name: formData.get('geprName') as string || '',
        datum: formData.get('geprDatum') as string || '',
      },
    };
    
    onSave(newData, sheetCount > 1 ? activeSheetIndex : undefined);
    onClose();
  };

  // Reset sheet index when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
    } else {
      setActiveSheetIndex(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Zeichenkopf bearbeiten</DialogTitle>
        </DialogHeader>
        
        {/* Sheet selector - only shown when multiple sheets exist */}
        {sheetCount > 1 && (
          <div className="border-b pb-3">
            <Label className="text-sm text-muted-foreground mb-2 block">Blatt auswählen:</Label>
            <ToggleGroup
              type="single"
              value={String(activeSheetIndex)}
              onValueChange={(val) => {
                if (val) setActiveSheetIndex(Number(val));
              }}
              className="justify-start"
            >
              {Array.from({ length: sheetCount }).map((_, i) => (
                <ToggleGroupItem key={i} value={String(i)} className="px-4">
                  Blatt {i + 1}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4" key={activeSheetIndex}>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="projekt">Projekt</Label>
              <Input id="projekt" name="projekt" defaultValue={currentData.projekt} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zeichnungsNr">Zeichnungs-Nr.</Label>
              <Input id="zeichnungsNr" name="zeichnungsNr" defaultValue={currentData.zeichnungsNr} />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Blatt-Nr.</Label>
              <Input value={`${activeSheetIndex + 1}`} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Blattzahl</Label>
              <Input value={`${sheetCount}`} disabled className="bg-muted" />
            </div>
          </div>
          
          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">Gezeichnet</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gezName">Name</Label>
                <Input id="gezName" name="gezName" defaultValue={currentData.gezeichnet.name} />
              </div>
              <div className="space-y-2">
              <Label htmlFor="gezDatum">Datum</Label>
                <Input id="gezDatum" name="gezDatum" defaultValue={currentData.gezeichnet.datum || currentDate} placeholder="TT.MM.JJJJ" />
              </div>
            </div>
          </div>
          
          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">Geprüft</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="geprName">Name</Label>
                <Input id="geprName" name="geprName" defaultValue={currentData.geprueft.name} />
              </div>
              <div className="space-y-2">
              <Label htmlFor="geprDatum">Datum</Label>
                <Input id="geprDatum" name="geprDatum" defaultValue={currentData.geprueft.datum || currentDate} placeholder="TT.MM.JJJJ" />
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="aenderungen">Änderungen</Label>
            <Textarea 
              id="aenderungen" 
              name="aenderungen" 
              defaultValue={currentData.aenderungen} 
              rows={3}
              placeholder="Änderungshistorie..."
            />
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Abbrechen</Button>
            <Button type="submit">Speichern</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
