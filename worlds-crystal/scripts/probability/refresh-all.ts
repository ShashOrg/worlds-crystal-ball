#!/usr/bin/env tsx

import "dotenv/config";

import { prisma } from "@/lib/prisma";
import { calculatePickProbabilities } from "@/lib/probability/questions";
import { saveProbabilitySnapshots } from "@/lib/probability/snapshot";

function usage(): never {
  console.error("Usage: tsx scripts/probability/refresh-all.ts --tournament <slug>");
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

  const questions = await prisma.question.findMany({ where: { tournamentId: tournament.id } });
  for (const question of questions) {
    const probabilities = await calculatePickProbabilities(question.id);
    await saveProbabilitySnapshots(question.id, probabilities);
    console.log(`Refreshed probabilities for question ${question.slug}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
