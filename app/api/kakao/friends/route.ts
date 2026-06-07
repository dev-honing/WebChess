import { noStoreJson } from "@/server/api-utils";
import { currentKakaoSession, kakaoApi } from "@/server/kakao";
import type { KakaoFriend } from "@/lib/types";

export const dynamic = "force-dynamic";

interface KakaoFriendsResponse {
  elements: Array<{
    uuid: string;
    profile_nickname?: string;
    profile_thumbnail_image?: string;
  }>;
}

export async function GET() {
  const session = await currentKakaoSession();
  if (!session) {
    return noStoreJson({ message: "카카오 로그인이 필요합니다." }, { status: 401 });
  }
  try {
    const result = await kakaoApi<KakaoFriendsResponse>("/v1/api/talk/friends", session.accessToken);
    const friends: KakaoFriend[] = result.elements.map((friend) => ({
      uuid: friend.uuid,
      nickname: friend.profile_nickname || "카카오 친구",
      profileThumbnail: friend.profile_thumbnail_image,
    }));
    return noStoreJson({ friends });
  } catch (error) {
    return noStoreJson(
      {
        message: error instanceof Error ? error.message : "친구 목록을 불러오지 못했습니다.",
        requiresConsent: true,
      },
      { status: 403 },
    );
  }
}
