import { noStoreJson } from "@/server/api-utils";
import { readGame } from "@/server/game-service";
import { listUserRooms } from "@/server/room-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const userId = new URL(request.url).searchParams.get("userId");
  if (!userId) return noStoreJson([]);
  const rooms = await listUserRooms(userId);
  return noStoreJson(
    rooms
      .map((room) => readGame(room).responseState)
      .sort((a, b) => b.createdAt - a.createdAt),
  );
}
