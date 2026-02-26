-- LDGradnja - Username Login Migration
-- Pokrenite ovo u Supabase SQL Editoru (Dashboard > SQL Editor > New Query)

-- 1. Dodaj username kolonu u app_users
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- 2. Email vise nije obavezan (radnici ne moraju imati email)
ALTER TABLE app_users ALTER COLUMN email DROP NOT NULL;

-- 3. Dozvoli radnicima da vide svoj sopstveni zapis
DROP POLICY IF EXISTS "app_users_select" ON app_users;
CREATE POLICY "app_users_select" ON app_users FOR SELECT
  USING (admin_id = auth.uid() OR auth_user_id = auth.uid());
