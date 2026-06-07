import { currentKakaoSession, kakaoApi } from "@/server/kakao";
import { noStoreJson } from "@/server/api-utils";
import { requestOrigin } from "@/server/request-origin";

export async function POST(request: Request) {
  const session = await currentKakaoSession();
  if (!session) {
    return noStoreJson({ message: "카카오 로그인이 필요합니다." }, { status: 401 });
  }
  const body = (await request.json()) as { receiverUuid?: string; roomId?: string };
  if (!body.receiverUuid || !body.roomId) {
    return noStoreJson({ message: "초대할 친구 또는 게임 방 정보가 없습니다." }, { status: 400 });
  }
  const origin = requestOrigin(request);
  const inviteUrl = `${origin}/game/${encodeURIComponent(body.roomId)}`;
  const form = new URLSearchParams({
    receiver_uuids: JSON.stringify([body.receiverUuid]),
    template_object: JSON.stringify({
      object_type: "text",
      text: `${session.user.identity.nickname}님이 Web Chess Arena 대국에 초대했습니다.`,
      link: { web_url: inviteUrl, mobile_web_url: inviteUrl },
      button_title: "대국 입장",
    }),
  });
  try {
    await kakaoApi("/v1/api/talk/friends/message/default/send", session.accessToken, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded;charset=utf-8" },
      body: form,
    });
    return noStoreJson({ ok: true });
  } catch (error) {
    return noStoreJson(
      { message: error instanceof Error ? error.message : "카카오 초대 전송에 실패했습니다." },
      { status: 400 },
    );
  }
}
