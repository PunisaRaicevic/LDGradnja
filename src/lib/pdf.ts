import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, formatDate } from './utils';
import type { InterimSituation, BillItem, SituationItem, PurchaseOrder, DiaryEntry } from '@/types';

export function generateSituationPDF(
  situation: InterimSituation,
  billItems: BillItem[],
  projectName: string
) {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text('PRIVREMENA SITUACIJA', 105, 20, { align: 'center' });

  doc.setFontSize(12);
  doc.text(`Projekat: ${projectName}`, 14, 35);
  doc.text(`Situacija br: ${situation.number}`, 14, 42);
  doc.text(`Datum: ${formatDate(situation.date)}`, 14, 49);
  doc.text(`Period: ${formatDate(situation.periodFrom)} - ${formatDate(situation.periodTo)}`, 14, 56);

  const tableData = situation.items.map((item: SituationItem) => {
    const billItem = billItems.find((b: BillItem) => b.id === item.billItemId);
    return [
      billItem?.ordinal || '',
      billItem?.description || '',
      billItem?.unit || '',
      billItem?.quantity?.toFixed(2) || '',
      item.quantityDone.toFixed(2),
      item.percentComplete.toFixed(1) + '%',
      formatCurrency(item.value),
      item.cumulativePercent.toFixed(1) + '%',
      formatCurrency(item.cumulativeValue),
    ];
  });

  autoTable(doc, {
    startY: 65,
    head: [['R.br', 'Opis', 'Jed.', 'Ukupno', 'Izvršeno', '%', 'Vrijednost', 'Kum. %', 'Kum. vrij.']],
    body: tableData,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [29, 78, 216] },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 200;
  doc.setFontSize(12);
  doc.text(`UKUPNO: ${formatCurrency(situation.totalValue)}`, 14, finalY + 15);
  doc.text(`KUMULATIV: ${formatCurrency(situation.cumulativeValue)}`, 14, finalY + 22);

  return doc;
}

export function generateOrderPDF(order: PurchaseOrder, projectName: string) {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text('PORUDŽBENICA', 105, 20, { align: 'center' });

  doc.setFontSize(12);
  doc.text(`Br: ${order.orderNumber}`, 14, 35);
  doc.text(`Projekat: ${projectName}`, 14, 42);
  doc.text(`Datum: ${formatDate(order.date)}`, 14, 49);
  doc.text(`Dobavljač: ${order.supplier}`, 14, 56);

  const tableData = order.items.map(item => [
    item.ordinal,
    item.description,
    item.unit,
    item.quantity.toFixed(2),
    formatCurrency(item.unitPrice),
    formatCurrency(item.amount),
  ]);

  autoTable(doc, {
    startY: 65,
    head: [['R.br', 'Opis materijala', 'Jed. mjere', 'Količina', 'Jed. cijena', 'Iznos']],
    body: tableData,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [29, 78, 216] },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 200;
  doc.setFontSize(12);
  doc.text(`UKUPNO: ${formatCurrency(order.totalAmount)}`, 14, finalY + 15);

  return doc;
}

export function generateDiaryPDF(entries: DiaryEntry[], projectName: string) {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text('GRAĐEVINSKI DNEVNIK', 105, 20, { align: 'center' });
  doc.setFontSize(12);
  doc.text(`Projekat: ${projectName}`, 14, 35);

  const tableData = entries.map(entry => [
    formatDate(entry.date),
    entry.weather,
    entry.workerCount.toString(),
    entry.workDescription,
    entry.materials,
    entry.specialEvents || '',
  ]);

  autoTable(doc, {
    startY: 45,
    head: [['Datum', 'Vrijeme', 'Radnici', 'Izvršeni radovi', 'Materijal', 'Posebni događaji']],
    body: tableData,
    styles: { fontSize: 8, cellWidth: 'wrap' },
    headStyles: { fillColor: [29, 78, 216] },
    columnStyles: {
      3: { cellWidth: 50 },
      4: { cellWidth: 30 },
    },
  });

  return doc;
}