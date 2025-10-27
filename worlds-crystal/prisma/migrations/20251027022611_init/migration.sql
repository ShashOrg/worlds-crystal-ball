-- CreateEnum
CREATE TYPE "Side" AS ENUM ('BLUE', 'RED');

-- CreateEnum
CREATE TYPE "BestOf" AS ENUM ('BO1', 'BO3', 'BO5');

-- CreateEnum
CREATE TYPE "StatisticEntityType" AS ENUM ('champion', 'player', 'team', 'event_total', 'boolean');

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
    "oracleGameId" TEXT,
    "seriesId" TEXT NOT NULL,
    "gameInSeries" INTEGER NOT NULL,
    "bestOf" "BestOf" NOT NULL,

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
CREATE TABLE "Tournament" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "region" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stage" (
    "id" SERIAL NOT NULL,
    "tournamentId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "bestOf" INTEGER NOT NULL,
    "type" TEXT NOT NULL,

    CONSTRAINT "Stage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "region" TEXT,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Series" (
    "id" SERIAL NOT NULL,
    "stageId" INTEGER NOT NULL,
    "round" INTEGER NOT NULL,
    "indexInRound" INTEGER NOT NULL,
    "bestOf" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "blueTeamId" INTEGER,
    "redTeamId" INTEGER,
    "winnerTeamId" INTEGER,
    "scheduledAt" TIMESTAMP(3),
    "feedsWinnerToId" INTEGER,
    "feedsLoserToId" INTEGER,

    CONSTRAINT "Series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" SERIAL NOT NULL,
    "seriesId" INTEGER NOT NULL,
    "gameIndex" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "blueTeamId" INTEGER,
    "redTeamId" INTEGER,
    "winnerTeamId" INTEGER,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "oracleGameId" TEXT,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamRating" (
    "id" SERIAL NOT NULL,
    "teamId" INTEGER NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "rd" DOUBLE PRECISION,
    "vol" DOUBLE PRECISION,
    "patch" TEXT,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "tournamentId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "configJson" JSONB NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pick" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" INTEGER NOT NULL,
    "answerKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProbabilitySnapshot" (
    "id" SERIAL NOT NULL,
    "questionId" INTEGER NOT NULL,
    "answerKey" TEXT NOT NULL,
    "probability" DOUBLE PRECISION NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detailsJson" JSONB,

    CONSTRAINT "ProbabilitySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannedSeries" (
    "id" SERIAL NOT NULL,
    "tournament" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "bestOf" "BestOf" NOT NULL,

    CONSTRAINT "PlannedSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalMetric" (
    "id" SERIAL NOT NULL,
    "metricId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPick" (
    "id" BIGSERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "season" INTEGER NOT NULL,

    CONSTRAINT "UserPick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Champion_key_key" ON "Champion"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Player_handle_key" ON "Player"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "Game_oracleGameId_key" ON "Game"("oracleGameId");

-- CreateIndex
CREATE INDEX "Game_seriesId_idx" ON "Game"("seriesId");

-- CreateIndex
CREATE INDEX "Game_tournament_stage_idx" ON "Game"("tournament", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "GameChampStats_gameId_playerId_key" ON "GameChampStats"("gameId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "Tournament_slug_key" ON "Tournament"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Team_slug_key" ON "Team"("slug");

-- CreateIndex
CREATE INDEX "Series_stageId_round_indexInRound_idx" ON "Series"("stageId", "round", "indexInRound");

-- CreateIndex
CREATE UNIQUE INDEX "Match_oracleGameId_key" ON "Match"("oracleGameId");

-- CreateIndex
CREATE INDEX "TeamRating_teamId_createdAt_idx" ON "TeamRating"("teamId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Question_slug_key" ON "Question"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Pick_userId_questionId_key" ON "Pick"("userId", "questionId");

-- CreateIndex
CREATE INDEX "ProbabilitySnapshot_questionId_asOf_idx" ON "ProbabilitySnapshot"("questionId", "asOf");

-- CreateIndex
CREATE UNIQUE INDEX "PlannedSeries_seriesId_key" ON "PlannedSeries"("seriesId");

-- CreateIndex
CREATE INDEX "PlannedSeries_tournament_stage_idx" ON "PlannedSeries"("tournament", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalMetric_metricId_key" ON "ExternalMetric"("metricId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPickSelection_userPickId_statisticKey_key" ON "UserPickSelection"("userPickId", "statisticKey");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserPick_userId_season_key" ON "UserPick"("userId", "season");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- AddForeignKey
ALTER TABLE "GameChampStats" ADD CONSTRAINT "GameChampStats_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameChampStats" ADD CONSTRAINT "GameChampStats_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameChampStats" ADD CONSTRAINT "GameChampStats_championId_fkey" FOREIGN KEY ("championId") REFERENCES "Champion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stage" ADD CONSTRAINT "Stage_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Series" ADD CONSTRAINT "Series_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Series" ADD CONSTRAINT "Series_blueTeamId_fkey" FOREIGN KEY ("blueTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Series" ADD CONSTRAINT "Series_redTeamId_fkey" FOREIGN KEY ("redTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Series" ADD CONSTRAINT "Series_winnerTeamId_fkey" FOREIGN KEY ("winnerTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamRating" ADD CONSTRAINT "TeamRating_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pick" ADD CONSTRAINT "Pick_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProbabilitySnapshot" ADD CONSTRAINT "ProbabilitySnapshot_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPickSelection" ADD CONSTRAINT "UserPickSelection_userPickId_fkey" FOREIGN KEY ("userPickId") REFERENCES "UserPick"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPickSelection" ADD CONSTRAINT "UserPickSelection_statisticKey_fkey" FOREIGN KEY ("statisticKey") REFERENCES "Statistic"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPickSelection" ADD CONSTRAINT "UserPickSelection_championId_fkey" FOREIGN KEY ("championId") REFERENCES "Champion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPickSelection" ADD CONSTRAINT "UserPickSelection_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPick" ADD CONSTRAINT "UserPick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
