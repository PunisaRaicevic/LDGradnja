-- LDGradnja - Supabase Schema
-- Pokrenite ovo u Supabase SQL Editoru (Dashboard → SQL Editor → New Query)

-- ============================================================
-- TABELE
-- ============================================================

CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  location text DEFAULT '',
  start_date date,
  investor text DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','paused')),
  description text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_projects_user ON projects(user_id);

CREATE TABLE drawings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size bigint DEFAULT 0,
  version int DEFAULT 1,
  file_path text NOT NULL,
  description text DEFAULT '',
  uploaded_at timestamptz DEFAULT now()
);
CREATE INDEX idx_drawings_project ON drawings(project_id);

CREATE TABLE bill_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  ordinal text DEFAULT '',
  description text NOT NULL,
  unit text DEFAULT '',
  quantity numeric DEFAULT 0,
  unit_price numeric DEFAULT 0,
  total_price numeric DEFAULT 0
);
CREATE INDEX idx_bill_items_project ON bill_items(project_id);

CREATE TABLE situations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  number int NOT NULL,
  date date NOT NULL,
  period_from date,
  period_to date,
  total_value numeric DEFAULT 0,
  cumulative_value numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_situations_project ON situations(project_id);

CREATE TABLE situation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  situation_id uuid NOT NULL REFERENCES situations(id) ON DELETE CASCADE,
  bill_item_id uuid REFERENCES bill_items(id),
  percent_complete numeric DEFAULT 0,
  quantity_done numeric DEFAULT 0,
  value numeric DEFAULT 0,
  cumulative_percent numeric DEFAULT 0,
  cumulative_quantity numeric DEFAULT 0,
  cumulative_value numeric DEFAULT 0
);
CREATE INDEX idx_situation_items_situation ON situation_items(situation_id);

CREATE TABLE diary_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  date date NOT NULL,
  weather text DEFAULT '',
  temperature text DEFAULT '',
  worker_count int DEFAULT 0,
  work_description text DEFAULT '',
  materials text DEFAULT '',
  special_events text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_diary_project ON diary_entries(project_id);

CREATE TABLE expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  date date NOT NULL,
  supplier text DEFAULT '',
  description text DEFAULT '',
  quantity numeric DEFAULT 1,
  price numeric DEFAULT 0,
  total_amount numeric DEFAULT 0,
  category text DEFAULT 'ostalo',
  receipt_file_path text,
  receipt_file_name text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_expenses_project ON expenses(project_id);

CREATE TABLE contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('investor','subcontractor')),
  contract_number text DEFAULT '',
  date date,
  amount numeric DEFAULT 0,
  deadline date,
  party_name text NOT NULL,
  contact_info text DEFAULT '',
  scope_of_work text DEFAULT '',
  payment_terms text DEFAULT '',
  file_path text,
  file_name text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_contracts_project ON contracts(project_id);

CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  priority text DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  deadline date,
  assigned_to text DEFAULT '',
  status text DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_tasks_project ON tasks(project_id);

CREATE TABLE task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  description text DEFAULT '',
  uploaded_at timestamptz DEFAULT now()
);

CREATE TABLE material_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  description text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','ordered')),
  created_by text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_material_requests_project ON material_requests(project_id);

CREATE TABLE request_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES material_requests(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  description text DEFAULT '',
  uploaded_at timestamptz DEFAULT now()
);

CREATE TABLE purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  order_number text NOT NULL,
  date date NOT NULL,
  supplier text NOT NULL,
  total_amount numeric DEFAULT 0,
  status text DEFAULT 'created' CHECK (status IN ('created','sent','delivered')),
  material_request_id uuid REFERENCES material_requests(id),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_orders_project ON purchase_orders(project_id);

CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  ordinal int DEFAULT 0,
  description text NOT NULL,
  unit text DEFAULT '',
  quantity numeric DEFAULT 0,
  unit_price numeric DEFAULT 0,
  amount numeric DEFAULT 0
);

