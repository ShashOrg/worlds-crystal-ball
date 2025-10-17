// app/api/picks/save/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
    // IMPORTANT: pass authOptions so NextAuth uses your database session strategy
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ ok: false, error: "Auth required" }, { status: 401 });
    }

    const form = await req.formData();
    const season = Number(form.get("season"));
    const mostPickedChampionId = form.get("mostPickedChampionId")
        ? Number(form.get("mostPickedChampionId"))
        : null;
    const highestWrChampionId = form.get("highestWrChampionId")
        ? Number(form.get("highestWrChampionId"))
        : null;
    const highestKdaPlayerId = form.get("highestKdaPlayerId")
        ? Number(form.get("highestKdaPlayerId"))
        : null;
    const teemoPicked = Boolean(form.get("teemoPicked"));

    await prisma.userPick.upsert({
        where: { userId_season: { userId: session.user.id, season } },
        update: { mostPickedChampionId, highestWrChampionId, highestKdaPlayerId, teemoPicked },
        create: {
            userId: session.user.id,
            season,
            mostPickedChampionId,
            highestWrChampionId,
            highestKdaPlayerId,
            teemoPicked,
        },
    });

    // Redirect back to /picks
    return NextResponse.redirect(new URL("/picks", req.url), { status: 303 });
}
