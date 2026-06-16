# Gomoku — Five in a Row

A 15×15 Gomoku game you can play with one friend over a shareable link, with
live spectators, synthesized sound, and a persistent win/loss record. No
backend, no database, no API keys — the realtime layer is **WebRTC peer-to-peer**
via [PeerJS](https://peerjs.com/).

> Black always opens; first to get five stones in a row (horizontal, vertical,
> or diagonal) wins. This is freestyle Gomoku — no opening restrictions and
> overlines (six or more) also count.

---

## How online play works

There is no server of your own holding game state. The flow is:

1. **You create a room.** Your browser registers a peer id on PeerJS's free
   public broker (`gmk5r-<CODE>`). That broker exists only to introduce
   browsers to each other.
2. **You share the link** (`…/?room=CODE`). The page auto-fills and joins from
   that `room` query param.
3. **Your friend opens it.** Their browser opens a direct WebRTC data channel
   to yours. From here on, moves travel browser-to-browser — the broker is no
   longer in the loop.
4. **Roles are assigned by the host.** The creator plays **Black** and is the
   authority for game state. The first joiner who wants to play takes **White**.
   Anyone who opens the link after that becomes a **spectator** and watches the
   game update live.

The host validates every move and broadcasts the full board to all connected
peers, so spectators and the white player always see a consistent game.

### Important limitation

Because there's no server, **the host's tab must stay open** for the room to
exist. If the creator closes the tab, the room is gone and players/spectators
disconnect. This is the trade-off for a zero-backend, zero-key design. See
*Going more robust* below if you want rooms to survive a host leaving.

---

## Project structure

```
gomoku/
├── index.html          # markup + script/style includes
├── assets/
│   └── styles.css       # all styling (goban + cinnabar theme)
├── src/
│   ├── sound.js         # Web Audio effects, fully synthesized (no files)
│   ├── engine.js        # pure rules: board, win detection, state transitions
│   ├── net.js           # PeerJS layer: rooms, host authority, broadcast
│   └── ui.js            # rendering, input, sound diffing, scores, screen flow
├── vercel.json          # static config (optional)
├── .gitignore
└── README.md
```

The four scripts load in order and communicate through small global namespaces
(`GSound`, `GEngine`, `GNet`) plus an event API (`GNet.on(...)`). No build step,
no bundler, no dependencies to install — PeerJS is loaded from a CDN.

---

## Run locally

Because the scripts are loaded as plain `<script>` tags (not ES modules), you
can open `index.html` directly. But for clipboard, audio, and WebRTC to behave
consistently, serve it over `http://localhost`:

```bash
# any static server works — pick one
npx serve .
# or
python3 -m http.server 8000
```

Then visit `http://localhost:8000` (or whatever port your server prints).

To test multiplayer on one machine, open the room link in **two different
browser windows** (or one normal + one incognito) so each gets its own peer id.

---

## Deploy to Vercel

This is a static site, so deployment is trivial.

**From the dashboard**
1. Push this folder to a GitHub repo.
2. In Vercel, *Add New → Project* and import the repo.
3. Framework preset: **Other** (no build command, output is the repo root).
4. Deploy. Your link is live.

**From the CLI**
```bash
npm i -g vercel
vercel        # preview deploy
vercel --prod # production deploy
```

The included `vercel.json` enables clean URLs and a light cache header on
`/assets`. It's optional — delete it and the site still deploys fine.

No environment variables are needed.

---

## Controls & features

- **Create a room** → get a code + invite link; share the link with a friend.
- **Join with a code** → enter a 5-character code, or just open a `?room=` link.
- **Pass & play** → two people share one device (does not affect your record).
- **Copy link / Code** → invite buttons inside a room.
- **Rematch** → both players must agree; the running score carries over.
- **🔊** → mute/unmute. Sound is generated live (a woody *clack* per stone, a
  chime on a win), so there are no audio assets to host.
- **Win / loss / draw record** → stored in `localStorage` under `gomoku.stats`,
  so it survives reloads on the same browser.

---

## Going more robust (optional upgrades)

The public PeerJS broker is convenient but occasionally flaky and rate-limited.
If you want production-grade reliability, two paths:

1. **Self-host the PeerJS signaling server** (still peer-to-peer for game data):
   ```bash
   npm i -g peer
   peerjs --port 9000 --key peerjs --path /
   ```
   Then point the clients at it by passing options to `new Peer(...)` in
   `src/net.js`:
   ```js
   new Peer(PREFIX + code, { host: "your-host", port: 9000, path: "/", secure: true });
   ```

2. **Move to a hosted realtime backend** (e.g. Supabase Realtime channels) if
   you'd rather rooms survive the host leaving and not depend on a public broker
   at all. That swaps `src/net.js` for a channel-based layer; the engine, UI,
   and sound stay exactly as they are.

---

## License

Do whatever you like with it.
