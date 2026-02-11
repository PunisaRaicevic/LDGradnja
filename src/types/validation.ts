export type ValidationCategory = 'math' | 'missing_data' | 'structure' | 'semantic';
export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  rowIndex: number;
  category: ValidationCategory;
  severity: ValidationSeverity;
  field: string;
  message: string;
  currentValue: string;
  suggestedValue: string;
  autoFixable: boolean;
  accepted: boolean;
}

export interface ValidationResult {
  issues: ValidationIssue[];
  totalChecked: number;
  mathErrors: number;
  missingData: number;
  structureIssues: number;
  semanticIssues: number;
}

export interface ChunkProgress {
  currentChunk: number;
  totalChunks: number;
  processedRows: number;
  totalRows: number;
}
