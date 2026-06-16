/* ai.js - a self-contained Gomoku opponent. No DOM, no network: given a board
   it returns the index the computer should play. Three difficulties tune how
   far it looks and how often it plays the strongest move:

     easy   - short sight, blunders often, weak on defence
     medium - picks the best one-ply move (solid blocker + attacker)
     hard   - one-ply scoring plus a look-ahead that anticipates the reply,
              always takes a win and always blocks an immediate loss

   Scoring works by, for a candidate cell, measuring the runs it would create
   in all four directions for a given colour and mapping (length, open ends) to
   a value. A move is worth its own attacking value plus a share of the value it
   denies the opponent. */
window.GAI = (function () {
  "use strict";
  const N = GEngine.N, CELLS = GEngine.CELLS;
  const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];

  // Map a run of `len` same-colour stones with `ends` open extensions to a score.
  function shape(len, ends) {
    if (len >= 5) return 1000000;          // five in a row - winning
    if (ends === 0) return 0;              // walled in on both sides - dead
    if (len === 4) return ends === 2 ? 200000 : 12000; // open four wins; closed four forces
    if (len === 3) return ends === 2 ? 8000 : 600;     // open three is a real threat
    if (len === 2) return ends === 2 ? 220 : 40;
    if (len === 1) return ends === 2 ? 14 : 4;
    return 0;
  }

  // Value of `player` placing at `idx` on `board`, summed over the 4 directions.
  function cellScore(board, idx, player) {
    const r0 = Math.floor(idx / N), c0 = idx % N;
    let total = 0;
    for (const [dr, dc] of DIRS) {
      let len = 1, ends = 0;
      // forward
      let r = r0 + dr, c = c0 + dc;
      while (r >= 0 && r < N && c >= 0 && c < N && board[r * N + c] === player) { len++; r += dr; c += dc; }
      if (r >= 0 && r < N && c >= 0 && c < N && board[r * N + c] === 0) ends++;
      // backward
      r = r0 - dr; c = c0 - dc;
      while (r >= 0 && r < N && c >= 0 && c < N && board[r * N + c] === player) { len++; r -= dr; c -= dc; }
      if (r >= 0 && r < N && c >= 0 && c < N && board[r * N + c] === 0) ends++;
      total += shape(len, ends);
    }
    return total;
  }

  // Empty cells within `radius` of any stone - the only moves worth weighing.
  function candidates(board, radius) {
    const seen = new Set();
    let any = false;
    for (let i = 0; i < CELLS; i++) {
      if (!board[i]) continue;
      any = true;
      const r0 = Math.floor(i / N), c0 = i % N;
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          const r = r0 + dr, c = c0 + dc;
          if (r < 0 || r >= N || c < 0 || c >= N) continue;
          const j = r * N + c;
          if (board[j] === 0) seen.add(j);
        }
      }
    }
    if (!any) return [Math.floor(CELLS / 2)]; // empty board → centre
    return Array.from(seen);
  }

  // Combined worth of a candidate: what it builds for `ai` plus what it denies
  // `human`. `defense` scales how seriously we treat the opponent's threats.
  function rank(board, cells, ai, human, defense) {
    return cells.map((idx) => {
      const atk = cellScore(board, idx, ai);
      const def = cellScore(board, idx, human);
      return { idx, score: atk + def * defense, atk, def };
    }).sort((a, b) => b.score - a.score);
  }

  const LEVELS = {
    easy:   { radius: 1, defense: 0.4, blunder: 0.45, lookahead: false, topK: 1 },
    medium: { radius: 2, defense: 0.9, blunder: 0.05, lookahead: false, topK: 1 },
    hard:   { radius: 2, defense: 1.0, blunder: 0,    lookahead: true,  topK: 8 },
  };

  // Pick a move index for `ai` (defaults to White) facing `human`.
  function bestMove(board, ai, human, difficulty) {
    const cfg = LEVELS[difficulty] || LEVELS.medium;
    const cells = candidates(board, cfg.radius);
    if (cells.length === 1) return cells[0];

    const ranked = rank(board, cells, ai, human, cfg.defense);

    // Always grab an immediate win, and always block the opponent's.
    const winNow = ranked.find((m) => m.atk >= 1000000);
    if (winNow) return winNow.idx;
    const loseNext = ranked.find((m) => m.def >= 1000000);
    if (loseNext) return loseNext.idx;

    // Easy play sometimes fumbles to a merely-decent move.
    if (cfg.blunder && randLess(cfg.blunder)) {
      const pool = ranked.slice(0, Math.min(6, ranked.length));
      return pool[pick(pool.length)].idx;
    }

    if (!cfg.lookahead) return tieBreak(ranked).idx;

    // Hard: for the strongest candidates, simulate our move then the opponent's
    // best reply, and prefer the move that leaves them the least to work with.
    let best = ranked[0], bestVal = -Infinity;
    for (const m of ranked.slice(0, cfg.topK)) {
      board[m.idx] = ai;
      const reply = rank(board, candidates(board, cfg.radius), human, ai, 1.0)[0];
      board[m.idx] = 0;
      const val = m.score - (reply ? reply.score * 0.95 : 0);
      if (val > bestVal) { bestVal = val; best = m; }
    }
    return best.idx;
  }

  // Choose randomly among moves tied with the top score, so play isn't robotic.
  function tieBreak(ranked) {
    const top = ranked[0].score;
    const tied = ranked.filter((m) => m.score === top);
    return tied[pick(tied.length)];
  }

  function pick(n) { return Math.floor(rand01() * n); }
  function randLess(p) { return rand01() < p; }
  // Math.random is fine here - these picks are cosmetic, never persisted.
  function rand01() { return Math.random(); }

  return { bestMove: bestMove, levels: Object.keys(LEVELS) };
})();
