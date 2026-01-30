import { TitleBlockData } from "@/types/schematic";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface TitleBlockEditorProps {
  open: boolean;
  data: TitleBlockData;
  onClose: () => void;
  onSave: (data: TitleBlockData) => void;
}

export function TitleBlockEditor({ open, data, onClose, onSave }: TitleBlockEditorProps) {
  // Format current date as DD.MM.YYYY
  const today = new Date();
  const currentDate = `${today.getDate().toString().padStart(2, '0')}.${(today.getMonth() + 1).toString().padStart(2, '0')}.${today.getFullYear()}`;
  
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const newData: TitleBlockData = {
      ...data,
      projekt: formData.get('projekt') as string || '',
      zeichnungsNr: formData.get('zeichnungsNr') as string || '',
      blattNr: formData.get('blattNr') as string || '',
      blattzahl: formData.get('blattzahl') as string || '',
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
    
    onSave(newData);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Zeichenkopf bearbeiten</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="projekt">Projekt</Label>
              <Input id="projekt" name="projekt" defaultValue={data.projekt} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zeichnungsNr">Zeichnungs-Nr.</Label>
              <Input id="zeichnungsNr" name="zeichnungsNr" defaultValue={data.zeichnungsNr} />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="blattNr">Blatt-Nr.</Label>
              <Input id="blattNr" name="blattNr" defaultValue={data.blattNr} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="blattzahl">Blattzahl</Label>
              <Input id="blattzahl" name="blattzahl" defaultValue={data.blattzahl} />
            </div>
          </div>
          
          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">Gezeichnet</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gezName">Name</Label>
                <Input id="gezName" name="gezName" defaultValue={data.gezeichnet.name} />
              </div>
              <div className="space-y-2">
              <Label htmlFor="gezDatum">Datum</Label>
                <Input id="gezDatum" name="gezDatum" defaultValue={data.gezeichnet.datum || currentDate} placeholder="TT.MM.JJJJ" />
              </div>
            </div>
          </div>
          
          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">Geprüft</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="geprName">Name</Label>
                <Input id="geprName" name="geprName" defaultValue={data.geprueft.name} />
              </div>
              <div className="space-y-2">
              <Label htmlFor="geprDatum">Datum</Label>
                <Input id="geprDatum" name="geprDatum" defaultValue={data.geprueft.datum || currentDate} placeholder="TT.MM.JJJJ" />
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="aenderungen">Änderungen</Label>
            <Textarea 
              id="aenderungen" 
              name="aenderungen" 
              defaultValue={data.aenderungen} 
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
