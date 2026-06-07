import { apiError, noStoreJson, parseIdentity } from "@/server/api-utils";
import { createGame } from "@/server/game-service";
import { addUserRoom, saveRoom } from "@/server/room-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { identity?: unknown };
    const identity = parseIdentity(body.identity);
    const created = createGame(identity);
    await Promise.all([saveRoom(created.state), addUserRoom(identity.id, created.roomId)]);
    return noStoreJson(created, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
