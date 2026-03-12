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
  let imageContents: { type: 'image_url'; image_url: { url: string; detail: string } }[] = [];

  if (file.type === 'application/pdf') {
    // Convert ALL PDF pages to images
    const pages = await pdfToBase64Images(file);
    imageContents = pages.map((pageBase64) => ({
      type: 'image_url' as const,
      image_url: {
        url: `data:image/jpeg;base64,${pageBase64}`,
        detail: 'high',
      },
    }));
  } else {
    // Compress image to reduce payload size (especially important on mobile)
    const base64 = await compressImageToBase64(file);
    imageContents = [{
      type: 'image_url' as const,
      image_url: {
        url: `data:image/jpeg;base64,${base64}`,
        detail: 'high',
      },
    }];
  }

  // On web (Railway): use relative proxy URL
  // On mobile (Capacitor) / Electron: use full Railway backend URL
  const isLocalServer = typeof window !== 'undefined'
    && !window.location.protocol.startsWith('capacitor')
    && !window.location.protocol.startsWith('ionic')
    && !(window as any).electronAPI?.isElectron
    && window.location.hostname !== 'localhost';
  const apiBase = isLocalServer
    ? '/api/gemini/chat/completions'
    : 'https://thorough-surprise-production-48bf.up.railway.app/api/gemini/chat/completions';

  let response: Response;
  try {
    response = await fetch(apiBase, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      // Use stronger model for multi-page PDFs, lite for single images
      model: imageContents.length > 1 ? 'gemini-2.5-flash' : 'gemini-2.5-flash-lite',
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
- Sve tekstove piši na jeziku koji je na računu
- VAŽNO: Ako dokument ima više stranica, moraš pročitati SVE stranice i izvući SVE stavke. Nemoj se zaustaviti na prvoj stranici!
- totalAmount treba biti UKUPAN iznos sa PDV-om sa POSLJEDNJE stranice (sumarna linija)`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: imageContents.length > 1
                ? `Ovo je faktura/račun sa ${imageContents.length} stranica. OBAVEZNO analiziraj SVE ${imageContents.length} stranice i izvuci SVE stavke sa SVIH stranica. Ukupan iznos (totalAmount) uzmi sa posljednje stranice. Vrati samo JSON.`
                : 'Izvuci podatke sa ovog računa/fakture. Vrati samo JSON.'
            },
            ...imageContents,
          ]
        }
      ],
      // More tokens for multi-page docs with many items
      max_tokens: imageContents.length > 1 ? 8000 : 4000,
      temperature: 0.1,
    }),
  });
  } catch (err: any) {
    throw new Error(`Greška pri slanju zahtjeva: ${err.message}. Provjerite internet konekciju.`);
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Gemini API greška: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  // Parse JSON from response - extract JSON object from any surrounding text
  let jsonStr = content.trim();
  // Remove markdown code block wrapping
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }
  // If still not valid JSON, try to find JSON object in the text
  if (!jsonStr.startsWith('{')) {
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }
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

function compressImageToBase64(file: File, maxWidth = 1600, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Greška pri učitavanju slike'));
      img.onload = () => {
        // Scale down if larger than maxWidth
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl.split(',')[1]);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

async function pdfToBase64Images(file: File, maxPages = 10): Promise<string[]> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = Math.min(pdf.numPages, maxPages);

  const pages: string[] = [];
  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);

    // Use 1.5x scale (balance between quality and size) - JPEG compression reduces payload
    const scale = 1.5;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    // White background (JPEG has no transparency)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;

    // Use JPEG at 0.7 quality instead of PNG to drastically reduce size
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    pages.push(dataUrl.split(',')[1]);
  }

  return pages;
}
