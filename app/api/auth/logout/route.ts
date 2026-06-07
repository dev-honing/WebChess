import { cookies } from "next/headers";
import { deleteSession } from "@/server/session-store";
import { SESSION_COOKIE } from "@/server/kakao";

export async function POST() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  await deleteSession(sessionId);
  cookieStore.delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}
