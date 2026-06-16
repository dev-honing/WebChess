import { Chess } from "chess.js";
import { randomBytes } from "node:crypto";
import type {
  EndReason,
  GameResult,
  GameState,
  JoinRoomResponse,
  MoveRequest,
  PlayerColor,
  UserIdentity,
} from "@/lib/types";

const STARTING_TIME_MS = 10 * 60 * 1000;
const PIECE_VALUES: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  // Kings are never scored as captures; checkmate ends the round.
  k: 0,
};

export type GameAction =
  | { type: "move"; move: MoveRequest }
  | { type: "resign" }
  | { type: "offer_draw" }
  | { type: "accept_draw" }
  | { type: "decline_draw" }
  | { type: "rematch" };

export class GameError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

function opposite(color: PlayerColor): PlayerColor {
  return color === "white" ? "black" : "white";
}

function chessColor(color: "w" | "b"): PlayerColor {
  return color === "w" ? "white" : "black";
}

function cleanIdentity(identity: UserIdentity): UserIdentity {
  return {
    id: String(identity?.id || "").slice(0, 80),
    nickname: String(identity?.nickname || "Guest").trim().slice(0, 18) || "Guest",
  };
}

function cloneState(state: GameState): GameState {
  return structuredClone(state);
}

function emptyScore() {
  return { white: 0, black: 0 };
}

function ensureGameMeta(state: GameState) {
  let changed = false;
  if (!state.round) {
    state.round = 1;
    changed = true;
  }
  if (!state.captureScore) {
    state.captureScore = emptyScore();
    changed = true;
  }
  if (!state.match) {
    state.match = { rounds: emptyScore(), points: emptyScore() };
    changed = true;
  }
  return changed;
}

function findPlayerColor(state: GameState, userId: string): PlayerColor | null {
  if (state.players.white?.id === userId) return "white";
  if (state.players.black?.id === userId) return "black";
  return null;
}

function requirePlayer(state: GameState, identity: UserIdentity) {
  const color = findPlayerColor(state, identity.id);
  if (!color) throw new GameError("NOT_A_PLAYER", "이 게임의 플레이어가 아닙니다.");
  return color;
}

function requirePlaying(state: GameState) {
  if (state.status !== "playing") {
    throw new GameError("GAME_NOT_PLAYING", "현재 진행 중인 게임이 아닙니다.");
  }
}

function finish(
  state: GameState,
  winner: PlayerColor | null,
  reason: EndReason,
  message: string,
) {
  ensureGameMeta(state);
  state.status = "finished";
  state.endedAt = Date.now();
  state.turnStartedAt = null;
  state.drawOfferBy = null;
  state.match.points.white += state.captureScore.white;
  state.match.points.black += state.captureScore.black;
  if (winner) state.match.rounds[winner] += 1;
  state.result = {
    outcome: winner ? `${winner}_win` : "draw",
    winner,
    reason,
    message,
  };
}

function settleClock(state: GameState, now = Date.now()) {
  if (state.status !== "playing" || !state.turnStartedAt) return;
  state.clocks[state.turn] = Math.max(0, state.clocks[state.turn] - (now - state.turnStartedAt));
  state.turnStartedAt = now;
  if (state.clocks[state.turn] === 0) {
    const winner =
      state.captureScore.white === state.captureScore.black
        ? null
        : state.captureScore.white > state.captureScore.black
          ? "white"
          : "black";
    const scoreText = `백 ${state.captureScore.white}점 : 흑 ${state.captureScore.black}점`;
    finish(
      state,
      winner,
      "timeout",
      winner
        ? `시간 종료. ${scoreText}, ${winner === "white" ? "백" : "흑"}이 점수 우세로 승리했습니다.`
        : `시간 종료. ${scoreText}, 점수 동률로 무승부입니다.`,
    );
  }
}

function chessFromState(state: GameState) {
  const chess = new Chess();
  for (const move of state.moves) {
    chess.move({ from: move.from, to: move.to, promotion: move.promotion });
  }
  return chess;
}

function finishForBoardState(state: GameState, chess: Chess, mover: PlayerColor) {
  if (chess.isCheckmate()) {
    finish(state, mover, "checkmate", "체크메이트입니다.");
  } else if (chess.isStalemate()) {
    finish(state, null, "stalemate", "스테일메이트로 무승부입니다.");
  } else if (chess.isInsufficientMaterial()) {
    finish(state, null, "insufficient_material", "기물 부족으로 무승부입니다.");
  } else if (chess.isThreefoldRepetition()) {
    finish(state, null, "threefold_repetition", "3회 동형 반복으로 무승부입니다.");
  } else if (chess.isDraw()) {
    finish(state, null, "fifty_move_rule", "50수 규칙으로 무승부입니다.");
  }
}

function resetBoardForNextRound(state: GameState) {
  if (!state.players.white || !state.players.black) {
    throw new GameError("WAITING_FOR_PLAYER", "두 명의 플레이어가 필요합니다.");
  }
  if (state.status !== "finished") {
    throw new GameError("GAME_NOT_FINISHED", "종료된 게임만 다시 시작할 수 있습니다.");
  }
  ensureGameMeta(state);
  const chess = new Chess();
  const now = Date.now();
  state.round += 1;
  state.status = "playing";
  state.fen = chess.fen();
  state.pgn = "";
  state.turn = "white";
  state.check = false;
  state.moves = [];
  state.captureScore = emptyScore();
  state.clocks = { white: STARTING_TIME_MS, black: STARTING_TIME_MS };
  state.turnStartedAt = now;
  state.drawOfferBy = null;
  state.result = null;
  state.startedAt = now;
  state.endedAt = null;
  state.serverNow = now;
}

