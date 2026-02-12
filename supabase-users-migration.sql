-- LDGradnja - User Management Migration
-- Pokrenite ovo u Supabase SQL Editoru (Dashboard > SQL Editor > New Query)

-- ============================================================
-- NOVE TABELE
-- ============================================================

-- app_users: korisnici koje admin kreira na nivou aplikacije
CREATE TABLE app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  phone text DEFAULT '',
  role text NOT NULL DEFAULT 'worker' CHECK (role IN ('admin', 'worker')),
  auth_user_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_app_users_admin ON app_users(admin_id);
CREATE INDEX idx_app_users_email ON app_users(email);
CREATE INDEX idx_app_users_auth ON app_users(auth_user_id);

-- project_members: dodjela korisnika na projekte
CREATE TABLE project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'worker' CHECK (role IN ('admin', 'worker')),
  added_at timestamptz DEFAULT now(),
  UNIQUE(project_id, user_id)
);
CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user ON project_members(user_id);

-- ============================================================
-- RLS ZA NOVE TABELE
-- ============================================================

ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

-- Admin moze vidjeti samo korisnike koje je sam kreirao
CREATE POLICY "app_users_select" ON app_users FOR SELECT
  USING (admin_id = auth.uid());
CREATE POLICY "app_users_insert" ON app_users FOR INSERT
  WITH CHECK (admin_id = auth.uid());
CREATE POLICY "app_users_update" ON app_users FOR UPDATE
  USING (admin_id = auth.uid());
CREATE POLICY "app_users_delete" ON app_users FOR DELETE
  USING (admin_id = auth.uid());

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- Project members: admin moze upravljati memberima svojih projekata
CREATE POLICY "project_members_select" ON project_members FOR SELECT
  USING (auth_owns_project(project_id));
CREATE POLICY "project_members_insert" ON project_members FOR INSERT
  WITH CHECK (auth_owns_project(project_id));
CREATE POLICY "project_members_update" ON project_members FOR UPDATE
  USING (auth_owns_project(project_id));
CREATE POLICY "project_members_delete" ON project_members FOR DELETE
  USING (auth_owns_project(project_id));

-- ============================================================
-- NOVA FUNKCIJA: provjera pristupa projektu (vlasnik ILI member)
-- ============================================================

CREATE OR REPLACE FUNCTION auth_has_project_access(p_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects WHERE id = p_id AND user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM project_members pm
    JOIN app_users au ON au.id = pm.user_id
    WHERE pm.project_id = p_id AND au.auth_user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================
-- AUTOMATSKO POVEZIVANJE: kad se korisnik registruje,
-- povezi ga sa app_users zapisom po emailu
-- ============================================================

CREATE OR REPLACE FUNCTION link_auth_user_to_app_user()
RETURNS trigger AS $$
BEGIN
  UPDATE app_users
  SET auth_user_id = NEW.id
  WHERE email = NEW.email AND auth_user_id IS NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION link_auth_user_to_app_user();
