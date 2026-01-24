import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Stable Crash WebSocket Hook
 * - No LIVE/OFFLINE flicker
 * - Debounced disconnect
 * - Engine-driven connection state
 */
export function useCrashWebSocket(mode = "real", onMessage) {
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const offlineTimerRef = useRef(null);
  const onMessageRef = useRef(onMessage);

  const [connected, setConnected] = useState(false);
  const [engineAlive, setEngineAlive] = useState(false);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const markOnline = useCallback(() => {
    if (offlineTimerRef.current) {
      clearTimeout(offlineTimerRef.current);
      offlineTimerRef.current = null;
    }
    setConnected(true);
  }, []);

  const markOfflineDelayed = useCallback(() => {
    if (offlineTimerRef.current) return;

    offlineTimerRef.current = setTimeout(() => {
      setConnected(false);
      setEngineAlive(false);
      offlineTimerRef.current = null;
    }, 5000); // 👈 5s debounce
  }, []);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const WS_HOST = process.env.REACT_APP_WS_URL || "veltoragames.com";
    const url = `${protocol}://${WS_HOST}/ws/crash/${mode}/`;

    try {
      wsRef.current?.close();
    } catch (_) {}

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      markOnline();
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);

        // 🔑 Any engine event means backend is alive
        if (
          payload?.event &&
          payload.event.startsWith("round_")
        ) {
          setEngineAlive(true);
          markOnline();
        }

        onMessageRef.current?.(payload);
      } catch (e) {
        console.error("[CRASH WS] bad payload", e);
      }
    };

    ws.onerror = () => {
      markOfflineDelayed();
    };

    ws.onclose = () => {
      markOfflineDelayed();

      if (!reconnectTimerRef.current) {
        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null;
          connect();
        }, 1500);
      }
    };
  }, [mode, markOnline, markOfflineDelayed]);

  useEffect(() => {
    connect();
    return () => {
      if (offlineTimerRef.current) {
        clearTimeout(offlineTimerRef.current);
        offlineTimerRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      try {
        wsRef.current?.close();
      } catch (_) {}
      wsRef.current = null;
    };
  }, [connect]);

  const send = useCallback((payload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  return {
    connected,      // transport + debounce
    engineAlive,    // true only if engine broadcasts
    send,
  };
}
