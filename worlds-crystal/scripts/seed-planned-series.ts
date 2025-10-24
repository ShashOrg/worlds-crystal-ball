import "dotenv/config";
import { promises as fs } from "node:fs";
import path from "node:path";

import { BestOf } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type PlannedSeriesInput = {
    tournament: string;
    stage: string;
    seriesId: string;
    bestOf: string;
};

function parseBestOf(value: string): BestOf {
    const normalized = value.trim().toUpperCase();
    switch (normalized) {
        case "BO1":
            return BestOf.BO1;
        case "BO3":
            return BestOf.BO3;
        case "BO5":
            return BestOf.BO5;
        default:
            throw new Error(`Unsupported BestOf value: ${value}`);
    }
}

async function main() {
    const inputPath = process.argv[2];
    if (!inputPath) {
        console.error("Usage: pnpm tsx scripts/seed-planned-series.ts <path-to-json>");
        process.exitCode = 1;
        return;
    }

    const resolvedPath = path.isAbsolute(inputPath) ? inputPath : path.join(process.cwd(), inputPath);
    const raw = await fs.readFile(resolvedPath, "utf-8");
    const parsed = JSON.parse(raw) as PlannedSeriesInput[];

    if (!Array.isArray(parsed)) {
        throw new Error("Planned series seed must be an array of entries");
    }

    let upserted = 0;
    for (const entry of parsed) {
        if (!entry.tournament || !entry.stage || !entry.seriesId || !entry.bestOf) {
            console.warn("[planned-series] skipping invalid entry", entry);
            continue;
        }

        const bestOf = parseBestOf(entry.bestOf);
        await prisma.plannedSeries.upsert({
            where: { seriesId: entry.seriesId },
            update: {
                tournament: entry.tournament,
                stage: entry.stage,
                bestOf,
            },
            create: {
                tournament: entry.tournament,
                stage: entry.stage,
                seriesId: entry.seriesId,
                bestOf,
            },
        });
        upserted += 1;
    }

    console.log(`[planned-series] upserted ${upserted} planned series entries`);
}

main()
    .catch((error) => {
        console.error("[planned-series] failed to seed planned series", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
