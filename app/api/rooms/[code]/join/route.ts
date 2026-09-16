import { NextRequest, NextResponse } from "next/server";
import { joinRoom } from "@/lib/game";
import { jsonError, readJson } from "@/lib/http";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const body = await readJson<{ pseudo?: string }>(req);
    const result = await joinRoom(code, body.pseudo ?? "");
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
