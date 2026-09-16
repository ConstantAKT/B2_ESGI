import { NextRequest, NextResponse } from "next/server";
import { buildLobbyView, getRoomByCode } from "@/lib/game";
import { jsonError } from "@/lib/http";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const room = await getRoomByCode(code);
    const view = await buildLobbyView(room.id);
    return NextResponse.json(view);
  } catch (error) {
    return jsonError(error);
  }
}
