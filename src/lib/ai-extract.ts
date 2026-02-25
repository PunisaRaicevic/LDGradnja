export interface ExtractedExpense {
  date: string;
  supplier: string;
  description: string;
  items: { description: string; quantity: number; price: number; total: number }[];
  totalAmount: number;
  category: string;
  confidence: Record<string, number>;
  rawText?: string;
  invoiceNumber?: string;
  dueDate?: string;
  vendorTaxId?: string;
  taxAmount?: number;
}

export async function extractExpenseFromImage(
  file: File
): Promise<ExtractedExpense> {
  let base64: string;
  let mimeType: string;

  if (file.type === 'application/pdf') {
    // Convert PDF first page to image
    base64 = await pdfToBase64Image(file);
    mimeType = 'image/png';
  } else {
    base64 = await fileToBase64(file);
    mimeType = file.type || 'image/jpeg';
  }

  const response = await fetch('/api/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Ti si AI asistent specijalizovan za čitanje i ekstrakciju podataka sa računa, faktura i fiskalnih dokumenata.
Izvuci podatke sa slike i vrati ih ISKLJUČIVO kao validan JSON objekat (bez markdown formatiranja, bez \`\`\`json blokova).

Format odgovora:
{
  "date": "YYYY-MM-DD",
  "supplier": "naziv dobavljača/firme",
  "description": "kratki opis kupovine/usluge",
  "invoiceNumber": "broj fakture/računa ako postoji",
  "dueDate": "YYYY-MM-DD rok plaćanja ako postoji",
  "vendorTaxId": "PIB/ID broj dobavljača ako postoji",
  "taxAmount": 17.00,
  "items": [
    {"description": "opis stavke", "quantity": 1, "price": 10.00, "total": 10.00}
  ],
  "totalAmount": 100.00,
  "category": "jedna od: materijal, radna_snaga, oprema, transport, podizvođači, ostalo",
  "confidence": {
    "date": 0.95,
    "supplier": 0.90,
    "description": 0.85,
    "invoiceNumber": 0.80,
    "dueDate": 0.70,
    "vendorTaxId": 0.85,
    "taxAmount": 0.90,
    "items": 0.80,
    "totalAmount": 0.95,
    "category": 0.75
  },
  "rawText": "prepoznati tekst sa slike"
}

Pravila:
- Datum uvijek u formatu YYYY-MM-DD
- Iznose zaokruži na 2 decimale
- Ako ne možeš pročitati neko polje, stavi prazan string ili 0, a confidence za to polje stavi na 0
- Kategoriju odredi na osnovu sadržaja računa (građevinski materijal = "materijal", radnici = "radna_snaga", alati/mašine = "oprema", prevoz = "transport")
- confidence je tvoja procjena pouzdanosti PO SVAKOM POLJU posebno (0.0 - 1.0)
- taxAmount je iznos PDV-a (poreza) ako je vidljiv na računu
- invoiceNumber je broj fakture/računa
- vendorTaxId je PIB ili identifikacioni broj dobavljača
- dueDate je rok plaćanja ako postoji
- Sve tekstove piši na jeziku koji je na računu`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Izvuci podatke sa ovog računa/fakture. Vrati samo JSON.'
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
                detail: 'high'
              }
            }
          ]
        }
      ],
      max_tokens: 2000,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `OpenAI API greška: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  // Parse JSON from response - handle possible markdown wrapping
  let jsonStr = content.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    const parsed = JSON.parse(jsonStr);

    // Build per-field confidence from response or use defaults
    const rawConfidence = parsed.confidence;
    const defaultConf = typeof rawConfidence === 'number' ? rawConfidence : 0.5;
    const confidence: Record<string, number> =
      typeof rawConfidence === 'object' && rawConfidence !== null
        ? {
            date: parseFloat(rawConfidence.date) || defaultConf,
            supplier: parseFloat(rawConfidence.supplier) || defaultConf,
            description: parseFloat(rawConfidence.description) || defaultConf,
            invoiceNumber: parseFloat(rawConfidence.invoiceNumber) || 0,
            dueDate: parseFloat(rawConfidence.dueDate) || 0,
            vendorTaxId: parseFloat(rawConfidence.vendorTaxId) || 0,
            taxAmount: parseFloat(rawConfidence.taxAmount) || 0,
            items: parseFloat(rawConfidence.items) || defaultConf,
            totalAmount: parseFloat(rawConfidence.totalAmount) || defaultConf,
            category: parseFloat(rawConfidence.category) || defaultConf,
          }
        : {
            date: defaultConf,
            supplier: defaultConf,
            description: defaultConf,
            invoiceNumber: 0,
            dueDate: 0,
            vendorTaxId: 0,
            taxAmount: 0,
            items: defaultConf,
            totalAmount: defaultConf,
            category: defaultConf,
          };

    return {
      date: parsed.date || new Date().toISOString().split('T')[0],
      supplier: parsed.supplier || '',
      description: parsed.description || '',
      items: Array.isArray(parsed.items) ? parsed.items : [],
      totalAmount: parseFloat(parsed.totalAmount) || 0,
      category: parsed.category || 'ostalo',
      confidence,
      rawText: parsed.rawText || '',
      invoiceNumber: parsed.invoiceNumber || '',
      dueDate: parsed.dueDate || '',
      vendorTaxId: parsed.vendorTaxId || '',
      taxAmount: parseFloat(parsed.taxAmount) || 0,
    };
  } catch {
    throw new Error('AI nije mogao pravilno parsirati račun. Pokušajte sa jasnijom slikom.');
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function pdfToBase64Image(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);

  // Render at 2x scale for better OCR quality
  const scale = 2;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;

  await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;

  const dataUrl = canvas.toDataURL('image/png');
  return dataUrl.split(',')[1];
}
