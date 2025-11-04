import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

import { PickProbability } from "./questions";

const normalizeDetails = (details: unknown): Prisma.InputJsonValue => {
  if (details === null || details === undefined) {
    return {} as Prisma.InputJsonValue;
  }

  try {
    return JSON.parse(JSON.stringify(details)) as Prisma.InputJsonValue;
  } catch (error) {
    console.warn("Failed to serialize probability snapshot details", error);
    return {} as Prisma.InputJsonValue;
  }
};

export async function saveProbabilitySnapshots(questionId: number, entries: PickProbability[]) {
  if (entries.length === 0) return;
  const writes = entries.map((entry) =>
    prisma.probabilitySnapshot.create({
      data: {
        questionId,
        answerKey: entry.answerKey,
        probability: entry.probability,
        detailsJson: normalizeDetails(entry.details),
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
