import { apiError, noStoreJson, parseIdentity } from "@/server/api-utils";
import { GameError, performAction, type GameAction } from "@/server/game-service";
import { getRoom, saveRoom } from "@/server/room-store";
import type { MoveRequest } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ActionBody = {
  identity?: unknown;
  action?: GameAction["type"];
  move?: MoveRequest;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await context.params;
    const body = (await request.json()) as ActionBody;
    const identity = parseIdentity(body.identity);
    const room = await getRoom(roomId);
    if (!room) throw new GameError("ROOM_NOT_FOUND", "게임 방을 찾을 수 없습니다.");
    if (!body.action) throw new GameError("INVALID_ACTION", "게임 동작이 지정되지 않았습니다.");
    if (body.action === "move" && !body.move) {
      throw new GameError("INVALID_MOVE", "착수 정보가 없습니다.");
    }

    const action: GameAction =
      body.action === "move"
        ? { type: "move", move: body.move! }
        : { type: body.action };
    const state = performAction(room, identity, action);
    await saveRoom(state);
    return noStoreJson(state);
  } catch (error) {
    return apiError(error);
  }
}
