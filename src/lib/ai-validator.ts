import type { BillItem } from '@/types';
import type { ValidationIssue, ChunkProgress } from '@/types/validation';

const CHUNK_SIZE = 200;

interface AIValidationOptions {
  apiKey: string;
  onProgress?: (progress: ChunkProgress) => void;
}

export async function validateWithAI(
  items: BillItem[],
  options: AIValidationOptions
): Promise<ValidationIssue[]> {
  const { apiKey, onProgress } = options;
  const totalChunks = Math.ceil(items.length / CHUNK_SIZE);
  const allIssues: ValidationIssue[] = [];

  for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
    const start = chunkIdx * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, items.length);
    const chunk = items.slice(start, end);

    onProgress?.({
      currentChunk: chunkIdx + 1,
      totalChunks,
      processedRows: start,
      totalRows: items.length,
    });

    const issues = await validateChunk(chunk, start, apiKey);
    allIssues.push(...issues);
  }

  onProgress?.({
    currentChunk: totalChunks,
    totalChunks,
    processedRows: items.length,
    totalRows: items.length,
  });

  return allIssues;
}

async function validateChunk(
  chunk: BillItem[],
  startIndex: number,
  apiKey: string
): Promise<ValidationIssue[]> {
  const rows = chunk.map((item, i) => ({
    row: startIndex + i,
    ordinal: item.ordinal,
    description: item.description,
    unit: item.unit,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    totalPrice: item.totalPrice,
  }));

  const response = await fetch('/api/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Ti si AI asistent specijalizovan za provjeru predmjera građevinskih radova.
Analiziraj stavke predmjera i pronađi semantičke greške. Traži:

1. NELOGIČNE JEDINICE - npr. beton u "kg" umjesto "m³", armatura u "m²" umjesto "kg", fasada u "m³" umjesto "m²"
2. NEUOBIČAJENE CIJENE - cijena koja je ekstremno visoka ili niska za datu vrstu rada
3. NEJASNI OPISI - opisi koji su prekratki, nerazumljivi ili nedovoljno specifični
4. MOGUĆI DUPLIKATI - stavke sa vrlo sličnim opisima koje bi mogle biti duplirane

Vrati ISKLJUČIVO validan JSON niz (bez markdown formatiranja):
[
  {
    "row": broj_reda,
    "field": "unit|unitPrice|description|duplicate",
    "severity": "error|warning|info",
    "message": "opis problema na bosanskom",
    "currentValue": "trenutna vrijednost",
    "suggestedValue": "predložena ispravka ili prazan string"
  }
]

Ako nema problema, vrati prazan niz: []
Budi konzervativan - prijavi samo stvarne probleme, ne lažne pozitive.`,
        },
        {
          role: 'user',
          content: `Provjeri ove stavke predmjera:\n${JSON.stringify(rows)}`,
        },
      ],
      max_tokens: 4000,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `OpenAI API greška: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '[]';

  let jsonStr = content.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((item: any) => ({
      rowIndex: typeof item.row === 'number' ? item.row : 0,
      category: 'semantic' as const,
      severity: item.severity === 'error' ? 'error' : item.severity === 'warning' ? 'warning' : 'info',
      field: item.field || 'description',
      message: item.message || 'AI pronašao potencijalni problem',
      currentValue: String(item.currentValue ?? ''),
      suggestedValue: String(item.suggestedValue ?? ''),
      autoFixable: !!item.suggestedValue,
      accepted: false,
    }));
  } catch {
    console.warn('AI validator: neuspješno parsiranje odgovora', content);
    return [];
  }
}
