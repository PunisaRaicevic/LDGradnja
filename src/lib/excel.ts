import * as XLSX from 'xlsx';
import type { BillItem } from '@/types';
import { generateId } from './utils';

// Row classification types
export type RowType = 'header' | 'data' | 'section' | 'footer' | 'empty' | 'title';

export interface AnalyzedRow {
  rowIndex: number;
  type: RowType;
  reason: string;
  rawCells: string[];
  parsed?: {
    ordinal: number;
    description: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  };
  included: boolean;
}

export interface ExcelAnalysis {
  fileName: string;
  totalRows: number;
  dataRows: number;
  skippedRows: number;
  rows: AnalyzedRow[];
  columnMap: Record<string, number>;
  headerRowIndex: number;
  summary: string;
}

// Keywords for detecting various row types
const HEADER_KEYWORDS = ['r.b', 'rb', 'opis', 'jedinica', 'količina', 'kolicina', 'cijena', 'jed'];
const SECTION_KEYWORDS = [
  'radovi', 'demontažni', 'demontazni', 'montažni', 'montazni', 'pripremni',
  'završni', 'zavrsni', 'instalacij', 'elektro', 'vodoinstalat', 'keramič',
  'molersk', 'fasad', 'krovn', 'zidarski', 'betonski', 'armirač', 'tesarsk',
  'limarski', 'stolarsk', 'bravarsk', 'podopolagač', 'izolacij', 'zemljan',
  'spavaća', 'kupatilo', 'kuhinja', 'dnevn', 'hodnik', 'balkon', 'terasa',
  'soba', 'prostorij', 'etaža', 'sprat', 'prizemlje', 'podrum', 'krov',
  'ukupno', 'total', 'svega', 'rekapitulacija', 'suma',
];
const FOOTER_KEYWORDS = [
  'ukupno', 'total', 'svega', 'rekapitulacija', 'suma', 'zbir',
  'potpis', 'direktor', 'pečat', 'datum', 'mjesto', 'odobrio',
  'napomena', 'note', 'pdv', 'porez',
];
const TITLE_KEYWORDS = [
  'ponuda', 'predmjer', 'predračun', 'predracun', 'troškovnik', 'troskovnik',
  'specifikacija', 'finansij', 'investitor', 'izvođač', 'izvodjac',
  'projekat', 'objekat', 'gradilište', 'gradiliste',
];

function findColumnMap(row: string[]): Record<string, number> {
  const columnMap: Record<string, number> = {};
  const rowLower = row.map(cell => String(cell).toLowerCase().trim());

  for (let j = 0; j < rowLower.length; j++) {
    const cell = rowLower[j];
    if (!cell) continue;

    if (cell.includes('r.b') || cell === 'rb' || cell === '#' || cell === 'r.br') {
      columnMap['ordinal'] = j;
    } else if (cell.includes('opis') && !columnMap['description']) {
      columnMap['description'] = j;
    } else if (cell.includes('karakteristik') || cell.includes('bitne')) {
      columnMap['details'] = j;
    } else if (cell.includes('jedinic') && cell.includes('mjer')) {
      columnMap['unit'] = j;
    } else if (cell.includes('jedinic') && !cell.includes('mjer') && !cell.includes('cijen')) {
      if (!columnMap['unit']) columnMap['unit'] = j;
    } else if (cell.includes('količ') || cell.includes('kolic')) {
      columnMap['quantity'] = j;
    } else if ((cell.includes('cijena') || cell.includes('cjena')) && (cell.includes('jed') || cell.includes('jedan'))) {
      columnMap['unitPrice'] = j;
    } else if ((cell.includes('cijena') || cell.includes('cjena')) && !cell.includes('jed') && !cell.includes('ukup')) {
      if (!columnMap['unitPrice']) columnMap['unitPrice'] = j;
    } else if (cell.includes('ukup') && !cell.includes('pdv') && !cell.includes('sa')) {
      if (!columnMap['totalPrice']) columnMap['totalPrice'] = j;
    }
  }

  return columnMap;
}

