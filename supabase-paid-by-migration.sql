-- Add paid_by column to expenses table
-- Tracks who paid for each expense (e.g., Lolo, Saša, Noka)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS paid_by TEXT;
