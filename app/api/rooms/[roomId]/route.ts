import { apiError, noStoreJson } from "@/server/api-utils";
import { GameError, readGame } from "@/server/game-service";
import { getRoom, saveRoom } from "@/server/room-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await context.params;
    const room = await getRoom(roomId);
    if (!room) throw new GameError("ROOM_NOT_FOUND", "게임 방을 찾을 수 없습니다.");
    const read = readGame(room);
    if (read.changed) await saveRoom(read.storedState);
    return noStoreJson(read.responseState);
  } catch (error) {
    return apiError(error);
  }
}