function classifyRow(
  row: any[],
  rowIndex: number,
  headerRowIndex: number,
  columnMap: Record<string, number>,
  _totalRows: number,
  hasDetails: boolean
): AnalyzedRow {
  const rawCells = row.map(c => String(c ?? '').trim());
  const nonEmptyCells = rawCells.filter(c => c !== '');
  const fullText = rawCells.join(' ').toLowerCase();

  // Empty row
  if (nonEmptyCells.length === 0) {
    return { rowIndex, type: 'empty', reason: 'Prazan red', rawCells, included: false };
  }

  // Rows before header
  if (rowIndex < headerRowIndex) {
    // Check if it's the header row itself
    if (rowIndex === headerRowIndex) {
      return { rowIndex, type: 'header', reason: 'Zaglavlje tabele', rawCells, included: false };
    }
    // Check for title
    if (TITLE_KEYWORDS.some(k => fullText.includes(k)) || nonEmptyCells.length <= 2) {
      return { rowIndex, type: 'title', reason: 'Naslov dokumenta', rawCells, included: false };
    }
    return { rowIndex, type: 'title', reason: 'Red iznad zaglavlja', rawCells, included: false };
  }

  // The header row itself
  if (rowIndex === headerRowIndex) {
    return { rowIndex, type: 'header', reason: 'Zaglavlje tabele (nazivi kolona)', rawCells, included: false };
  }

  // Rows after header - analyze content
  const ordinalCol = columnMap['ordinal'];
  const rawOrdinal = ordinalCol !== undefined ? rawCells[ordinalCol] : '';
  const ordinal = parseInt(String(rawOrdinal));

  // Get description
  let description = columnMap['description'] !== undefined ? rawCells[columnMap['description']] || '' : '';
  if (hasDetails) {
    const details = columnMap['details'] !== undefined ? rawCells[columnMap['details']] || '' : '';
    if (details) {
      description = description ? `${description} - ${details}` : details;
    }
  }

  // Check for section headers - text spanning across, usually no numbers
  const hasNumericData = rawCells.some((c, i) => {
    if (i === ordinalCol) return false;
    return !isNaN(parseFloat(String(c).replace(',', '.'))) && parseFloat(String(c).replace(',', '.')) > 0;
  });

  // Section detection: has text but no numeric data (quantity, price)
  if (!hasNumericData && nonEmptyCells.length <= 3) {
    if (SECTION_KEYWORDS.some(k => fullText.includes(k))) {
      return { rowIndex, type: 'section', reason: `Naslov sekcije: "${nonEmptyCells.join(' ')}"`, rawCells, included: false };
    }
    // Also catch rows with just letters in first columns (like "A", "B" section markers)
    if (nonEmptyCells.every(c => c.length < 30) && isNaN(ordinal)) {
      return { rowIndex, type: 'section', reason: `Oznaka sekcije: "${nonEmptyCells.join(' ')}"`, rawCells, included: false };
    }
  }

  // Footer detection - usually near the end
  if (FOOTER_KEYWORDS.some(k => fullText.includes(k)) && isNaN(ordinal)) {
    return { rowIndex, type: 'footer', reason: `Footer/Sumiranje: "${nonEmptyCells.slice(0, 3).join(' ')}"`, rawCells, included: false };
  }

  // Valid data row - has ordinal number and description
  if (!isNaN(ordinal) && description) {
    const unit = columnMap['unit'] !== undefined ? rawCells[columnMap['unit']] || '' : '';
    const quantity = columnMap['quantity'] !== undefined
      ? parseFloat(String(rawCells[columnMap['quantity']]).replace(',', '.')) || 0
      : 0;
    const unitPrice = columnMap['unitPrice'] !== undefined
      ? parseFloat(String(rawCells[columnMap['unitPrice']]).replace(',', '.')) || 0
      : 0;
    let totalPrice = columnMap['totalPrice'] !== undefined
      ? parseFloat(String(rawCells[columnMap['totalPrice']]).replace(',', '.')) || 0
      : 0;
    if (totalPrice === 0 && quantity > 0 && unitPrice > 0) {
      totalPrice = quantity * unitPrice;
    }

    return {
      rowIndex,
      type: 'data',
      reason: 'Stavka predmjera',
      rawCells,
      parsed: { ordinal, description, unit, quantity, unitPrice, totalPrice },
      included: true,
    };
  }

  // Row with ordinal but no description
  if (!isNaN(ordinal) && !description) {
    return { rowIndex, type: 'section', reason: 'Red sa brojem ali bez opisa', rawCells, included: false };
  }

  // Catch-all for unclassified rows
  if (isNaN(ordinal) && nonEmptyCells.length > 0) {
    return { rowIndex, type: 'section', reason: `Neklasifikovan red: "${nonEmptyCells.slice(0, 2).join(' ')}"`, rawCells, included: false };
  }

  return { rowIndex, type: 'empty', reason: 'Prazan ili nevažeći red', rawCells, included: false };
}

