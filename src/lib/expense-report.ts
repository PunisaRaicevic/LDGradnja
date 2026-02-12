import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, formatDate } from './utils';
import type { Expense } from '@/types';
import { EXPENSE_CATEGORIES } from '@/types';

export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  category?: string;
}

function applyFilters(expenses: Expense[], filters: ReportFilters): Expense[] {
  return expenses.filter((e) => {
    if (filters.dateFrom && e.date < filters.dateFrom) return false;
    if (filters.dateTo && e.date > filters.dateTo) return false;
    if (filters.category && e.category !== filters.category) return false;
    return true;
  });
}

export function exportExpensesExcel(expenses: Expense[], filters: ReportFilters) {
  const filtered = applyFilters(expenses, filters);

  const rows = filtered.map((e) => ({
    'Datum': e.date,
    'Dobavljač': e.supplier,
    'PIB': e.vendorTaxId || '',
    'Br. fakture': e.invoiceNumber || '',
    'Opis': e.description,
    'Kategorija': EXPENSE_CATEGORIES.find((c) => c.value === e.category)?.label || e.category,
    'Količina': e.quantity,
    'Cijena': e.price,
    'PDV': e.taxAmount || 0,
    'Ukupno': e.totalAmount,
  }));

  // Add totals row
  const totalAmount = filtered.reduce((sum, e) => sum + e.totalAmount, 0);
  const totalTax = filtered.reduce((sum, e) => sum + (e.taxAmount || 0), 0);
  rows.push({
    'Datum': '',
    'Dobavljač': '',
    'PIB': '',
    'Br. fakture': '',
    'Opis': '',
    'Kategorija': '',
    'Količina': 0,
    'Cijena': 0,
    'PDV': totalTax,
    'Ukupno': totalAmount,
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Bold the totals row
  const totalRowIdx = rows.length; // 1-indexed in sheet (header + data rows)
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: totalRowIdx, c });
    if (worksheet[addr]) {
      worksheet[addr].s = { font: { bold: true } };
    }
  }

  // Set column widths
  worksheet['!cols'] = [
    { wch: 12 }, // Datum
    { wch: 25 }, // Dobavljač
    { wch: 15 }, // PIB
    { wch: 15 }, // Br. fakture
    { wch: 35 }, // Opis
    { wch: 15 }, // Kategorija
    { wch: 10 }, // Količina
    { wch: 12 }, // Cijena
    { wch: 12 }, // PDV
    { wch: 14 }, // Ukupno
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Troškovi');
  XLSX.writeFile(workbook, 'troskovi-izvjestaj.xlsx');
}

export function exportExpensesPDF(expenses: Expense[], filters: ReportFilters, projectName?: string) {
  const filtered = applyFilters(expenses, filters);
  const doc = new jsPDF({ orientation: 'landscape' });

  // Header
  doc.setFontSize(18);
  doc.text('IZVJEŠTAJ O TROŠKOVIMA', 148, 15, { align: 'center' });

  doc.setFontSize(11);
  let y = 25;
  if (projectName) {
    doc.text(`Projekat: ${projectName}`, 14, y);
    y += 7;
  }
  if (filters.dateFrom || filters.dateTo) {
    const period = [
      filters.dateFrom ? `od ${formatDate(filters.dateFrom)}` : '',
      filters.dateTo ? `do ${formatDate(filters.dateTo)}` : '',
    ].filter(Boolean).join(' ');
    doc.text(`Period: ${period}`, 14, y);
    y += 7;
  }
  if (filters.category) {
    const catLabel = EXPENSE_CATEGORIES.find((c) => c.value === filters.category)?.label || filters.category;
    doc.text(`Kategorija: ${catLabel}`, 14, y);
    y += 7;
  }

  const tableData = filtered.map((e) => [
    e.date ? formatDate(e.date) : '',
    e.supplier,
    e.vendorTaxId || '',
    e.invoiceNumber || '',
    e.description.length > 40 ? e.description.substring(0, 40) + '...' : e.description,
    EXPENSE_CATEGORIES.find((c) => c.value === e.category)?.label || e.category,
    e.quantity.toString(),
    formatCurrency(e.price),
    formatCurrency(e.taxAmount || 0),
    formatCurrency(e.totalAmount),
  ]);

  const totalAmount = filtered.reduce((sum, e) => sum + e.totalAmount, 0);
  const totalTax = filtered.reduce((sum, e) => sum + (e.taxAmount || 0), 0);

  autoTable(doc, {
    startY: y + 3,
    head: [['Datum', 'Dobavljač', 'PIB', 'Br. fakture', 'Opis', 'Kategorija', 'Kol.', 'Cijena', 'PDV', 'Ukupno']],
    body: tableData,
    foot: [['', '', '', '', '', '', '', '', formatCurrency(totalTax), formatCurrency(totalAmount)]],
    styles: { fontSize: 7 },
    headStyles: { fillColor: [29, 78, 216] },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: {
      7: { halign: 'right' },
      8: { halign: 'right' },
      9: { halign: 'right' },
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 200;
  doc.setFontSize(12);
  doc.text(`UKUPNO: ${formatCurrency(totalAmount)}`, 14, finalY + 12);
  doc.text(`PDV: ${formatCurrency(totalTax)}`, 14, finalY + 19);

  doc.save('troskovi-izvjestaj.pdf');
}
