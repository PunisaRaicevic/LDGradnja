import { create } from 'zustand';
import type {
  ConstructionLogSituation,
  ConstructionLogSheet,
  ConstructionLogPosition,
  LogValidationIssue,
  ParsedSheetData,
} from '@/types/construction-log';
import { supabase } from '@/lib/supabase';

interface ConstructionLogStore {
  situations: ConstructionLogSituation[];
  positions: ConstructionLogPosition[];
  loading: boolean;

  loadSituations: (projectId: string) => Promise<void>;
  addSituation: (projectId: string, data: { name: string; month?: number; year?: number }) => Promise<ConstructionLogSituation | null>;
  updateSituationStatus: (id: string, status: string) => Promise<void>;
  deleteSituation: (id: string) => Promise<void>;

  addSheet: (situationId: string, data: { fileName: string; fileType: 'excel' | 'pdf'; fileUrl?: string }) => Promise<ConstructionLogSheet | null>;
  updateSheet: (id: string, data: { parsedData?: ParsedSheetData; validationResults?: LogValidationIssue[]; status?: string }) => Promise<void>;
  deleteSheet: (id: string, situationId: string) => Promise<void>;

  loadPositions: (projectId: string) => Promise<void>;
  savePositions: (positions: Omit<ConstructionLogPosition, 'id' | 'createdAt'>[]) => Promise<void>;
  deletePositionsBySituation: (situationId: string) => Promise<void>;
}

function mapSituation(r: any, sheets: ConstructionLogSheet[]): ConstructionLogSituation {
  return {
    id: r.id, projectId: r.project_id, name: r.name,
    month: r.month, year: r.year, status: r.status,
    notes: r.notes || '', createdAt: r.created_at, sheets,
  };
}

function mapSheet(r: any): ConstructionLogSheet {
  return {
    id: r.id, situationId: r.situation_id, fileUrl: r.file_url,
    fileName: r.file_name, fileType: r.file_type,
    parsedData: r.parsed_data, validationResults: r.validation_results,
    status: r.status, createdAt: r.created_at,
  };
}

function mapPosition(r: any): ConstructionLogPosition {
  return {
    id: r.id, projectId: r.project_id, billItemId: r.bill_item_id,
    situationId: r.situation_id, sheetId: r.sheet_id,
    sheetName: r.sheet_name || '', detectedPosition: r.detected_position || '',
    description: r.description || '', unitUploaded: r.unit_uploaded || '',
    unitPriceUploaded: Number(r.unit_price_uploaded),
    quantityThisPeriod: Number(r.quantity_this_period),
    quantityCumulative: Number(r.quantity_cumulative),
    matchStatus: r.match_status, createdAt: r.created_at,
  };
}

export const useConstructionLogStore = create<ConstructionLogStore>((set, get) => ({
  situations: [], positions: [], loading: false,

  loadSituations: async (projectId) => {
    set({ loading: true });
    const { data: sitRows } = await supabase
      .from('construction_log_situations')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at');

    const situations: ConstructionLogSituation[] = [];
    for (const sr of sitRows || []) {
      const { data: sheetRows } = await supabase
        .from('construction_log_sheets')
        .select('*')
        .eq('situation_id', sr.id)
        .order('created_at');
      situations.push(mapSituation(sr, (sheetRows || []).map(mapSheet)));
    }
    set({ situations, loading: false });
  },

  addSituation: async (projectId, data) => {
    const { data: row } = await supabase
      .from('construction_log_situations')
      .insert({
        project_id: projectId,
        name: data.name,
        month: data.month ?? null,
        year: data.year ?? null,
      })
      .select()
      .single();

    if (!row) return null;
    const situation = mapSituation(row, []);
    set((s) => ({ situations: [...s.situations, situation] }));
    return situation;
  },

  updateSituationStatus: async (id, status) => {
    await supabase.from('construction_log_situations').update({ status }).eq('id', id);
    set((s) => ({
      situations: s.situations.map((sit) =>
        sit.id === id ? { ...sit, status: status as any } : sit
      ),
    }));
  },

  deleteSituation: async (id) => {
    await supabase.from('construction_log_situations').delete().eq('id', id);
    set((s) => ({
      situations: s.situations.filter((sit) => sit.id !== id),
      positions: s.positions.filter((p) => p.situationId !== id),
    }));
  },

  addSheet: async (situationId, data) => {
    const { data: row } = await supabase
      .from('construction_log_sheets')
      .insert({
        situation_id: situationId,
        file_name: data.fileName,
        file_type: data.fileType,
        file_url: data.fileUrl || null,
      })
      .select()
      .single();

    if (!row) return null;
    const sheet = mapSheet(row);
    set((s) => ({
      situations: s.situations.map((sit) =>
        sit.id === situationId ? { ...sit, sheets: [...sit.sheets, sheet] } : sit
      ),
    }));
    return sheet;
  },

  updateSheet: async (id, data) => {
    const u: Record<string, any> = {};
    if (data.parsedData !== undefined) u.parsed_data = data.parsedData;
    if (data.validationResults !== undefined) u.validation_results = data.validationResults;
    if (data.status !== undefined) u.status = data.status;
    await supabase.from('construction_log_sheets').update(u).eq('id', id);

    set((s) => ({
      situations: s.situations.map((sit) => ({
        ...sit,
        sheets: sit.sheets.map((sh) =>
          sh.id === id ? { ...sh, ...data } as ConstructionLogSheet : sh
        ),
      })),
    }));
  },

  deleteSheet: async (id, situationId) => {
    await supabase.from('construction_log_sheets').delete().eq('id', id);
    set((s) => ({
      situations: s.situations.map((sit) =>
        sit.id === situationId
          ? { ...sit, sheets: sit.sheets.filter((sh) => sh.id !== id) }
          : sit
      ),
    }));
  },

  loadPositions: async (projectId) => {
    const { data } = await supabase
      .from('construction_log_positions')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at');
    set({ positions: (data || []).map(mapPosition) });
  },

  savePositions: async (positions) => {
    const rows = positions.map((p) => ({
      project_id: p.projectId,
      bill_item_id: p.billItemId,
      situation_id: p.situationId,
      sheet_id: p.sheetId,
      sheet_name: p.sheetName,
      detected_position: p.detectedPosition,
      description: p.description,
      unit_uploaded: p.unitUploaded,
      unit_price_uploaded: p.unitPriceUploaded,
      quantity_this_period: p.quantityThisPeriod,
      quantity_cumulative: p.quantityCumulative,
      match_status: p.matchStatus,
    }));

    const { data } = await supabase
      .from('construction_log_positions')
      .insert(rows)
      .select();

    if (data) {
      const newPositions = data.map(mapPosition);
      set((s) => ({ positions: [...s.positions, ...newPositions] }));
    }
  },

  deletePositionsBySituation: async (situationId) => {
    await supabase.from('construction_log_positions').delete().eq('situation_id', situationId);
    set((s) => ({ positions: s.positions.filter((p) => p.situationId !== situationId) }));
  },
}));
