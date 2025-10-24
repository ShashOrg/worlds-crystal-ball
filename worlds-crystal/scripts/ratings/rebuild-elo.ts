#!/usr/bin/env tsx

import "dotenv/config";

import { prisma } from "@/lib/prisma";
import { rebuildTournamentElo } from "@/lib/probability/eloRebuild";

function usage(): never {
  console.error("Usage: tsx scripts/ratings/rebuild-elo.ts --tournament <slug>");
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  const idx = args.findIndex((arg) => arg === "--tournament");
  if (idx === -1 || !args[idx + 1]) usage();
  const tournamentSlug = args[idx + 1]!;

  const tournament = await prisma.tournament.findUnique({ where: { slug: tournamentSlug } });
  if (!tournament) {
    throw new Error(`Tournament ${tournamentSlug} not found`);
  }

  const result = await rebuildTournamentElo(tournament.id);
  console.log(
    `Rebuilt Elo for ${tournamentSlug}: ${result.teamsUpdated} teams, ${result.matchesProcessed} matches processed`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
