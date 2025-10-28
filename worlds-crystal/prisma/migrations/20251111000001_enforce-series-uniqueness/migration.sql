-- Ensure stored game numbers are at least 1 so the uniqueness guard is meaningful
UPDATE "Game"
SET "gameInSeries" = CASE WHEN "gameInSeries" <= 0 THEN 1 ELSE "gameInSeries" END,
    "seriesGameNo" = CASE WHEN "seriesGameNo" <= 0 THEN 1 ELSE "seriesGameNo" END,
    "seriesKey" = CASE WHEN "seriesKey" IS NULL OR "seriesKey" = '' THEN "seriesId" ELSE "seriesKey" END
WHERE "seriesId" IS NOT NULL;

CREATE UNIQUE INDEX "Game_seriesId_gameInSeries_key" ON "Game"("seriesId", "gameInSeries");
