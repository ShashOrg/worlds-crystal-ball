import { NextResponse } from "next/server";

import { getSeriesAndGamesStats } from "@/lib/stats/seriesGames";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const tournament = searchParams.get("tournament") ?? undefined;
    const stage = searchParams.get("stage") ?? undefined;

    const data = await getSeriesAndGamesStats({ tournament, stage });
    return NextResponse.json(data);
}
