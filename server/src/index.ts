import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { newPlayerId, newRoomCode } from './id.ts';
import { Room } from './room.ts';
import { LOBBY_THEMES, MIN_PLAYERS, MAX_PLAYERS, MIN_ROUNDS, MAX_ROUNDS } from '../../shared/gameData.ts';
import type { ClientMessage, RoomConfig, ServerMessage } from '../../shared/types.ts';

const PORT = Number(process.env.PORT) || 8787;
const rooms = new Map<string, Room>();

function sanitizeConfig(input: Partial<RoomConfig> | undefined): RoomConfig {
  const validThemeIds = new Set(LOBBY_THEMES.map((t) => t.id));
  const selectedThemes = (input?.selectedThemes ?? LOBBY_THEMES.map((t) => t.id)).filter((id) => validThemeIds.has(id));
  return {
    numPlayers: clamp(input?.numPlayers ?? 5, MIN_PLAYERS, MAX_PLAYERS),
    numRounds: clamp(input?.numRounds ?? 5, MIN_ROUNDS, MAX_ROUNDS),
    phraseMode: input?.phraseMode === 'ai' ? 'ai' : 'players',
    privacy: input?.privacy === 'private' ? 'private' : 'public',
    selectedThemes: selectedThemes.length ? selectedThemes : LOBBY_THEMES.map((t) => t.id),
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(Number(v) || min)));
}

function send(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

const httpServer = createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(200); res.end('ok'); return; }
  res.writeHead(404); res.end();
});

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws: WebSocket) => {
  let room: Room | null = null;
  let playerId: string | null = null;

  ws.on('message', (raw) => {
    let msg: ClientMessage;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === 'create_room') {
      const config = sanitizeConfig(msg.config);
      const code = newRoomCode((c) => rooms.has(c));
      const newRoom = new Room(code, config, () => rooms.delete(code));
      rooms.set(code, newRoom);
      playerId = newPlayerId();
      const player = newRoom.addPlayer(playerId, msg.name, ws);
      room = newRoom;
      send(ws, { type: 'joined', code, playerId: player.id });
      room.broadcast();
      return;
    }

    if (msg.type === 'join_room') {
      const target = rooms.get(msg.code.toUpperCase());
      if (!target) { send(ws, { type: 'error', message: 'Sala não encontrada.' }); return; }
      if (target.screen !== 'waiting') { send(ws, { type: 'error', message: 'A partida já começou.' }); return; }
      playerId = newPlayerId();
      target.addPlayer(playerId, msg.name, ws);
      room = target;
      send(ws, { type: 'joined', code: target.code, playerId });
      room.broadcast();
      return;
    }

    if (msg.type === 'rejoin') {
      const target = rooms.get(msg.code.toUpperCase());
      if (!target || !target.reconnect(msg.playerId, ws)) { send(ws, { type: 'error', message: 'Não foi possível reconectar.' }); return; }
      playerId = msg.playerId;
      room = target;
      send(ws, { type: 'joined', code: target.code, playerId });
      room.broadcast();
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
    }
  });

  ws.on('close', () => {
    if (room && playerId) room.disconnect(playerId);
  });
});

httpServer.listen(PORT, () => {
  console.log(`color.io server listening on :${PORT}`);
});
