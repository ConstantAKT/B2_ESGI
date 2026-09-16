import { NextRequest, NextResponse } from "next/server";
import { GameError, getRoomByCode, submitTeamActions, tickRoom, type ActionInput } from "@/lib/game";
import { getPlayerToken, jsonError, readJson } from "@/lib/http";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const body = await readJson<ActionInput & { teamId?: string }>(req);
    if (!body.teamId) throw new GameError("teamId requis");
    const room = await getRoomByCode(code);
    await tickRoom(room.id);
    await submitTeamActions(room.id, body.teamId, getPlayerToken(req) ?? "", body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
