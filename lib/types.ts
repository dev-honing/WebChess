export type PlayerColor = "white" | "black";
export type RoomStatus = "waiting" | "playing" | "finished";
export type EndReason =
  | "checkmate"
  | "resign"
  | "timeout"
  | "stalemate"
  | "insufficient_material"
  | "threefold_repetition"
  | "fifty_move_rule"
  | "draw_agreement";

export interface PublicPlayer {
  id: string;
  nickname: string;
  connected: boolean;
}

export interface MoveRecord {
  moveNumber: number;
  color: PlayerColor;
  from: string;
  to: string;
  promotion?: string;
  san: string;
  fenAfter: string;
  playedAt: number;
}

export interface GameResult {
  outcome: "white_win" | "black_win" | "draw";
  winner: PlayerColor | null;
  reason: EndReason;
  message: string;
}

export interface GameState {
  roomId: string;
  status: RoomStatus;
  players: Partial<Record<PlayerColor, PublicPlayer>>;
  fen: string;
  pgn: string;
  turn: PlayerColor;
  check: boolean;
  moves: MoveRecord[];
  clocks: Record<PlayerColor, number>;
  turnStartedAt: number | null;
  drawOfferBy: PlayerColor | null;
  result: GameResult | null;
  createdAt: number;
  startedAt: number | null;
  endedAt: number | null;
  serverNow: number;
}

export interface UserIdentity {
  id: string;
  nickname: string;
}

export interface AuthUser {
  identity: UserIdentity;
  provider: "kakao";
  profileImage?: string;
}

export interface JoinRoomResponse {
  state: GameState;
  playerColor: PlayerColor;
}

export interface MoveRequest {
  from: string;
  to: string;
  promotion?: "q" | "r" | "b" | "n";
}

export interface ServerError {
  code: string;
  message: string;
}
