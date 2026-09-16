import { NextRequest, NextResponse } from "next/server";
import { buildHostView, getRoomByCode, hostExtendTurn } from "@/lib/game";
import { getHostToken, jsonError, readJson } from "@/lib/http";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const body = await readJson<{ seconds?: number }>(req);
    const room = await getRoomByCode(code);
    await hostExtendTurn(room.id, getHostToken(req) ?? "", Math.max(0, Math.min(600, body.seconds ?? 60)));
    return NextResponse.json(await buildHostView(room.id));
  } catch (error) {
    return jsonError(error);
  }
}
