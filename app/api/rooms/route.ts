import { NextRequest, NextResponse } from "next/server";
import { createRoom } from "@/lib/game";
import { jsonError, readJson } from "@/lib/http";
import type { RoomSettings } from "@/engine/types";

export async function POST(req: NextRequest) {
  try {
    const body = await readJson<Partial<RoomSettings>>(req);
    const result = await createRoom(body);
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
