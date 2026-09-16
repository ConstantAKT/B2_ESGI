import { NextRequest, NextResponse } from "next/server";
import { buildHostView, getRoomByCode, hostPause } from "@/lib/game";
import { getHostToken, jsonError } from "@/lib/http";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const room = await getRoomByCode(code);
    await hostPause(room.id, getHostToken(req) ?? "");
    return NextResponse.json(await buildHostView(room.id));
  } catch (error) {
    return jsonError(error);
  }
}
