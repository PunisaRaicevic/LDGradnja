import type { Expense } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { EXPENSE_CATEGORIES } from '@/types';

function getGeminiUrl(): string {
  const isLocalServer = typeof window !== 'undefined'
    && !window.location.protocol.startsWith('capacitor')
    && !window.location.protocol.startsWith('ionic')
    && !(window as any).electronAPI?.isElectron
    && window.location.hostname !== 'localhost';
  return isLocalServer
    ? '/api/gemini/chat/completions'
    : 'https://thorough-surprise-production-48bf.up.railway.app/api/gemini/chat/completions';
}

function buildExpenseSummary(expenses: Expense[]): string {
  if (expenses.length === 0) return 'Nema unesenih troškova za ovaj projekat.';

  const total = expenses.reduce((s, e) => s + e.totalAmount, 0);
  const totalTax = expenses.reduce((s, e) => s + (e.taxAmount || 0), 0);

  // Po osobi (podrška za podijeljene račune)
  const byPayer: Record<string, { total: number; count: number }> = {};
  let unassigned = 0;
  for (const e of expenses) {
    if (e.paidByShares && e.paidByShares.length > 0) {
      for (const share of e.paidByShares) {
        if (share.name) {
          if (!byPayer[share.name]) byPayer[share.name] = { total: 0, count: 0 };
          byPayer[share.name].total += share.amount;
          byPayer[share.name].count += 1;
        }
      }
    } else if (e.paidBy) {
      if (!byPayer[e.paidBy]) byPayer[e.paidBy] = { total: 0, count: 0 };
      byPayer[e.paidBy].total += e.totalAmount;
      byPayer[e.paidBy].count += 1;
    } else {
      unassigned += e.totalAmount;
    }
  }

  // Po kategoriji
  const byCat: Record<string, number> = {};
  for (const e of expenses) {
    const cat = EXPENSE_CATEGORIES.find(c => c.value === e.category)?.label || e.category;
    byCat[cat] = (byCat[cat] || 0) + e.totalAmount;
  }

  // Po dobavljaču (top 10)
  const bySupplier: Record<string, number> = {};
  for (const e of expenses) {
    if (e.supplier) {
      bySupplier[e.supplier] = (bySupplier[e.supplier] || 0) + e.totalAmount;
    }
  }
  const topSuppliers = Object.entries(bySupplier)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Po mjesecu
  const byMonth: Record<string, number> = {};
  for (const e of expenses) {
    const month = e.date.substring(0, 7); // YYYY-MM
    byMonth[month] = (byMonth[month] || 0) + e.totalAmount;
  }

  // Sve stavke (skraćeno za kontekst)
  const itemLines = expenses
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(e => {
      const parts = [
        formatDate(e.date),
        e.supplier || '-',
        e.description.substring(0, 60),
        EXPENSE_CATEGORIES.find(c => c.value === e.category)?.label || e.category,
        e.paidByShares && e.paidByShares.length > 1
          ? e.paidByShares.map(s => `${s.name}:${formatCurrency(s.amount)}`).join('+')
          : (e.paidBy || 'neoznačeno'),
        formatCurrency(e.totalAmount),
      ];
      return parts.join(' | ');
    });

  let summary = `PREGLED TROŠKOVA PROJEKTA\n`;
  summary += `========================\n`;
  summary += `Ukupno troškova: ${expenses.length}\n`;
  summary += `Ukupan iznos: ${formatCurrency(total)}\n`;
  summary += `Ukupan PDV: ${formatCurrency(totalTax)}\n\n`;

  summary += `--- ULAGANJA PO OSOBI ---\n`;
  for (const [name, data] of Object.entries(byPayer)) {
    const pct = total > 0 ? (data.total / total * 100).toFixed(1) : '0';
    summary += `${name}: ${formatCurrency(data.total)} (${data.count} računa, ${pct}%)\n`;
  }
  if (unassigned > 0) {
    summary += `Neraspoređeno: ${formatCurrency(unassigned)}\n`;
  }

  summary += `\n--- PO KATEGORIJI ---\n`;
  for (const [cat, amount] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) {
    summary += `${cat}: ${formatCurrency(amount)}\n`;
  }

  summary += `\n--- TOP DOBAVLJAČI ---\n`;
  for (const [sup, amount] of topSuppliers) {
    summary += `${sup}: ${formatCurrency(amount)}\n`;
  }

  summary += `\n--- PO MJESECU ---\n`;
  for (const [month, amount] of Object.entries(byMonth).sort()) {
    summary += `${month}: ${formatCurrency(amount)}\n`;
  }

  summary += `\n--- SVE STAVKE ---\n`;
  summary += `Datum | Dobavljač | Opis | Kategorija | Platio | Iznos\n`;
  summary += itemLines.join('\n');

  return summary;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function analyzeExpenses(
  expenses: Expense[],
  question: string,
  history: ChatMessage[],
): Promise<string> {
  const summary = buildExpenseSummary(expenses);

  const messages = [
    {
      role: 'system',
      content: `Ti si AI asistent za analizu troškova građevinskog projekta. Korisnik radi renoviranje sa partnerima i vodi evidenciju troškova.

Evo kompletnih podataka o troškovima:

${summary}

Pravila:
- Odgovaraj na srpskom/crnogorskom jeziku
- Budi konkretan i koristi tačne cifre iz podataka
- Koristi EUR valutu, formatiraj iznose sa 2 decimale
- Kad korisnik pita ko je koliko platio, daj tačan pregled sa procentima
- Možeš računati razlike, prosjeke, trendove, porediti troškove
- Ako korisnik pita nešto što se ne može odrediti iz podataka, reci mu to
- Budi kratak i jasan, bez nepotrebnog teksta
- Koristi emoji za vizuelnu preglednost u odgovorima`
    },
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: question },
  ];

  const response = await fetch(getGeminiUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gemini-2.5-flash-lite',
      messages,
      max_tokens: 2000,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Gemini API greška: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'Nisam uspio generisati odgovor.';
}
