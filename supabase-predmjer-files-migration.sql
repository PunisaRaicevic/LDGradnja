-- Migracija: Tabela predmjer_files za upload fajlova predmjera
-- Pokrenite u Supabase SQL Editoru (Dashboard → SQL Editor → New Query)

-- 1. Kreiraj tabelu
CREATE TABLE predmjer_files (
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

CREATE INDEX idx_predmjer_files_project ON predmjer_files(project_id);

-- 2. Uključi RLS
ALTER TABLE predmjer_files ENABLE ROW LEVEL SECURITY;

-- 3. RLS politike (iste kao za drawings - provjerava vlasništvo kroz project_id)
CREATE POLICY "predmjer_files_select" ON predmjer_files
  FOR SELECT USING (auth_owns_project(project_id));

CREATE POLICY "predmjer_files_insert" ON predmjer_files
  FOR INSERT WITH CHECK (auth_owns_project(project_id));

CREATE POLICY "predmjer_files_update" ON predmjer_files
  FOR UPDATE USING (auth_owns_project(project_id));

CREATE POLICY "predmjer_files_delete" ON predmjer_files
  FOR DELETE USING (auth_owns_project(project_id));

-- 4. Kreiraj storage bucket "predmjer" u Supabase Dashboard → Storage
-- Ili pokrenite:
INSERT INTO storage.buckets (id, name, public)
VALUES ('predmjer', 'predmjer', false)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage politike za bucket "predmjer"
CREATE POLICY "predmjer_storage_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'predmjer' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "predmjer_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'predmjer' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "predmjer_storage_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'predmjer' AND auth.uid()::text = (storage.foldername(name))[1]);
