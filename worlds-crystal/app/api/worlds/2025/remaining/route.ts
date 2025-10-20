import { NextResponse } from "next/server";

import { computeRemainingGamesWorlds2025 } from "@/src/domain/remainingGames/calcWorlds2025";

export async function GET() {
  const data = await computeRemainingGamesWorlds2025();
  return NextResponse.json(data);
}
