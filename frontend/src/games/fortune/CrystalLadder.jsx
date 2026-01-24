// src/games/fortune/CrystalLadder.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./fortune.css";

/**
 * ✅ SAFE ARCADE VERSION
 * - Setup modal: difficulty
 * - Tap "Climb" to progress steps
 * - Random shatter ends run
 * - Bank points anytime
 */

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function formatInt(n) {
  try {
    return Number(n || 0).toLocaleString("en-NG");
  } catch {
    return String(n || 0);
  }
}

function readArcadePoints() {
  const v = localStorage.getItem("arcade_points");
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

function writeArcadePoints(n) {
  localStorage.setItem("arcade_points", String(Math.max(0, Math.floor(n))));
}

function SetupModal({
  open,
  title,
  badge,
  points,
  difficulty,
  setDifficulty,
  onStart,
  onExit,
  starting,
  hint,
}) {
  if (!open) return null;

  const diffs = [
    { id: "chill", name: "Chill", desc: "More stable steps • steady climb", tag: "LOW" },
    { id: "classic", name: "Classic", desc: "Balanced stability • good growth", tag: "MID" },
    { id: "wild", name: "Wild", desc: "Fragile ladder • huge jumps", tag: "HIGH" },
  ];

  return (
    <div className="fortune-stake-backdrop" onClick={onExit}>
      <div className="fortune-stake-modal" onClick={(e) => e.stopPropagation()}>
        <div className="stake-top">
          <div className="stake-badge">{badge}</div>
          <div className="stake-title">
            <div className="t1">{title}</div>
            <div className="t2">{hint}</div>
          </div>
        </div>

        <div className="stake-balance">
          <span className="label">Arcade Points</span>
          <span className="value">{formatInt(points)}</span>
        </div>

        <div className="fortune-setup-grid">
          {diffs.map((d) => (
            <button
              key={d.id}
              type="button"
              className={`fortune-setup-card ${difficulty === d.id ? "active" : ""}`}
              onClick={() => setDifficulty(d.id)}
              disabled={starting}
            >
              <div className="fortune-setup-top">
                <div className="fortune-setup-name">{d.name}</div>
                <div className={`fortune-setup-tag ${d.tag.toLowerCase()}`}>{d.tag}</div>
              </div>
              <div className="fortune-setup-desc">{d.desc}</div>
            </button>
          ))}
        </div>

        <div className="stake-actions">
          <button className="stake-btn ghost" onClick={onExit} disabled={starting}>
            Exit
          </button>
          <button className="stake-btn gold" onClick={onStart} disabled={starting}>
            {starting ? "Warping…" : "Start Run"}
          </button>
        </div>

        <div className="stake-footnote">
          <span className="spark"></span>
          Earn points only — no wagering.
        </div>
      </div>
    </div>
  );
}

export default function CrystalLadder() {
  const navigate = useNavigate();

  const [setupOpen, setSetupOpen] = useState(true);
  const [starting, setStarting] = useState(false);
  const [difficulty, setDifficulty] = useState("classic");

  const [arcadePoints, setArcadePoints] = useState(() => readArcadePoints());

  const [status, setStatus] = useState("idle"); // idle | active | shattered | banked
  const [step, setStep] = useState(0);
  const [mult, setMult] = useState(1.0);
  const [runScore, setRunScore] = useState(0);

  const [shake, setShake] = useState(false);
  const [burst, setBurst] = useState(false);
  const [vaultPulse, setVaultPulse] = useState(false);

  const tapLock = useRef(false);

  const rules = useMemo(() => {
    const shatterBase = difficulty === "chill" ? 0.07 : difficulty === "wild" ? 0.15 : 0.11;
    const shatterInc = difficulty === "chill" ? 0.010 : difficulty === "wild" ? 0.020 : 0.015;

    const gainBase = difficulty === "wild" ? 26 : difficulty === "chill" ? 16 : 20;
    const multInc = difficulty === "wild" ? 0.13 : difficulty === "chill" ? 0.08 : 0.10;

    const maxSteps = difficulty === "wild" ? 22 : difficulty === "chill" ? 28 : 25;

    return { shatterBase, shatterInc, gainBase, multInc, maxSteps };
  }, [difficulty]);

  useEffect(() => {
    const t = setInterval(() => setVaultPulse((v) => !v), 1400);
    return () => clearInterval(t);
  }, []);

  const exit = () => navigate("/", { replace: true });

  const resetRun = () => {
    tapLock.current = false;
    setStatus("idle");
    setStep(0);
    setMult(1.0);
    setRunScore(0);
    setBurst(false);
    setShake(false);
  };

  const startRun = async () => {
    setStarting(true);
    try {
      await new Promise((r) => setTimeout(r, 280));
      resetRun();
      setStatus("active");
      setSetupOpen(false);
    } finally {
      setStarting(false);
    }
  };

  const bank = () => {
    if (status !== "active") return;
    if (runScore <= 0) return;

    const newTotal = arcadePoints + Math.floor(runScore);
    writeArcadePoints(newTotal);
    setArcadePoints(newTotal);

    setStatus("banked");
    setBurst(true);
    setTimeout(() => setBurst(false), 900);

    setTimeout(() => {
      resetRun();
      setSetupOpen(true);
    }, 900);
  };

  const shatter = () => {
    setStatus("shattered");
    setShake(true);
    setTimeout(() => setShake(false), 450);

    setTimeout(() => {
      resetRun();
      setSetupOpen(true);
    }, 1100);
  };

  const climb = () => {
    if (status !== "active") return;
    if (tapLock.current) return;
    tapLock.current = true;

    const nextStep = step + 1;

    // Auto-bank at max steps (feels like “finish line”)
    if (nextStep > rules.maxSteps) {
      bank();
      tapLock.current = false;
      return;
    }

    const shatterChance = clamp(rules.shatterBase + nextStep * rules.shatterInc, 0, 0.85);
    const shattered = Math.random() < shatterChance;

    if (!shattered) {
      const nextMult = Number((mult + rules.multInc).toFixed(2));
      const gain = Math.floor(rules.gainBase * nextMult + nextStep * 2);

      setStep(nextStep);
      setMult(nextMult);
      setRunScore((s) => s + gain);

      setBurst(true);
      setTimeout(() => setBurst(false), 380);
    } else {
      shatter();
    }

    setTimeout(() => {
      tapLock.current = false;
    }, 220);
  };

  const livePill =
    status === "shattered"
      ? { cls: "bad", text: "LADDER SHATTERED!" }
      : status === "banked"
      ? { cls: "ok", text: `BANKED +${formatInt(runScore)} PTS` }
      : status === "active"
      ? { cls: "ok", text: "CLIMB LIVE" }
      : { cls: "warn", text: "READY" };

  return (
    <div className={`fortune-stage ${shake ? "shake" : ""}`}>
      <SetupModal
        open={setupOpen}
        title="Crystal Ladder"
        badge="💎"
        points={arcadePoints}
        difficulty={difficulty}
        setDifficulty={setDifficulty}
        onStart={startRun}
        onExit={exit}
        starting={starting}
        hint="Climb steps • Stack multiplier • Bank before it shatters"
      />

      <div className="fortune-header">
        <div className="fortune-brand">
          <div className={`vault-orb ${vaultPulse ? "pulse" : ""}`}></div>
          <div className="fortune-brand-text">
            <div className="fortune-name">Crystal Ladder</div>
            <div className="fortune-sub">Step progression • Beautiful tension • Bank points anytime</div>
          </div>
        </div>

        <div className="fortune-hud">
          <div className="hud-card">
            <div className="hud-label">MULTI</div>
            <div className="hud-value">{mult.toFixed(2)}x</div>
          </div>
          <div className="hud-card">
            <div className="hud-label">STEPS</div>
            <div className="hud-value">
              {step}/{rules.maxSteps}
            </div>
          </div>
          <div className="hud-card">
            <div className="hud-label">RUN PTS</div>
            <div className="hud-value">{formatInt(runScore)}</div>
          </div>

          <button className="hud-cashout" onClick={bank} disabled={status !== "active" || runScore <= 0}>
            BANK
          </button>
          <button className="hud-exit" onClick={exit}>
            EXIT
          </button>
        </div>
      </div>

      <div className="fortune-scene fortune-scene--ladder">
        <div className="vault-bg"></div>
        <div className={`vault-shimmer ${vaultPulse ? "on" : ""}`}></div>

        <div className="ladder-nebula"></div>
        <div className="ladder-shards"></div>
        <div className={`ladder-avatar ${status !== "active" ? "idle" : ""}`}>🧑‍🚀</div>

        <div className={`coin-rain ${burst ? "on" : ""}`}>
          <span className="coin c1"></span>
          <span className="coin c2"></span>
          <span className="coin c3"></span>
          <span className="coin c4"></span>
          <span className="coin c5"></span>
          <span className="coin c6"></span>
        </div>
      </div>

      <div className="fortune-board">
        <div className="fortune-board-top">
          <div className="pill-wrap">
            <span className={`pill ${livePill.cls}`}>{livePill.text}</span>
            <span className="pill warn">DIFF: {difficulty.toUpperCase()}</span>
          </div>

          <div className="provably">
            <span className="prov-label">Hint</span>
            <span className="prov-mono">Bank often when you’re ahead. Don’t get greedy.</span>
          </div>
        </div>

        <div className="fortune-ladder-controls">
          <button
            className="fortune-ladder-climbBtn"
            onClick={climb}
            disabled={status !== "active"}
            aria-label="climb"
          >
            <span className="ladderGlow"></span>
            <span className="ladderIcon">💎</span>
            <span className="ladderText">CLIMB</span>
          </button>

          <div className="fortune-ladder-mini">
            <div className="fortune-ladder-bar">
              <div
                className="fortune-ladder-fill"
                style={{ width: `${clamp((step / rules.maxSteps) * 100, 0, 100)}%` }}
              />
            </div>
            <div className="fortune-ladder-label">Progress</div>
          </div>
        </div>
      </div>
    </div>
  );
}
