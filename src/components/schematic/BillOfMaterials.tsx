import { useState, useMemo, useEffect } from "react";
import { Component, TitleBlockData, PaperFormat, Orientation } from "@/types/schematic";
import { isConnectionBlock } from "@/lib/connectionBlocks";
import { PlacedTile } from "./Canvas";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileSpreadsheet, Settings, Eye, EyeOff } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import * as XLSX from 'xlsx';

// Default columns that are always available
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

interface BillOfMaterialsItem {
  position: number;
  componentId: string;
  name: string;
  kategorie: string;
  marke: string;
  modell: string;
  quantity: number;
  preis: number;
  gesamtkosten: number;
  customFields: Record<string, string | number>;
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
  projectMarken: Map<string, string>;
  projectModelle: Map<string, string>;
  projectCustomFields: Map<string, Record<string, string | number>>;
  excludedCategories?: string[];
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
  projectPreise,
  projectMarken,
  projectModelle,
  projectCustomFields,
  excludedCategories = []
}: BillOfMaterialsProps) {
  
  // Get all unique custom field keys from project data
  const customFieldKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const fields of projectCustomFields.values()) {
      for (const key of Object.keys(fields)) {
        keys.add(key);
      }
    }
    return Array.from(keys);
  }, [projectCustomFields]);

  // Build column configuration with custom fields
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(BOM_COLUMNS_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load column visibility:', e);
    }
    // Default all visible
    const defaults: Record<string, boolean> = {};
    for (const col of DEFAULT_COLUMNS) {
      defaults[col.id] = col.visible;
    }
    return defaults;
  });

  // Update localStorage when visibility changes
  useEffect(() => {
    try {
      localStorage.setItem(BOM_COLUMNS_STORAGE_KEY, JSON.stringify(columnVisibility));
    } catch (e) {
      console.error('Failed to save column visibility:', e);
    }
  }, [columnVisibility]);

  // All columns including custom fields (inserted before "Menge")
  const allColumns = useMemo(() => {
    const columns: ColumnConfig[] = [];
    
    // Add default columns up to and including "modell"
    const insertIndex = DEFAULT_COLUMNS.findIndex(c => c.id === 'quantity');
    
    for (let i = 0; i < insertIndex; i++) {
      const col = DEFAULT_COLUMNS[i];
      columns.push({
        ...col,
        visible: columnVisibility[col.id] !== false
      });
    }
    
    // Add custom field columns (before Menge)
    for (const key of customFieldKeys) {
      columns.push({
        id: `custom_${key}`,
        label: key,
        visible: columnVisibility[`custom_${key}`] !== false,
        isCustom: true
      });
    }
    
    // Add remaining default columns (Menge, Preis, Gesamt)
    for (let i = insertIndex; i < DEFAULT_COLUMNS.length; i++) {
      const col = DEFAULT_COLUMNS[i];
      columns.push({
        ...col,
        visible: columnVisibility[col.id] !== false
      });
    }
    
    return columns;
  }, [customFieldKeys, columnVisibility]);

  const toggleColumnVisibility = (columnId: string) => {
    setColumnVisibility(prev => ({
      ...prev,
      [columnId]: !prev[columnId]
    }));
  };

  // Calculate BOM from placed tiles - group by component
  const bomItems: BillOfMaterialsItem[] = useMemo(() => {
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
    
    // Sort by category first, then by name within each category
    const sortedEntries = Array.from(componentCounts.entries())
      .sort(([, a], [, b]) => {
        const catA = a.component.category || '';
        const catB = b.component.category || '';
        if (catA !== catB) {
          if (!catA) return 1;
          if (!catB) return -1;
          return catA.localeCompare(catB);
        }
        return a.component.name.localeCompare(b.component.name);
      });
    
    let position = 1;
    for (const [id, { component, count }] of sortedEntries) {
      const kategorie = component.category || projectKategorien.get(id) || '';
      const marke = projectMarken.get(id) || '';
      const modell = projectModelle.get(id) || '';
      const preis = projectPreise.get(id) || 0;
      const customFields = projectCustomFields.get(id) || {};
      
      // Apply category filter
      if (excludedCategories.length > 0) {
        const catName = kategorie || '__uncategorized__';
        if (excludedCategories.includes(catName)) continue;
      }
      
      items.push({
        position: position++,
        componentId: id,
        name: component.name,
        kategorie,
        marke,
        modell,
        quantity: count,
        preis,
        gesamtkosten: preis * count,
        customFields
      });
    }
    
    return items;
  }, [tiles, projectKategorien, projectMarken, projectModelle, projectPreise, projectCustomFields, excludedCategories]);

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const wsData: (string | number)[][] = [];
    
    // Title row
    wsData.push(['STÜCKLISTE', '', '', '', '', '', '', '']);
    wsData.push(['', '', '', '', '', '', '', '']);
    
    // Project info
    if (titleBlockData.projekt) {
      wsData.push(['Projekt:', titleBlockData.projekt, '', '', '', '', '', '']);
    }
    if (titleBlockData.zeichnungsNr) {
      wsData.push(['Zeichnungs-Nr.:', titleBlockData.zeichnungsNr, '', '', '', '', '', '']);
    }
    wsData.push(['Erstellt am:', new Date().toLocaleDateString('de-DE'), '', '', '', '', '', '']);
    wsData.push(['', '', '', '', '', '', '', '']);
    
    // Get visible columns for export
    const visibleColumns = allColumns.filter(c => c.visible);
    
    // Table header row
    const headerRowIndex = wsData.length;
    const headerRow = visibleColumns.map(col => {
      if (col.id === 'preis') return 'Preis (€)';
      if (col.id === 'gesamtkosten') return 'Gesamt (€)';
      if (col.id === 'position') return 'Pos.';
      return col.label;
    });
    wsData.push(headerRow);
    
    // Data rows
    for (const item of bomItems) {
      const row: (string | number)[] = [];
      for (const col of visibleColumns) {
        if (col.id === 'position') row.push(item.position);
        else if (col.id === 'name') row.push(item.name);
        else if (col.id === 'kategorie') row.push(item.kategorie || '');
        else if (col.id === 'marke') row.push(item.marke || '');
        else if (col.id === 'modell') row.push(item.modell || '');
        else if (col.id === 'quantity') row.push(item.quantity);
        else if (col.id === 'preis') row.push(item.preis || '');
        else if (col.id === 'gesamtkosten') row.push(item.gesamtkosten || '');
        else if (col.isCustom) {
          const key = col.label;
          row.push(item.customFields[key] ?? '');
        }
      }
      wsData.push(row);
    }
    
    // Empty row before totals
    wsData.push(Array(visibleColumns.length).fill(''));
    
    // Totals row
    const totalCount = bomItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalKosten = bomItems.reduce((sum, item) => sum + item.gesamtkosten, 0);
    const totalsRow: (string | number)[] = Array(visibleColumns.length).fill('');
    const quantityIndex = visibleColumns.findIndex(c => c.id === 'quantity');
    const gesamtIndex = visibleColumns.findIndex(c => c.id === 'gesamtkosten');
    if (quantityIndex > 0) totalsRow[quantityIndex - 1] = 'GESAMT:';
    if (quantityIndex >= 0) totalsRow[quantityIndex] = totalCount;
    if (gesamtIndex >= 0 && totalKosten > 0) totalsRow[gesamtIndex] = totalKosten;
    wsData.push(totalsRow);
    
    // Create worksheet from data
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Set column widths
    ws['!cols'] = visibleColumns.map(col => {
      if (col.id === 'position') return { wch: 6 };
      if (col.id === 'name') return { wch: 20 };
      if (col.id === 'kategorie') return { wch: 18 };
      if (col.id === 'marke') return { wch: 15 };
      if (col.id === 'modell') return { wch: 20 };
      if (col.id === 'quantity') return { wch: 8 };
      if (col.id === 'preis') return { wch: 12 };
      if (col.id === 'gesamtkosten') return { wch: 12 };
      return { wch: 15 }; // Custom fields
    });
    
    // Set row heights
    const rowCount = wsData.length;
    ws['!rows'] = [];
    for (let i = 0; i < rowCount; i++) {
      if (i === 0) {
        ws['!rows'].push({ hpt: 28 });
      } else if (i === headerRowIndex) {
        ws['!rows'].push({ hpt: 24 });
      } else {
        ws['!rows'].push({ hpt: 20 });
      }
    }
    
    // Merge cells for title
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: visibleColumns.length - 1 } }
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, 'Stückliste');
    
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

  const visibleColumns = allColumns.filter(c => c.visible);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-8">
            <span>Stückliste</span>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Settings className="w-4 h-4" />
                    Spalten
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64" align="end">
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Sichtbare Spalten</h4>
                    <div className="space-y-2">
                      {allColumns.map(col => (
                        <div key={col.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`col-${col.id}`}
                            checked={col.visible}
                            onCheckedChange={() => toggleColumnVisibility(col.id)}
                          />
                          <Label htmlFor={`col-${col.id}`} className="text-sm cursor-pointer flex-1">
                            {col.label}
                            {col.isCustom && (
                              <span className="ml-1 text-xs text-muted-foreground">(Import)</span>
                            )}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <Button onClick={handleExportExcel} size="sm" className="gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                Als Excel exportieren
              </Button>
            </div>
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
                {visibleColumns.map(col => (
                  <TableHead 
                    key={col.id}
                    className={
                      col.id === 'position' ? 'w-12' :
                      col.id === 'quantity' ? 'w-16 text-center' :
                      col.id === 'preis' || col.id === 'gesamtkosten' ? 'w-24 text-right' :
                      col.id === 'kategorie' ? 'w-32' :
                      col.id === 'marke' ? 'w-28' :
                      ''
                    }
                  >
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {bomItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length} className="text-center text-muted-foreground py-8">
                    Keine Komponenten platziert
                  </TableCell>
                </TableRow>
              ) : (
                bomItems.map((item, index) => (
                  <TableRow key={`${item.componentId}-${index}`}>
                    {visibleColumns.map(col => {
                      if (col.id === 'position') {
                        return <TableCell key={col.id} className="font-medium">{item.position}</TableCell>;
                      }
                      if (col.id === 'name') {
                        return <TableCell key={col.id}>{item.name}</TableCell>;
                      }
                      if (col.id === 'kategorie') {
                        return <TableCell key={col.id} className={item.kategorie ? '' : 'text-muted-foreground'}>{item.kategorie || '–'}</TableCell>;
                      }
                      if (col.id === 'marke') {
                        return <TableCell key={col.id} className={item.marke ? '' : 'text-muted-foreground'}>{item.marke || '–'}</TableCell>;
                      }
                      if (col.id === 'modell') {
                        return <TableCell key={col.id} className={item.modell ? '' : 'text-muted-foreground'}>{item.modell || '–'}</TableCell>;
                      }
                      if (col.id === 'quantity') {
                        return <TableCell key={col.id} className="text-center">{item.quantity}</TableCell>;
                      }
                      if (col.id === 'preis') {
                        return <TableCell key={col.id} className="text-right">{formatCurrency(item.preis)}</TableCell>;
                      }
                      if (col.id === 'gesamtkosten') {
                        return <TableCell key={col.id} className="text-right font-medium">{formatCurrency(item.gesamtkosten)}</TableCell>;
                      }
                      if (col.isCustom) {
                        const key = col.label;
                        const value = item.customFields[key];
                        return (
                          <TableCell key={col.id} className={value ? '' : 'text-muted-foreground'}>
                            {value ?? '–'}
                          </TableCell>
                        );
                      }
                      return <TableCell key={col.id}>–</TableCell>;
                    })}
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
