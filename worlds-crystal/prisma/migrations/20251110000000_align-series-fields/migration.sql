ALTER TABLE "Game"
    ADD COLUMN IF NOT EXISTS "seriesId" TEXT,
    ADD COLUMN IF NOT EXISTS "gameInSeries" INTEGER,
    ADD COLUMN IF NOT EXISTS "bestOf" "BestOf",
    ADD COLUMN IF NOT EXISTS "seriesKey" TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS "seriesGameNo" INTEGER NOT NULL DEFAULT 1;

UPDATE "Game" SET "seriesKey" = '' WHERE "seriesKey" IS NULL;
UPDATE "Game" SET "seriesGameNo" = 1 WHERE "seriesGameNo" IS NULL;

CREATE INDEX IF NOT EXISTS "Game_seriesKey_idx" ON "Game"("seriesKey");
CREATE INDEX IF NOT EXISTS "Game_seriesId_idx" ON "Game"("seriesId");
CREATE INDEX IF NOT EXISTS "Game_tournament_stage_idx" ON "Game"("tournament", "stage");
