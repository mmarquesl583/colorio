import { createServer } from 'node:http';
import { appendFile } from 'node:fs/promises';
import { WebSocketServer, WebSocket } from 'ws';
import { newPlayerId, newRoomCode } from './id.ts';
import { Room, type QuestionReport } from './room.ts';
import { verifyUserToken } from './supabaseAdmin.ts';
import { startStaleSessionSweep, startQuestionOverridesPoll, recordQuestionReport } from './stats.ts';
import { handleAdminRequest } from './admin.ts';
import { LOBBY_THEMES, MIN_PLAYERS, MAX_PLAYERS, MIN_ROUNDS, MAX_ROUNDS } from '../../shared/gameData.ts';
import type { ClientMessage, RoomConfig, ServerMessage, PublicRoomSummary } from '../../shared/types.ts';

const PORT = Number(process.env.PORT) || 8787;
const rooms = new Map<string, Room>();

// Question reports (Frase da IA "reportar pergunta" button) — kept in memory
// for the running process and best-effort appended to a local file so they
// survive a plain restart. Render's free-tier disk is NOT guaranteed to
// survive a redeploy, so this is a mailbox to check periodically, not a
// permanent archive.
const reports: QuestionReport[] = [];
function recordReport(report: QuestionReport) {
  reports.push(report);
  if (reports.length > 2000) reports.shift();
  appendFile('reports.jsonl', JSON.stringify(report) + '\n', 'utf8').catch((err) => {
    console.error('Failed to persist report to disk:', err);
  });
  // Durable copy for the admin panel — the file above stays untouched, this
  // is purely additive (see the comment on recordQuestionReport itself).
  recordQuestionReport({
    userId: report.reporterUserId, roomCode: report.roomCode, themeId: report.themeId,
    questionId: report.questionId, phrase: report.phrase,
  });
}

function publicRoomSummary(room: Room): PublicRoomSummary {
  const host = room.players.get(room.hostId ?? '');
  return {
    code: room.code,
    hostName: host?.name ?? '?',
    playerCount: [...room.players.values()].filter((p) => p.connected).length,
    numPlayers: room.config.numPlayers,
    phraseMode: room.config.phraseMode,
    screen: room.screen,
    numRounds: room.config.numRounds,
  };
}

function sanitizeConfig(input: Partial<RoomConfig> | undefined): RoomConfig {
  const validThemeIds = new Set(LOBBY_THEMES.map((t) => t.id));
  const selectedThemes = (input?.selectedThemes ?? LOBBY_THEMES.map((t) => t.id)).filter((id) => validThemeIds.has(id));
  return {
    numPlayers: clamp(input?.numPlayers ?? 5, MIN_PLAYERS, MAX_PLAYERS),
    numRounds: clamp(input?.numRounds ?? 5, MIN_ROUNDS, MAX_ROUNDS),
    phraseMode: input?.phraseMode === 'ai' ? 'ai' : 'players',
    gameMode: input?.gameMode === 'race' ? 'race' : 'classic',
    privacy: input?.privacy === 'private' ? 'private' : 'public',
    selectedThemes: selectedThemes.length ? selectedThemes : LOBBY_THEMES.map((t) => t.id),
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(Number(v) || min)));
}

// ClientMessage is a compile-time-only type — nothing about the JSON a
// socket actually sends is guaranteed to match it. Rejecting the obvious
// wrong-type cases up front (rather than letting e.g. `code.toUpperCase()`
// throw deeper in) avoids leaving half-built state behind, like a Room
// that got inserted into `rooms` before addPlayer() throws on a
// non-string name and never gets cleaned up.
function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