CREATE TABLE project_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  description text DEFAULT '',
  date date,
  uploaded_at timestamptz DEFAULT now()
);
CREATE INDEX idx_project_photos_project ON project_photos(project_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Helper function: check if user owns a project
CREATE OR REPLACE FUNCTION auth_owns_project(p_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects WHERE id = p_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Projects: direct user_id check
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projects_select" ON projects FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "projects_insert" ON projects FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "projects_update" ON projects FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "projects_delete" ON projects FOR DELETE USING (user_id = auth.uid());

-- All other tables: check through project_id
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'drawings','bill_items','situations','diary_entries',
    'expenses','contracts','tasks','material_requests',
    'purchase_orders','project_photos'
  ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "%s_select" ON %I FOR SELECT USING (auth_owns_project(project_id))', t, t);
    EXECUTE format('CREATE POLICY "%s_insert" ON %I FOR INSERT WITH CHECK (auth_owns_project(project_id))', t, t);
    EXECUTE format('CREATE POLICY "%s_update" ON %I FOR UPDATE USING (auth_owns_project(project_id))', t, t);
    EXECUTE format('CREATE POLICY "%s_delete" ON %I FOR DELETE USING (auth_owns_project(project_id))', t, t);
  END LOOP;
END $$;

-- Nested tables (through parent → project)
-- situation_items via situation → project
ALTER TABLE situation_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "situation_items_select" ON situation_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM situations s WHERE s.id = situation_id AND auth_owns_project(s.project_id)));
CREATE POLICY "situation_items_insert" ON situation_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM situations s WHERE s.id = situation_id AND auth_owns_project(s.project_id)));
CREATE POLICY "situation_items_update" ON situation_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM situations s WHERE s.id = situation_id AND auth_owns_project(s.project_id)));
CREATE POLICY "situation_items_delete" ON situation_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM situations s WHERE s.id = situation_id AND auth_owns_project(s.project_id)));

-- task_attachments via task → project
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_attachments_select" ON task_attachments FOR SELECT
  USING (EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND auth_owns_project(t.project_id)));
CREATE POLICY "task_attachments_insert" ON task_attachments FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND auth_owns_project(t.project_id)));
CREATE POLICY "task_attachments_update" ON task_attachments FOR UPDATE
  USING (EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND auth_owns_project(t.project_id)));
CREATE POLICY "task_attachments_delete" ON task_attachments FOR DELETE
  USING (EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND auth_owns_project(t.project_id)));

-- request_photos via material_request → project
ALTER TABLE request_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "request_photos_select" ON request_photos FOR SELECT
  USING (EXISTS (SELECT 1 FROM material_requests mr WHERE mr.id = request_id AND auth_owns_project(mr.project_id)));
CREATE POLICY "request_photos_insert" ON request_photos FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM material_requests mr WHERE mr.id = request_id AND auth_owns_project(mr.project_id)));
CREATE POLICY "request_photos_update" ON request_photos FOR UPDATE
  USING (EXISTS (SELECT 1 FROM material_requests mr WHERE mr.id = request_id AND auth_owns_project(mr.project_id)));
CREATE POLICY "request_photos_delete" ON request_photos FOR DELETE
  USING (EXISTS (SELECT 1 FROM material_requests mr WHERE mr.id = request_id AND auth_owns_project(mr.project_id)));

-- order_items via purchase_order → project
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_items_select" ON order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM purchase_orders po WHERE po.id = order_id AND auth_owns_project(po.project_id)));
CREATE POLICY "order_items_insert" ON order_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM purchase_orders po WHERE po.id = order_id AND auth_owns_project(po.project_id)));
CREATE POLICY "order_items_update" ON order_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM purchase_orders po WHERE po.id = order_id AND auth_owns_project(po.project_id)));
CREATE POLICY "order_items_delete" ON order_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM purchase_orders po WHERE po.id = order_id AND auth_owns_project(po.project_id)));

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================

INSERT INTO storage.buckets (id, name, public) VALUES ('drawings', 'drawings', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('contracts', 'contracts', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('photos', 'photos', false);

-- Storage RLS: users can only access their own folder ({user_id}/...)
CREATE POLICY "storage_select" ON storage.objects FOR SELECT
  USING (bucket_id IN ('drawings','receipts','contracts','photos') AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "storage_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id IN ('drawings','receipts','contracts','photos') AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "storage_delete" ON storage.objects FOR DELETE
  USING (bucket_id IN ('drawings','receipts','contracts','photos') AND (storage.foldername(name))[1] = auth.uid()::text);
