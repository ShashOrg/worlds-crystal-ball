/* prisma/seed.ts */
import { PrismaClient } from "@prisma/client";

interface ChampionData {
    id: string;
    key: string;
    name: string;
}

const prisma = new PrismaClient();

async function main() {
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

main().finally(() => prisma.$disconnect());
