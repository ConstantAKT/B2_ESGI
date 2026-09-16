import { NextRequest, NextResponse } from "next/server";
import { GameError, getRoomByCode, tickRoom, validateTeamActions } from "@/lib/game";
import { getPlayerToken, jsonError, readJson } from "@/lib/http";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const body = await readJson<{ teamId?: string }>(req);
    if (!body.teamId) throw new GameError("teamId requis");
    const room = await getRoomByCode(code);
    await validateTeamActions(room.id, body.teamId, getPlayerToken(req) ?? "");
    await tickRoom(room.id); // résout immédiatement si c'était la dernière équipe à valider
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
