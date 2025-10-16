-- CreateEnum
CREATE TYPE "Side" AS ENUM ('BLUE', 'RED');

-- CreateTable
CREATE TABLE "Champion" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "riotId" INTEGER,
    "name" TEXT NOT NULL,

    CONSTRAINT "Champion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" SERIAL NOT NULL,
    "handle" TEXT NOT NULL,
    "team" TEXT,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" BIGSERIAL NOT NULL,
    "tournament" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "dateUtc" TIMESTAMP(3) NOT NULL,
    "patch" TEXT,
    "blueTeam" TEXT NOT NULL,
    "redTeam" TEXT NOT NULL,
    "winnerTeam" TEXT NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameChampStats" (
    "id" BIGSERIAL NOT NULL,
    "gameId" BIGINT NOT NULL,
    "side" "Side" NOT NULL,
    "playerId" INTEGER,
    "championId" INTEGER NOT NULL,
    "kills" INTEGER NOT NULL DEFAULT 0,
    "deaths" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "win" BOOLEAN NOT NULL,

    CONSTRAINT "GameChampStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPick" (
    "id" BIGSERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "mostPickedChampionId" INTEGER,
    "highestWrChampionId" INTEGER,
    "highestKdaPlayerId" INTEGER,
    "teemoPicked" BOOLEAN,

    CONSTRAINT "UserPick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Champion_key_key" ON "Champion"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Player_handle_key" ON "Player"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "UserPick_userId_season_key" ON "UserPick"("userId", "season");

-- AddForeignKey
ALTER TABLE "GameChampStats" ADD CONSTRAINT "GameChampStats_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameChampStats" ADD CONSTRAINT "GameChampStats_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameChampStats" ADD CONSTRAINT "GameChampStats_championId_fkey" FOREIGN KEY ("championId") REFERENCES "Champion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPick" ADD CONSTRAINT "UserPick_mostPickedChampionId_fkey" FOREIGN KEY ("mostPickedChampionId") REFERENCES "Champion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPick" ADD CONSTRAINT "UserPick_highestWrChampionId_fkey" FOREIGN KEY ("highestWrChampionId") REFERENCES "Champion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPick" ADD CONSTRAINT "UserPick_highestKdaPlayerId_fkey" FOREIGN KEY ("highestKdaPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
