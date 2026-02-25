// === Data model types ===

export type LogSituationStatus = 'draft' | 'confirmed' | 'validated';
export type LogSheetStatus = 'pending' | 'previewed' | 'confirmed';
export type PositionMatchStatus = 'auto' | 'manual' | 'unmatched' | 'skipped';

export interface ConstructionLogSituation {
  id: string;
  projectId: string;
  name: string;
  month: number | null;
  year: number | null;
  status: LogSituationStatus;
  notes: string;
  createdAt: string;
  sheets: ConstructionLogSheet[];
}

export interface ConstructionLogSheet {
  id: string;
  situationId: string;
  fileUrl: string | null;
  fileName: string;
  fileType: 'excel' | 'pdf';
  parsedData: ParsedSheetData | null;
  validationResults: LogValidationIssue[] | null;
  status: LogSheetStatus;
  createdAt: string;
}

export interface ConstructionLogPosition {
  id: string;
  projectId: string;
  billItemId: string | null;
  situationId: string;
  sheetId: string | null;
  sheetName: string;
  detectedPosition: string;
  description: string;
  unitUploaded: string;
  unitPriceUploaded: number;
  quantityThisPeriod: number;
  quantityCumulative: number;
  matchStatus: PositionMatchStatus;
  createdAt: string;
}

// === Parsing types ===

export interface ParsedSheetData {
  sheets: ParsedSheet[];
}

export interface ParsedSheet {
  sheetName: string;
  rows: ParsedLogRow[];
}

export interface ParsedLogRow {
  detectedPosition: string;
  description: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  matchedBillItemId: string | null;
  matchConfidence: 'high' | 'medium' | 'low' | 'none';
  userAction: 'confirm' | 'link' | 'skip' | 'pending';
}

// === Validation types ===

export type LogValidationCategory =
  | 'price_mismatch'
  | 'wrong_unit'
  | 'position_not_found'
  | 'quantity_exceeded';

export type LogValidationSeverity = 'error' | 'warning' | 'info';

export interface LogValidationIssue {
  category: LogValidationCategory;
  severity: LogValidationSeverity;
  message: string;
  detectedPosition: string;
  billItemId: string | null;
  details: {
    uploaded: string;
    expected: string;
  };
}

// === Cumulative tracking types ===

export interface PositionTracker {
  billItemId: string;
  ordinal: string;
  description: string;
  unit: string;
  quantityFromPredmjer: number;
  quantityCumulativePrevious: number;
  quantityThisPeriod: number;
  quantityTotal: number;
  quantityRemaining: number;
  percentComplete: number;
  status: 'ok' | 'warning' | 'exceeded';
}
