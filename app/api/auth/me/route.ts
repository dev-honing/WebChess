import { currentKakaoSession, kakaoConfigured } from "@/server/kakao";
import { noStoreJson } from "@/server/api-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await currentKakaoSession();
  return noStoreJson({ configured: kakaoConfigured(), user: session?.user || null });
}
