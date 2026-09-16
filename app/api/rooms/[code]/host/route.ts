import { NextRequest, NextResponse } from "next/server";
import { buildHostView, getRoomByCode, requireHost, tickRoom } from "@/lib/game";
import { getHostToken, jsonError } from "@/lib/http";

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const room = await getRoomByCode(code);
    requireHost(room, getHostToken(req));
    await tickRoom(room.id);
    const view = await buildHostView(room.id);
    return NextResponse.json(view);
  } catch (error) {
    return jsonError(error);
  }
}
