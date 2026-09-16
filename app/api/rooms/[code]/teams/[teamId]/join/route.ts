import { NextRequest, NextResponse } from "next/server";
import { getRoomByCode, joinTeam } from "@/lib/game";
import { getPlayerToken, jsonError, readJson } from "@/lib/http";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string; teamId: string }> }
) {
  try {
    const { code, teamId } = await params;
    const body = await readJson<{ playerId?: string }>(req);
    const room = await getRoomByCode(code);
    await joinTeam(room.id, body.playerId ?? "", getPlayerToken(req) ?? "", teamId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
