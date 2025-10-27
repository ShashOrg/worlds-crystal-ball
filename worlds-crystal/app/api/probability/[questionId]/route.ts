import { NextRequest, NextResponse } from "next/server";
import { calculatePickProbabilities } from "@/lib/probability/questions";
import { getLatestSnapshots, saveProbabilitySnapshots } from "@/lib/probability/snapshot";

// Avoid static optimization on this API route
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ questionId: string }> };

function parseId(s: string): number | null {
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export async function GET(_req: NextRequest, ctx: Params) {
  const { questionId } = await ctx.params;
  const id = parseId(questionId);
  if (id === null) {
    return NextResponse.json({ error: "Invalid questionId" }, { status: 400 });
  }

  // Use the repo’s abstraction instead of prisma.* directly
  const rows = await getLatestSnapshots(id);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest, ctx: Params) {
  const { questionId } = await ctx.params;
  const id = parseId(questionId);
  if (id === null) {
    return NextResponse.json({ error: "Invalid question id" }, { status: 400 });
  }

  // Accept either body { "refresh": true } or .../refresh path
  let forceRefresh = false;
  try {
    const body = await req.json();
    forceRefresh = body?.refresh === true;
  } catch { /* ignore */ }
  if (!forceRefresh && !req.nextUrl.pathname.endsWith("/refresh")) {
    return NextResponse.json({ error: "Use refresh flag to recompute" }, { status: 400 });
  }

  const probabilities = await calculatePickProbabilities(id);
  await saveProbabilitySnapshots(id, probabilities);

  const refreshed = await getLatestSnapshots(id);
  refreshed.sort((a, b) => b.probability - a.probability);
  return NextResponse.json(refreshed);
}
