import { prisma } from "@/lib/prisma";

import { PickProbability } from "./questions";

export async function saveProbabilitySnapshots(questionId: number, entries: PickProbability[]) {
  if (entries.length === 0) return;
  const writes = entries.map((entry) =>
    prisma.probabilitySnapshot.create({
      data: {
        questionId,
        answerKey: entry.answerKey,
        probability: entry.probability,
        detailsJson: entry.details ?? {},
      },
    }),
  );
  await prisma.$transaction(writes);
}

export async function getLatestSnapshots(questionId: number) {
  return prisma.probabilitySnapshot.findMany({
    where: { questionId },
    orderBy: { asOf: "desc" },
    take: 1000,
  });
}
