-- Add paid_by column to expenses table
-- Tracks who paid for each expense (e.g., Lolo, Saša, Noka)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS paid_by TEXT;

-- Add paid_by_shares column for split payments
-- JSONB array: [{"name": "Lolo", "amount": 50}, {"name": "Saša", "amount": 30}]
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS paid_by_shares JSONB;
