import { NextRequest, NextResponse } from "next/server";
import { buildTeamView, getRoomByCode, tickRoom } from "@/lib/game";
import { getPlayerToken, jsonError } from "@/lib/http";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string; teamId: string }> }
) {
  try {
    const { code, teamId } = await params;
    const room = await getRoomByCode(code);
    await tickRoom(room.id);
    const view = await buildTeamView(room.id, teamId, getPlayerToken(req) ?? "");
    return NextResponse.json(view);
  } catch (error) {
    return jsonError(error);
  }
}
