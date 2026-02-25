-- Građevinska knjiga (Construction Log) - Migration
-- Pokrenite ovo u Supabase SQL Editoru

-- ============================================================
-- TABELE
-- ============================================================

-- Situacije građevinske knjige (grupisanje upload-a po periodu)
CREATE TABLE construction_log_situations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  month integer,
  year integer,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','confirmed','validated')),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_cls_project ON construction_log_situations(project_id);

-- Upload-ovani fajlovi po situaciji
CREATE TABLE construction_log_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  situation_id uuid NOT NULL REFERENCES construction_log_situations(id) ON DELETE CASCADE,
  file_url text,
  file_name text NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('excel','pdf')),
  parsed_data jsonb,
  validation_results jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','previewed','confirmed')),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_clsh_situation ON construction_log_sheets(situation_id);

-- Ekstrahovane pozicije povezane sa bill_items
CREATE TABLE construction_log_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  bill_item_id uuid REFERENCES bill_items(id) ON DELETE SET NULL,
  situation_id uuid NOT NULL REFERENCES construction_log_situations(id) ON DELETE CASCADE,
  sheet_id uuid REFERENCES construction_log_sheets(id) ON DELETE CASCADE,
  sheet_name text DEFAULT '',
  detected_position text DEFAULT '',
  description text DEFAULT '',
  unit_uploaded text DEFAULT '',
  unit_price_uploaded numeric DEFAULT 0,
  quantity_this_period numeric DEFAULT 0,
  quantity_cumulative numeric DEFAULT 0,
  match_status text NOT NULL DEFAULT 'auto' CHECK (match_status IN ('auto','manual','unmatched','skipped')),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_clp_project ON construction_log_positions(project_id);
CREATE INDEX idx_clp_bill_item ON construction_log_positions(bill_item_id);
CREATE INDEX idx_clp_situation ON construction_log_positions(situation_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- construction_log_situations: direct project_id check
ALTER TABLE construction_log_situations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cls_select" ON construction_log_situations FOR SELECT USING (auth_owns_project(project_id));
CREATE POLICY "cls_insert" ON construction_log_situations FOR INSERT WITH CHECK (auth_owns_project(project_id));
CREATE POLICY "cls_update" ON construction_log_situations FOR UPDATE USING (auth_owns_project(project_id));
CREATE POLICY "cls_delete" ON construction_log_situations FOR DELETE USING (auth_owns_project(project_id));

-- construction_log_sheets: through situation → project
ALTER TABLE construction_log_sheets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clsh_select" ON construction_log_sheets FOR SELECT
  USING (EXISTS (SELECT 1 FROM construction_log_situations s WHERE s.id = situation_id AND auth_owns_project(s.project_id)));
CREATE POLICY "clsh_insert" ON construction_log_sheets FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM construction_log_situations s WHERE s.id = situation_id AND auth_owns_project(s.project_id)));
CREATE POLICY "clsh_update" ON construction_log_sheets FOR UPDATE
  USING (EXISTS (SELECT 1 FROM construction_log_situations s WHERE s.id = situation_id AND auth_owns_project(s.project_id)));
CREATE POLICY "clsh_delete" ON construction_log_sheets FOR DELETE
  USING (EXISTS (SELECT 1 FROM construction_log_situations s WHERE s.id = situation_id AND auth_owns_project(s.project_id)));

-- construction_log_positions: direct project_id check
ALTER TABLE construction_log_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clp_select" ON construction_log_positions FOR SELECT USING (auth_owns_project(project_id));
CREATE POLICY "clp_insert" ON construction_log_positions FOR INSERT WITH CHECK (auth_owns_project(project_id));
CREATE POLICY "clp_update" ON construction_log_positions FOR UPDATE USING (auth_owns_project(project_id));
CREATE POLICY "clp_delete" ON construction_log_positions FOR DELETE USING (auth_owns_project(project_id));

-- ============================================================
-- STORAGE BUCKET
-- ============================================================

INSERT INTO storage.buckets (id, name, public) VALUES ('construction-logs', 'construction-logs', false);

CREATE POLICY "cl_storage_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'construction-logs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "cl_storage_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'construction-logs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "cl_storage_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'construction-logs' AND (storage.foldername(name))[1] = auth.uid()::text);
