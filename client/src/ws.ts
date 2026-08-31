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
const RECONNECT_DELAY_MS = 1200;

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
  // A tab going to the background (phone lock screen, switching apps to
  // check a message) commonly drops the socket on mobile browsers. None of
  // that is the player choosing to leave, so it should reconnect on its own
  // — inRoomRef/intentionalCloseRef tell onclose whether to bother.
  const inRoomRef = useRef(false);
  const intentionalCloseRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectFnRef = useRef<() => void>(() => {});

  const openSocket = useCallback((onOpen: (ws: WebSocket) => void, opts?: { silent?: boolean }) => {
    if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
    setConnecting(!opts?.silent);
    setError(null);
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onopen = () => {
      onOpen(ws);
      if (pendingRef.current) { ws.send(JSON.stringify(pendingRef.current)); pendingRef.current = null; }
    };
    ws.onmessage = (ev) => {
      const msg: ServerMessage = JSON.parse(ev.data);
      if (msg.type === 'joined') {
        setPlayerId(msg.playerId);
        saveSession({ code: msg.code, playerId: msg.playerId });
        inRoomRef.current = true;
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
          inRoomRef.current = false;
          ws.close();
        } else {
          setError(msg.message);
        }
        setConnecting(false);
      }
    };
    ws.onclose = () => {
      if (wsRef.current === ws) wsRef.current = null;
      if (!intentionalCloseRef.current && inRoomRef.current) {
        reconnectTimerRef.current = setTimeout(() => reconnectFnRef.current(), RECONNECT_DELAY_MS);
      }
    };
    ws.onerror = () => {
      if (!opts?.silent) setError('Não foi possível conectar ao servidor.');
      setConnecting(false);
    };
  }, []);

  const attemptReconnect = useCallback(() => {
    const saved = loadSession();
    if (!saved) { inRoomRef.current = false; return; }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;
    openSocket((ws) => {
      ws.send(JSON.stringify({ type: 'rejoin', code: saved.code, playerId: saved.playerId } satisfies ClientMessage));
    }, { silent: true });
  }, [openSocket]);
  reconnectFnRef.current = attemptReconnect;

  useEffect(() => {
    attemptReconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Belt-and-suspenders for the same scenario: don't wait on a possibly
  // delayed/missed onclose — the moment the tab is foregrounded again,
  // check the socket ourselves and reconnect immediately if it's not open.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (!inRoomRef.current) return;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;
      attemptReconnect();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onVisible);
    window.addEventListener('online', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onVisible);
      window.removeEventListener('online', onVisible);
    };
  }, [attemptReconnect]);

  const createRoom = useCallback((name: string, config: RoomConfig) => {
    intentionalCloseRef.current = false;
    openSocket((ws) => {
      ws.send(JSON.stringify({ type: 'create_room', name, config } satisfies ClientMessage));
    });
  }, [openSocket]);

  const joinRoom = useCallback((code: string, name: string) => {
    intentionalCloseRef.current = false;
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
    intentionalCloseRef.current = true;
    inRoomRef.current = false;
    if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
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