export function createGame(rawIdentity: UserIdentity): JoinRoomResponse & { roomId: string } {
  const identity = cleanIdentity(rawIdentity);
  const creatorColor: PlayerColor = Math.random() < 0.5 ? "white" : "black";
  const now = Date.now();
  const chess = new Chess();
  const state: GameState = {
    roomId: randomBytes(5).toString("hex"),
    status: "waiting",
    round: 1,
    players: {
      [creatorColor]: { ...identity, connected: true },
    },
    fen: chess.fen(),
    pgn: "",
    turn: "white",
    check: false,
    moves: [],
    captureScore: emptyScore(),
    match: { rounds: emptyScore(), points: emptyScore() },
    clocks: { white: STARTING_TIME_MS, black: STARTING_TIME_MS },
    turnStartedAt: null,
    drawOfferBy: null,
    result: null,
    createdAt: now,
    startedAt: null,
    endedAt: null,
    serverNow: now,
  };
  return { roomId: state.roomId, playerColor: creatorColor, state };
}

export function joinGame(stored: GameState, rawIdentity: UserIdentity): JoinRoomResponse {
  const state = cloneState(stored);
  ensureGameMeta(state);
  const identity = cleanIdentity(rawIdentity);
  let color = findPlayerColor(state, identity.id);

  if (!color) {
    if (state.status === "finished") {
      throw new GameError("GAME_FINISHED", "이미 종료된 게임입니다.");
    }
    color = state.players.white ? "black" : "white";
    if (state.players[color]) {
      throw new GameError("ROOM_FULL", "이미 두 명의 플레이어가 참가 중입니다.");
    }
    state.players[color] = { ...identity, connected: true };
  } else {
    state.players[color] = { ...state.players[color]!, nickname: identity.nickname, connected: true };
  }

  if (state.players.white && state.players.black && state.status === "waiting") {
    state.status = "playing";
    state.startedAt = Date.now();
    state.turnStartedAt = state.startedAt;
  }
  state.serverNow = Date.now();
  return { playerColor: color, state };
}

export function readGame(stored: GameState) {
  const state = cloneState(stored);
  const now = Date.now();
  let changed = ensureGameMeta(state);

  if (
    state.status === "playing" &&
    state.turnStartedAt &&
    state.clocks[state.turn] - (now - state.turnStartedAt) <= 0
  ) {
    settleClock(state, now);
    changed = true;
  }

  const response = cloneState(state);
  if (response.status === "playing" && response.turnStartedAt) {
    response.clocks[response.turn] = Math.max(
      0,
      response.clocks[response.turn] - (now - response.turnStartedAt),
    );
  }
  response.serverNow = now;
  return { storedState: state, responseState: response, changed };
}

export function performAction(
  stored: GameState,
  rawIdentity: UserIdentity,
  action: GameAction,
) {
  const state = cloneState(stored);
  ensureGameMeta(state);
  const identity = cleanIdentity(rawIdentity);
  const color = requirePlayer(state, identity);

  if (action.type === "rematch") {
    resetBoardForNextRound(state);
    return state;
  }

  requirePlaying(state);
  settleClock(state);
  if (state.status === "finished") return state;

  if (action.type === "move") {
    const chess = chessFromState(state);
    if (chessColor(chess.turn()) !== color) {
      throw new GameError("NOT_YOUR_TURN", "상대방의 차례입니다.");
    }

    let move;
    try {
      move = chess.move({
        from: action.move.from,
        to: action.move.to,
        promotion: action.move.promotion || "q",
      });
    } catch {
      move = null;
    }
    if (!move) throw new GameError("ILLEGAL_MOVE", "이동할 수 없는 수입니다.");

    const mover = chessColor(move.color);
    const captured = move.captured;
    const capturedValue = captured ? PIECE_VALUES[captured] || 0 : 0;
    if (capturedValue) state.captureScore[mover] += capturedValue;
    state.moves.push({
      moveNumber: Math.floor(state.moves.length / 2) + 1,
      color: mover,
      from: move.from,
      to: move.to,
      promotion: move.promotion,
      captured,
      capturedValue: captured ? capturedValue : undefined,
      san: move.san,
      fenAfter: chess.fen(),
      playedAt: Date.now(),
    });
    state.fen = chess.fen();
    state.pgn = chess.pgn();
    state.turn = chessColor(chess.turn());
    state.check = chess.isCheck();
    state.drawOfferBy = null;
    state.turnStartedAt = Date.now();
    finishForBoardState(state, chess, mover);
  } else if (action.type === "resign") {
    finish(state, opposite(color), "resign", `${color === "white" ? "백" : "흑"}이 기권했습니다.`);
  } else if (action.type === "offer_draw") {
    state.drawOfferBy = color;
  } else if (action.type === "decline_draw") {
    if (state.drawOfferBy && state.drawOfferBy !== color) state.drawOfferBy = null;
  } else if (action.type === "accept_draw") {
    if (!state.drawOfferBy || state.drawOfferBy === color) {
      throw new GameError("NO_DRAW_OFFER", "수락할 무승부 제안이 없습니다.");
    }
    finish(state, null, "draw_agreement", "두 플레이어가 무승부에 합의했습니다.");
  }

  state.serverNow = Date.now();
  return state;
}
