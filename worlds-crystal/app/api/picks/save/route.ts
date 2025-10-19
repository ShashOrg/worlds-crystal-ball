// app/api/picks/save/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { STATISTICS } from "@/lib/statistics";
import type { Prisma } from "@prisma/client";

type SelectionData = {
    championId: number | null;
    playerId: number | null;
    teamName: string | null;
    valueNumber: number | null;
    valueBoolean: boolean | null;
    valueText: string | null;
};

function parseSelectionValue(statKey: string, raw: FormDataEntryValue | null): SelectionData | null {
    const stat = STATISTICS.find((s) => s.key === statKey);
    if (!stat) return null;

    const base: SelectionData = {
        championId: null,
        playerId: null,
        teamName: null,
        valueNumber: null,
        valueBoolean: null,
        valueText: null,
    };

    if (raw === null || raw === undefined) {
        return null;
    }

    const value = typeof raw === "string" ? raw.trim() : String(raw);
    if (!value.length) {
        return null;
    }

    switch (stat.entity_type) {
        case "champion": {
            const parsed = Number(value);
            if (Number.isNaN(parsed)) return null;
            return { ...base, championId: parsed };
        }
        case "player": {
            const parsed = Number(value);
            if (Number.isNaN(parsed)) return null;
            return { ...base, playerId: parsed };
        }
        case "team": {
            return { ...base, teamName: value, valueText: value };
        }
        case "event_total": {
            const parsed = Number(value);
            if (Number.isNaN(parsed)) return null;
            return { ...base, valueNumber: parsed };
        }
        case "boolean": {
            if (value !== "true" && value !== "false") return null;
            return { ...base, valueBoolean: value === "true" };
        }
        default:
            return null;
    }
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ ok: false, error: "Auth required" }, { status: 401 });
    }

    const form = await req.formData();
    const season = Number(form.get("season"));
    if (Number.isNaN(season)) {
        return NextResponse.json({ ok: false, error: "Invalid season" }, { status: 400 });
    }

    const userPick = await prisma.userPick.upsert({
        where: { userId_season: { userId: session.user.id, season } },
        update: {},
        create: {
            userId: session.user.id,
            season,
        },
    });

    const userPickSelectionDelegate = (prisma as unknown as {
        userPickSelection?: Prisma.UserPickSelectionDelegate<false>;
    }).userPickSelection;

    if (!userPickSelectionDelegate) {
        console.error(
            "Prisma client is missing the userPickSelection delegate. Run `pnpm prisma generate` to regenerate the client."
        );
        return NextResponse.json(
            {
                ok: false,
                error:
                    "Server is missing the regenerated Prisma client. Run `pnpm prisma generate` after pulling the latest schema.",
            },
            { status: 500 }
        );
    }

    for (const stat of STATISTICS) {
        const raw = form.get(stat.key);
        const parsed = parseSelectionValue(stat.key, raw);
        const where = {
            userPickId_statisticKey: {
                userPickId: userPick.id,
                statisticKey: stat.key,
            },
        };

        if (!parsed) {
            await userPickSelectionDelegate
                .delete({ where })
                .catch(() => undefined);
            continue;
        }

        await userPickSelectionDelegate.upsert({
            where,
            update: parsed,
            create: {
                userPickId: userPick.id,
                statisticKey: stat.key,
                ...parsed,
            },
        });
    }

    return NextResponse.redirect(new URL("/picks", req.url), { status: 303 });
}
