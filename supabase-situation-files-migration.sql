-- Migracija: Tabela situation_files za upload fajlova privremenih situacija
-- Pokrenite u Supabase SQL Editoru (Dashboard → SQL Editor → New Query)

-- 1. Kreiraj tabelu
CREATE TABLE situation_files (
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

CREATE INDEX idx_situation_files_project ON situation_files(project_id);

-- 2. Uključi RLS
ALTER TABLE situation_files ENABLE ROW LEVEL SECURITY;

-- 3. RLS politike
CREATE POLICY "situation_files_select" ON situation_files
  FOR SELECT USING (auth_owns_project(project_id));

CREATE POLICY "situation_files_insert" ON situation_files
  FOR INSERT WITH CHECK (auth_owns_project(project_id));

CREATE POLICY "situation_files_update" ON situation_files
  FOR UPDATE USING (auth_owns_project(project_id));

CREATE POLICY "situation_files_delete" ON situation_files
  FOR DELETE USING (auth_owns_project(project_id));

-- 4. Kreiraj storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('situation-files', 'situation-files', false)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage politike
CREATE POLICY "situation_files_storage_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'situation-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "situation_files_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'situation-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "situation_files_storage_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'situation-files' AND auth.uid()::text = (storage.foldername(name))[1]);
