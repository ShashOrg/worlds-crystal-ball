-- Drop existing pick columns that are superseded by selections
ALTER TABLE "UserPick" DROP CONSTRAINT IF EXISTS "UserPick_mostPickedChampionId_fkey";
ALTER TABLE "UserPick" DROP CONSTRAINT IF EXISTS "UserPick_highestWrChampionId_fkey";
ALTER TABLE "UserPick" DROP CONSTRAINT IF EXISTS "UserPick_highestKdaPlayerId_fkey";

ALTER TABLE "UserPick"
    DROP COLUMN IF EXISTS "mostPickedChampionId",
    DROP COLUMN IF EXISTS "highestWrChampionId",
    DROP COLUMN IF EXISTS "highestKdaPlayerId",
    DROP COLUMN IF EXISTS "teemoPicked";

-- New enum for statistic entity types
CREATE TYPE "StatisticEntityType" AS ENUM ('champion', 'player', 'team', 'event_total', 'boolean');

-- Table of supported statistics definitions
CREATE TABLE "Statistic" (
    "key" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "entityType" "StatisticEntityType" NOT NULL,
    "metricId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "constraints" JSONB,
    CONSTRAINT "Statistic_pkey" PRIMARY KEY ("key")
);

-- Individual selections for each statistic per user pick
CREATE TABLE "UserPickSelection" (
    "id" BIGSERIAL NOT NULL,
    "userPickId" BIGINT NOT NULL,
    "statisticKey" TEXT NOT NULL,
    "championId" INTEGER,
    "playerId" INTEGER,
    "teamName" TEXT,
    "valueNumber" DOUBLE PRECISION,
    "valueBoolean" BOOLEAN,
    "valueText" TEXT,
    CONSTRAINT "UserPickSelection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserPickSelection_userPickId_statisticKey_key" ON "UserPickSelection"("userPickId", "statisticKey");

ALTER TABLE "UserPickSelection"
    ADD CONSTRAINT "UserPickSelection_userPickId_fkey" FOREIGN KEY ("userPickId") REFERENCES "UserPick"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserPickSelection"
    ADD CONSTRAINT "UserPickSelection_statisticKey_fkey" FOREIGN KEY ("statisticKey") REFERENCES "Statistic"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UserPickSelection"
    ADD CONSTRAINT "UserPickSelection_championId_fkey" FOREIGN KEY ("championId") REFERENCES "Champion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UserPickSelection"
    ADD CONSTRAINT "UserPickSelection_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
