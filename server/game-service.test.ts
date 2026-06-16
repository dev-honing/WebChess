import { afterEach, describe, expect, it, vi } from "vitest";
import { createGame, GameError, joinGame, performAction, readGame } from "./game-service";

const creator = { id: "creator-id", nickname: "Creator" };
const opponent = { id: "opponent-id", nickname: "Opponent" };

function readyGame() {
  vi.spyOn(Math, "random").mockReturnValue(0.1);
  const created = createGame(creator);
  const joined = joinGame(created.state, opponent);
  return { state: joined.state, white: creator, black: opponent };
}

describe("serverless game service", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts a room when the second player joins", () => {
    const { state } = readyGame();
    expect(state.status).toBe("playing");
    expect(state.players.white?.nickname).toBe("Creator");
    expect(state.players.black?.nickname).toBe("Opponent");
  });

  it("validates turn and legal moves", () => {
    const game = readyGame();
    expect(() =>
      performAction(game.state, game.black, {
        type: "move",
        move: { from: "e7", to: "e5" },
      }),
    ).toThrow(GameError);

    const state = performAction(game.state, game.white, {
      type: "move",
      move: { from: "e2", to: "e4" },
    });
    expect(state.moves[0].san).toBe("e4");
    expect(state.turn).toBe("black");
  });

  it("detects checkmate", () => {
    const game = readyGame();
    let state = performAction(game.state, game.white, {
      type: "move",
      move: { from: "f2", to: "f3" },
    });
    state = performAction(state, game.black, {
      type: "move",
      move: { from: "e7", to: "e5" },
    });
    state = performAction(state, game.white, {
      type: "move",
      move: { from: "g2", to: "g4" },
    });
    state = performAction(state, game.black, {
      type: "move",
      move: { from: "d8", to: "h4" },
    });
    expect(state.status).toBe("finished");
    expect(state.result?.reason).toBe("checkmate");
    expect(state.result?.winner).toBe("black");
  });

  it("finishes by resignation and agreed draw", () => {
    const first = readyGame();
    expect(performAction(first.state, first.white, { type: "resign" }).result?.winner).toBe(
      "black",
    );

    const second = readyGame();
    let state = performAction(second.state, second.white, { type: "offer_draw" });
    state = performAction(state, second.black, { type: "accept_draw" });
    expect(state.result?.outcome).toBe("draw");
    expect(state.result?.reason).toBe("draw_agreement");
  });

  it("scores captured pieces by value", () => {
    const game = readyGame();
    let state = performAction(game.state, game.white, {
      type: "move",
      move: { from: "e2", to: "e4" },
    });
    state = performAction(state, game.black, {
      type: "move",
      move: { from: "d7", to: "d5" },
    });
    state = performAction(state, game.white, {
      type: "move",
      move: { from: "e4", to: "d5" },
    });

    expect(state.captureScore.white).toBe(1);
    expect(state.captureScore.black).toBe(0);
    expect(state.moves.at(-1)?.captured).toBe("p");
    expect(state.moves.at(-1)?.capturedValue).toBe(1);
  });

  it("decides timeout winner by current capture score", () => {
    vi.useFakeTimers();
    vi.setSystemTime(20_000);
    const game = readyGame();
    const state = {
      ...game.state,
      turn: "black" as const,
      turnStartedAt: 1,
      clocks: { white: 60_000, black: 1 },
      captureScore: { white: 3, black: 1 },
    };

    const read = readGame(state);
    expect(read.changed).toBe(true);
    expect(read.storedState.status).toBe("finished");
    expect(read.storedState.result?.reason).toBe("timeout");
    expect(read.storedState.result?.winner).toBe("white");
    expect(read.storedState.match.points.white).toBe(3);
    expect(read.storedState.match.points.black).toBe(1);
  });

  it("starts another round in the same room after a finished game", () => {
    const game = readyGame();
    let state = performAction(game.state, game.white, { type: "resign" });
    expect(state.status).toBe("finished");
    expect(state.match.rounds.black).toBe(1);

    state = performAction(state, game.white, { type: "rematch" });
    expect(state.status).toBe("playing");
    expect(state.round).toBe(2);
    expect(state.result).toBeNull();
    expect(state.moves).toHaveLength(0);
    expect(state.captureScore).toEqual({ white: 0, black: 0 });
    expect(state.match.rounds.black).toBe(1);
  });
});
