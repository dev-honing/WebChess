"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import { getIdentity, saveIdentity } from "@/lib/identity";
import type {
  AuthUser,
  GameState,
  JoinRoomResponse,
  KakaoFriend,
  MoveRequest,
  PlayerColor,
  ServerError,
  UserIdentity,
} from "@/lib/types";

const PIECES: Record<string, string> = {
  wp: "♙", wn: "♘", wb: "♗", wr: "♖", wq: "♕", wk: "♔",
  bp: "♟", bn: "♞", bb: "♝", br: "♜", bq: "♛", bk: "♚",
};
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];
const KAKAO_SDK_URL = "https://t1.kakaocdn.net/kakao_js_sdk/2.8.1/kakao.min.js";

type KakaoSdk = {
  init: (key: string) => void;
  isInitialized: () => boolean;
  Share: {
    sendDefault: (options: {
      objectType: "text";
      text: string;
      link: { mobileWebUrl: string; webUrl: string };
      buttonTitle: string;
    }) => void;
  };
};

declare global {
  interface Window {
    Kakao?: KakaoSdk;
  }
}

function loadKakaoSdk() {
  return new Promise<KakaoSdk>((resolve, reject) => {
    if (window.Kakao) {
      resolve(window.Kakao);
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${KAKAO_SDK_URL}"]`);
    const script = existing || document.createElement("script");
    const loaded = () => window.Kakao ? resolve(window.Kakao) : reject(new Error("카카오 SDK를 불러오지 못했습니다."));
    script.addEventListener("load", loaded, { once: true });
    script.addEventListener("error", () => reject(new Error("카카오 SDK를 불러오지 못했습니다.")), { once: true });

    if (!existing) {
      script.src = KAKAO_SDK_URL;
      script.crossOrigin = "anonymous";
      document.head.appendChild(script);
    }
  });
}

function formatTime(ms: number) {
  const safe = Math.max(0, ms);
  const minutes = Math.floor(safe / 60000);
  const seconds = Math.floor((safe % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function reasonLabel(reason?: string) {
  const labels: Record<string, string> = {
    checkmate: "CHECKMATE",
    resign: "RESIGNATION",
    timeout: "TIME OUT",
    stalemate: "STALEMATE",
    insufficient_material: "INSUFFICIENT MATERIAL",
    threefold_repetition: "THREEFOLD REPETITION",
    fifty_move_rule: "FIFTY-MOVE RULE",
    draw_agreement: "DRAW AGREEMENT",
  };
  return labels[reason || ""] || "GAME OVER";
}

export default function GamePage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const identityRef = useRef<UserIdentity | null>(null);
  const moveListRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [color, setColor] = useState<PlayerColor | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [promotion, setPromotion] = useState<MoveRequest | null>(null);
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [lanOrigin, setLanOrigin] = useState("");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [friends, setFriends] = useState<KakaoFriend[]>([]);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendConsentRequired, setFriendConsentRequired] = useState(false);
  const [invitedFriend, setInvitedFriend] = useState("");
  const [, setClockTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setClockTick((tick) => tick + 1), 250);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let disposed = false;
    let pollTimer: ReturnType<typeof setInterval> | undefined;

    async function joinRoom() {
      try {
        let identity = getIdentity();
        const authResponse = await fetch("/api/auth/me", { cache: "no-store" });
        const auth = (await authResponse.json()) as { user?: AuthUser | null };
        if (auth.user) {
          setAuthUser(auth.user);
          identity = saveIdentity(auth.user.identity);
        }
        identityRef.current = identity;
        const response = await fetch(`/api/rooms/${roomId}/join`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ identity }),
        });
        const data = (await response.json()) as JoinRoomResponse | ServerError;
        if (!response.ok) throw new Error((data as ServerError).message);
        if (disposed) return;
        const joined = data as JoinRoomResponse;
        setColor(joined.playerColor);
        setState(joined.state);
        setNotice("");
        pollTimer = setInterval(() => {
          void fetch(`/api/rooms/${roomId}`, { cache: "no-store" })
            .then(async (pollResponse) => {
              const next = (await pollResponse.json()) as GameState | ServerError;
              if (!pollResponse.ok) throw new Error((next as ServerError).message);
              if (!disposed) setState(next as GameState);
            })
            .catch(() => undefined);
        }, 700);
      } catch (error) {
        if (!disposed) {
          setNotice(error instanceof Error ? error.message : "게임 방에 입장하지 못했습니다.");
        }
      }
    }

    void joinRoom();
    return () => {
      disposed = true;
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [roomId]);

  useEffect(() => {
    void fetch("/api/network")
      .then((response) => response.json())
      .then((data: { origins?: string[] }) => setLanOrigin(data.origins?.[0] || ""))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const list = moveListRef.current;
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [state?.moves.length]);

  const chess = useMemo(() => {
    if (!state) return null;
    return new Chess(state.fen);
  }, [state?.fen]);

  const legalTargets = useMemo(() => {
    if (!chess || !selected) return new Set<string>();
    return new Set(chess.moves({ square: selected as Square, verbose: true }).map((move) => move.to));
  }, [chess, selected]);

  const displayedClocks = useMemo(() => {
    if (!state) return { white: 0, black: 0 };
    const clocks = { ...state.clocks };
    if (state.status === "playing" && state.turnStartedAt) {
      const elapsed = Date.now() - state.serverNow;
      clocks[state.turn] = Math.max(0, clocks[state.turn] - elapsed);
    }
    return clocks;
  }, [state, Date.now()]);

  const requestAction = useCallback(async (
    action: "move" | "resign" | "offer_draw" | "accept_draw" | "decline_draw",
    move?: MoveRequest,
  ) => {
    if (!identityRef.current) return;
    try {
      const response = await fetch(`/api/rooms/${roomId}/action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identity: identityRef.current, action, move }),
      });
      const data = (await response.json()) as GameState | ServerError;
      if (!response.ok) throw new Error((data as ServerError).message);
      setState(data as GameState);
      setNotice("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "게임 요청을 처리하지 못했습니다.");
    }
  }, [roomId]);

  const sendMove = useCallback((move: MoveRequest) => {
    void requestAction("move", move);
    setSelected(null);
    setPromotion(null);
  }, [requestAction]);

  function attemptMove(from: string, to: string) {
    if (!state || !chess || color !== state.turn || state.status !== "playing") return;
    const move = chess.moves({ square: from as Square, verbose: true }).find((item) => item.to === to);
    if (!move) return;
    if (move.piece === "p" && (to.endsWith("8") || to.endsWith("1"))) {
      setPromotion({ from, to });
    } else {
      sendMove({ from, to });
    }
  }

  function selectSquare(square: string) {
    if (!state || !chess || !color) return;
    if (selected && legalTargets.has(square)) {
      attemptMove(selected, square);
      return;
    }
    const piece = chess.get(square as Square);
    if (
      state.status === "playing" &&
      state.turn === color &&
      piece?.color === (color === "white" ? "w" : "b")
    ) {
      setSelected(square);
    } else {
      setSelected(null);
    }
  }

  async function copyInvite() {
    const localHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
    const origin = localHost && lanOrigin ? lanOrigin : window.location.origin;
    await navigator.clipboard.writeText(`${origin}/game/${roomId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function shareKakaoInvite() {
    try {
      const key = process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY;
      if (!key) throw new Error("카카오 JavaScript 키가 설정되지 않았습니다.");

      const kakao = await loadKakaoSdk();
      if (!kakao.isInitialized()) kakao.init(key);

      const inviteUrl = `${window.location.origin}/game/${roomId}`;
      kakao.Share.sendDefault({
        objectType: "text",
        text: "웹 체스 대국에 초대합니다. 링크를 눌러 참가하세요.",
        link: { mobileWebUrl: inviteUrl, webUrl: inviteUrl },
        buttonTitle: "대국 참가하기",
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "카카오톡 공유를 열지 못했습니다.");
    }
  }

  async function openKakaoFriends() {
    if (!authUser) {
      window.location.href = `/api/auth/kakao/login?returnTo=${encodeURIComponent(`/game/${roomId}`)}`;
      return;
    }
    setFriendsOpen(true);
    setFriendsLoading(true);
    setFriendConsentRequired(false);
    try {
      const response = await fetch("/api/kakao/friends", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        setFriendConsentRequired(Boolean(data.requiresConsent));
        throw new Error(data.message);
      }
      setFriends(data.friends || []);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "카카오 친구 목록을 불러오지 못했습니다.");
    } finally {
      setFriendsLoading(false);
    }
  }

  async function inviteKakaoFriend(friend: KakaoFriend) {
    setInvitedFriend(friend.uuid);
    try {
      const response = await fetch("/api/kakao/invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ receiverUuid: friend.uuid, roomId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setNotice(`${friend.nickname}님에게 카카오 초대를 보냈습니다.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "카카오 초대를 보내지 못했습니다.");
    } finally {
      setInvitedFriend("");
    }
  }

  const squares = useMemo(() => {
    const files = color === "black" ? [...FILES].reverse() : FILES;
    const ranks = color === "black" ? [...RANKS].reverse() : RANKS;
    return ranks.flatMap((rank) => files.map((file) => `${file}${rank}`));
  }, [color]);

  if (!state) {
    return (
      <main className="loading-screen">
        <span className="brand-mark">♞</span>
        <p>{notice || "게임 서버에 연결하는 중..."}</p>
        {notice && <a href="/">메인으로 돌아가기</a>}
      </main>
    );
  }

  const topColor = color === "black" ? "white" : "black";
  const bottomColor = color === "black" ? "black" : "white";
  const incomingDraw = state.drawOfferBy && state.drawOfferBy !== color;

  return (
    <main className="game-shell">
      <nav className="game-nav">
        <a className="brand" href="/"><span className="brand-mark">♞</span><span>WEB CHESS <b>ARENA</b></span></a>
        <div className="room-code"><span>ROOM</span><b>{roomId.toUpperCase()}</b></div>
        <div className="game-nav-actions">
          <button className="kakao-invite-button" onClick={() => void openKakaoFriends()}>카카오 친구 초대</button>
          <button className="copy-button" onClick={copyInvite} title={lanOrigin ? `LAN: ${lanOrigin}` : undefined}>{copied ? "복사 완료" : "초대 링크 복사"}</button>
        </div>
      </nav>

      <div className="game-layout">
        <section className="board-column">
          <PlayerBar
            color={topColor}
            state={state}
            clock={displayedClocks[topColor]}
            active={state.status === "playing" && state.turn === topColor}
          />
          <div className="board-wrap">
            <div className="chessboard">
              {squares.map((square, index) => {
                const piece = chess?.get(square as Square);
                const pieceKey = piece ? `${piece.color}${piece.type}` : "";
                const isLight = (FILES.indexOf(square[0]) + Number(square[1])) % 2 === 1;
                const target = legalTargets.has(square);
                const lastMove = state.moves.at(-1);
                const last = lastMove?.from === square || lastMove?.to === square;
                const checkedKing =
                  state.check &&
                  piece?.type === "k" &&
                  piece.color === (state.turn === "white" ? "w" : "b");
                return (
                  <button
                    key={square}
                    className={[
                      "square",
                      isLight ? "light" : "dark",
                      selected === square ? "selected" : "",
                      target ? (piece ? "capture-target" : "move-target") : "",
                      last ? "last-move" : "",
                      checkedKing ? "checked" : "",
                    ].join(" ")}
                    onClick={() => selectSquare(square)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      const from = event.dataTransfer.getData("text/plain");
                      if (from) attemptMove(from, square);
                    }}
                  >
                    {index % 8 === 0 && <span className="rank-label">{square[1]}</span>}
                    {index >= 56 && <span className="file-label">{square[0]}</span>}
                    {piece && (
                      <span
                        className={`piece ${piece.color === "w" ? "white-piece" : "black-piece"}`}
                        data-piece={PIECES[pieceKey]}
                        draggable={state.status === "playing" && color === state.turn && piece.color === (color === "white" ? "w" : "b")}
                        onDragStart={(event) => {
                          event.dataTransfer.setData("text/plain", square);
                          setSelected(square);
                        }}
                      >
                        <span className="piece-face">{PIECES[pieceKey]}</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {state.status === "waiting" && (
              <div className="board-overlay waiting-overlay">
                <span className="pulse-ring">♞</span>
                <h2>상대방을 기다리는 중</h2>
                <p>초대 링크를 친구에게 보내 대국을 시작하세요.</p>
                <button onClick={copyInvite}>{copied ? "링크를 복사했습니다" : "초대 링크 복사"}</button>
              </div>
            )}

            {state.result && (
              <div className="board-overlay result-overlay">
                <span className="result-kicker">{reasonLabel(state.result.reason)}</span>
                <h2>{state.result.winner ? `${state.result.winner === color ? "승리" : "패배"}` : "무승부"}</h2>
                <p>{state.result.message}</p>
                <a href="/">새 게임 시작</a>
              </div>
            )}

            {promotion && (
              <div className="promotion-popover">
                <span>승급할 기물을 선택하세요</span>
                <div>
                  {(["q", "r", "b", "n"] as const).map((piece) => (
                    <button key={piece} onClick={() => sendMove({ ...promotion, promotion: piece })}>
                      {PIECES[`${color === "white" ? "w" : "b"}${piece}`]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <PlayerBar
            color={bottomColor}
            state={state}
            clock={displayedClocks[bottomColor]}
            active={state.status === "playing" && state.turn === bottomColor}
          />
        </section>

        <aside className="game-panel">
          <div className="panel-status">
            <span className={`status-dot ${state.status}`} />
            <div>
              <small>{state.status === "waiting" ? "WAITING ROOM" : state.status === "finished" ? "GAME COMPLETE" : "LIVE MATCH"}</small>
              <b>{state.status === "playing" ? `${state.turn === "white" ? "백" : "흑"}의 차례` : state.status === "waiting" ? "두 번째 플레이어 대기 중" : state.result?.message}</b>
            </div>
          </div>

          {incomingDraw && (
            <div className="draw-offer">
              <b>무승부 제안</b>
              <p>상대가 무승부를 제안했습니다.</p>
              <div><button onClick={() => void requestAction("accept_draw")}>수락</button><button onClick={() => void requestAction("decline_draw")}>거절</button></div>
            </div>
          )}

          <div className="moves-heading"><span>기보</span><small>{state.moves.length} MOVES</small></div>
          <div className="move-list" ref={moveListRef}>
            {Array.from({ length: Math.ceil(state.moves.length / 2) }).map((_, index) => {
              const white = state.moves[index * 2];
              const black = state.moves[index * 2 + 1];
              return (
                <div className="move-row" key={index}>
                  <span>{index + 1}.</span><b>{white?.san || ""}</b><b>{black?.san || ""}</b>
                </div>
              );
            })}
            {!state.moves.length && <p className="no-moves">첫 수를 기다리고 있습니다.</p>}
          </div>

          {notice && <button className="notice" onClick={() => setNotice("")}>{notice}<span>×</span></button>}
          <div className="game-actions">
            <button disabled={state.status !== "playing"} onClick={() => void requestAction("offer_draw")}>½ 무승부 제안</button>
            <button className="danger-action" disabled={state.status !== "playing"} onClick={() => window.confirm("정말 기권하시겠습니까?") && void requestAction("resign")}>기권</button>
          </div>
        </aside>
      </div>

      {friendsOpen && (
        <div className="friends-backdrop" onClick={() => setFriendsOpen(false)}>
          <section className="friends-modal" onClick={(event) => event.stopPropagation()}>
            <div className="friends-modal-heading">
              <div><small>KAKAO FRIENDS</small><h2>친구에게 대국 초대</h2></div>
              <button onClick={() => setFriendsOpen(false)}>×</button>
            </div>
            <button className="friends-share-button" onClick={() => void shareKakaoInvite()}>
              카카오톡으로 공유해서 초대
            </button>
            {friendsLoading ? (
              <p className="friends-empty">친구 목록을 불러오는 중...</p>
            ) : friendConsentRequired ? (
              <div className="friends-empty">
                <p>카카오 앱에서 친구 목록 권한을 활성화한 후 사용자 동의가 필요합니다.</p>
                <a href={`/api/auth/kakao/login?consent=friends&returnTo=${encodeURIComponent(`/game/${roomId}`)}`}>친구 권한 동의하기</a>
                <button className="friends-copy-fallback" onClick={() => void copyInvite()}>대신 초대 링크 복사</button>
              </div>
            ) : friends.length ? (
              <div className="friends-list">
                {friends.map((friend) => (
                  <div className="friend-row" key={friend.uuid}>
                    {friend.profileThumbnail ? <img src={friend.profileThumbnail} alt="" /> : <span>K</span>}
                    <b>{friend.nickname}</b>
                    <button disabled={invitedFriend === friend.uuid} onClick={() => void inviteKakaoFriend(friend)}>
                      {invitedFriend === friend.uuid ? "전송 중" : "초대"}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="friends-empty">
                <p>이 앱에 연결된 카카오 친구가 없습니다.</p>
                <small>친구도 카카오 로그인 및 친구 목록 제공에 동의해야 표시됩니다.</small>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

function PlayerBar({
  color,
  state,
  clock,
  active,
}: {
  color: PlayerColor;
  state: GameState;
  clock: number;
  active: boolean;
}) {
  const player = state.players[color];
  return (
    <div className={`player-bar ${active ? "active" : ""}`}>
      <span className={`player-avatar ${color}`}>{color === "white" ? "♔" : "♚"}</span>
      <div className="player-name">
        <b>{player?.nickname || "Waiting..."}</b>
        <small><i className={player?.connected ? "online" : ""} /> {player?.connected ? "CONNECTED" : "OFFLINE"}</small>
      </div>
      {active && <span className="turn-badge">TURN</span>}
      <time>{formatTime(clock)}</time>
    </div>
  );
}
