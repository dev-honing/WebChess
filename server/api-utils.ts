import { GameError } from "@/server/game-service";
import type { UserIdentity } from "@/lib/types";

export function parseIdentity(value: unknown): UserIdentity {
  const input = (value || {}) as Partial<UserIdentity>;
  return { id: String(input.id || ""), nickname: String(input.nickname || "") };
}

export function apiError(error: unknown) {
  if (error instanceof GameError) {
    const status = error.code === "ROOM_NOT_FOUND" ? 404 : 400;
    return Response.json({ code: error.code, message: error.message }, { status });
  }
  console.error(error);
  return Response.json(
    { code: "SERVER_ERROR", message: "서버 요청을 처리하지 못했습니다." },
    { status: 500 },
  );
}

export function noStoreJson(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("cache-control", "no-store, max-age=0");
  return Response.json(data, { ...init, headers });
}
