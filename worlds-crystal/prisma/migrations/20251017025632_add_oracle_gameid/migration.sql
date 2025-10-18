/*
  Warnings:

  - A unique constraint covering the columns `[oracleGameId]` on the table `Game` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "oracleGameId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Game_oracleGameId_key" ON "Game"("oracleGameId");
