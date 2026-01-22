import { Component, TitleBlockData, PaperFormat, Orientation } from "@/types/schematic";
import { isConnectionBlock } from "@/lib/connectionBlocks";
import { PlacedTile } from "./Canvas";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileSpreadsheet } from "lucide-react";
import * as XLSX from 'xlsx';

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
    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    
    // Build the data array for the worksheet
    const wsData: (string | number)[][] = [];
    
    // Title row (will be styled as header)
    wsData.push(['STÜCKLISTE', '', '', '']);
    wsData.push(['', '', '', '']); // Empty row
    
    // Project info
    if (titleBlockData.projekt) {
      wsData.push(['Projekt:', titleBlockData.projekt, '', '']);
    }
    if (titleBlockData.zeichnungsNr) {
      wsData.push(['Zeichnungs-Nr.:', titleBlockData.zeichnungsNr, '', '']);
    }
    wsData.push(['Erstellt am:', new Date().toLocaleDateString('de-DE'), '', '']);
    wsData.push(['', '', '', '']); // Empty row
    
    // Table header row
    const headerRowIndex = wsData.length;
    wsData.push(['Pos.', 'Benennung', 'Beschreibung', 'Menge']);
    
    // Data rows
    for (const item of bomItems) {
      wsData.push([
        item.position,
        item.name,
        item.description || '',
        item.quantity
      ]);
    }
    
    // Empty row before totals
    wsData.push(['', '', '', '']);
    
    // Totals row
    const totalCount = bomItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalRowIndex = wsData.length;
    wsData.push(['', '', 'Gesamt:', totalCount]);
    
    // Create worksheet from data
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 8 },   // Pos.
      { wch: 30 },  // Benennung
      { wch: 40 },  // Beschreibung
      { wch: 10 },  // Menge
    ];
    
    // Merge cells for title
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } } // Merge title row
    ];
    
    // Add the worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Stückliste');
    
    // Generate file and download
    const projektName = titleBlockData.projekt || 'Projekt';
    const fileName = `stueckliste-${projektName}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
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
