// src/games/fortune/useArcadeWS.js
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Arcade WS
 * - Shares same WS base resolution as Fortune
 * - Connects to /ws/fortune-arcade/
 */

function normalizeWsBase(input) {
  if (!input) return null;

  let s = String(input).trim();

  if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(s)) {
    s = `ws://${s}`;
  }

  if (s.startsWith("http://")) s = s.replace("http://", "ws://");
  if (s.startsWith("https://")) s = s.replace("https://", "wss://");

  s = s.replace(/\/+$/, "");

  try {
    const u = new URL(s);
    if (u.protocol !== "ws:" && u.protocol !== "wss:") return null;
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

function deriveWsBase() {
  const explicit = normalizeWsBase(process.env.REACT_APP_WS_URL);
  if (explicit) return explicit;

  const api = process.env.REACT_APP_API_URL || "http://localhost:8001/api/";
  try {
    const u = new URL(api);
    const proto = u.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${u.host}`;
  } catch {
    return "ws://localhost:8001";
  }
}

export function useArcadeWS({ wsToken, onEvent }) {
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const aliveRef = useRef(true);
  const joinSentRef = useRef(false);
  const reconnectAttemptRef = useRef(0);

  const [connected, setConnected] = useState(false);
  const [lastError, setLastError] = useState(null);

  const disconnectGraceRef = useRef(null);

  const wsBase = useMemo(() => deriveWsBase(), []);
  const wsUrl = useMemo(() => `${wsBase}/ws/fortune-arcade/`, [wsBase]);

  const clearTimers = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (disconnectGraceRef.current) {
      clearTimeout(disconnectGraceRef.current);
      disconnectGraceRef.current = null;
    }
  }, []);

  const safeSetDisconnected = useCallback(() => {
    if (disconnectGraceRef.current) clearTimeout(disconnectGraceRef.current);
    disconnectGraceRef.current = setTimeout(() => {
      setConnected(false);
    }, 250);
  }, []);

  const closeSocket = useCallback(() => {
    try {
      const ws = wsRef.current;
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        ws.close();
      }
    } catch (_) {}
    wsRef.current = null;
    joinSentRef.current = false;
  }, []);

  const send = useCallback((payload) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(payload));
    return true;
  }, []);

  const connect = useCallback(() => {
    if (!wsToken || !aliveRef.current) return;

    clearTimers();
    closeSocket();

    try {
      const u = new URL(wsUrl);
      if (u.protocol !== "ws:" && u.protocol !== "wss:") {
        setLastError("WebSocket URL invalid");
        safeSetDisconnected();
        return;
      }
    } catch {
      setLastError("WebSocket URL invalid");
      safeSetDisconnected();
      return;
    }

    let ws;
    try {
      ws = new WebSocket(wsUrl);
    } catch {
      setLastError("WebSocket URL invalid");
      safeSetDisconnected();
      return;
    }

    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptRef.current = 0;
      setLastError(null);
      setConnected(true);

      if (!joinSentRef.current) {
        joinSentRef.current = true;
        ws.send(JSON.stringify({ type: "join", ws_token: wsToken }));
      }
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        onEvent?.(msg);
      } catch (_) {}
    };

    ws.onerror = () => {
      setLastError("WebSocket error");
      safeSetDisconnected();
    };

    ws.onclose = () => {
      safeSetDisconnected();
      if (!aliveRef.current) return;

      reconnectAttemptRef.current += 1;
      const attempt = reconnectAttemptRef.current;
      const base = Math.min(2500, 600 + attempt * 250);
      const jitter = Math.floor(Math.random() * 400);

      reconnectTimerRef.current = setTimeout(connect, base + jitter);
    };
  }, [wsToken, wsUrl, onEvent, clearTimers, closeSocket, safeSetDisconnected]);

  useEffect(() => {
    aliveRef.current = true;

    if (!wsToken) {
      setConnected(false);
      setLastError(null);
      reconnectAttemptRef.current = 0;
      closeSocket();
      clearTimers();
      return () => {};
    }

    connect();

    const onVis = () => {
      if (document.visibilityState === "visible" && wsToken) connect();
    };

    document.addEventListener("visibilitychange", onVis);

    return () => {
      aliveRef.current = false;
      document.removeEventListener("visibilitychange", onVis);
      clearTimers();
      closeSocket();
      setConnected(false);
    };
  }, [wsToken, connect, clearTimers, closeSocket]);

  return { connected, lastError, send, wsUrl, wsBase };
}
