import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientMessage, RoomConfig, RoomStateView, ServerMessage } from '@shared/types';

const WS_URL = (import.meta.env.VITE_WS_URL as string | undefined)
  || `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;

// Same-origin derivation as WS_URL above, but for plain HTTP calls (the open
// rooms list). Used before any room WebSocket connection exists.
export const HTTP_BASE = (import.meta.env.VITE_WS_URL as string | undefined)
  ? (import.meta.env.VITE_WS_URL as string).replace(/^ws/, 'http').replace(/\/ws\/?$/, '')
  : `${location.protocol}//${location.host}`;

const SESSION_KEY = 'colorio.session';

interface StoredSession {
  code: string;
  playerId: string;
}

function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function saveSession(s: StoredSession | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch { /* ignore */ }
}

export interface RoomConnection {
  state: RoomStateView | null;
  error: string | null;
  connecting: boolean;
  playerId: string | null;
  createRoom: (name: string, config: RoomConfig) => void;
  joinRoom: (code: string, name: string) => void;
  send: (msg: ClientMessage) => void;
  leaveRoom: () => void;
  clearError: () => void;
}

export function useRoomConnection(): RoomConnection {
  const [state, setState] = useState<RoomStateView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pendingRef = useRef<ClientMessage | null>(null);

  const openSocket = useCallback((onOpen: (ws: WebSocket) => void, opts?: { silent?: boolean }) => {
    setConnecting(!opts?.silent);
    setError(null);
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onopen = () => onOpen(ws);
    ws.onmessage = (ev) => {
      const msg: ServerMessage = JSON.parse(ev.data);
      if (msg.type === 'joined') {
        setPlayerId(msg.playerId);
        saveSession({ code: msg.code, playerId: msg.playerId });
        setConnecting(false);
      } else if (msg.type === 'state') {
        setState(msg.state);
        setConnecting(false);
      } else if (msg.type === 'error') {
        if (opts?.silent) {
          // A stale saved session (old room, restarted server, etc.) failing
          // to auto-rejoin isn't something the player did — clear it quietly
          // instead of greeting them with an error before they've done anything.
          saveSession(null);
          ws.close();
        } else {
          setError(msg.message);
        }
        setConnecting(false);
      }
    };
    ws.onclose = () => {
      if (wsRef.current === ws) wsRef.current = null;
    };
    ws.onerror = () => {
      if (!opts?.silent) setError('Não foi possível conectar ao servidor.');
      setConnecting(false);
    };
  }, []);

  useEffect(() => {
    const saved = loadSession();
    if (!saved) return;
    openSocket((ws) => {
      ws.send(JSON.stringify({ type: 'rejoin', code: saved.code, playerId: saved.playerId } satisfies ClientMessage));
    }, { silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createRoom = useCallback((name: string, config: RoomConfig) => {
    openSocket((ws) => {
      ws.send(JSON.stringify({ type: 'create_room', name, config } satisfies ClientMessage));
    });
  }, [openSocket]);

  const joinRoom = useCallback((code: string, name: string) => {
    openSocket((ws) => {
      ws.send(JSON.stringify({ type: 'join_room', code: code.toUpperCase(), name } satisfies ClientMessage));
    });
  }, [openSocket]);

  const send = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) { pendingRef.current = msg; return; }
    ws.send(JSON.stringify(msg));
  }, []);

  const leaveRoom = useCallback(() => {
    saveSession(null);
    wsRef.current?.close();
    wsRef.current = null;
    setState(null);
    setPlayerId(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { state, error, connecting, playerId, createRoom, joinRoom, send, leaveRoom, clearError };
}
