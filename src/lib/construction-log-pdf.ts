import type { BillItem } from '@/types';
import type { ParsedSheetData, ParsedLogRow } from '@/types/construction-log';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function pdfPagesToBase64(file: File): Promise<string[]> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];

  // Process up to 10 pages to avoid excessive API calls
  const maxPages = Math.min(pdf.numPages, 10);

  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const scale = 2;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;

    await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;

    const dataUrl = canvas.toDataURL('image/png');
    pages.push(dataUrl.split(',')[1]);
  }

  return pages;
}

function matchToBillItem(
  detectedPosition: string,
  description: string,
  billItems: BillItem[]
): { billItemId: string | null; confidence: 'high' | 'medium' | 'low' | 'none' } {
  // Extract number from position reference
  const posMatch = detectedPosition.match(/(\d+[\d.]*)/);
  const posNum = posMatch ? posMatch[1] : '';

  // Exact ordinal match
  for (const item of billItems) {
    const itemOrdinal = String(item.ordinal).trim();
    if (posNum && itemOrdinal === posNum) {
      return { billItemId: item.id, confidence: 'high' };
    }
  }

  // Numeric match
  const parsed = parseInt(posNum);
  if (!isNaN(parsed)) {
    for (const item of billItems) {
      if (Number(item.ordinal) === parsed) {
        return { billItemId: item.id, confidence: 'high' };
      }
    }
  }

  // Description match
  if (description && description.length > 5) {
    const descLower = description.toLowerCase();
    for (const item of billItems) {
      const itemDescLower = item.description.toLowerCase();
      if (
        itemDescLower.includes(descLower.slice(0, 20)) ||
        descLower.includes(itemDescLower.slice(0, 20))
      ) {
        return { billItemId: item.id, confidence: 'medium' };
      }
    }
  }

  return { billItemId: null, confidence: 'none' };
}

export async function parseConstructionLogPDF(
  file: File,
  billItems: BillItem[],
  onProgress?: (message: string) => void
): Promise<ParsedSheetData> {
  onProgress?.('Konvertovanje PDF stranica...');

  let pages: string[];
  try {
    pages = await pdfPagesToBase64(file);
  } catch {
    // Fallback: try as image directly
    const base64 = await fileToBase64(file);
    pages = [base64];
  }

  onProgress?.(`Ekstrakcija podataka iz ${pages.length} stranica...`);

  // Build image content for GPT-4 Vision
  const imageContent = pages.map((base64) => ({
    type: 'image_url' as const,
    image_url: {
      url: `data:image/png;base64,${base64}`,
      detail: 'high' as const,
    },
  }));

  const response = await fetch('/api/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Ti si AI asistent za čitanje građevinskih knjiga (construction log sheets).
Izvuci sve pozicije/stavke iz tabele na slikama i vrati ih kao JSON.

Format odgovora (SAMO validan JSON, bez markdown):
{
  "positions": [
    {
      "position": "broj pozicije (npr. '3' ili 'poz. 3')",
      "description": "opis rada",
      "unit": "jedinica mjere (m, m², m³, kg, kom, itd.)",
      "unitPrice": 0.00,
      "quantity": 0.00
    }
  ]
}

Pravila:
- Izvuci SVE redove koji predstavljaju pozicije/stavke rada
- Brojeve zaokruži na 2 decimale
- Ako je cijena ili količina nečitljiva, stavi 0
- Preskoči zaglavlja, fusnote, ukupne sumiranja
- Prepoznaj kolone: pozicija/poz.predrač., opis, jedinica mjere, jedinična cijena, količina
- Decimalni separator može biti tačka ili zarez`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Izvuci sve pozicije/stavke iz ove građevinske knjige. Vrati samo JSON.',
            },
            ...imageContent,
          ],
        },
      ],
      max_tokens: 4000,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `API greška: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  // Parse JSON response
  let jsonStr = content.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  onProgress?.('Obrada rezultata...');

  try {
    const parsed = JSON.parse(jsonStr);
    const positions = Array.isArray(parsed.positions) ? parsed.positions : [];

    const rows: ParsedLogRow[] = positions.map((pos: any) => {
      const detectedPosition = String(pos.position || '');
      const description = String(pos.description || '');
      const match = matchToBillItem(detectedPosition, description, billItems);

      return {
        detectedPosition,
        description,
        unit: String(pos.unit || ''),
        unitPrice: parseFloat(pos.unitPrice) || 0,
        quantity: parseFloat(pos.quantity) || 0,
        matchedBillItemId: match.billItemId,
        matchConfidence: match.confidence,
        userAction: match.confidence === 'high' || match.confidence === 'medium' ? 'confirm' : 'pending',
      };
    });

    if (rows.length === 0) {
      throw new Error('AI nije pronašao pozicije u PDF-u.');
    }

    return {
      sheets: [{ sheetName: file.name, rows }],
    };
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error('AI nije mogao pravilno parsirati PDF. Pokušajte sa jasnijim dokumentom.');
    }
    throw e;
  }
}
