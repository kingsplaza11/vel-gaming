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
  const [connectionStatus, setConnectionStatus] = useState("disconnected");

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const markOnline = useCallback(() => {
    if (offlineTimerRef.current) {
      clearTimeout(offlineTimerRef.current);
      offlineTimerRef.current = null;
    }
    setConnected(true);
    setConnectionStatus("connected");
  }, []);

  const markOfflineDelayed = useCallback(() => {
    if (offlineTimerRef.current) return;

    offlineTimerRef.current = setTimeout(() => {
      setConnected(false);
      setEngineAlive(false);
      setConnectionStatus("disconnected");
      offlineTimerRef.current = null;
    }, 5000); // 👈 5s debounce
  }, []);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const WS_HOST = process.env.REACT_APP_WS_URL || window.location.host;
    const url = `${protocol}://${WS_HOST}/ws/crash/${mode}/`;

    console.log("[CRASH WS] Attempting to connect to:", url);
    setConnectionStatus("connecting");

    try {
      if (wsRef.current) {
        console.log("[CRASH WS] Closing existing connection");
        wsRef.current.close();
      }
    } catch (_) {}

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[CRASH WS] ✅ Connection established");
      markOnline();
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        console.log("[CRASH WS] 📨 Received message:", payload);

        // 🔑 Any engine event means backend is alive
        if (payload?.event) {
          if (payload.event.startsWith("round_")) {
            setEngineAlive(true);
          }
          markOnline();
        }

        onMessageRef.current?.(payload);
      } catch (e) {
        console.error("[CRASH WS] ❌ Failed to parse payload:", e, "Raw:", event.data);
      }
    };

    ws.onerror = (error) => {
      console.error("[CRASH WS] ❌ WebSocket error:", error);
      setConnectionStatus("error");
      markOfflineDelayed();
    };

    ws.onclose = (event) => {
      console.log(`[CRASH WS] 🔌 Connection closed. Code: ${event.code}, Reason: ${event.reason}`);
      setConnectionStatus("closed");
      markOfflineDelayed();

      if (!reconnectTimerRef.current) {
        console.log("[CRASH WS] 🔄 Attempting reconnect in 1.5s");
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
      console.log("[CRASH WS] 🧹 Cleaning up WebSocket");
      if (offlineTimerRef.current) {
        clearTimeout(offlineTimerRef.current);
        offlineTimerRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      try {
        if (wsRef.current) {
          wsRef.current.close();
          console.log("[CRASH WS] Closed WebSocket connection");
        }
      } catch (_) {}
      wsRef.current = null;
    };
  }, [connect]);

  const send = useCallback((payload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        const payloadStr = JSON.stringify(payload);
        console.log("[CRASH WS] 📤 Sending message:", payloadStr);
        wsRef.current.send(payloadStr);
        return true;
      } catch (e) {
        console.error("[CRASH WS] ❌ Failed to send message:", e);
        return false;
      }
    } else {
      console.warn(`[CRASH WS] ⚠️ Not connected. Ready state: ${wsRef.current?.readyState}`);
      console.log(`[CRASH WS] Connection status: ${connectionStatus}`);
      return false;
    }
  }, [connectionStatus]);

  return {
    connected,      // transport + debounce
    engineAlive,    // true only if engine broadcasts
    send,
    connectionStatus, // For debugging
  };
}