/* net.js — peer-to-peer rooms over WebRTC (PeerJS).
 *
 * Model: the room creator is the HOST and plays Black. The host is the single
 * source of truth for game state. Everyone else connects TO the host:
 *   - the first joiner who wants to play takes White
 *   - anyone after that becomes a spectator
 * The host validates every move and broadcasts the full state to all peers.
 * There is no server of our own — PeerJS's public broker only introduces the
 * browsers, after which the data flows directly between them.
 *
 * UI talks to this module through a tiny intent API (requestMove / requestRematch)
 * and listens via GNet.on(event, fn). The same calls work whether you are the
 * host or a guest, so the UI never has to know the difference.
 */
window.GNet = (function () {
  "use strict";
  const PREFIX = "gmk5r-"; // namespaced so our peer ids don't collide on the shared broker
  const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

  let peer = null;
  let isHost = false;
  let role = null;            // 'black' | 'white' | 'spectator'
  let code = null;

  // host-only
  let state = null;           // authoritative GEngine state
  let conns = [];             // every open DataConnection (white + spectators)
  let whiteConn = null;

  // guest-only
  let hostConn = null;

  const handlers = {};
  function on(name, fn) { handlers[name] = fn; }
  function emit(name, payload) { if (handlers[name]) handlers[name](payload); }

  function genCode() {
    let s = ""; for (let i = 0; i < 5; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    return s;
  }

  function friendly(err) {
    const t = err && err.type;
    if (t === "peer-unavailable") return "No open room with that code. Ask your friend to keep their tab open.";
    if (t === "network" || t === "server-error" || t === "socket-error") return "Connection trouble reaching the matchmaking broker. Try again in a moment.";
    if (t === "browser-incompatible") return "This browser doesn't support the peer connection. Try Chrome, Edge, or Firefox.";
    return "Connection error" + (t ? " (" + t + ")" : "") + ". Try again.";
  }

  function shareUrl(roomCode) {
    return location.origin + location.pathname + "?room=" + roomCode;
  }

  // ---- HOST -----------------------------------------------------------------
  function create(onReady) {
    isHost = true; role = "black"; code = genCode();
    openHost(onReady, 0);
  }

  function openHost(onReady, attempt) {
    if (attempt > 5) { emit("error", "Couldn't open a room. Please retry."); return; }
    peer = new Peer(PREFIX + code, { debug: 1 });

    peer.on("open", function () {
      state = GEngine.emptyState();
      emit("role", "black");
      emit("state", state);
      emit("status", "Waiting for a friend");
      onReady(code, shareUrl(code));
    });

    peer.on("connection", setupIncoming);

    peer.on("error", function (err) {
      if (err && err.type === "unavailable-id") {       // code already in use globally — pick another
        code = genCode(); try { peer.destroy(); } catch (e) {}
        openHost(onReady, attempt + 1);
      } else if (err && err.type === "peer-unavailable") {
        // a spectator/guest left; not fatal for the host
      } else {
        emit("error", friendly(err));
      }
    });
  }

  function setupIncoming(conn) {
    conn.on("open", function () {
      conns.push(conn);
      let assigned;
      if (!whiteConn) {
        whiteConn = conn; assigned = "white";
        state.players.white = true;
        if (state.status === "waiting") state.status = "playing";
        emit("status", "Opponent joined");
      } else {
        assigned = "spectator";
      }
      safeSend(conn, { t: "welcome", role: assigned, state: state });
      broadcast();
      emit("state", state);
    });

    conn.on("data", function (d) { handleHostData(conn, d); });

    conn.on("close", function () {
      conns = conns.filter((c) => c !== conn);
      if (conn === whiteConn) {
        whiteConn = null;
        state.players.white = false;
        if (state.status === "playing") emit("status", "Opponent left — waiting for someone to join");
        broadcast();
        emit("state", state);
      }
    });
  }

  function handleHostData(conn, d) {
    if (!d || !d.t) return;
    if (d.t === "move" && conn === whiteConn) {
      applyHostMove(d.idx, 2);
    } else if (d.t === "rematch" && conn === whiteConn) {
      state.rematch.white = true;
      tryRematch();
    }
  }

  function applyHostMove(idx, player) {
    if (GEngine.place(state, idx, player)) { emit("state", state); broadcast(); }
  }

  function tryRematch() {
    if (state.rematch.black && state.rematch.white) {
      GEngine.resetBoard(state, !!whiteConn);
      emit("status", whiteConn ? "New game" : "Waiting for a friend");
    }
    emit("state", state); broadcast();
  }

  function broadcast() {
    const msg = { t: "state", state: state };
    conns.forEach((c) => safeSend(c, msg));
  }

  function safeSend(conn, msg) { try { if (conn && conn.open) conn.send(msg); } catch (e) {} }

  // ---- GUEST ----------------------------------------------------------------
  function join(roomCode) {
    isHost = false; code = (roomCode || "").toUpperCase().trim();
    if (code.length !== 5) { emit("error", "A room code is 5 characters."); return; }

    peer = new Peer({ debug: 1 });

    peer.on("open", function () {
      const conn = peer.connect(PREFIX + code, { reliable: true });
      hostConn = conn;
      let opened = false;
      const timeout = setTimeout(function () {
        if (!opened) emit("error", "Couldn't reach that room. Is your friend's tab still open, and is the code right?");
      }, 9000);

      conn.on("open", function () { opened = true; clearTimeout(timeout); safeSend(conn, { t: "hello" }); });
      conn.on("data", handleGuestData);
      conn.on("close", function () { emit("status", "Disconnected from host"); });
    });

    peer.on("error", function (err) { emit("error", friendly(err)); });
  }

  function handleGuestData(d) {
    if (!d || !d.t) return;
    if (d.t === "welcome") {
      role = d.role; state = d.state;
      emit("role", role);
      emit("state", state);
      emit("status", role === "spectator" ? "Spectating" : "Connected — you play White");
    } else if (d.t === "state") {
      state = d.state; emit("state", state);
    }
  }

  // ---- shared intent API ----------------------------------------------------
  function requestMove(idx) {
    if (isHost) applyHostMove(idx, 1);
    else if (hostConn) safeSend(hostConn, { t: "move", idx: idx });
  }

  function requestRematch() {
    if (isHost) { state.rematch.black = true; tryRematch(); }
    else if (hostConn) safeSend(hostConn, { t: "rematch" });
  }

  function leave() {
    try { if (peer) peer.destroy(); } catch (e) {}
    peer = null; isHost = false; role = null; code = null;
    state = null; conns = []; whiteConn = null; hostConn = null;
  }

  return {
    on: on, create: create, join: join,
    requestMove: requestMove, requestRematch: requestRematch, leave: leave,
    shareUrl: shareUrl,
    getRole: function () { return role; },
    getCode: function () { return code; },
    amHost: function () { return isHost; },
  };
})();
