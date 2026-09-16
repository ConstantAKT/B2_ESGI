import { NextRequest, NextResponse } from "next/server";
import { buildHostView, getRoomByCode, updateSettings } from "@/lib/game";
import { getHostToken, jsonError, readJson } from "@/lib/http";
import type { RoomSettings } from "@/engine/types";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const body = await readJson<Partial<RoomSettings>>(req);
    const room = await getRoomByCode(code);
    await updateSettings(room.id, getHostToken(req) ?? "", body);
    return NextResponse.json(await buildHostView(room.id));
  } catch (error) {
    return jsonError(error);
  }
}
