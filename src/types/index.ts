export interface Project {
  id: string;
  name: string;
  location: string;
  startDate: string;
  investor: string;
  status: 'active' | 'completed' | 'paused';
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Drawing {
  id: string;
  projectId: string;
  name: string;
  fileName: string;
  fileType: 'pdf' | 'dwg' | 'dxf' | 'other';
  fileSize: number;
  version: number;
  uploadedAt: string;
  description?: string;
  filePath?: string;
}

export interface BillItem {
  id: string;
  projectId: string;
  ordinal: number;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface PredmjerFile {
  id: string;
  projectId: string;
  name: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  description: string;
  uploadedAt: string;
  filePath?: string;
}

export interface ConstructionLogFile {
  id: string;
  projectId: string;
  name: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  description: string;
  uploadedAt: string;
  filePath?: string;
}

export interface SituationFile {
  id: string;
  projectId: string;
  name: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  description: string;
  uploadedAt: string;
  filePath?: string;
}

export interface InterimSituation {
  id: string;
  projectId: string;
  number: number;
  date: string;
  periodFrom: string;
  periodTo: string;
  items: SituationItem[];
  totalValue: number;
  cumulativeValue: number;
  createdAt: string;
}

export interface SituationItem {
  id: string;
  situationId: string;
  billItemId: string;
  percentComplete: number;
  quantityDone: number;
  value: number;
  cumulativePercent: number;
  cumulativeQuantity: number;
  cumulativeValue: number;
}

export interface DiaryEntry {
  id: string;
  projectId: string;
  date: string;
  weather: string;
  temperature?: string;
  workerCount: number;
  workDescription: string;
  materials: string;
  specialEvents?: string;
  createdAt: string;
}

export interface LineItem {
  description: string;
  quantity: number;
  price: number;
  total: number;
}

export interface Expense {
  id: string;
  projectId: string;
  date: string;
  supplier: string;
  description: string;
  quantity: number;
  price: number;
  totalAmount: number;
  category: string;
  receiptFilePath?: string;
  receiptFileName?: string;
  invoiceNumber?: string;
  dueDate?: string;
  vendorTaxId?: string;
  taxAmount?: number;
  status: 'pending' | 'confirmed';
  extractionConfidence?: Record<string, number>;
  lineItems?: LineItem[];
  createdAt: string;
}

export interface Contract {
  id: string;
  projectId: string;
  type: 'investor' | 'subcontractor';
  contractNumber: string;
  date: string;
  amount: number;
  deadline?: string;
  partyName: string;
  contactInfo?: string;
  scopeOfWork?: string;
  paymentTerms?: string;
  filePath?: string;
  fileName?: string;
  createdAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  deadline?: string;
  assignedTo: string;
  status: 'pending' | 'in_progress' | 'completed';
  attachments: TaskAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  fileName: string;
  filePath?: string;
  description?: string;
  uploadedAt: string;
}

export interface MaterialRequest {
  id: string;
  projectId: string;
  description: string;
  photos: RequestPhoto[];
  status: 'pending' | 'approved' | 'ordered';
  createdBy: string;
  createdAt: string;
}

export interface RequestPhoto {
  id: string;
  requestId: string;
  filePath?: string;
  fileName: string;
  description?: string;
  uploadedAt: string;
}

export interface Message {
  id: string;
  projectId: string;
  senderName: string;
  content: string;
  imagePath?: string;
  imageName?: string;
  messageType: 'text' | 'image' | 'task_update' | 'request_update';
  relatedTaskId?: string;
  relatedRequestId?: string;
  createdAt: string;
}

export interface PurchaseOrder {
  id: string;
  projectId: string;
  orderNumber: string;
  date: string;
  supplier: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'created' | 'sent' | 'delivered';
  materialRequestId?: string;
  createdAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  ordinal: number;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface ProjectPhoto {
  id: string;
  projectId: string;
  fileName: string;
  filePath?: string;
  description?: string;
  date: string;
  uploadedAt: string;
}

export type ExpenseCategory =
  | 'materijal'
  | 'radna_snaga'
  | 'oprema'
  | 'transport'
  | 'podizvođači'
  | 'ostalo';

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'materijal', label: 'Materijal' },
  { value: 'radna_snaga', label: 'Radna snaga' },
  { value: 'oprema', label: 'Oprema' },
  { value: 'transport', label: 'Transport' },
  { value: 'podizvođači', label: 'Podizvođači' },
  { value: 'ostalo', label: 'Ostalo' },
];

export const UNITS: string[] = [
  'm', 'm²', 'm³', 'kg', 't', 'kom', 'sat', 'dan', 'komplet', 'pau'
];

export interface AppUser {
  id: string;
  adminId: string;
  email: string;
  fullName: string;
  phone: string;
  role: 'admin' | 'worker';
  authUserId: string | null;
  createdAt: string;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: 'admin' | 'worker';
  addedAt: string;
  // joined fields
  userName?: string;
  userEmail?: string;
  projectName?: string;
}

// Construction Log types
export type {
  ConstructionLogSituation,
  ConstructionLogSheet,
  ConstructionLogPosition,
  ParsedSheetData,
  ParsedSheet,
  ParsedLogRow,
  LogValidationIssue,
  LogValidationCategory,
  LogValidationSeverity,
  PositionTracker,
  LogSituationStatus,
  LogSheetStatus,
  PositionMatchStatus,
} from './construction-log';