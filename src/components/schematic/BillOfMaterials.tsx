import { Component, TitleBlockData, PaperFormat, Orientation } from "@/types/schematic";
import { isConnectionBlock } from "@/lib/connectionBlocks";
import { PlacedTile } from "./Canvas";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileSpreadsheet } from "lucide-react";

interface BillOfMaterialsItem {
  position: number;
  componentId: string;
  name: string;
  description: string;
  quantity: number;
  instanceIndex?: number; // For individual items with descriptions
}

interface BillOfMaterialsProps {
  open: boolean;
  onClose: () => void;
  tiles: PlacedTile[];
  titleBlockData: TitleBlockData;
  paperFormat: PaperFormat;
  orientation: Orientation;
  projectDescriptions: Map<string, string[]>;
}

export function BillOfMaterials({ 
  open, 
  onClose, 
  tiles, 
  titleBlockData,
  paperFormat,
  orientation,
  projectDescriptions
}: BillOfMaterialsProps) {
  
  // Calculate BOM from placed tiles with descriptions
  const bomItems: BillOfMaterialsItem[] = (() => {
    const componentCounts = new Map<string, { component: Component; count: number }>();
    
    for (const tile of tiles) {
      // Exclude connection blocks from BOM - they are not actual components
      if (isConnectionBlock(tile.component)) {
        continue;
      }
      
      const existing = componentCounts.get(tile.component.id);
      if (existing) {
        existing.count++;
      } else {
        componentCounts.set(tile.component.id, { component: tile.component, count: 1 });
      }
    }
    
    const items: BillOfMaterialsItem[] = [];
    let position = 1;
    
    // Sort by name first
    const sortedEntries = Array.from(componentCounts.entries())
      .sort(([, a], [, b]) => a.component.name.localeCompare(b.component.name));
    
    for (const [id, { component, count }] of sortedEntries) {
      const descriptions = projectDescriptions.get(id) || [];
      const hasDescriptions = descriptions.some(d => d && d.trim() !== '');
      
      if (hasDescriptions) {
        // Create individual items for each instance with description
        for (let i = 0; i < count; i++) {
          items.push({
            position: position++,
            componentId: id,
            name: component.name,
            description: descriptions[i] || '',
            quantity: 1,
            instanceIndex: i
          });
        }
      } else {
        // Single grouped item without descriptions
        items.push({
          position: position++,
          componentId: id,
          name: component.name,
          description: '',
          quantity: count
        });
      }
    }
    
    return items;
  })();

  const handleExportExcel = () => {
    // Create CSV content for Excel
    const headers = ['Pos.', 'Benennung', 'Beschreibung', 'Menge'];
    const csvRows: string[] = [];
    
    // Add BOM header
    csvRows.push('Stückliste');
    if (titleBlockData.projekt) {
      csvRows.push(`Projekt:;${titleBlockData.projekt}`);
    }
    if (titleBlockData.zeichnungsNr) {
      csvRows.push(`Zeichnungs-Nr.:;${titleBlockData.zeichnungsNr}`);
    }
    csvRows.push(''); // Empty row
    
    // Add table headers
    csvRows.push(headers.join(';'));
    
    // Add data rows
    for (const item of bomItems) {
      const row = [
        String(item.position),
        item.name,
        item.description || '',
        String(item.quantity)
      ];
      // Escape fields with semicolons or quotes
      const escapedRow = row.map(field => {
        if (field.includes(';') || field.includes('"') || field.includes('\n')) {
          return `"${field.replace(/"/g, '""')}"`;
        }
        return field;
      });
      csvRows.push(escapedRow.join(';'));
    }
    
    // Add totals
    csvRows.push(''); // Empty row
    const totalCount = bomItems.reduce((sum, item) => sum + item.quantity, 0);
    csvRows.push(`Gesamt:;;${totalCount} Teile`);
    csvRows.push(`Erstellt am:;${new Date().toLocaleDateString('de-DE')}`);
    
    // Create CSV with BOM for Excel UTF-8 compatibility
    const BOM = '\uFEFF';
    const csvContent = BOM + csvRows.join('\r\n');
    
    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const projektName = titleBlockData.projekt || 'Projekt';
    link.download = `stueckliste-${projektName}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const totalQuantity = bomItems.reduce((sum, item) => sum + item.quantity, 0);
  const uniquePositions = new Set(bomItems.map(item => item.componentId)).size;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-8">
            <span>Stückliste</span>
            <Button onClick={handleExportExcel} size="sm" className="gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              Als Excel exportieren
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        {titleBlockData.projekt && (
          <div className="text-sm text-muted-foreground mb-2">
            Projekt: <span className="font-medium text-foreground">{titleBlockData.projekt}</span>
            {titleBlockData.zeichnungsNr && (
              <span className="ml-4">Zeichnungs-Nr.: <span className="font-medium text-foreground">{titleBlockData.zeichnungsNr}</span></span>
            )}
          </div>
        )}

        <div className="flex-1 overflow-auto border rounded-md">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-16">Pos.</TableHead>
                <TableHead>Benennung</TableHead>
                <TableHead>Beschreibung</TableHead>
                <TableHead className="w-20 text-right">Menge</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bomItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Keine Komponenten platziert
                  </TableCell>
                </TableRow>
              ) : (
                bomItems.map((item, index) => (
                  <TableRow key={`${item.componentId}-${item.instanceIndex ?? index}`}>
                    <TableCell className="font-medium">{item.position}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell className={item.description ? '' : 'text-muted-foreground'}>
                      {item.description || '–'}
                    </TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-between items-center pt-2 border-t">
          <span className="text-sm text-muted-foreground">
            {bomItems.length} Position{bomItems.length !== 1 ? 'en' : ''} ({uniquePositions} Komponenten-Typ{uniquePositions !== 1 ? 'en' : ''})
          </span>
          <span className="font-medium">
            Gesamt: {totalQuantity} Teil{totalQuantity !== 1 ? 'e' : ''}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
