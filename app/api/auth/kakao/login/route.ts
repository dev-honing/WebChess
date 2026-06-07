import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { kakaoConfigured, kakaoRedirectUri } from "@/server/kakao";
import { requestOrigin } from "@/server/request-origin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = requestOrigin(request);
  if (!kakaoConfigured()) {
    return Response.redirect(`${origin}/?authError=kakao_not_configured`);
  }

  const state = randomBytes(24).toString("hex");
  const returnTo = url.searchParams.get("returnTo") || "/";
  const cookieStore = await cookies();
  const secure = process.env.NODE_ENV === "production";
  cookieStore.set("kakao-oauth-state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: 600,
    path: "/",
  });
  cookieStore.set("kakao-return-to", returnTo.startsWith("/") ? returnTo : "/", {
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: 600,
    path: "/",
  });

  const authorize = new URL("https://kauth.kakao.com/oauth/authorize");
  authorize.searchParams.set("client_id", process.env.KAKAO_REST_API_KEY!);
  authorize.searchParams.set("redirect_uri", kakaoRedirectUri(origin));
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("state", state);
  return Response.redirect(authorize);
}
