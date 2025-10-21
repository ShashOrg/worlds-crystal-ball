/* prisma/seed.ts */
import { PrismaClient } from "@prisma/client";
import { STATISTICS } from "../lib/statistics";

interface ChampionData {
    id: string;
    key: string;
    name: string;
}

const prisma = new PrismaClient();

type StatisticConstraintsInput = Parameters<
    (typeof prisma.statistic)["upsert"]
>[0]["update"]["constraints"];

const toConstraintsInput = (
    value: unknown
): StatisticConstraintsInput =>
    value == null ? undefined : (value as Exclude<StatisticConstraintsInput, undefined>);

async function seedChampions() {
    const ddVersion = "14.20.1"; // example; use the Worlds patch version you want
    const url = `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/data/en_US/champion.json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch DDragon: ${res.status}`);
    const data = await res.json();

    const champions = Object.values(data.data as Record<string, ChampionData>).map((c) => ({
        key: c.id,
        riotId: Number(c.key),
        name: c.name,
    }));

    for (const c of champions) {
        await prisma.champion.upsert({
            where: { key: c.key },
            update: { name: c.name, riotId: c.riotId },
            create: c,
        });
    }

    console.log(`Seeded ${champions.length} champions`);
}

async function seedStatistics() {
    for (const stat of STATISTICS) {
        await prisma.statistic.upsert({
            where: { key: stat.key },
            update: {
                category: stat.category,
                question: stat.question,
                entityType: stat.entity_type,
                metricId: stat.metric_id,
                points: stat.points,
                constraints: toConstraintsInput(stat.constraints),
            },
            create: {
                key: stat.key,
                category: stat.category,
                question: stat.question,
                entityType: stat.entity_type,
                metricId: stat.metric_id,
                points: stat.points,
                constraints: toConstraintsInput(stat.constraints),
            },
        });
    }

    console.log(`Seeded ${STATISTICS.length} statistics`);
}

async function main() {
    await seedChampions();
    await seedStatistics();
}

main().finally(() => prisma.$disconnect());
