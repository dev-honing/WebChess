import { Redis } from "@upstash/redis";
import type { GameState } from "@/lib/types";

const ROOM_TTL_SECONDS = 60 * 60 * 24 * 30;
const hasRedis = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
);
const redis = hasRedis ? Redis.fromEnv() : null;

interface MemoryStore {
  rooms: Map<string, GameState>;
  userRooms: Map<string, string[]>;
}

declare global {
  // eslint-disable-next-line no-var
  var webChessMemoryStore: MemoryStore | undefined;
}

const memory =
  globalThis.webChessMemoryStore ||
  (globalThis.webChessMemoryStore = {
    rooms: new Map<string, GameState>(),
    userRooms: new Map<string, string[]>(),
  });

function roomKey(roomId: string) {
  return `webchess:room:${roomId}`;
}

function userRoomsKey(userId: string) {
  return `webchess:user:${userId}:rooms`;
}

export function isPersistentStoreConfigured() {
  return hasRedis;
}

export async function getRoom(roomId: string) {
  if (redis) return redis.get<GameState>(roomKey(roomId));
  return memory.rooms.get(roomId) || null;
}

export async function saveRoom(state: GameState) {
  if (redis) {
    await redis.set(roomKey(state.roomId), state, { ex: ROOM_TTL_SECONDS });
  } else {
    memory.rooms.set(state.roomId, structuredClone(state));
  }
}

export async function addUserRoom(userId: string, roomId: string) {
  if (redis) {
    const key = userRoomsKey(userId);
    await redis.lrem(key, 0, roomId);
    await redis.lpush(key, roomId);
    await redis.ltrim(key, 0, 11);
    await redis.expire(key, ROOM_TTL_SECONDS);
  } else {
    const rooms = memory.userRooms.get(userId) || [];
    memory.userRooms.set(userId, [roomId, ...rooms.filter((id) => id !== roomId)].slice(0, 12));
  }
}

export async function listUserRooms(userId: string) {
  const ids = redis
    ? await redis.lrange<string>(userRoomsKey(userId), 0, 11)
    : memory.userRooms.get(userId) || [];
  const rooms = await Promise.all(ids.map((id) => getRoom(id)));
  return rooms.filter((room): room is GameState => Boolean(room));
}
