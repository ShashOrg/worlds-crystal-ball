ALTER TABLE "Game"
    ADD COLUMN "seriesKey" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "seriesGameNo" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX "Game_seriesKey_idx" ON "Game"("seriesKey");
