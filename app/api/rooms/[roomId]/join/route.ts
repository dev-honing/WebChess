import { apiError, noStoreJson, parseIdentity } from "@/server/api-utils";
import { GameError, joinGame } from "@/server/game-service";
import { addUserRoom, getRoom, saveRoom } from "@/server/room-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await context.params;
    const body = (await request.json()) as { identity?: unknown };
    const identity = parseIdentity(body.identity);
    const room = await getRoom(roomId);
    if (!room) throw new GameError("ROOM_NOT_FOUND", "게임 방을 찾을 수 없습니다.");
    const joined = joinGame(room, identity);
    await Promise.all([saveRoom(joined.state), addUserRoom(identity.id, roomId)]);
    return noStoreJson(joined);
  } catch (error) {
    return apiError(error);
  }
}
