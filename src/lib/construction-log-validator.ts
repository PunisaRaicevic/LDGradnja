import type { BillItem } from '@/types';
import type {
  ConstructionLogPosition,
  LogValidationIssue,
  PositionTracker,
} from '@/types/construction-log';

const PRICE_TOLERANCE = 0.01;

function validatePriceMismatch(
  pos: ConstructionLogPosition,
  billItem: BillItem
): LogValidationIssue | null {
  if (pos.unitPriceUploaded === 0) return null;
  const diff = Math.abs(pos.unitPriceUploaded - billItem.unitPrice);
  if (diff > PRICE_TOLERANCE) {
    return {
      category: 'price_mismatch',
      severity: 'warning',
      message: `Cijena za poz. ${pos.detectedPosition} ne odgovara predmjeru (${pos.unitPriceUploaded} vs ${billItem.unitPrice})`,
      detectedPosition: pos.detectedPosition,
      billItemId: pos.billItemId,
      details: {
        uploaded: String(pos.unitPriceUploaded),
        expected: String(billItem.unitPrice),
      },
    };
  }
  return null;
}

function validateWrongUnit(
  pos: ConstructionLogPosition,
  billItem: BillItem
): LogValidationIssue | null {
  if (!pos.unitUploaded) return null;
  const uploadedUnit = pos.unitUploaded.toLowerCase().trim();
  const expectedUnit = billItem.unit.toLowerCase().trim();
  if (uploadedUnit && expectedUnit && uploadedUnit !== expectedUnit) {
    return {
      category: 'wrong_unit',
      severity: 'warning',
      message: `Jedinica mjere za poz. ${pos.detectedPosition} ne odgovara ("${pos.unitUploaded}" vs "${billItem.unit}")`,
      detectedPosition: pos.detectedPosition,
      billItemId: pos.billItemId,
      details: {
        uploaded: pos.unitUploaded,
        expected: billItem.unit,
      },
    };
  }
  return null;
}

function validatePositionNotFound(
  pos: ConstructionLogPosition
): LogValidationIssue | null {
  if (!pos.billItemId && pos.matchStatus !== 'skipped') {
    return {
      category: 'position_not_found',
      severity: 'error',
      message: `Pozicija "${pos.detectedPosition}" nije pronađena u predmjeru`,
      detectedPosition: pos.detectedPosition,
      billItemId: null,
      details: {
        uploaded: pos.detectedPosition,
        expected: 'N/A',
      },
    };
  }
  return null;
}

function validateQuantityExceeded(
  pos: ConstructionLogPosition,
  billItem: BillItem,
  previousCumulative: number
): LogValidationIssue | null {
  const total = previousCumulative + pos.quantityThisPeriod;
  const percent = billItem.quantity > 0 ? (total / billItem.quantity) * 100 : 0;

  if (percent > 100) {
    return {
      category: 'quantity_exceeded',
      severity: 'error',
      message: `Poz. ${pos.detectedPosition}: kumulativna količina (${total}) prelazi predmjer (${billItem.quantity}) - ${percent.toFixed(1)}%`,
      detectedPosition: pos.detectedPosition,
      billItemId: pos.billItemId,
      details: {
        uploaded: String(total),
        expected: String(billItem.quantity),
      },
    };
  }

  if (percent > 90) {
    return {
      category: 'quantity_exceeded',
      severity: 'warning',
      message: `Poz. ${pos.detectedPosition}: kumulativna količina se približava limitu (${percent.toFixed(1)}%)`,
      detectedPosition: pos.detectedPosition,
      billItemId: pos.billItemId,
      details: {
        uploaded: String(total),
        expected: String(billItem.quantity),
      },
    };
  }

  return null;
}

export function validateLogPositions(
  currentPositions: ConstructionLogPosition[],
  billItems: BillItem[],
  allPreviousPositions: ConstructionLogPosition[]
): LogValidationIssue[] {
  const issues: LogValidationIssue[] = [];
  const billItemMap = new Map(billItems.map((b) => [b.id, b]));

  // Compute previous cumulative per bill item
  const previousCumulativeMap = new Map<string, number>();
  for (const pos of allPreviousPositions) {
    if (pos.billItemId) {
      const prev = previousCumulativeMap.get(pos.billItemId) || 0;
      previousCumulativeMap.set(pos.billItemId, prev + pos.quantityThisPeriod);
    }
  }

  for (const pos of currentPositions) {
    if (pos.matchStatus === 'skipped') continue;

    // Check position not found
    const notFound = validatePositionNotFound(pos);
    if (notFound) {
      issues.push(notFound);
      continue;
    }

    if (!pos.billItemId) continue;
    const billItem = billItemMap.get(pos.billItemId);
    if (!billItem) continue;

    // Check price mismatch
    const priceMismatch = validatePriceMismatch(pos, billItem);
    if (priceMismatch) issues.push(priceMismatch);

    // Check wrong unit
    const wrongUnit = validateWrongUnit(pos, billItem);
    if (wrongUnit) issues.push(wrongUnit);

    // Check quantity exceeded
    const previousCum = previousCumulativeMap.get(pos.billItemId) || 0;
    const quantityExceeded = validateQuantityExceeded(pos, billItem, previousCum);
    if (quantityExceeded) issues.push(quantityExceeded);
  }

  return issues;
}

export function computePositionTrackers(
  billItems: BillItem[],
  allPositions: ConstructionLogPosition[],
  currentSituationId?: string
): PositionTracker[] {
  const trackers: PositionTracker[] = [];

  for (const item of billItems) {
    // Sum quantities from all confirmed positions for this bill item
    const relevantPositions = allPositions.filter(
      (p) => p.billItemId === item.id && p.matchStatus !== 'skipped'
    );

    let quantityCumulativePrevious = 0;
    let quantityThisPeriod = 0;

    for (const pos of relevantPositions) {
      if (currentSituationId && pos.situationId === currentSituationId) {
        quantityThisPeriod += pos.quantityThisPeriod;
      } else {
        quantityCumulativePrevious += pos.quantityThisPeriod;
      }
    }

    const quantityTotal = quantityCumulativePrevious + quantityThisPeriod;
    const quantityRemaining = item.quantity - quantityTotal;
    const percentComplete = item.quantity > 0
      ? Math.round((quantityTotal / item.quantity) * 10000) / 100
      : 0;

    let status: 'ok' | 'warning' | 'exceeded';
    if (percentComplete >= 100) {
      status = 'exceeded';
    } else if (percentComplete >= 75) {
      status = 'warning';
    } else {
      status = 'ok';
    }

    trackers.push({
      billItemId: item.id,
      ordinal: String(item.ordinal),
      description: item.description,
      unit: item.unit,
      quantityFromPredmjer: item.quantity,
      quantityCumulativePrevious,
      quantityThisPeriod,
      quantityTotal,
      quantityRemaining: Math.round(quantityRemaining * 100) / 100,
      percentComplete,
      status,
    });
  }

  return trackers;
}
