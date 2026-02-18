import { Component } from "@/types/schematic";
import { SavedPlanData } from "@/hooks/useSavedPlans";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { CONNECTION_BLOCKS } from "@/lib/connectionBlocks";
import { AppSettings } from "./SettingsDialog";

interface ProjectInfoDialogProps {
  plan: SavedPlanData | null;
  components: Component[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings?: AppSettings;
}

function findComponentById(componentId: string, components: Component[]): Component | undefined {
  const found = components.find(c => c.id === componentId);
  if (found) return found;
  return CONNECTION_BLOCKS.find(c => c.id === componentId);
}

function shouldShowComponent(comp: Component | undefined, settings?: AppSettings): boolean {
  if (!comp || !settings) return true;
  const isConn = comp.id.startsWith('connection-');
  const isMeasurement = !!comp.labelingEnabled;

  if (isConn) return settings.groupInfo.showConnectionComponents;
  if (isMeasurement) return settings.groupInfo.showMeasurementInstruments;
  return settings.groupInfo.showComponents;
}

export function ProjectInfoDialog({ plan, components, open, onOpenChange, settings }: ProjectInfoDialogProps) {
  if (!plan) return null;

  const componentList = plan.componentQuantities
    .map(cq => {
      const component = findComponentById(cq.componentId, components);
      return { id: cq.componentId, name: component?.name || 'Unbekannt', count: cq.quantity, component };
    })
    .filter(({ component }) => shouldShowComponent(component, settings));

  const totalTiles = plan.drawingData?.tiles?.length || 0;
  const connectionCount = plan.drawingData?.connections?.length || 0;
  const annotationLineCount = plan.drawingData?.annotationLines?.length || 0;
  const annotationTextCount = plan.drawingData?.annotationTexts?.length || 0;
  const showConnectionLines = settings ? settings.groupInfo.showConnectionLines : true;

  const formatMap: Record<string, string> = {
    'A5': 'A5', 'A4': 'A4', 'A3': 'A3', 'A2': 'A2', 'A1': 'A1',
    'Letter': 'Letter', 'Legal': 'Legal'
  };
  const orientationMap: Record<string, string> = {
    'landscape': 'Querformat', 'portrait': 'Hochformat'
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Projektinformationen
            <Badge variant="secondary">{plan.name}</Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Paper format & orientation */}
          {(plan.paperFormat || plan.orientation) && (
            <div className="flex gap-4 text-sm">
              {plan.paperFormat && (
                <div>
                  <span className="text-muted-foreground">Format: </span>
                  <span className="font-medium">{formatMap[plan.paperFormat] || plan.paperFormat}</span>
                </div>
              )}
              {plan.orientation && (
                <div>
                  <span className="text-muted-foreground">Orientierung: </span>
                  <span className="font-medium">{orientationMap[plan.orientation] || plan.orientation}</span>
                </div>
              )}
            </div>
          )}

          {/* Title block info */}
          {plan.titleBlockData && plan.titleBlockData.enabled && (
            <div className="space-y-1 text-sm border rounded-lg p-2 bg-muted/30">
              <p className="font-medium text-xs text-muted-foreground">Zeichenkopf</p>
              {plan.titleBlockData.projekt && <p>Projekt: {plan.titleBlockData.projekt}</p>}
              {plan.titleBlockData.zeichnungsNr && <p>Zeichnungs-Nr.: {plan.titleBlockData.zeichnungsNr}</p>}
              {plan.titleBlockData.blattNr && <p>Blatt: {plan.titleBlockData.blattNr}/{plan.titleBlockData.blattzahl}</p>}
              {plan.titleBlockData.gezeichnet?.name && (
                <p>Gezeichnet: {plan.titleBlockData.gezeichnet.name} ({plan.titleBlockData.gezeichnet.datum})</p>
              )}
            </div>
          )}

          {/* Component list */}
          <div className="text-sm text-muted-foreground">
            {componentList.length} Komponententyp{componentList.length !== 1 ? 'en' : ''}, {totalTiles} Kachel{totalTiles !== 1 ? 'n' : ''} gesamt:
          </div>
          <ScrollArea className="max-h-[250px]">
            <div className="space-y-2">
              {componentList.map(({ id, name, count }) => (
                <div
                  key={id}
                  className="flex items-center justify-center gap-3 p-2 rounded-lg border bg-muted/30"
                >
                  <span className="text-sm font-medium flex-1">{name}</span>
                  <Badge variant="outline">{count}×</Badge>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Stats */}
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {showConnectionLines && connectionCount > 0 && (
              <span>{connectionCount} Verbindung{connectionCount !== 1 ? 'en' : ''}</span>
            )}
            {annotationLineCount > 0 && (
              <span>{annotationLineCount} Markierungslinie{annotationLineCount !== 1 ? 'n' : ''}</span>
            )}
            {annotationTextCount > 0 && (
              <span>{annotationTextCount} Textfeld{annotationTextCount !== 1 ? 'er' : ''}</span>
            )}
          </div>

          {plan.createdAt && (
            <div className="text-xs text-muted-foreground">
              Erstellt: {new Date(plan.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
