import { getSession, saveSession } from "@/server/session-store";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "webchess-session";

export function kakaoConfigured() {
  return Boolean(process.env.KAKAO_REST_API_KEY);
}

export function kakaoRedirectUri(origin: string) {
  return process.env.KAKAO_REDIRECT_URI || `${origin}/api/auth/kakao/callback`;
}

export async function currentKakaoSession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  const session = await getSession(sessionId);
  if (
    !sessionId ||
    !session ||
    session.accessTokenExpiresAt > Date.now() + 60_000 ||
    !session.refreshToken ||
    !process.env.KAKAO_REST_API_KEY
  ) {
    return session;
  }

  try {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.KAKAO_REST_API_KEY,
      refresh_token: session.refreshToken,
    });
    if (process.env.KAKAO_CLIENT_SECRET) body.set("client_secret", process.env.KAKAO_CLIENT_SECRET);
    const response = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded;charset=utf-8" },
      body,
      cache: "no-store",
    });
    const token = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!response.ok || !token.access_token || !token.expires_in) return session;
    const refreshed = {
      ...session,
      accessToken: token.access_token,
      refreshToken: token.refresh_token || session.refreshToken,
      accessTokenExpiresAt: Date.now() + token.expires_in * 1000,
    };
    await saveSession(sessionId, refreshed);
    return refreshed;
  } catch {
    return session;
  }
}

export async function kakaoApi<T>(
  path: string,
  accessToken: string,
  init?: RequestInit,
) {
  const response = await fetch(`https://kapi.kakao.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...init?.headers,
    },
    cache: "no-store",
  });
  const data = (await response.json()) as T & { msg?: string; code?: number };
  if (!response.ok) {
    throw new Error(data.msg || "카카오 API 요청을 처리하지 못했습니다.");
  }
  return data;
}
