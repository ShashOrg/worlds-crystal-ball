import { NextRequest, NextResponse } from "next/server";

import { calculatePickProbabilities } from "@/lib/probability/questions";
import { getLatestSnapshots, saveProbabilitySnapshots } from "@/lib/probability/snapshot";

export async function GET(_: NextRequest, { params }: { params: { questionId: string } }) {
  const questionId = Number(params.questionId);
  if (Number.isNaN(questionId)) {
    return NextResponse.json({ error: "Invalid question id" }, { status: 400 });
  }

  const latest = await getLatestSnapshots(questionId);
  if (latest.length > 0) {
    return NextResponse.json(latest);
  }

  const probabilities = await calculatePickProbabilities(questionId);
  await saveProbabilitySnapshots(questionId, probabilities);
  const refreshed = await getLatestSnapshots(questionId);
  return NextResponse.json(refreshed.sort((a, b) => b.probability - a.probability));
}

export async function POST(request: NextRequest, { params }: { params: { questionId: string } }) {
  const questionId = Number(params.questionId);
  if (Number.isNaN(questionId)) {
    return NextResponse.json({ error: "Invalid question id" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const forceRefresh = body?.refresh === true || request.nextUrl.pathname.endsWith("/refresh");
  if (!forceRefresh) {
    return NextResponse.json({ error: "Use refresh flag to recompute" }, { status: 400 });
  }

  const probabilities = await calculatePickProbabilities(questionId);
  await saveProbabilitySnapshots(questionId, probabilities);
  const refreshed = await getLatestSnapshots(questionId);
  return NextResponse.json(refreshed.sort((a, b) => b.probability - a.probability));
}