function send(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

const httpServer = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');

  if (url.pathname === '/health') { res.writeHead(200); res.end('ok'); return; }

  if (url.pathname === '/rooms') {
    const list = [...rooms.values()]
      .filter((r) => r.config.privacy === 'public' && r.players.size > 0)
      .sort((a, b) => (a.screen === b.screen ? b.createdAt - a.createdAt : a.screen === 'waiting' ? -1 : 1))
      .map(publicRoomSummary);
    res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
    res.end(JSON.stringify(list));
    return;
  }

  if (url.pathname === '/reports') {
    const key = url.searchParams.get('key');
    if (!process.env.REPORTS_KEY || key !== process.env.REPORTS_KEY) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(reports));
    return;
  }

  if (url.pathname.startsWith('/admin/')) {
    handleAdminRequest(req, res, url, rooms).catch((err) => {
      console.error('Admin request failed:', err);
      if (!res.headersSent) { res.writeHead(500, { 'access-control-allow-origin': '*' }); res.end(); }
    });
    return;
  }

  res.writeHead(404); res.end();
});

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws: WebSocket) => {
  let room: Room | null = null;
  let playerId: string | null = null;

  ws.on('message', async (raw) => {
    let msg: ClientMessage;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (!msg || typeof msg !== 'object' || typeof (msg as { type?: unknown }).type !== 'string') return;

    try {
      await handleMessage(msg);
    } catch (err) {
      // A malformed-but-JSON-parseable message (wrong types, missing
      // fields — nothing here is runtime-validated against ClientMessage,
      // that type is compile-time only) must never take the whole process
      // down with it: this handler is async, so an uncaught throw here
      // becomes an unhandled promise rejection, which by default kills the
      // Node process — every room, every connected player, gone. Logging
      // and dropping the one bad message is the correct failure mode.
      console.error('Failed to handle client message:', err);
    }
  });

  async function handleMessage(msg: ClientMessage) {
    if (msg.type === 'create_room') {
      if (!isNonEmptyString(msg.name)) return;
      // Circuit breaker, not a real rate limiter — a room that never starts
      // a match self-cleans within LOBBY_RECONNECT_GRACE_MS of its creator
      // disconnecting, so a burst of spam is naturally transient. This just
      // stops it from growing unbounded if that grace period is ever
      // outpaced by the spam rate.
      if (rooms.size >= 3000) { send(ws, { type: 'error', message: 'Servidor ocupado, tente novamente em instantes.' }); return; }
      // Verified once per join, not on every message — a valid token here
      // just resolves to the real account id, attached to this player for
      // the room's lifetime (stats attribution only, never sent back to
      // any client). An unset/invalid token degrades to null: the room
      // and match play out identically, that player just isn't tracked.
      const userId = await verifyUserToken(msg.token);
      const config = sanitizeConfig(msg.config);
      const code = newRoomCode((c) => rooms.has(c));
      const newRoom = new Room(code, config, () => rooms.delete(code), recordReport);
      rooms.set(code, newRoom);
      playerId = newPlayerId();
      const player = newRoom.addPlayer(playerId, msg.name, ws, userId, msg.avatarId ?? null, msg.titleId ?? null);
      room = newRoom;
      send(ws, { type: 'joined', code, playerId: player.id });
      room.broadcast();
      return;
    }

    if (msg.type === 'join_room') {
      if (!isNonEmptyString(msg.code) || !isNonEmptyString(msg.name)) return;
      const target = rooms.get(msg.code.toUpperCase());
      if (!target) { send(ws, { type: 'error', message: 'Sala não encontrada.' }); return; }
      const userId = await verifyUserToken(msg.token);
      // Rooms stay open for the whole match — joining mid-round just drops
      // the newcomer in with 0 points and a chat announcement, no gate here.
      playerId = newPlayerId();
      target.addPlayer(playerId, msg.name, ws, userId, msg.avatarId ?? null, msg.titleId ?? null);
      room = target;
      send(ws, { type: 'joined', code: target.code, playerId });
      room.broadcast();
      return;
    }

    if (msg.type === 'rejoin') {
      if (!isNonEmptyString(msg.code) || !isNonEmptyString(msg.playerId)) return;
      const target = rooms.get(msg.code.toUpperCase());
      if (!target || !target.reconnect(msg.playerId, ws)) { send(ws, { type: 'error', message: 'Não foi possível reconectar.' }); return; }
      playerId = msg.playerId;
      room = target;
      send(ws, { type: 'joined', code: target.code, playerId });
      room.broadcast();
      return;
    }

    if (msg.type === 'leave_room') {
      // Nulling these out (instead of leaving them for the disconnect()
      // guard to no-op on) also stops any message that slips in between
      // this and the socket actually closing from acting on a playerId the
      // room has already fully removed.
      if (room && playerId) room.leave(playerId);
      room = null;
      playerId = null;
      return;
    }

    if (!room || !playerId) return;

    switch (msg.type) {
      case 'update_config': room.updateConfig(playerId, sanitizeConfig({ ...room.config, ...msg.config })); room.broadcast(); break;
      case 'start_match': room.startMatch(playerId); break;
      case 'pick_color': room.pickColor(playerId, msg.hsl); break;
      case 'confirm_color': room.confirmColor(playerId); break;
      case 'submit_phrase': room.submitPhrase(playerId, msg.text); break;
      case 'send_chat': room.sendChat(playerId, msg.text); break;
      case 'ready_next': room.readyNext(playerId); break;
      case 'restart_match': room.restartMatch(playerId); break;
      case 'report_question': room.reportQuestion(playerId); break;
    }
  }

  ws.on('close', () => {
    if (room && playerId) room.disconnect(playerId);
  });
});

startStaleSessionSweep();
startQuestionOverridesPoll();

// Last line of defense: every message-handling path above already has its
// own try/catch, but a stray unhandled rejection anywhere else (a .then()
// missing its own .catch, a future oversight) would otherwise take the
// entire process — every room, every connected player — down with it by
// Node's default behavior. Logging and staying up matches how every other
// failure in this codebase is already treated (best-effort, never fatal).
process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));
process.on('uncaughtException', (err) => console.error('Uncaught exception:', err));

httpServer.listen(PORT, () => {
  console.log(`color.io server listening on :${PORT}`);
});
