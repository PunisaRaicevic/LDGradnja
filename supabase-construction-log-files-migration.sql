-- Migracija: Tabela construction_log_files za upload fajlova građevinske knjige
-- Pokrenite u Supabase SQL Editoru (Dashboard → SQL Editor → New Query)

-- 1. Kreiraj tabelu
CREATE TABLE construction_log_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'other',
  file_size BIGINT DEFAULT 0,
  description TEXT DEFAULT '',
  file_path TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_construction_log_files_project ON construction_log_files(project_id);

-- 2. Uključi RLS
ALTER TABLE construction_log_files ENABLE ROW LEVEL SECURITY;

-- 3. RLS politike
CREATE POLICY "construction_log_files_select" ON construction_log_files
  FOR SELECT USING (auth_owns_project(project_id));

CREATE POLICY "construction_log_files_insert" ON construction_log_files
  FOR INSERT WITH CHECK (auth_owns_project(project_id));

CREATE POLICY "construction_log_files_update" ON construction_log_files
  FOR UPDATE USING (auth_owns_project(project_id));

CREATE POLICY "construction_log_files_delete" ON construction_log_files
  FOR DELETE USING (auth_owns_project(project_id));

-- 4. Kreiraj storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('construction-log-files', 'construction-log-files', false)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage politike
CREATE POLICY "construction_log_files_storage_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'construction-log-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "construction_log_files_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'construction-log-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "construction_log_files_storage_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'construction-log-files' AND auth.uid()::text = (storage.foldername(name))[1]);
