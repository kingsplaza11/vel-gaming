// src/games/fortune/FortuneDragon.jsx
import React, { useCallback, useMemo, useRef, useState } from "react";
import "./fortune.css";
import { useFortuneWS } from "./useFortuneWS";
import { createSound } from "./sound";

export default function FortuneDragon({ startPayload }) {
  const [state, setState] = useState({
    status: "active",
    step_index: 0,
    current_multiplier: "1.00",
    payout_amount: "0.00",
    server_seed_hash: startPayload.server_seed_hash,
  });

  const tapLock = useRef(false);

  const sounds = useMemo(() => ({
    orb: createSound("/static/sfx/orb.mp3"),
    roar: createSound("/static/sfx/dragon.mp3"),
    win: createSound("/static/sfx/win.mp3"),
  }), []);

  const onEvent = useCallback((msg) => {
    if (msg.type === "step_result") {
      tapLock.current = false;

      if (msg.result === "safe") {
        sounds.orb.play();
        setState((s) => ({
          ...s,
          step_index: msg.step_index,
          current_multiplier: msg.current_multiplier,
        }));
      } else {
        sounds.roar.play();
        setState((s) => ({
          ...s,
          status: "lost",
          revealed_server_seed: msg.revealed_server_seed,
        }));
      }
    }

    if (msg.type === "cashout_result") {
      sounds.win.play();
      setState((s) => ({
        ...s,
        status: "cashed_out",
        payout_amount: msg.payout_amount,
        revealed_server_seed: msg.revealed_server_seed,
      }));
    }
  }, [sounds]);

  const { connected, send } = useFortuneWS({
    wsToken: startPayload.ws_token,
    onEvent,
  });

  const collectOrb = () => {
    if (!connected || tapLock.current || state.status !== "active") return;
    tapLock.current = true;

    send({
      type: "step",
      msg_id: crypto.randomUUID(),
      client_ts_ms: Date.now(),
      action: "collect_orb",
      choice: "orb",
    });
  };

  const cashout = () => {
    send({
      type: "cashout",
      msg_id: crypto.randomUUID(),
      client_ts_ms: Date.now(),
    });
  };

  return (
    <div className="fortune-stage dragon">
      <div className="fortune-header">
        <h2>🐉 Fortune Dragon</h2>
        <button onClick={cashout} disabled={!connected || state.step_index <= 0}>
          Cash Out
        </button>
      </div>

      <div className="dragon-scene" />

      <div className="fortune-hud">
        <div>Multiplier: {state.current_multiplier}x</div>
        <div>Orbs: {state.step_index}</div>
      </div>

      <button className="dragon-orb-btn" onClick={collectOrb}>
        Collect Orb
      </button>
    </div>
  );
}
