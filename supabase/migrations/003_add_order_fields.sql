-- Add order-related columns to design_sessions
ALTER TABLE design_sessions ADD COLUMN IF NOT EXISTS printful_order_id text;
ALTER TABLE design_sessions ADD COLUMN IF NOT EXISTS order_recipient jsonb;
ALTER TABLE design_sessions ADD COLUMN IF NOT EXISTS ordered_at timestamptz;
