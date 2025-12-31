import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/*
============================================================
 Fortune WebSocket Hook (FINAL, STABLE)
------------------------------------------------------------
 ✔ Requires a valid wsToken
 ✔ Auto-reconnect with backoff
 ✔ Safe cleanup on unmount
 ✔ Works on localhost + production
 ✔ Explicit logging for debugging
============================================================
*/

/* ------------------ URL HELPERS ------------------ */

function normalizeWsBase(input) {
  if (!input) return null;

  let s = String(input).trim();

  // If missing scheme (localhost:8001)
  if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(s)) {
    s = `ws://${s}`;
  }

  // Convert http → ws
  if (s.startsWith("http://")) s = s.replace("http://", "ws://");
  if (s.startsWith("https://")) s = s.replace("https://", "wss://");

  // Remove trailing slash
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
  // 1️⃣ Explicit WS URL
  const explicit = normalizeWsBase(process.env.REACT_APP_WS_URL);
  if (explicit) return explicit;

  // 2️⃣ Derive from API URL
  const api = process.env.REACT_APP_API_URL || "http://veltoragames.com/api/";
  try {
    const u = new URL(api);
    const proto = u.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${u.host}`;
  } catch {
    return "ws://veltoragames.com";
  }
}

/* ============================================================
   MAIN HOOK
============================================================ */

export function useFortuneWS({ wsToken, onEvent }) {
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const aliveRef = useRef(true);
  const joinSentRef = useRef(false);
  const reconnectAttemptRef = useRef(0);

  const [connected, setConnected] = useState(false);
  const [lastError, setLastError] = useState(null);

  const wsBase = useMemo(() => deriveWsBase(), []);
  const wsUrl = useMemo(() => `${wsBase}/ws/fortune/`, [wsBase]);

  /* ------------------ CLEANUP HELPERS ------------------ */

  const clearTimers = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
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

  /* ------------------ SEND SAFE ------------------ */

  const send = useCallback((payload) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn("[FortuneWS] Send failed: socket not open");
      return false;
    }
    ws.send(JSON.stringify(payload));
    return true;
  }, []);

  /* ------------------ CONNECT ------------------ */

  const connect = useCallback(() => {
    if (!wsToken) {
      console.warn("[FortuneWS] wsToken missing, abort connect");
      return;
    }
    if (!aliveRef.current) return;

    clearTimers();
    closeSocket();

    let ws;
    try {
      ws = new WebSocket(wsUrl);
    } catch (e) {
      console.error("[FortuneWS] Invalid WS URL", wsUrl);
      setLastError("Invalid WebSocket URL");
      setConnected(false);
      return;
    }

    wsRef.current = ws;

    console.info("[FortuneWS] Connecting →", wsUrl);

    ws.onopen = () => {
      reconnectAttemptRef.current = 0;
      setConnected(true);
      setLastError(null);

      console.info("[FortuneWS] Connected");

      if (!joinSentRef.current) {
        joinSentRef.current = true;
        ws.send(
          JSON.stringify({
            type: "join",
            ws_token: wsToken,
          })
        );
        console.info("[FortuneWS] Join sent");
      }
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        onEvent?.(msg);
      } catch (err) {
        console.warn("[FortuneWS] Invalid message", ev.data);
      }
    };

    ws.onerror = (err) => {
      console.error("[FortuneWS] Socket error", err);
      setLastError("WebSocket error");
    };

    ws.onclose = (ev) => {
      console.warn(
        `[FortuneWS] Closed (${ev.code}) ${ev.reason || ""}`
      );
      setConnected(false);

      if (!aliveRef.current) return;

      reconnectAttemptRef.current += 1;
      const attempt = reconnectAttemptRef.current;

      const delay = Math.min(3000, 500 + attempt * 400);

      reconnectTimerRef.current = setTimeout(() => {
        connect();
      }, delay);
    };
  }, [wsToken, wsUrl, clearTimers, closeSocket, onEvent]);

  /* ------------------ EFFECT ------------------ */

  useEffect(() => {
    aliveRef.current = true;

    if (!wsToken) {
      closeSocket();
      clearTimers();
      setConnected(false);
      setLastError(null);
      return;
    }

    connect();

    const onVisibility = () => {
      if (document.visibilityState === "visible" && wsToken) {
        console.info("[FortuneWS] Visibility restore → reconnect");
        connect();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      aliveRef.current = false;
      document.removeEventListener("visibilitychange", onVisibility);
      clearTimers();
      closeSocket();
      setConnected(false);
    };
  }, [wsToken, connect, clearTimers, closeSocket]);

  /* ------------------ EXPORT ------------------ */

  return {
    connected,
    lastError,
    send,
    wsUrl,
    wsBase,
  };
}
