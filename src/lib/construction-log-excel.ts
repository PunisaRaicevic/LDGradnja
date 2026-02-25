import * as XLSX from 'xlsx';
import type { BillItem } from '@/types';
import type { ParsedSheetData, ParsedLogRow } from '@/types/construction-log';

/**
 * Pre-filters and compacts Excel rows to reduce token usage.
 * Removes empty rows, empty columns, and obvious non-data rows.
 */
function compactSheetToText(rows: any[][]): string {
  if (rows.length === 0) return '';

  // Find which columns actually have data across all rows
  const maxCols = Math.max(...rows.map((r) => r.length));
  const colHasData = new Array(maxCols).fill(false);
  for (const row of rows) {
    for (let j = 0; j < row.length; j++) {
      if (String(row[j] ?? '').trim()) colHasData[j] = true;
    }
  }
  const activeCols = colHasData.reduce<number[]>((acc, has, i) => {
    if (has) acc.push(i);
    return acc;
  }, []);

  const lines: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const cells = activeCols.map((j) => String(rows[i][j] ?? '').trim());
    const nonEmpty = cells.filter((c) => c !== '');

    // Skip completely empty rows
    if (nonEmpty.length === 0) continue;

    // Compact: join with | separator, keep short
    const line = cells.join(' | ');

    // Skip extremely short lines (just separators or single chars)
    if (line.replace(/[|\s]/g, '').length < 2) continue;

    lines.push(line);
  }

  return lines.join('\n');
}

/**
 * Converts all sheets in an Excel workbook to compact text.
 */
function excelToText(workbook: XLSX.WorkBook): { sheetName: string; text: string }[] {
  const results: { sheetName: string; text: string }[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (rows.length < 2) continue;

    const text = compactSheetToText(rows);
    if (text.length > 10) {
      results.push({ sheetName, text });
    }
  }

  return results;
}

/**
 * Builds a concise predmjer reference for the AI prompt.
 */
function buildPredmjerReference(billItems: BillItem[]): string {
  if (billItems.length === 0) return 'Predmjer je prazan.';

  return billItems.map((item) =>
    `${item.ordinal}|${item.id}|${item.description.slice(0, 60)}|${item.unit}|${item.unitPrice}|${item.quantity}`
  ).join('\n');
}

/**
 * Calls GPT-4 to parse one sheet and match with predmjer.
 * Sends sheet text in chunks if needed.
 */
async function aiParseSheet(
  sheetName: string,
  sheetText: string,
  billItems: BillItem[],
  onProgress?: (message: string) => void
): Promise<ParsedLogRow[]> {
  const predmjerRef = buildPredmjerReference(billItems);

  onProgress?.(`AI analiza sheet-a "${sheetName}"...`);

  // Hard limit: ~3000 chars of sheet text to stay well within token limits
  const maxChars = 3000;
  const truncated = sheetText.length > maxChars
    ? sheetText.slice(0, maxChars) + '\n...(skraćeno)'
    : sheetText;

  console.log(`[AI Parse] Sheet "${sheetName}": ${sheetText.length} → ${truncated.length} chars`);

  const response = await fetch('/api/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Izvuci stavke radova iz građevinske knjige i poveži sa predmjerom.

PREDMJER (format: poz|ID|opis|jed|cijena|količina):
${predmjerRef}

PRAVILA:
- Izvuci SAMO redove sa STVARNIM količinama (quantity > 0)
- PRESKOČI zaglavlja, sumiranja, prazne redove
- Poveži sa predmjerom po opisu ili broju pozicije
- matchedBillItemId = ID iz predmjera ili null

Vrati SAMO JSON (bez markdown):
{"positions":[{"detectedPosition":"br","description":"opis","unit":"jed","unitPrice":0,"quantity":0,"matchedBillItemId":"ID ili null","matchConfidence":"high|medium|low|none"}]}`
        },
        {
          role: 'user',
          content: `Sheet "${sheetName}":\n${truncated}`
        }
      ],
      max_tokens: 3000,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    console.error(`[AI Parse] API error ${response.status}:`, errorBody.slice(0, 300));
    throw new Error(`API greška: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  console.log(`[AI Parse] Response for "${sheetName}":`, content.slice(0, 300));

  let jsonStr = content.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  const parsed = JSON.parse(jsonStr);
  const positions = Array.isArray(parsed.positions) ? parsed.positions : [];

  return positions.map((pos: any) => ({
    detectedPosition: String(pos.detectedPosition || ''),
    description: String(pos.description || ''),
    unit: String(pos.unit || ''),
    unitPrice: parseFloat(pos.unitPrice) || 0,
    quantity: parseFloat(pos.quantity) || 0,
    matchedBillItemId: pos.matchedBillItemId || null,
    matchConfidence: pos.matchConfidence || 'none',
    userAction: (pos.matchConfidence === 'high' || pos.matchConfidence === 'medium') ? 'confirm' as const : 'pending' as const,
  }));
}

/**
 * Sends sheets to AI one at a time with a delay to avoid rate limits.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function parseConstructionLogExcel(
  file: File,
  billItems: BillItem[],
  onProgress?: (message: string) => void
): Promise<ParsedSheetData> {
  onProgress?.('Čitanje Excel fajla...');

  const arrayBuffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);
  const workbook = XLSX.read(uint8, { type: 'array' });

  const sheetTexts = excelToText(workbook);

  if (sheetTexts.length === 0) {
    throw new Error('Fajl je prazan ili nema čitljivih podataka.');
  }

  onProgress?.(`Pronađeno ${sheetTexts.length} sheet-ova. Pokrećem AI analizu...`);

  const sheets: { sheetName: string; rows: ParsedLogRow[] }[] = [];
  const errors: string[] = [];

  for (let i = 0; i < sheetTexts.length; i++) {
    const st = sheetTexts[i];
    onProgress?.(`AI analiza sheet-a "${st.sheetName}" (${i + 1}/${sheetTexts.length})...`);

    try {
      const rows = await aiParseSheet(st.sheetName, st.text, billItems, onProgress);
      if (rows.length > 0) {
        sheets.push({ sheetName: st.sheetName, rows });
      }
    } catch (err: any) {
      console.error(`[AI Parse] Sheet "${st.sheetName}" failed:`, err);
      errors.push(`Sheet "${st.sheetName}": ${err.message}`);
    }

    // Delay between sheets to avoid rate limits
    if (i < sheetTexts.length - 1) {
      await delay(1500);
    }
  }

  if (sheets.length === 0) {
    const detail = errors.length > 0 ? '\n\nDetalji: ' + errors.join('; ') : '';
    throw new Error('AI nije pronašao stavke radova u fajlu.' + detail);
  }

  onProgress?.('Analiza završena!');
  return { sheets };
}
