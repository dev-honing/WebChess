import { describe, expect, it, vi } from "vitest";
import { createGame, GameError, joinGame, performAction } from "./game-service";

const creator = { id: "creator-id", nickname: "Creator" };
const opponent = { id: "opponent-id", nickname: "Opponent" };

function readyGame() {
  vi.spyOn(Math, "random").mockReturnValue(0.1);
  const created = createGame(creator);
  const joined = joinGame(created.state, opponent);
  return { state: joined.state, white: creator, black: opponent };
}

describe("serverless game service", () => {
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
});
