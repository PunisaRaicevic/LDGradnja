import Dexie, { type Table } from 'dexie';
import type { Project, Drawing, BillItem, InterimSituation, DiaryEntry, Expense, Contract, Task, PurchaseOrder, ProjectPhoto, MaterialRequest } from '@/types';

export class LDGradnjaDB extends Dexie {
  projects!: Table<Project>;
  drawings!: Table<Drawing>;
  billItems!: Table<BillItem>;
  situations!: Table<InterimSituation>;
  diaryEntries!: Table<DiaryEntry>;
  expenses!: Table<Expense>;
  contracts!: Table<Contract>;
  tasks!: Table<Task>;
  purchaseOrders!: Table<PurchaseOrder>;
  photos!: Table<ProjectPhoto>;
  materialRequests!: Table<MaterialRequest>;

  constructor() {
    super('ldgradnja');
    this.version(1).stores({
      projects: 'id, name, status, createdAt',
      drawings: 'id, projectId, name, uploadedAt',
      billItems: 'id, projectId, ordinal',
      situations: 'id, projectId, number, date',
      diaryEntries: 'id, projectId, date',
      expenses: 'id, projectId, date, supplier, category',
      contracts: 'id, projectId, type, contractNumber',
      tasks: 'id, projectId, status, priority, deadline',
      purchaseOrders: 'id, projectId, orderNumber, status',
      photos: 'id, projectId, date',
      materialRequests: 'id, projectId, status',
    });
  }
}

export const db = new LDGradnjaDB();