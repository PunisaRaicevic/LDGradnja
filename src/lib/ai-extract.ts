export interface ExtractedExpense {
  date: string;
  supplier: string;
  description: string;
  items: { description: string; quantity: number; price: number; total: number }[];
  totalAmount: number;
  category: string;
  confidence: number;
  rawText?: string;
}

export async function extractExpenseFromImage(
  file: File,
  apiKey: string
): Promise<ExtractedExpense> {
  const base64 = await fileToBase64(file);
  const mimeType = file.type || 'image/jpeg';

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
          content: `Ti si AI asistent specijalizovan za čitanje i ekstrakciju podataka sa računa, faktura i fiskalnih dokumenata.
Izvuci podatke sa slike i vrati ih ISKLJUČIVO kao validan JSON objekat (bez markdown formatiranja, bez \`\`\`json blokova).

Format odgovora:
{
  "date": "YYYY-MM-DD",
  "supplier": "naziv dobavljača/firme",
  "description": "kratki opis kupovine/usluge",
  "items": [
    {"description": "opis stavke", "quantity": 1, "price": 10.00, "total": 10.00}
  ],
  "totalAmount": 100.00,
  "category": "jedna od: materijal, radna_snaga, oprema, transport, podizvođači, ostalo",
  "confidence": 0.85,
  "rawText": "prepoznati tekst sa slike"
}

Pravila:
- Datum uvijek u formatu YYYY-MM-DD
- Iznose zaokruži na 2 decimale
- Ako ne možeš pročitati neko polje, stavi prazan string ili 0
- Kategoriju odredi na osnovu sadržaja računa (građevinski materijal = "materijal", radnici = "radna_snaga", alati/mašine = "oprema", prevoz = "transport")
- confidence je tvoja procjena koliko si siguran u ekstrakciju (0.0 - 1.0)
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
    return {
      date: parsed.date || new Date().toISOString().split('T')[0],
      supplier: parsed.supplier || '',
      description: parsed.description || '',
      items: Array.isArray(parsed.items) ? parsed.items : [],
      totalAmount: parseFloat(parsed.totalAmount) || 0,
      category: parsed.category || 'ostalo',
      confidence: parseFloat(parsed.confidence) || 0.5,
      rawText: parsed.rawText || '',
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
