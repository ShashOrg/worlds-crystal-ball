import { NextResponse } from "next/server";

import {
  computeRemainingGamesWorlds2025,
  fallbackRemainingWorlds2025,
} from "@/src/domain/remainingGames/calcWorlds2025";

export async function GET() {
  try {
    const data = await computeRemainingGamesWorlds2025();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[remaining] error:", error);
    return NextResponse.json(fallbackRemainingWorlds2025());
  }
}
