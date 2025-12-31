import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------ URL HELPERS ------------------ */

function deriveWsBase() {
  // 1️⃣ Explicit WS URL
  const explicit = process.env.REACT_APP_WS_URL;
  if (explicit) {
    // Ensure it has a protocol
    let url = explicit.trim();
    if (!url.startsWith('ws://') && !url.startsWith('wss://') && !url.startsWith('http://') && !url.startsWith('https://')) {
      url = `ws://${url}`;
    }
    // Convert http/https to ws/wss
    url = url.replace(/^http/, 'ws');
    // Remove trailing slash
    return url.replace(/\/+$/, '');
  }
  
  // 2️⃣ Derive from API URL or default
  const api = process.env.REACT_APP_API_URL || "https://veltoragames.com/api/";
  try {
    const url = new URL(api);
    const protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${url.host}`;
  } catch {
    // Default to localhost with ws protocol
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

  const [connected, setConnected] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [lastError, setLastError] = useState(null);

  const wsBase = useMemo(() => deriveWsBase(), []);
  const wsUrl = useMemo(() => `${wsBase}/ws/fortune/`, [wsBase]);

  /* ------------------ CONNECTION MANAGEMENT ------------------ */

  const closeSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close(1000, "Normal closure");
      }
      wsRef.current = null;
    }
    setConnected(false);
    setAuthenticated(false);
  }, []);

  const send = useCallback((payload) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn("[FortuneWS] Cannot send: WebSocket not open");
      return false;
    }
    
    // For non-ping messages, require authentication
    if (payload.type !== "ping" && !authenticated) {
      console.warn("[FortuneWS] Cannot send: not authenticated");
      return false;
    }
    
    try {
      ws.send(JSON.stringify(payload));
      return true;
    } catch (err) {
      console.error("[FortuneWS] Send error:", err);
      return false;
    }
  }, [authenticated]);

  const connect = useCallback(() => {
    if (!wsToken || !aliveRef.current) {
      console.log("[FortuneWS] No wsToken or not alive, skipping connect");
      return;
    }

    // Clear any existing connection
    closeSocket();

    console.log("[FortuneWS] Connecting to:", wsUrl);
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[FortuneWS] Connected successfully");
        setConnected(true);
        setLastError(null);
        
        // Send join message immediately after connection
        if (wsToken) {
          console.log("[FortuneWS] Sending join message with token");
          ws.send(JSON.stringify({
            type: "join",
            ws_token: wsToken,
          }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log("[FortuneWS] Received message type:", message.type, message);
          
          // Handle authentication
          if (message.type === "joined") {
            setAuthenticated(true);
            console.log("[FortuneWS] Authenticated successfully");
          }
          
          if (message.type === "connected") {
            console.log("[FortuneWS] WebSocket connection established");
          }
          
          if (message.type === "error") {
            console.error("[FortuneWS] Server error:", message);
            setLastError(message.message || message.code || "Unknown error");
            
            // If auth error, don't try to reconnect
            if (message.code === "auth_failed" || message.code === "session_not_found") {
              closeSocket();
            }
          }
          
          // Pass to parent handler
          if (onEvent) {
            onEvent(message);
          }
        } catch (err) {
          console.warn("[FortuneWS] Failed to parse message:", err, event.data);
        }
      };

      ws.onerror = (error) => {
        console.error("[FortuneWS] WebSocket error event:", error);
        setLastError("Connection error");
      };

      ws.onclose = (event) => {
        console.log(`[FortuneWS] Connection closed (${event.code}): ${event.reason || 'No reason provided'}`);
        setConnected(false);
        setAuthenticated(false);
        
        // Reconnect logic (only for unexpected closures)
        if (aliveRef.current && wsToken && event.code !== 1000 && event.code !== 4001 && event.code !== 4002) {
          const delay = 2000; // 2 seconds
          reconnectTimerRef.current = setTimeout(() => {
            console.log("[FortuneWS] Attempting to reconnect...");
            connect();
          }, delay);
        }
      };
    } catch (error) {
      console.error("[FortuneWS] Failed to create WebSocket:", error);
      setLastError(`Failed to create connection: ${error.message}`);
    }
  }, [wsToken, wsUrl, closeSocket, onEvent]);

  /* ------------------ EFFECTS ------------------ */

  useEffect(() => {
    aliveRef.current = true;
    
    console.log("[FortuneWS] Effect triggered, wsToken:", wsToken ? "present" : "missing");
    
    if (wsToken) {
      connect();
    } else {
      closeSocket();
    }

    // Cleanup
    return () => {
      console.log("[FortuneWS] Cleanup triggered");
      aliveRef.current = false;
      closeSocket();
      
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [wsToken, connect, closeSocket]);

  /* ------------------ PING INTERVAL ------------------ */

  useEffect(() => {
    if (!connected || !authenticated) return;
    
    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ping" }));
      }
    }, 30000); // Every 30 seconds
    
    return () => clearInterval(interval);
  }, [connected, authenticated]);

  /* ------------------ RETURN ------------------ */

  return {
    connected,
    authenticated,
    lastError,
    send,
    wsUrl,
  };
}