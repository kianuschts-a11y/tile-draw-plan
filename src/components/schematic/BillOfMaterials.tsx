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
  kategorie: string;
  description: string;
  quantity: number;
  preis: number;
  gesamtkosten: number;
  instanceIndex?: number;
}

interface BillOfMaterialsProps {
  open: boolean;
  onClose: () => void;
  tiles: PlacedTile[];
  titleBlockData: TitleBlockData;
  paperFormat: PaperFormat;
  orientation: Orientation;
  projectDescriptions: Map<string, string[]>;
  projectKategorien: Map<string, string>;
  projectPreise: Map<string, number>;
}

export function BillOfMaterials({ 
  open, 
  onClose, 
  tiles, 
  titleBlockData,
  paperFormat,
  orientation,
  projectDescriptions,
  projectKategorien,
  projectPreise
}: BillOfMaterialsProps) {
  
  // Calculate BOM from placed tiles with descriptions
  const bomItems: BillOfMaterialsItem[] = (() => {
    const componentCounts = new Map<string, { component: Component; count: number }>();
    
    for (const tile of tiles) {
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
    
    const sortedEntries = Array.from(componentCounts.entries())
      .sort(([, a], [, b]) => a.component.name.localeCompare(b.component.name));
    
    for (const [id, { component, count }] of sortedEntries) {
      const descriptions = projectDescriptions.get(id) || [];
      const kategorie = projectKategorien.get(id) || '';
      const preis = projectPreise.get(id) || 0;
      const hasDescriptions = descriptions.some(d => d && d.trim() !== '');
      
      if (hasDescriptions) {
        for (let i = 0; i < count; i++) {
          items.push({
            position: position++,
            componentId: id,
            name: component.name,
            kategorie,
            description: descriptions[i] || '',
            quantity: 1,
            preis,
            gesamtkosten: preis,
            instanceIndex: i
          });
        }
      } else {
        items.push({
          position: position++,
          componentId: id,
          name: component.name,
          kategorie,
          description: '',
          quantity: count,
          preis,
          gesamtkosten: preis * count
        });
      }
    }
    
    return items;
  })();

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const wsData: (string | number)[][] = [];
    
    // Title row
    wsData.push(['STÜCKLISTE', '', '', '', '', '', '']);
    wsData.push(['', '', '', '', '', '', '']);
    
    // Project info
    if (titleBlockData.projekt) {
      wsData.push(['Projekt:', titleBlockData.projekt, '', '', '', '', '']);
    }
    if (titleBlockData.zeichnungsNr) {
      wsData.push(['Zeichnungs-Nr.:', titleBlockData.zeichnungsNr, '', '', '', '', '']);
    }
    wsData.push(['Erstellt am:', new Date().toLocaleDateString('de-DE'), '', '', '', '', '']);
    wsData.push(['', '', '', '', '', '', '']);
    
    // Table header row
    const headerRowIndex = wsData.length;
    wsData.push(['Pos.', 'Benennung', 'Kategorie', 'Beschreibung', 'Menge', 'Preis (€)', 'Gesamt (€)']);
    
    // Data rows
    for (const item of bomItems) {
      wsData.push([
        item.position,
        item.name,
        item.kategorie || '',
        item.description || '',
        item.quantity,
        item.preis || '',
        item.gesamtkosten || ''
      ]);
    }
    
    // Empty row before totals
    wsData.push(['', '', '', '', '', '', '']);
    
    // Totals row
    const totalCount = bomItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalKosten = bomItems.reduce((sum, item) => sum + item.gesamtkosten, 0);
    wsData.push(['', '', '', 'GESAMT:', totalCount, '', totalKosten > 0 ? totalKosten : '']);
    
    // Create worksheet from data
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 6 },   // Pos.
      { wch: 25 },  // Benennung
      { wch: 18 },  // Kategorie
      { wch: 35 },  // Beschreibung
      { wch: 8 },   // Menge
      { wch: 12 },  // Preis
      { wch: 12 },  // Gesamt
    ];
    
    // Set row heights (in points, 1 point = 1/72 inch)
    const rowCount = wsData.length;
    ws['!rows'] = [];
    for (let i = 0; i < rowCount; i++) {
      if (i === 0) {
        // Title row - larger
        ws['!rows'].push({ hpt: 28 });
      } else if (i === headerRowIndex) {
        // Header row - medium height
        ws['!rows'].push({ hpt: 24 });
      } else {
        // Data rows - comfortable height
        ws['!rows'].push({ hpt: 20 });
      }
    }
    
    // Merge cells for title
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }
    ];
    
    // Add the worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Stückliste');
    
    // Generate file and download
    const projektName = titleBlockData.projekt || 'Projekt';
    const fileName = `stueckliste-${projektName}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const totalQuantity = bomItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalKosten = bomItems.reduce((sum, item) => sum + item.gesamtkosten, 0);
  const uniquePositions = new Set(bomItems.map(item => item.componentId)).size;

  const formatCurrency = (value: number) => {
    if (!value) return '–';
    return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
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
                <TableHead className="w-12">Pos.</TableHead>
                <TableHead>Benennung</TableHead>
                <TableHead className="w-32">Kategorie</TableHead>
                <TableHead>Beschreibung</TableHead>
                <TableHead className="w-16 text-center">Menge</TableHead>
                <TableHead className="w-24 text-right">Preis</TableHead>
                <TableHead className="w-24 text-right">Gesamt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bomItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Keine Komponenten platziert
                  </TableCell>
                </TableRow>
              ) : (
                bomItems.map((item, index) => (
                  <TableRow key={`${item.componentId}-${item.instanceIndex ?? index}`}>
                    <TableCell className="font-medium">{item.position}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell className={item.kategorie ? '' : 'text-muted-foreground'}>
                      {item.kategorie || '–'}
                    </TableCell>
                    <TableCell className={item.description ? '' : 'text-muted-foreground'}>
                      {item.description || '–'}
                    </TableCell>
                    <TableCell className="text-center">{item.quantity}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.preis)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.gesamtkosten)}
                    </TableCell>
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
          <div className="flex items-center gap-6">
            <span className="font-medium">
              Gesamt: {totalQuantity} Teil{totalQuantity !== 1 ? 'e' : ''}
            </span>
            {totalKosten > 0 && (
              <span className="font-bold text-primary">
                Gesamtkosten: {formatCurrency(totalKosten)}
              </span>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