/**
 * Check if a raw ordinal string is a sub-item of a parent ordinal.
 * Matches patterns like: "8.1", "8.2", "8a", "8b", "8-1", "8/1" for parent ordinal 8.
 */
function isSubOrdinal(rawOrdinal: string, parentOrdinal: number): boolean {
  const s = String(rawOrdinal).trim();
  if (!s) return false;
  // "8.1", "8.2", "8,1" etc.
  if (/^\d+[.,]\d+$/.test(s) && parseInt(s) === parentOrdinal) return true;
  // "8a", "8b", "8A" etc.
  if (/^\d+[a-zA-Z]$/.test(s) && parseInt(s) === parentOrdinal) return true;
  // "8-1", "8/1" etc.
  if (/^\d+[-/]\d+$/.test(s) && parseInt(s) === parentOrdinal) return true;
  return false;
}

/**
 * Aggregate sub-rows into their parent data row.
 * Handles two patterns:
 * 1. Data row with quantity=0 followed by non-data rows with numeric values
 * 2. Data row followed by data rows with sub-ordinals (8.1, 8.2, 8a, 8b)
 * Sub-row values are summed into the parent and sub-rows are marked as included=false.
 */
function aggregateSubRows(rows: AnalyzedRow[], columnMap: Record<string, number>): void {
  const ordinalCol = columnMap['ordinal'];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.type !== 'data' || !row.parsed) continue;

    const parentOrdinal = row.parsed.ordinal;
    const parentRawOrdinal = ordinalCol !== undefined ? row.rawCells[ordinalCol] : '';
    // Parent must have a clean integer ordinal (not itself a sub-item)
    if (String(parentRawOrdinal).trim() !== String(parentOrdinal)) continue;

    // Collect sub-rows below this parent
    const subRows: AnalyzedRow[] = [];
    for (let j = i + 1; j < rows.length; j++) {
      const next = rows[j];
      if (next.type === 'empty') continue;

      // Pattern 2: data rows with sub-ordinals (8.1, 8.2, etc.)
      if (next.type === 'data' && next.parsed) {
        const nextRawOrdinal = ordinalCol !== undefined ? next.rawCells[ordinalCol] : '';
        if (isSubOrdinal(nextRawOrdinal, parentOrdinal)) {
          subRows.push(next);
          continue;
        }
        break; // next real item with different ordinal
      }

      // Pattern 1: section/footer rows with numeric data (no ordinal)
      if (next.type === 'section' || next.type === 'footer') {
        const hasNumerics = next.rawCells.some((c, ci) => {
          if (ci === ordinalCol) return false;
          const val = parseFloat(String(c).replace(',', '.'));
          return !isNaN(val) && val > 0;
        });
        if (hasNumerics) {
          subRows.push(next);
        } else {
          break; // real section header, stop
        }
      }
    }

    if (subRows.length === 0) continue;

    // Only aggregate if parent has 0 values OR sub-rows have sub-ordinals
    const hasSubOrdinals = subRows.some(s => s.type === 'data' && s.parsed);
    if (!hasSubOrdinals && row.parsed.quantity > 0 && row.parsed.unitPrice > 0) continue;

    // Aggregate sub-row values
    let totalQuantity = 0;
    let totalPrice = 0;
    let unit = row.parsed.unit;
    const subDescriptions: string[] = [];

    for (const sub of subRows) {
      let subUnit: string, subQty: number, subUnitPrice: number, subTotal: number;

      if (sub.type === 'data' && sub.parsed) {
        // Sub-ordinal data row - use parsed values
        subUnit = sub.parsed.unit;
        subQty = sub.parsed.quantity;
        subUnitPrice = sub.parsed.unitPrice;
        subTotal = sub.parsed.totalPrice;
        subDescriptions.push(sub.parsed.description);
      } else {
        // Section/footer row - extract from raw cells
        subUnit = columnMap['unit'] !== undefined ? sub.rawCells[columnMap['unit']] || '' : '';
        subQty = columnMap['quantity'] !== undefined
          ? parseFloat(String(sub.rawCells[columnMap['quantity']]).replace(',', '.')) || 0
          : 0;
        subUnitPrice = columnMap['unitPrice'] !== undefined
          ? parseFloat(String(sub.rawCells[columnMap['unitPrice']]).replace(',', '.')) || 0
          : 0;
        subTotal = columnMap['totalPrice'] !== undefined
          ? parseFloat(String(sub.rawCells[columnMap['totalPrice']]).replace(',', '.')) || 0
          : 0;
        if (subTotal === 0 && subQty > 0 && subUnitPrice > 0) {
          subTotal = subQty * subUnitPrice;
        }
        const subDesc = columnMap['description'] !== undefined ? sub.rawCells[columnMap['description']] || '' : '';
        if (subDesc) subDescriptions.push(subDesc);
      }

      if (subUnit && !unit) unit = subUnit;
      totalQuantity += subQty;
      totalPrice += subTotal;

      // Mark sub-row as consumed
      sub.included = false;
      if (sub.type === 'data' && sub.parsed) {
        sub.type = 'section'; // reclassify so it shows in skipped
      }
      sub.reason = `Pod-stavka agregirana u stavku ${parentOrdinal}`;
    }

    // Update parent row
    const avgUnitPrice = totalQuantity > 0 ? Math.round((totalPrice / totalQuantity) * 100) / 100 : 0;
    row.parsed.unit = unit;
    row.parsed.quantity = Math.round(totalQuantity * 100) / 100;
    row.parsed.unitPrice = avgUnitPrice;
    row.parsed.totalPrice = Math.round(totalPrice * 100) / 100;

    if (subDescriptions.length > 0) {
      row.parsed.description += ` (${subDescriptions.join(' + ')})`;
    }
    row.reason = `Stavka predmjera (${subRows.length} pod-stavki agregirano)`;
  }
}

