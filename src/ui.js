/* ui.js — rendering, input, and glue. Reads game state from GNet, draws the
   board, wires the controls, plays sound on state transitions, and keeps the
   lifetime win/loss/draw tally in localStorage. */
(function () {
  "use strict";
  const N = GEngine.N, CELLS = GEngine.CELLS;
  const MARGIN = 34, SPAN = 600 - MARGIN * 2, STEP = SPAN / (N - 1);
  const STAR = [3, 7, 11];
  const colorName = GEngine.colorName;

  // -- screen state -----------------------------------------------------------
  let mode = null;          // 'online' | 'local'
  let role = null;          // online seat: 'black' | 'white' | 'spectator'
  let state = null;         // current state we render from
  let prev = null;          // previous state, for sound + transitions
  let banked = false;       // lifetime stat counted for this finished game?
  let shareLink = "";

  // -- DOM --------------------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const el = {
    lobby: $("lobby"), game: $("game"),
    board: $("board"), boardbox: $("boardbox"),
    createBtn: $("create-btn"), joinBtn: $("join-btn"), joinInput: $("join-input"),
    localBtn: $("local-btn"), lobbyErr: $("lobby-err"),
    turnCard: $("turn-card"), turnStone: $("turn-stone"), turnLabel: $("turn-label"), turnWho: $("turn-who"),
    statusMsg: $("status-msg"),
    scoreBlack: $("score-black"), scoreWhite: $("score-white"),
    roomPanel: $("room-panel"), roomCode: $("room-code"), roleBadge: $("role-badge"),
    copyCode: $("copy-code"), copyLink: $("copy-link"),
    rematchBtn: $("rematch-btn"), leaveBtn: $("leave-btn"),
    soundBtn: $("sound-btn"), brand: $("brand"), toast: $("toast"),
    ltW: $("lt-w"), ltL: $("lt-l"), ltD: $("lt-d"),
  };

  // -- lifetime scores (localStorage) ----------------------------------------
  function loadStats() {
    try { return Object.assign({ w: 0, l: 0, d: 0 }, JSON.parse(localStorage.getItem("gomoku.stats") || "{}")); }
    catch (e) { return { w: 0, l: 0, d: 0 }; }
  }
  function saveStats(s) { try { localStorage.setItem("gomoku.stats", JSON.stringify(s)); } catch (e) {} }
  let stats = loadStats();
  function renderStats() { el.ltW.textContent = stats.w; el.ltL.textContent = stats.l; el.ltD.textContent = stats.d; }

  // -- view helper ------------------------------------------------------------
  function canMove() {
    if (!state || state.status !== "playing") return false;
    if (mode === "local") return true;
    if (role === "black") return state.turn === 1;
    if (role === "white") return state.turn === 2;
    return false;
  }

  // -- board rendering --------------------------------------------------------
  const xy = (i) => ({ x: MARGIN + (i % N) * STEP, y: MARGIN + Math.floor(i / N) * STEP });

  function renderBoard() {
    if (!state) { el.board.innerHTML = ""; return; }
    let svg = "";
    for (let i = 0; i < N; i++) {
      const p = MARGIN + i * STEP;
      svg += '<line x1="' + MARGIN + '" y1="' + p + '" x2="' + (600 - MARGIN) + '" y2="' + p + '" stroke="var(--ink)" stroke-width="1.1"/>';
      svg += '<line x1="' + p + '" y1="' + MARGIN + '" x2="' + p + '" y2="' + (600 - MARGIN) + '" stroke="var(--ink)" stroke-width="1.1"/>';
    }
    for (const r of STAR) for (const c of STAR) { const o = xy(r * N + c); svg += '<circle cx="' + o.x + '" cy="' + o.y + '" r="3.4" fill="var(--ink)"/>'; }

    if (state.winLine && state.winLine.length) {
      const a = xy(state.winLine[0]), b = xy(state.winLine[state.winLine.length - 1]);
      svg += '<line x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '" stroke="var(--cinnabar)" stroke-width="9" stroke-linecap="round" opacity=".45"/>';
    }

    const R = STEP * 0.44;
    for (let i = 0; i < CELLS; i++) {
      const p = state.board[i]; if (!p) continue;
      const o = xy(i);
      svg += '<circle cx="' + o.x + '" cy="' + (o.y + 1.5) + '" r="' + R + '" fill="rgba(0,0,0,.32)"/>';
      if (p === 1) svg += '<circle cx="' + o.x + '" cy="' + o.y + '" r="' + R + '" fill="url(#blk)"/>';
      else svg += '<circle cx="' + o.x + '" cy="' + o.y + '" r="' + R + '" fill="url(#wht)" stroke="#cdbfa3" stroke-width=".6"/>';
      svg += '<circle cx="' + (o.x - R * .3) + '" cy="' + (o.y - R * .3) + '" r="' + (R * .26) + '" fill="rgba(255,255,255,' + (p === 1 ? .28 : .85) + ')"/>';
    }
    if (state.lastMove != null && state.board[state.lastMove]) {
      const o = xy(state.lastMove);
      svg += '<circle cx="' + o.x + '" cy="' + o.y + '" r="' + (R * .26) + '" fill="none" stroke="var(--cinnabar-hi)" stroke-width="2"/>';
    }
    svg += '<defs>' +
      '<radialGradient id="blk" cx="36%" cy="30%" r="75%"><stop offset="0%" stop-color="#56504a"/><stop offset="55%" stop-color="#221f1b"/><stop offset="100%" stop-color="#0b0a09"/></radialGradient>' +
      '<radialGradient id="wht" cx="36%" cy="30%" r="80%"><stop offset="0%" stop-color="#ffffff"/><stop offset="70%" stop-color="#f0e9d9"/><stop offset="100%" stop-color="#d2c8b2"/></radialGradient>' +
      '</defs>';

    const playable = canMove();
    for (let i = 0; i < CELLS; i++) {
      if (state.board[i]) continue;
      const o = xy(i);
      svg += '<circle class="hit" data-idx="' + i + '" cx="' + o.x + '" cy="' + o.y + '" r="' + (STEP * 0.46) + '"' + (playable ? "" : ' pointer-events="none"') + "/>";
    }
    el.board.innerHTML = svg;
    el.boardbox.classList.toggle("locked", !playable);
  }

  function renderSide() {
    if (!state) return;
    const turnColor = colorName(state.turn);
    el.turnStone.className = "turn-stone " + turnColor;
    el.turnWho.textContent = turnColor.charAt(0).toUpperCase() + turnColor.slice(1);
    el.turnCard.classList.toggle("active", state.status === "playing");

    el.scoreBlack.textContent = state.scores.black;
    el.scoreWhite.textContent = state.scores.white;

    let msg = "";
    if (mode === "online") {
      if (state.status === "waiting") msg = "Waiting for a friend";
      else if (state.status === "won") msg = (state.winner === 1 ? "Black" : "White") + " wins";
      else if (state.status === "draw") msg = "Board full — a draw";
      else if (role === "spectator") msg = "Spectating";
      el.turnLabel.textContent = (role !== "spectator" && state.status === "playing") ? (canMove() ? "Your turn" : "Their turn") : "Turn";
    } else {
      if (state.status === "won") msg = (state.winner === 1 ? "Black" : "White") + " wins";
      else if (state.status === "draw") msg = "Board full — a draw";
      el.turnLabel.textContent = "Turn";
    }
    el.statusMsg.textContent = msg;
    el.statusMsg.classList.toggle("waiting-dots", mode === "online" && state.status === "waiting");

    if (mode === "online") {
      el.roomPanel.classList.remove("hidden");
      el.roomCode.textContent = GNet.getCode() || "—";
      el.roleBadge.textContent = role === "spectator" ? "Spectator" : "You play " + role;
      el.roleBadge.classList.toggle("you", role !== "spectator");
    } else {
      el.roomPanel.classList.add("hidden");
    }

    const finished = state.status === "won" || state.status === "draw";
    const canRematch = finished && (mode === "local" || role !== "spectator");
    el.rematchBtn.classList.toggle("hidden", !canRematch);
  }

  function render() { renderBoard(); renderSide(); }

  // -- sound + stats on state transitions ------------------------------------
  function onState(s) {
    state = s;
    if (prev) {
      if (s.lastMove != null && s.lastMove !== prev.lastMove && s.board[s.lastMove]) GSound.clack(s.board[s.lastMove] === 2);
      if (s.status === "won" && prev.status !== "won") GSound.win();
      else if (s.status === "draw" && prev.status !== "draw") GSound.draw();
      if (!prev.players.white && s.players.white) GSound.join();
      // a fresh game started after a finished one
      if ((prev.status === "won" || prev.status === "draw") && (s.status === "playing" || s.status === "waiting")) banked = false;
    }
    bankResult(s);
    prev = JSON.parse(JSON.stringify(s));
    render();
  }

  function bankResult(s) {
    if (banked) return;
    if (s.status !== "won" && s.status !== "draw") return;
    const iAmPlayer = (mode === "local") || (mode === "online" && role !== "spectator");
    if (!iAmPlayer) { banked = true; return; }
    banked = true;
    if (mode === "local") return; // local hot-seat doesn't touch lifetime record
    if (s.status === "draw") stats.d++;
    else if (colorName(s.winner) === role) stats.w++;
    else stats.l++;
    saveStats(stats); renderStats();
  }

  // -- screen flow ------------------------------------------------------------
  function enterGame() { el.lobby.classList.add("hidden"); el.game.classList.remove("hidden"); render(); }
  function lobbyErr(t) { el.lobbyErr.textContent = t || ""; }

  let toastTimer = null;
  function toast(t) {
    el.toast.textContent = t; el.toast.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.toast.classList.remove("show"), 2600);
  }

  function startLocal() {
    mode = "local"; role = null; prev = null; banked = false;
    state = GEngine.emptyState(); state.status = "playing"; state.players.white = true;
    GSound.sweep(); enterGame();
  }

  function wireNet() {
    GNet.on("role", (r) => { role = r; render(); });
    GNet.on("state", onState);
    GNet.on("status", (m) => { toast(m); });
    GNet.on("error", (m) => {
      if (el.game.classList.contains("hidden")) lobbyErr(m); else toast(m);
    });
  }

  function createRoom() {
    mode = "online"; prev = null; banked = false; lobbyErr("");
    GSound.sweep();
    GNet.create(function (code, url) {
      shareLink = url; enterGame();
      toast("Room " + code + " — share the link");
    });
  }

  function joinRoom(raw) {
    const code = (raw || "").toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 5);
    if (code.length !== 5) { lobbyErr("A room code is 5 characters."); return; }
    mode = "online"; prev = null; banked = false; lobbyErr("");
    shareLink = GNet.shareUrl(code);
    GSound.sweep();
    GNet.join(code);
    enterGame();
  }

  function leave() {
    GNet.leave();
    mode = null; role = null; state = null; prev = null; banked = false;
    el.game.classList.add("hidden"); el.lobby.classList.remove("hidden");
    el.joinInput.value = ""; lobbyErr("");
    // drop ?room= from the URL so a refresh doesn't auto-rejoin a dead room
    if (location.search) history.replaceState(null, "", location.pathname);
  }

  // -- input wiring -----------------------------------------------------------
  el.board.addEventListener("click", (e) => {
    const t = e.target;
    if (t && t.classList.contains("hit")) {
      GSound.unlock();
      if (!canMove()) { GSound.deny(); return; }
      const idx = parseInt(t.getAttribute("data-idx"), 10);
      if (mode === "local") { GEngine.place(state, idx, state.turn); onState(state); }
      else GNet.requestMove(idx);
    }
  });

  el.createBtn.addEventListener("click", () => { GSound.unlock(); createRoom(); });
  el.joinBtn.addEventListener("click", () => { GSound.unlock(); joinRoom(el.joinInput.value); });
  el.joinInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { GSound.unlock(); joinRoom(el.joinInput.value); } });
  el.joinInput.addEventListener("input", () => { el.joinInput.value = el.joinInput.value.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 5); });
  el.localBtn.addEventListener("click", () => { GSound.unlock(); startLocal(); });
  el.rematchBtn.addEventListener("click", () => { GSound.unlock(); if (mode === "local") { GEngine.resetBoard(state, true); state.status = "playing"; GSound.sweep(); onState(state); } else GNet.requestRematch(); });
  el.leaveBtn.addEventListener("click", () => { GSound.sweep(); leave(); });
  el.brand.addEventListener("click", () => { if (!el.game.classList.contains("hidden")) leave(); });

  el.copyCode.addEventListener("click", async () => {
    const code = GNet.getCode(); if (!code) return;
    try { await navigator.clipboard.writeText(code); toast("Code copied: " + code); }
    catch (e) { toast("Room code: " + code); }
  });
  el.copyLink.addEventListener("click", async () => {
    if (!shareLink) return;
    try { await navigator.clipboard.writeText(shareLink); toast("Invite link copied"); }
    catch (e) { toast(shareLink); }
  });
  el.soundBtn.addEventListener("click", () => { const m = GSound.toggle(); el.soundBtn.textContent = m ? "🔇" : "🔊"; });

  // -- boot -------------------------------------------------------------------
  wireNet();
  renderStats();
  const params = new URLSearchParams(location.search);
  const roomParam = params.get("room");
  if (roomParam) { el.joinInput.value = roomParam.toUpperCase().slice(0, 5); joinRoom(roomParam); }
})();
