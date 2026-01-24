// src/games/fortune/LightningVault.jsx
import React, { useCallback, useMemo, useState } from "react";
import "./fortune.css";
import { useFortuneWS } from "./useFortuneWS";
import { createSound } from "./sound";

export default function LightningVault({ startPayload }) {
  const [state, setState] = useState({
    status: "active",
    current_multiplier: "1.00",
    payout_amount: "0.00",
  });

  const sounds = useMemo(() => ({
    hum: createSound("/static/sfx/electric.mp3"),
    boom: createSound("/static/sfx/explode.mp3"),
    win: createSound("/static/sfx/win.mp3"),
  }), []);

  const onEvent = useCallback((msg) => {
    if (msg.type === "step_result") {
      if (msg.result === "safe") {
        sounds.hum.play();
        setState((s) => ({
          ...s,
          current_multiplier: msg.current_multiplier,
        }));
      } else {
        sounds.boom.play();
        setState((s) => ({
          ...s,
          status: "lost",
        }));
      }
    }

    if (msg.type === "cashout_result") {
      sounds.win.play();
      setState((s) => ({
        ...s,
        status: "cashed_out",
        payout_amount: msg.payout_amount,
      }));
    }
  }, [sounds]);

  const { connected, send } = useFortuneWS({
    wsToken: startPayload.ws_token,
    onEvent,
  });

  const cashout = () => {
    send({
      type: "cashout",
      msg_id: crypto.randomUUID(),
      client_ts_ms: Date.now(),
    });
  };

  return (
    <div className="fortune-stage lightning">
      <h2>⚡ Lightning Vault</h2>

      <div className="vault-meter">
        <div
          className="energy"
          style={{ width: `${Math.min(100, Number(state.current_multiplier) * 10)}%` }}
        />
      </div>

      <div className="vault-multiplier">
        {state.current_multiplier}x
      </div>

      <button onClick={cashout} disabled={!connected}>
        Secure Payout
      </button>
    </div>
  );
}
