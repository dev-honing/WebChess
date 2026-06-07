"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getIdentity, resetIdentity, saveIdentity, saveNickname } from "@/lib/identity";
import type { AuthUser, GameState, UserIdentity } from "@/lib/types";

function statusText(game: GameState) {
  if (game.status === "waiting") return "상대 대기 중";
  if (game.status === "playing") return "대국 진행 중";
  return game.result?.message || "대국 종료";
}

export default function HomePage() {
  const router = useRouter();
  const [identity, setIdentity] = useState<UserIdentity | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [kakaoConfigured, setKakaoConfigured] = useState(false);
  const [nickname, setNickname] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [games, setGames] = useState<GameState[]>([]);
  const [lanOrigin, setLanOrigin] = useState("");
  const [showLanHint, setShowLanHint] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const current = getIdentity();
    setIdentity(current);
    setNickname(current.nickname);
    setShowLanHint(["localhost", "127.0.0.1"].includes(window.location.hostname));
    const authError = new URLSearchParams(window.location.search).get("authError");
    if (authError === "kakao_not_configured") setError("카카오 로그인 환경 변수가 설정되지 않았습니다.");
    if (authError === "invalid_state") setError("카카오 로그인 요청이 만료되었습니다. 다시 시도해 주세요.");
    if (authError === "kakao_login_failed") setError("카카오 로그인에 실패했습니다.");
    if (authError === "kakao_client_secret") setError("카카오 Client Secret이 없거나 올바르지 않습니다.");
    if (authError === "kakao_redirect_mismatch") setError("토큰 요청의 카카오 Redirect URI가 일치하지 않습니다.");
    if (authError === "kakao_platform") setError("카카오 Web 플랫폼 도메인 설정을 확인해 주세요.");
    void fetch(`/api/games?userId=${encodeURIComponent(current.id)}`)
      .then((response) => response.json())
      .then(setGames)
      .catch(() => undefined);
    void fetch("/api/network")
      .then((response) => response.json())
      .then((data: { origins?: string[]; persistent?: boolean; deployment?: boolean }) => {
        setLanOrigin(data.origins?.[0] || "");
        setStorageWarning(Boolean(data.deployment && !data.persistent));
      })
      .catch(() => undefined);
    void fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { configured?: boolean; user?: AuthUser | null }) => {
        setKakaoConfigured(Boolean(data.configured));
        if (data.user) {
          const kakaoIdentity = saveIdentity(data.user.identity);
          setAuthUser(data.user);
          setIdentity(kakaoIdentity);
          setNickname(kakaoIdentity.nickname);
        }
      })
      .catch(() => undefined);
  }, []);

  function updateName(value: string) {
    setNickname(value);
    setIdentity(saveNickname(value));
  }

  async function createGame() {
    if (!identity) return;
    setBusy(true);
    setError("");
    try {
      const current = saveNickname(nickname);
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identity: current }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      router.push(`/game/${data.roomId}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "게임을 만들지 못했습니다.");
      setBusy(false);
    }
  }

  function joinGame() {
    const code = inviteCode.trim().split("/").filter(Boolean).at(-1);
    if (!code) {
      setError("초대 코드 또는 링크를 입력해 주세요.");
      return;
    }
    saveNickname(nickname);
    router.push(`/game/${code}`);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setAuthUser(null);
    const guest = resetIdentity();
    setIdentity(guest);
    setNickname(guest.nickname);
  }

  return (
    <main className="home-shell">
      <nav className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark"><img src="/chess-pieces/bn.png" alt="" /></span>
          <span>WEB CHESS <b>ARENA</b></span>
        </a>
        <div className="nav-actions">
          {authUser ? (
            <button className="kakao-profile" onClick={logout}>
              {authUser.profileImage ? <img src={authUser.profileImage} alt="" /> : <span>K</span>}
              <b>{authUser.identity.nickname}</b>
              <small>로그아웃</small>
            </button>
          ) : kakaoConfigured ? (
            <a className="kakao-login-button" href="/api/auth/kakao/login">카카오 로그인</a>
          ) : (
            <span className="live-pill"><i /> REAL-TIME CHESS</span>
          )}
        </div>
      </nav>

      {lanOrigin && showLanHint && (
        <div className="lan-banner">
          <span>같은 Wi-Fi의 다른 기기 접속 주소</span>
          <a href={lanOrigin}>{lanOrigin}</a>
        </div>
      )}
      {storageWarning && (
        <div className="storage-banner">
          Vercel 멀티플레이를 사용하려면 프로젝트에 Upstash Redis를 연결해 주세요.
        </div>
      )}

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">NO DOWNLOAD. NO MATCHMAKING.</span>
          <h1>친구와 바로<br /><em>체크메이트.</em></h1>
          <p>방을 만들고 초대 링크 하나만 보내세요. 모든 착수와 판정은 서버에서 공정하게 검증됩니다.</p>
          <div className="feature-row">
            <span>10분 래피드</span><span>실시간 동기화</span><span>서버 규칙 검증</span>
          </div>
        </div>

        <div className="start-card">
          <div className="card-kicker">START A MATCH</div>
          <h2>새로운 대국</h2>
          <label>
            플레이어 이름
            <input
              value={nickname}
              onChange={(event) => updateName(event.target.value)}
              maxLength={18}
              placeholder="닉네임"
            />
          </label>
          <button className="primary-button" onClick={createGame} disabled={busy || !identity}>
            <span>새 게임 만들기</span><b>→</b>
          </button>
          <div className="or-divider"><span>OR JOIN A FRIEND</span></div>
          <div className="join-row">
            <input
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && joinGame()}
              placeholder="초대 코드 또는 링크"
            />
            <button onClick={joinGame}>입장</button>
          </div>
          {error && <p className="form-error">{error}</p>}
        </div>
      </section>

      <section className="recent-section">
        <div className="section-heading">
          <div><span className="eyebrow">YOUR BOARD</span><h2>최근 게임</h2></div>
          <span>{games.length ? `${games.length} games` : "첫 대국을 시작해 보세요"}</span>
        </div>
        <div className="game-list">
          {games.map((game) => (
            <button key={game.roomId} className="game-card" onClick={() => router.push(`/game/${game.roomId}`)}>
              <span className={`status-dot ${game.status}`} />
              <span className="game-players">
                <b>{game.players.white?.nickname || "Waiting..."}</b>
                <small>vs</small>
                <b>{game.players.black?.nickname || "Waiting..."}</b>
              </span>
              <span className="game-status">{statusText(game)}</span>
              <span className="game-arrow">↗</span>
            </button>
          ))}
          {!games.length && (
            <div className="empty-games">
              <span><img src="/chess-pieces/wp.png" alt="" /></span>
              <p>아직 기록된 대국이 없습니다.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
