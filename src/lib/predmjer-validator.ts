import type { BillItem } from '@/types';
import type { ValidationIssue, ValidationResult } from '@/types/validation';

const MATH_TOLERANCE = 0.01;

export function validateMath(items: BillItem[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const expected = item.quantity * item.unitPrice;
    const diff = Math.abs(item.totalPrice - expected);

    if (diff > MATH_TOLERANCE) {
      issues.push({
        rowIndex: i,
        category: 'math',
        severity: 'error',
        field: 'totalPrice',
        message: `Ukupna cijena (${item.totalPrice.toFixed(2)}) ne odgovara količina × jed. cijena (${expected.toFixed(2)})`,
        currentValue: item.totalPrice.toFixed(2),
        suggestedValue: expected.toFixed(2),
        autoFixable: true,
        accepted: false,
      });
    }
  }

  return issues;
}

export function validateMissingData(items: BillItem[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (!item.description || item.description.trim() === '') {
      issues.push({
        rowIndex: i,
        category: 'missing_data',
        severity: 'error',
        field: 'description',
        message: `Stavka #${item.ordinal} nema opis rada`,
        currentValue: '',
        suggestedValue: '',
        autoFixable: false,
        accepted: false,
      });
    }

    if (!item.unit || item.unit.trim() === '') {
      issues.push({
        rowIndex: i,
        category: 'missing_data',
        severity: 'warning',
        field: 'unit',
        message: `Stavka #${item.ordinal} nema jedinicu mjere`,
        currentValue: '',
        suggestedValue: '',
        autoFixable: false,
        accepted: false,
      });
    }

    if (item.quantity === 0) {
      issues.push({
        rowIndex: i,
        category: 'missing_data',
        severity: 'warning',
        field: 'quantity',
        message: `Stavka #${item.ordinal} ima količinu 0`,
        currentValue: '0',
        suggestedValue: '',
        autoFixable: false,
        accepted: false,
      });
    }

    if (item.unitPrice === 0) {
      issues.push({
        rowIndex: i,
        category: 'missing_data',
        severity: 'warning',
        field: 'unitPrice',
        message: `Stavka #${item.ordinal} ima jediničnu cijenu 0`,
        currentValue: '0',
        suggestedValue: '',
        autoFixable: false,
        accepted: false,
      });
    }
  }

  return issues;
}

export function validateOrdinals(items: BillItem[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ordinals = items.map((item) => item.ordinal);

  // Check for duplicates
  const seen = new Map<number, number>();
  for (let i = 0; i < ordinals.length; i++) {
    const ord = ordinals[i];
    if (seen.has(ord)) {
      issues.push({
        rowIndex: i,
        category: 'structure',
        severity: 'warning',
        field: 'ordinal',
        message: `Duplikat rednog broja ${ord} (prvi put na redu ${seen.get(ord)! + 1})`,
        currentValue: String(ord),
        suggestedValue: String(i + 1),
        autoFixable: true,
        accepted: false,
      });
    } else {
      seen.set(ord, i);
    }
  }

  // Check for gaps in sequence
  const sorted = [...ordinals].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] > 1) {
      const gapStart = sorted[i - 1];
      const gapEnd = sorted[i];
      // Find the row index that has gapEnd ordinal
      const rowIdx = ordinals.indexOf(gapEnd);
      issues.push({
        rowIndex: rowIdx,
        category: 'structure',
        severity: 'info',
        field: 'ordinal',
        message: `Praznina u numeraciji: od ${gapStart} skače na ${gapEnd}`,
        currentValue: String(gapEnd),
        suggestedValue: '',
        autoFixable: false,
        accepted: false,
      });
    }
  }

  return issues;
}

export function validateAllLocal(items: BillItem[]): ValidationResult {
  const mathIssues = validateMath(items);
  const missingIssues = validateMissingData(items);
  const structureIssues = validateOrdinals(items);
  const allIssues = [...mathIssues, ...missingIssues, ...structureIssues];

  return {
    issues: allIssues,
    totalChecked: items.length,
    mathErrors: mathIssues.length,
    missingData: missingIssues.length,
    structureIssues: structureIssues.length,
    semanticIssues: 0,
  };
}
