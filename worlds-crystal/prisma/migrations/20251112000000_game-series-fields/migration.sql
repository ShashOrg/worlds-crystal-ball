ALTER TABLE "Game"
    ADD COLUMN IF NOT EXISTS "seriesId" TEXT,
    ADD COLUMN IF NOT EXISTS "gameInSeries" INTEGER;

UPDATE "Game"
SET "seriesId" = COALESCE("seriesId", ''),
    "gameInSeries" = CASE WHEN "gameInSeries" IS NULL OR "gameInSeries" <= 0 THEN 1 ELSE "gameInSeries" END;

ALTER TABLE "Game"
    ALTER COLUMN "seriesId" SET NOT NULL,
    ALTER COLUMN "gameInSeries" SET NOT NULL;

DROP INDEX IF EXISTS "Game_seriesKey_idx";
DROP INDEX IF EXISTS "Game_seriesId_idx";
DROP INDEX IF EXISTS "Game_tournament_stage_idx";

CREATE INDEX IF NOT EXISTS "Game_seriesId_idx" ON "Game"("seriesId");
CREATE INDEX IF NOT EXISTS "Game_tournament_stage_idx" ON "Game"("tournament", "stage");
CREATE UNIQUE INDEX IF NOT EXISTS "Game_seriesId_gameInSeries_key" ON "Game"("seriesId", "gameInSeries");

ALTER TABLE "Game"
    DROP COLUMN IF EXISTS "seriesKey",
    DROP COLUMN IF EXISTS "seriesGameNo",
    DROP COLUMN IF EXISTS "bestOf";
