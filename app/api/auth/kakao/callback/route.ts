import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { kakaoApi, kakaoRedirectUri, SESSION_COOKIE } from "@/server/kakao";
import { saveSession } from "@/server/session-store";
import { requestOrigin } from "@/server/request-origin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface KakaoToken {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

interface KakaoMe {
  id: number;
  properties?: {
    nickname?: string;
    profile_image?: string;
  };
  kakao_account?: {
    profile?: {
      nickname?: string;
      profile_image_url?: string;
    };
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = requestOrigin(request);
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("kakao-oauth-state")?.value;
  const returnTo = cookieStore.get("kakao-return-to")?.value || "/";
  cookieStore.delete("kakao-oauth-state");
  cookieStore.delete("kakao-return-to");

  if (!expectedState || expectedState !== url.searchParams.get("state")) {
    return Response.redirect(`${origin}/?authError=invalid_state`);
  }
  const code = url.searchParams.get("code");
  if (!code || !process.env.KAKAO_REST_API_KEY) {
    return Response.redirect(`${origin}/?authError=kakao_login_failed`);
  }

  try {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.KAKAO_REST_API_KEY,
      redirect_uri: kakaoRedirectUri(origin),
      code,
    });
    if (process.env.KAKAO_CLIENT_SECRET) {
      body.set("client_secret", process.env.KAKAO_CLIENT_SECRET);
    }
    const tokenResponse = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded;charset=utf-8" },
      body,
      cache: "no-store",
    });
    const token = (await tokenResponse.json()) as KakaoToken & { error_description?: string };
    if (!tokenResponse.ok) throw new Error(token.error_description || "카카오 토큰 발급 실패");

    const me = await kakaoApi<KakaoMe>("/v2/user/me", token.access_token);
    const profile = me.kakao_account?.profile;
    const nickname = profile?.nickname || me.properties?.nickname || `Kakao ${String(me.id).slice(-4)}`;
    const sessionId = randomBytes(32).toString("hex");
    await saveSession(sessionId, {
      user: {
        provider: "kakao",
        identity: { id: `kakao-${me.id}`, nickname: nickname.slice(0, 18) },
        profileImage: profile?.profile_image_url || me.properties?.profile_image,
      },
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      accessTokenExpiresAt: Date.now() + token.expires_in * 1000,
    });
    cookieStore.set(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
    return Response.redirect(`${origin}${returnTo.startsWith("/") ? returnTo : "/"}`);
  } catch (error) {
    console.error(error);
    return Response.redirect(`${origin}/?authError=kakao_login_failed`);
  }
}
