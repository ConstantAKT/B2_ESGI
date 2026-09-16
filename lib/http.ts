import { NextRequest, NextResponse } from "next/server";
import { GameError } from "@/lib/game/errors";

export function jsonError(error: unknown): NextResponse {
  if (error instanceof GameError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
}

export function getHostToken(req: NextRequest): string | null {
  return req.headers.get("x-host-token");
}

export function getPlayerToken(req: NextRequest): string | null {
  return req.headers.get("x-player-token");
}

export async function readJson<T>(req: NextRequest): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}
