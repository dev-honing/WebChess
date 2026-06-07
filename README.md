# Web Chess Arena

초대 링크로 두 플레이어가 대국하는 Vercel 배포형 Next.js 체스 게임입니다. 모든 착수, 턴, 체크메이트, 무승부, 기권, 타이머 판정은 서버에서 `chess.js`로 검증합니다.

## 로컬 실행

```bash
npm install
npm run dev
```

- 내 PC: `http://localhost:3000`
- 같은 Wi-Fi의 다른 기기: 터미널에 표시되는 `http://192.168.x.x:3000`
- 로컬에서 Redis 환경 변수가 없으면 방 상태는 개발 서버 메모리에 저장됩니다.

## Vercel 배포

1. 이 프로젝트를 GitHub 저장소에 Push합니다.
2. Vercel에서 `Add New Project`를 선택하고 GitHub 저장소를 Import합니다.
3. Framework Preset은 `Next.js`를 사용하고 Deploy합니다.
4. Vercel 프로젝트의 `Storage` 또는 Marketplace에서 `Upstash Redis`를 추가합니다.
5. Redis 데이터베이스를 프로젝트에 연결한 후 Redeploy합니다.

Upstash 통합은 아래 환경 변수를 Vercel 프로젝트에 자동으로 추가합니다.

```text
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

기존 Vercel KV 통합에서 생성되는 `KV_REST_API_URL`, `KV_REST_API_TOKEN`도 자동으로 인식합니다.

배포가 끝나면 Vercel에서 발급한 `https://프로젝트명.vercel.app` 주소로 접속할 수 있습니다. 원하는 별도 도메인은 Vercel 프로젝트의 `Settings > Domains`에서 연결할 수 있습니다.

## Vercel 구조

- Next.js App Router 화면 및 Route Handler API
- Upstash Redis에 게임 방, 플레이어, FEN, PGN, 착수 기록 저장
- 브라우저가 약 0.7초 간격으로 서버의 검증된 게임 상태 동기화
- 별도 Socket.IO 서버 없이 단일 Vercel 프로젝트로 배포

Vercel 배포 환경에서 Upstash Redis를 연결하지 않으면 서버리스 인스턴스 사이에 게임 상태가 유지되지 않으므로 실제 멀티플레이에는 Redis 연결이 필수입니다.

## 카카오 로그인 및 친구 초대 설정

1. [Kakao Developers](https://developers.kakao.com/)에서 애플리케이션을 생성합니다.
2. `앱 설정 > 앱 키`의 REST API 키를 Vercel 환경 변수 `KAKAO_REST_API_KEY`에 추가합니다.
3. `앱 설정 > 플랫폼 > Web`에 Vercel 배포 도메인을 등록합니다.
   - 예: `https://web-chess.vercel.app`
4. `제품 설정 > 카카오 로그인`을 활성화합니다.
5. Redirect URI를 등록합니다.
   - 예: `https://web-chess.vercel.app/api/auth/kakao/callback`
6. 같은 URI를 Vercel 환경 변수 `KAKAO_REDIRECT_URI`에 추가합니다.
7. 카카오 로그인 동의 항목에서 닉네임과 프로필 이미지를 설정합니다.
8. 친구 초대 기능을 사용하려면 `카카오톡 친구 목록`과 `카카오톡 메시지 전송` 권한을 신청하고 동의 항목을 설정합니다.
9. 카카오톡 메시지에 포함된 대국 링크가 열리도록 제품 링크 도메인에도 Vercel 도메인을 등록합니다.
10. 권한 승인 없이 카카오톡 공유 초대를 사용하려면 JavaScript 키의 SDK 도메인에 Vercel 도메인을 등록하고, JavaScript 키를 `NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY`로 추가합니다.
11. 환경 변수 추가 후 Vercel에서 Redeploy합니다.

```text
KAKAO_REST_API_KEY
KAKAO_CLIENT_SECRET       # 카카오에서 Client Secret을 활성화한 경우만
KAKAO_REDIRECT_URI
NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY
```

카카오 친구 API는 사용자의 모든 카카오톡 친구를 반환하지 않습니다. 같은 카카오 앱에 연결되어 있고 친구 목록 제공에 동의한 친구만 표시됩니다. 친구 목록 및 메시지 권한은 카카오 개발자 콘솔에서 별도 검수나 권한 승인이 필요할 수 있습니다.
카카오톡 공유 초대는 친구 목록 및 메시지 권한 승인 없이 사용할 수 있으며, 사용자가 카카오톡에서 직접 친구나 대화방을 선택합니다.
