import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const tournament = await prisma.tournament.findUnique({ where: { slug: "worlds-2025" } });
  if (!tournament) {
    throw new Error("Tournament worlds-2025 not found. Run schedule:upsert first.");
  }

  await prisma.question.createMany({
    data: [
      {
        slug: "team-wins-worlds",
        tournamentId: tournament.id,
        text: "Which team will win Worlds?",
        type: "binary",
        configJson: { answerPool: "teams_active" },
      },
      {
        slug: "most-picked-champion",
        tournamentId: tournament.id,
        text: "Which champion will be picked the most?",
        type: "categorical",
        configJson: { answerPool: "champions_all", patchScoped: true },
      },
      {
        slug: "total-barons",
        tournamentId: tournament.id,
        text: "How many Barons will be slain in total?",
        type: "numeric",
        configJson: { buckets: ["0-20", "21-40", "41-60", "61+"] },
      },
    ],
    skipDuplicates: true,
  });

  console.log("Seeded crystal ball questions for Worlds 2025");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
