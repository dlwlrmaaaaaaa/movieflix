-- Additive update for existing TogetherFlix installations.
-- No tables, columns or provider configuration are removed.
ALTER TYPE "PlaybackMode" ADD VALUE IF NOT EXISTS 'IFRAME';
ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "catalogSelection" JSONB;
