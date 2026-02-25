import * as XLSX from 'xlsx';
import type { BillItem } from '@/types';
import { generateId } from './utils';

export interface AIParsedBillItem {
  ordinal: number;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  sheetName: string;
  included: boolean;
}

export interface AIPredmjerResult {
  fileName: string;
  items: AIParsedBillItem[];
  sheetsProcessed: number;
  summary: string;
}

/**
 * Compacts sheet rows to pipe-separated text, removing empty columns/rows.
 * Also truncates long description cells to save space.
 */
function compactSheetToText(rows: any[][]): string {
  if (rows.length === 0) return '';

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
    const cells = activeCols.map((j) => {
      const val = String(rows[i][j] ?? '').trim();
      // Truncate long text cells to 80 chars to save token space
      return val.length > 80 ? val.slice(0, 80) + '...' : val;
    });
    const nonEmpty = cells.filter((c) => c !== '');
    if (nonEmpty.length === 0) continue;
    const line = cells.join(' | ');
    if (line.replace(/[|\s]/g, '').length < 2) continue;
    lines.push(line);
  }

  return lines.join('\n');
}

/**
 * Splits text into chunks by lines, each chunk <= maxChars.
 */
function splitIntoChunks(text: string, maxChars: number): string[] {
  const lines = text.split('\n');
  const chunks: string[] = [];
  let current = '';

  for (const line of lines) {
    if (current.length + line.length + 1 > maxChars && current.length > 0) {
      chunks.push(current);
      current = line;
    } else {
      current = current ? current + '\n' + line : line;
    }
  }
  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const SYSTEM_PROMPT = `Izvuci stavke predmjera radova (bill of quantities) iz tabele.

PRAVILA:
- Izvuci SAMO redove koji su STAVKE RADOVA (imaju redni broj, opis, jedinicu mjere, količinu i cijenu)
- PRESKOČI zaglavlja, naslove, sekcije (npr "A SPAVAĆA SOBA", "B KUPATILO"), footere, rekapitulacije, sumiranja
- Ako stavka ima pod-redove bez rednog broja (npr stavka 8 sa pod-redovima "Zidovi" i "Plafon"), izvuci svaki pod-red kao zasebnu stavku sa istim ordinal brojem
- ordinal = redni broj stavke (integer)
- totalPrice = quantity * unitPrice (izračunaj ako nije dat)
- Izvuci SVE stavke iz teksta, ne samo prvih par

Vrati SAMO JSON (bez markdown):
{"items":[{"ordinal":1,"description":"opis rada","unit":"m²","quantity":10,"unitPrice":5.00,"totalPrice":50.00}]}`;

/**
 * Sends one chunk of text to GPT-4o-mini for bill item extraction.
 */
async function aiParseChunk(
  sheetName: string,
  chunkText: string,
  chunkIndex: number,
  totalChunks: number,
): Promise<AIParsedBillItem[]> {
  const label = totalChunks > 1
    ? `Sheet "${sheetName}" dio ${chunkIndex + 1}/${totalChunks}`
    : `Sheet "${sheetName}"`;

  console.log(`[AI Predmjer] ${label}: ${chunkText.length} chars`);

  const response = await fetch('/api/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `${label}:\n${chunkText}` },
      ],
      max_tokens: 4000,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    console.error(`[AI Predmjer] API error ${response.status}:`, errorBody.slice(0, 300));
    throw new Error(`API greška: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  console.log(`[AI Predmjer] Response for ${label}:`, content.slice(0, 300));

  let jsonStr = content.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  const parsed = JSON.parse(jsonStr);
  const items = Array.isArray(parsed.items) ? parsed.items : [];

  return items.map((item: any) => ({
    ordinal: parseInt(item.ordinal) || 0,
    description: String(item.description || ''),
    unit: String(item.unit || ''),
    quantity: parseFloat(item.quantity) || 0,
    unitPrice: parseFloat(item.unitPrice) || 0,
    totalPrice: parseFloat(item.totalPrice) || (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0),
    sheetName,
    included: true,
  }));
}

/**
 * Parses all sheets in an Excel file using AI and extracts bill items.
 * Large sheets are split into chunks and each chunk is sent separately.
 */
export async function aiAnalyzePredmjer(
  file: File,
  onProgress?: (message: string) => void
): Promise<AIPredmjerResult> {
  onProgress?.('Čitanje Excel fajla...');

  const arrayBuffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);
  const workbook = XLSX.read(uint8, { type: 'array' });

  // Convert all sheets to compact text
  const sheetTexts: { sheetName: string; text: string }[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (rows.length < 2) continue;
    const text = compactSheetToText(rows);
    if (text.length > 10) {
      sheetTexts.push({ sheetName, text });
    }
  }

  if (sheetTexts.length === 0) {
    throw new Error('Fajl je prazan ili nema čitljivih podataka.');
  }

  // Split each sheet into chunks of ~3000 chars
  const CHUNK_SIZE = 3000;
  const allChunks: { sheetName: string; chunk: string; chunkIndex: number; totalChunks: number }[] = [];

  for (const st of sheetTexts) {
    const chunks = splitIntoChunks(st.text, CHUNK_SIZE);
    for (let i = 0; i < chunks.length; i++) {
      allChunks.push({ sheetName: st.sheetName, chunk: chunks[i], chunkIndex: i, totalChunks: chunks.length });
    }
  }

  onProgress?.(`Pronađeno ${sheetTexts.length} sheet-ova, ${allChunks.length} dijelova za analizu...`);

  const allItems: AIParsedBillItem[] = [];
  const errors: string[] = [];

  for (let i = 0; i < allChunks.length; i++) {
    const c = allChunks[i];
    const label = c.totalChunks > 1
      ? `"${c.sheetName}" dio ${c.chunkIndex + 1}/${c.totalChunks}`
      : `"${c.sheetName}"`;
    onProgress?.(`AI analiza ${label} (${i + 1}/${allChunks.length})...`);

    try {
      const items = await aiParseChunk(c.sheetName, c.chunk, c.chunkIndex, c.totalChunks);
      allItems.push(...items);
      onProgress?.(`${label}: pronađeno ${items.length} stavki (ukupno ${allItems.length})`);
    } catch (err: any) {
      console.error(`[AI Predmjer] ${label} failed:`, err);
      errors.push(`${label}: ${err.message}`);
    }

    // Delay between API calls to avoid rate limits
    if (i < allChunks.length - 1) {
      await delay(1500);
    }
  }

  if (allItems.length === 0) {
    const detail = errors.length > 0 ? '\n\nDetalji: ' + errors.join('; ') : '';
    throw new Error('AI nije pronašao stavke predmjera u fajlu.' + detail);
  }

  const totalValue = allItems.reduce((sum, item) => sum + item.totalPrice, 0);

  onProgress?.('Analiza završena!');
  return {
    fileName: file.name,
    items: allItems,
    sheetsProcessed: sheetTexts.length,
    summary: `AI je pronašao ${allItems.length} stavki iz ${sheetTexts.length} sheet-ova (${allChunks.length} dijelova). Ukupna vrijednost: ${totalValue.toFixed(2)} KM.${errors.length > 0 ? ` (${errors.length} grešaka)` : ''}`,
  };
}

/**
 * Converts AI parsed items to BillItem[] for saving.
 */
export function convertAIResultToBillItems(result: AIPredmjerResult, projectId: string): BillItem[] {
  return result.items
    .filter((item) => item.included)
    .map((item) => ({
      id: generateId(),
      projectId,
      ordinal: item.ordinal,
      description: item.description,
      unit: item.unit,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
    }));
}
