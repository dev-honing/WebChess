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

## 카카오 로그인 설정

1. [Kakao Developers](https://developers.kakao.com/)에서 애플리케이션을 생성합니다.
2. `앱 설정 > 앱 키`의 REST API 키를 Vercel 환경 변수 `KAKAO_REST_API_KEY`에 추가합니다.
3. `앱 설정 > 플랫폼 > Web`에 Vercel 배포 도메인을 등록합니다.
   - 예: `https://web-chess.vercel.app`
4. `제품 설정 > 카카오 로그인`을 활성화합니다.
5. Redirect URI를 등록합니다.
   - 예: `https://web-chess.vercel.app/api/auth/kakao/callback`
6. 같은 URI를 Vercel 환경 변수 `KAKAO_REDIRECT_URI`에 추가합니다.
7. 카카오 로그인 동의 항목에서 닉네임과 프로필 이미지를 설정합니다.
8. 환경 변수 추가 후 Vercel에서 Redeploy합니다.

```text
KAKAO_REST_API_KEY
KAKAO_CLIENT_SECRET       # 카카오에서 Client Secret을 활성화한 경우만
KAKAO_REDIRECT_URI
```

## 트러블슈팅 및 회고

개발과 배포 과정에서 실제로 겪었던 문제와 다음 개발에서 주의할 점을 정리합니다.

### 로컬 네트워크 접속

- `localhost:3000`은 개발 서버를 실행한 PC에서만 접속할 수 있습니다. 같은 Wi-Fi 기기에서는 PC의 `192.168.x.x:3000` 주소를 사용해야 합니다.
- 개발 서버는 외부 기기 접속을 위해 `next dev --hostname 0.0.0.0`으로 실행합니다.
- 외부 기기에서 접속되지 않으면 두 기기가 같은 Wi-Fi인지, Windows 방화벽이 Node.js의 사설 네트워크 접속을 허용하는지 확인합니다.
- `EADDRINUSE: 0.0.0.0:3000`은 기존 개발 서버가 이미 실행 중이라는 뜻입니다. 서버를 중복 실행하지 말고 기존 프로세스를 종료하거나 다른 포트를 사용합니다.

### 브라우저 호환성과 모바일 UI

- 일부 브라우저에서는 `crypto.randomUUID()`가 제공되지 않을 수 있으므로 사용자 식별자 생성에는 대체 구현이 필요합니다.
- 착수할 때마다 페이지 스크롤이 이동했던 원인은 전체 페이지를 대상으로 한 `scrollIntoView()`였습니다. 기보 컨테이너 자체의 `scrollTo()`만 사용해야 합니다.
- 모바일 레이아웃은 `100vh`보다 브라우저 주소창 크기를 반영하는 `100svh` 또는 `100dvh`가 안정적입니다.
- 체스판은 고정 픽셀 크기 대신 `aspect-ratio: 1 / 1`과 뷰포트 기반 크기를 사용해야 정사각형 비율을 유지할 수 있습니다.

### Vercel과 상태 저장

- Vercel 서버리스 인스턴스의 메모리는 요청 사이에 유지된다고 가정할 수 없습니다. 멀티플레이 게임 상태는 반드시 Upstash Redis 같은 외부 저장소에 보관해야 합니다.
- Redis 환경 변수를 추가한 뒤에는 기존 배포에 자동 적용되지 않을 수 있으므로 Redeploy가 필요합니다.
- 배포 전에 아래 명령을 모두 통과시키면 타입 오류나 Route Handler 빌드 실패를 미리 발견할 수 있습니다.

```bash
npm run typecheck
npm test
npm run build
```

### 카카오 로그인

- 카카오 로그인 Redirect URI는 코드, Vercel 환경 변수, Kakao Developers 콘솔에 등록된 값이 문자 단위로 동일해야 합니다.
- Redirect URI는 로그아웃 Redirect URI가 아니라 `카카오 로그인 > Redirect URI` 항목에 등록합니다.
- `KAKAO_CLIENT_SECRET`은 카카오 콘솔에서 Client Secret을 활성화했을 때만 설정합니다. 활성화 상태와 환경 변수 값이 일치하지 않으면 로그인이 실패합니다.
- Vercel 환경 변수를 변경한 뒤에는 Redeploy해야 하며, REST API 키나 Client Secret은 Git에 커밋하지 않습니다.

### 카카오 친구 기능을 제거한 이유

- 카카오 친구 목록 API는 사용자의 모든 카카오톡 친구를 반환하지 않습니다. 같은 앱에 연결되고 친구 목록 제공에 동의한 사용자만 조회할 수 있습니다.
- `friends`, `talk_message` 권한은 앱 설정과 별도 권한 승인이 필요하며, 설정되지 않은 권한을 요청하면 `KOE205` 오류가 발생합니다.
- 이 앱의 핵심 초대 흐름에는 복사 가능한 대국 링크만으로 충분했습니다. 복잡도와 권한 심사 부담에 비해 이점이 작아 카카오 친구 목록 및 메시지 전송 기능은 제거했습니다.

### 디자인 구현 교훈

- 시안에서 실제 2.5D 조각 기물을 선택했다면 유니코드 체스 문자를 CSS 그림자로 꾸미는 방식은 같은 결과를 만들 수 없습니다.
- 최종 기물은 아이보리·흑단 PNG 에셋으로 제작하고, 보드와 전체 UI도 월넛·파치먼트·브라스 계열로 통일했습니다.
- 과한 드롭 섀도와 두꺼운 외곽선은 작은 모바일 화면에서 형태를 뭉개므로, 기물에는 짧고 흐린 접지 그림자만 사용합니다.
- 큰 시각 변경은 예상 이미지를 먼저 검토한 뒤 구현해야 불필요한 재작업을 줄일 수 있습니다.

## 최종 확인 목록

- 같은 Wi-Fi 접속과 Vercel 배포 주소에서 방 생성 및 링크 입장 확인
- 백·흑 착수, 승급, 체크메이트, 기권, 무승부, 타이머 확인
- 데스크톱과 모바일에서 체스판 비율 및 기보 패널 확인
- 카카오 로그인과 로그아웃 확인
- Redis 연결 및 Vercel Redeploy 확인
- `npm run typecheck`, `npm test`, `npm run build` 통과