export function analyzeExcelFile(file: File): Promise<ExcelAnalysis> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const allRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        // Find header row
        let headerRowIndex = -1;
        let columnMap: Record<string, number> = {};

        for (let i = 0; i < Math.min(allRows.length, 15); i++) {
          const row = allRows[i];
          if (!row) continue;
          const rowLower = row.map((cell: any) => String(cell).toLowerCase().trim());

          let matchCount = 0;
          for (const keyword of HEADER_KEYWORDS) {
            if (rowLower.some((cell: string) => cell.includes(keyword))) matchCount++;
          }

          if (matchCount >= 3) {
            headerRowIndex = i;
            columnMap = findColumnMap(row.map((c: any) => String(c)));
            break;
          }
        }

        if (headerRowIndex === -1) {
          headerRowIndex = 0;
          columnMap = { ordinal: 0, description: 1, unit: 3, quantity: 4, unitPrice: 5, totalPrice: 6 };
        }

        const hasDetails = columnMap['details'] !== undefined;

        // Analyze each row
        const analyzedRows: AnalyzedRow[] = allRows.map((row, i) =>
          classifyRow(row, i, headerRowIndex, columnMap, allRows.length, hasDetails)
        );

        // Post-processing: aggregate sub-rows into parent items
        // Detects pattern: data row with quantity=0 followed by non-data rows with numeric values
        aggregateSubRows(analyzedRows, columnMap);

        const dataRows = analyzedRows.filter(r => r.type === 'data');
        const skippedRows = analyzedRows.filter(r => r.type !== 'data' && r.type !== 'empty');

        const summary = [
          `Pronađeno ${dataRows.length} stavki predmjera.`,
          skippedRows.length > 0 ? `Preskočeno ${skippedRows.length} redova (naslovi, sekcije, footer).` : '',
          `Zaglavlje detektovano u redu ${headerRowIndex + 1}.`,
        ].filter(Boolean).join(' ');

        resolve({
          fileName: file.name,
          totalRows: allRows.length,
          dataRows: dataRows.length,
          skippedRows: skippedRows.length,
          rows: analyzedRows,
          columnMap,
          headerRowIndex,
          summary,
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export function convertAnalysisToBillItems(analysis: ExcelAnalysis, projectId: string): BillItem[] {
  return analysis.rows
    .filter(r => r.included && r.parsed)
    .map(r => ({
      id: generateId(),
      projectId,
      ordinal: r.parsed!.ordinal,
      description: r.parsed!.description,
      unit: r.parsed!.unit,
      quantity: r.parsed!.quantity,
      unitPrice: r.parsed!.unitPrice,
      totalPrice: r.parsed!.totalPrice,
    }));
}

export function exportToExcel(data: any[], fileName: string) {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}
