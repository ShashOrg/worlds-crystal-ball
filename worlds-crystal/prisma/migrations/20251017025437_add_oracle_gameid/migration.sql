/*
  Warnings:

  - A unique constraint covering the columns `[gameId,playerId]` on the table `GameChampStats` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "GameChampStats_gameId_playerId_key" ON "GameChampStats"("gameId", "playerId");
