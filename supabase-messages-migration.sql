-- Migracija: Kreiranje tabele messages za komunikacijski sistem
-- Pokrenuti u Supabase SQL editoru

CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sender_name text NOT NULL,
  content text DEFAULT '',
  image_path text,
  image_name text,
  message_type text DEFAULT 'text' CHECK (message_type IN ('text','image','task_update','request_update')),
  related_task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  related_request_id uuid REFERENCES material_requests(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_messages_project ON messages(project_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_select" ON messages FOR SELECT USING (auth_owns_project(project_id));
CREATE POLICY "messages_insert" ON messages FOR INSERT WITH CHECK (auth_owns_project(project_id));
CREATE POLICY "messages_update" ON messages FOR UPDATE USING (auth_owns_project(project_id));
CREATE POLICY "messages_delete" ON messages FOR DELETE USING (auth_owns_project(project_id));
