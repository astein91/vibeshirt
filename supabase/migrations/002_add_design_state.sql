-- Add design_state column to persist design positioning for share pages
alter table design_sessions add column if not exists design_state jsonb;
