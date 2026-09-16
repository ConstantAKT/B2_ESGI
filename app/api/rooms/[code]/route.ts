import { NextRequest, NextResponse } from "next/server";
import { getRoomByCode } from "@/lib/game";
import { jsonError } from "@/lib/http";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const room = await getRoomByCode(code);
    return NextResponse.json({ code: room.code, status: room.status });
  } catch (error) {
    return jsonError(error);
  }
}
