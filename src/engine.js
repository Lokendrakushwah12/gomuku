/* engine.js — pure Gomoku rules. No DOM, no network. Used by the host to keep
   the authoritative game state, and by the UI for board constants. */
window.GEngine = (function () {
  "use strict";
  const N = 15;
  const CELLS = N * N;
  const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];

  function emptyState() {
    return {
      board: new Array(CELLS).fill(0), // 0 empty, 1 black, 2 white
      turn: 1,
      status: "waiting",               // waiting | playing | won | draw
      winner: 0,
      winLine: null,
      lastMove: null,
      scores: { black: 0, white: 0 },
      players: { black: true, white: false },
      rematch: { black: false, white: false },
    };
  }

  // Returns the list of indices forming the win (length >= 5) or null.
  function checkWin(board, idx, player) {
    const r0 = Math.floor(idx / N), c0 = idx % N;
    for (const [dr, dc] of DIRS) {
      let line = [idx];
      for (let s = 1; s < N; s++) {
        const r = r0 + dr * s, c = c0 + dc * s;
        if (r < 0 || r >= N || c < 0 || c >= N || board[r * N + c] !== player) break;
        line.push(r * N + c);
      }
      for (let s = 1; s < N; s++) {
        const r = r0 - dr * s, c = c0 - dc * s;
        if (r < 0 || r >= N || c < 0 || c >= N || board[r * N + c] !== player) break;
        line.unshift(r * N + c);
      }
      if (line.length >= 5) return line;
    }
    return null;
  }

  // Mutates `state`. Returns true if the move was legal and applied.
  function place(state, idx, player) {
    if (state.status !== "playing" || state.turn !== player || state.board[idx] !== 0) return false;
    state.board[idx] = player;
    state.lastMove = idx;
    const line = checkWin(state.board, idx, player);
    if (line) {
      state.status = "won";
      state.winner = player;
      state.winLine = line;
      state.scores[player === 1 ? "black" : "white"]++;
    } else if (state.board.every((c) => c !== 0)) {
      state.status = "draw";
    } else {
      state.turn = player === 1 ? 2 : 1;
    }
    return true;
  }

  // Reset board for a rematch, keeping the running score.
  function resetBoard(state, hasWhite) {
    state.board = new Array(CELLS).fill(0);
    state.turn = 1;
    state.winner = 0;
    state.winLine = null;
    state.lastMove = null;
    state.status = hasWhite ? "playing" : "waiting";
    state.rematch = { black: false, white: false };
  }

  return { N, CELLS, emptyState, checkWin, place, resetBoard, colorName: (p) => (p === 1 ? "black" : "white") };
})();
