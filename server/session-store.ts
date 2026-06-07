import { Redis } from "@upstash/redis";
import type { AuthUser } from "@/lib/types";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

export interface KakaoSession {
  user: AuthUser;
  accessToken: string;
  refreshToken?: string;
  accessTokenExpiresAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var webChessSessions: Map<string, KakaoSession> | undefined;
}

const memory = globalThis.webChessSessions || (globalThis.webChessSessions = new Map());

function sessionKey(id: string) {
  return `webchess:session:${id}`;
}

export async function saveSession(id: string, session: KakaoSession) {
  if (redis) {
    await redis.set(sessionKey(id), session, { ex: SESSION_TTL_SECONDS });
  } else {
    memory.set(id, structuredClone(session));
  }
}

export async function getSession(id?: string | null) {
  if (!id) return null;
  if (redis) return redis.get<KakaoSession>(sessionKey(id));
  return memory.get(id) || null;
}

export async function deleteSession(id?: string | null) {
  if (!id) return;
  if (redis) await redis.del(sessionKey(id));
  else memory.delete(id);
}
