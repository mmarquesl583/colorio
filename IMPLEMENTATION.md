# color.io — implementation

Real-time multiplayer implementation of the `project/cor.io.dc.html` design (Claude Design handoff bundle described in `README.md` / `chats/chat1.md`).

## Stack

- `shared/` — plain TypeScript, no build step. Color math (HSL↔RGB, CIE Lab, Delta E 2000), the 0–1000 scoring curve, theme/phrase data, and the WebSocket protocol types. Imported directly by both client and server.
- `server/` — Node + `ws`. Authoritative in-memory room/round state machine (timers, master rotation, scoring). One process, no database — matches the scope of a party-game prototype.
- `client/` — Vite + React + TypeScript. Pixel-matched port of the three screens in the design (room setup, waiting room, game).

## Running it

```bash
cd server && npm install && npm run dev   # ws server on :8787
cd client && npm install && npm run dev   # app on :5173
```

Open `http://localhost:5173` in two browser tabs/devices to play with a friend. Set `VITE_WS_URL` in `client/.env` if the server isn't on `localhost:8787`.

## Notable decisions (see conversation for full rationale)

- **Real multiplayer**, not the prototype's client-side bot simulation: the server is authoritative for round phase, timers, and scoring (Delta E 2000 computed server-side so nobody can see the secret color early).
- **"Frase da IA" mode** uses a curated bank of generic clue phrases (`shared/gameData.ts: AI_PHRASE_BANK`) rather than a live model call — no LLM is wired up. Say the word if you want that mode backed by a real API call instead.
- The fake iPhone bezel is only shown as a desktop preview frame; on real mobile viewports (≤520px) the app runs full-screen, matching the last request in the chat transcript (cor.io → color.io rename + "no mockup on real phones").
- A minimal home screen (name entry + create/join-by-code) was added since the original design started mid-flow assuming a single local host; every other screen is a close pixel port of the `.dc.html` source.
