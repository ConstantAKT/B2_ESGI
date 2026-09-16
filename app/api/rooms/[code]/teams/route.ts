import { NextRequest, NextResponse } from "next/server";
import { createTeam, getRoomByCode } from "@/lib/game";
import { jsonError, readJson } from "@/lib/http";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const body = await readJson<{ name?: string }>(req);
    const room = await getRoomByCode(code);
    const result = await createTeam(room.id, body.name ?? "");
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
