import { NextRequest, NextResponse } from "next/server";
import { buildHostView, getRoomByCode, GameError, removePlayer } from "@/lib/game";
import { getHostToken, jsonError, readJson } from "@/lib/http";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const body = await readJson<{ playerId?: string }>(req);
    if (!body.playerId) throw new GameError("playerId requis");
    const room = await getRoomByCode(code);
    await removePlayer(room.id, getHostToken(req) ?? "", body.playerId);
    return NextResponse.json(await buildHostView(room.id));
  } catch (error) {
    return jsonError(error);
  }
}
