-- CreateEnum
CREATE TYPE "BestOf" AS ENUM ('BO1', 'BO3', 'BO5');

-- AlterTable
ALTER TABLE "Game"
    ADD COLUMN "seriesId" TEXT NOT NULL DEFAULT 'legacy-series',
    ADD COLUMN "gameInSeries" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN "bestOf" "BestOf" NOT NULL DEFAULT 'BO1';

ALTER TABLE "Game"
    ALTER COLUMN "seriesId" DROP DEFAULT,
    ALTER COLUMN "gameInSeries" DROP DEFAULT,
    ALTER COLUMN "bestOf" DROP DEFAULT;

CREATE INDEX "Game_seriesId_idx" ON "Game"("seriesId");
CREATE INDEX "Game_tournament_stage_idx" ON "Game"("tournament", "stage");

-- CreateTable
CREATE TABLE "PlannedSeries" (
    "id" SERIAL PRIMARY KEY,
    "tournament" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "bestOf" "BestOf" NOT NULL
);

CREATE UNIQUE INDEX "PlannedSeries_seriesId_key" ON "PlannedSeries"("seriesId");
CREATE INDEX "PlannedSeries_tournament_stage_idx" ON "PlannedSeries"("tournament", "stage");
