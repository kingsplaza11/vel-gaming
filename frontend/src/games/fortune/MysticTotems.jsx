// src/games/fortune/MysticTotems.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./fortune.css";

/**
 * ✅ SAFE ARCADE VERSION
 * - Setup modal: difficulty
 * - Reveal totems from a grid
 * - Blessed => score + multiplier
 * - Cursed => run ends
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
    { id: "chill", name: "Chill", desc: "More blessings • calm suspense", tag: "LOW" },
    { id: "classic", name: "Classic", desc: "Balanced blessings & curses", tag: "MID" },
    { id: "wild", name: "Wild", desc: "Curses appear fast • huge jumps", tag: "HIGH" },
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
            {starting ? "Entering…" : "Start Run"}
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

const GRID = 16; // 4x4

export default function MysticTotems() {
  const navigate = useNavigate();

  const [setupOpen, setSetupOpen] = useState(true);
  const [starting, setStarting] = useState(false);
  const [difficulty, setDifficulty] = useState("classic");

  const [arcadePoints, setArcadePoints] = useState(() => readArcadePoints());

  const [status, setStatus] = useState("idle"); // idle | active | cursed | banked
  const [reveals, setReveals] = useState(0);
  const [mult, setMult] = useState(1.0);
  const [runScore, setRunScore] = useState(0);

  const [tiles, setTiles] = useState(() =>
    Array.from({ length: GRID }, (_, i) => ({
      id: i,
      revealed: false,
      kind: null, // blessed|cursed
      glow: false,
    }))
  );

  const [shake, setShake] = useState(false);
  const [burst, setBurst] = useState(false);
  const [vaultPulse, setVaultPulse] = useState(false);

  const tapLock = useRef(false);
  const lastPickRef = useRef(null);

  const rules = useMemo(() => {
    const curseBase = difficulty === "chill" ? 0.08 : difficulty === "wild" ? 0.16 : 0.12;
    const curseInc = difficulty === "chill" ? 0.010 : difficulty === "wild" ? 0.020 : 0.015;

    const gainBase = difficulty === "wild" ? 28 : difficulty === "chill" ? 16 : 22;
    const multInc = difficulty === "wild" ? 0.14 : difficulty === "chill" ? 0.08 : 0.11;

    return { curseBase, curseInc, gainBase, multInc };
  }, [difficulty]);

  useEffect(() => {
    const t = setInterval(() => setVaultPulse((v) => !v), 1400);
    return () => clearInterval(t);
  }, []);

  const exit = () => navigate("/", { replace: true });

  const resetRun = () => {
    tapLock.current = false;
    lastPickRef.current = null;
    setStatus("idle");
    setReveals(0);
    setMult(1.0);
    setRunScore(0);
    setBurst(false);
    setShake(false);
    setTiles(
      Array.from({ length: GRID }, (_, i) => ({
        id: i,
        revealed: false,
        kind: null,
        glow: false,
      }))
    );
  };

  const startRun = async () => {
    setStarting(true);
    try {
      await new Promise((r) => setTimeout(r, 260));
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

  const curseEnd = () => {
    setStatus("cursed");
    setShake(true);
    setTimeout(() => setShake(false), 450);

    setTimeout(() => {
      resetRun();
      setSetupOpen(true);
    }, 1100);
  };

  const reveal = (id) => {
    if (status !== "active") return;
    if (tapLock.current) return;

    const t = tiles[id];
    if (!t || t.revealed) return;

    tapLock.current = true;
    lastPickRef.current = id;

    const nextReveals = reveals + 1;
    const curseChance = clamp(rules.curseBase + nextReveals * rules.curseInc, 0, 0.8);
    const isCursed = Math.random() < curseChance;

    if (!isCursed) {
      const nextMult = Number((mult + rules.multInc).toFixed(2));
      const gain = Math.floor(rules.gainBase * nextMult + nextReveals * 3);

      setReveals(nextReveals);
      setMult(nextMult);
      setRunScore((s) => s + gain);

      setTiles((prev) =>
        prev.map((x) =>
          x.id === id ? { ...x, revealed: true, kind: "blessed", glow: true } : x
        )
      );

      setTimeout(() => {
        setTiles((prev) => prev.map((x) => (x.glow ? { ...x, glow: false } : x)));
      }, 420);

      setBurst(true);
      setTimeout(() => setBurst(false), 350);
    } else {
      setTiles((prev) =>
        prev.map((x) =>
          x.id === id ? { ...x, revealed: true, kind: "cursed" } : x
        )
      );
      curseEnd();
    }

    setTimeout(() => {
      tapLock.current = false;
    }, 220);
  };

  const livePill =
    status === "cursed"
      ? { cls: "bad", text: "CURSED TOTEM!" }
      : status === "banked"
      ? { cls: "ok", text: `BANKED +${formatInt(runScore)} PTS` }
      : status === "active"
      ? { cls: "ok", text: "SHRINE LIVE" }
      : { cls: "warn", text: "READY" };

  return (
    <div className={`fortune-stage ${shake ? "shake" : ""}`}>
      <SetupModal
        open={setupOpen}
        title="Mystic Totems"
        badge="🔮"
        points={arcadePoints}
        difficulty={difficulty}
        setDifficulty={setDifficulty}
        onStart={startRun}
        onExit={exit}
        starting={starting}
        hint="Reveal totems • Stack blessings • Bank before a curse"
      />

      <div className="fortune-header">
        <div className="fortune-brand">
          <div className={`vault-orb ${vaultPulse ? "pulse" : ""}`}></div>
          <div className="fortune-brand-text">
            <div className="fortune-name">Mystic Totems</div>
            <div className="fortune-sub">Reveal • Suspense • Bank your points</div>
          </div>
        </div>

        <div className="fortune-hud">
          <div className="hud-card">
            <div className="hud-label">MULTI</div>
            <div className="hud-value">{mult.toFixed(2)}x</div>
          </div>
          <div className="hud-card">
            <div className="hud-label">REVEALS</div>
            <div className="hud-value">{reveals}</div>
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

      <div className="fortune-scene fortune-scene--totems">
        <div className="vault-bg"></div>
        <div className={`vault-shimmer ${vaultPulse ? "on" : ""}`}></div>

        <div className="totems-fog"></div>
        <div className="totems-vines"></div>
        <div className={`totems-eye ${status === "active" ? "watch" : ""}`}></div>

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
            <span className="prov-label">Tip</span>
            <span className="prov-mono">Blessings feel great… until the curse lands.</span>
          </div>
        </div>

        <div className="fortune-grid fortune-grid--totems">
          {tiles.map((t) => (
            <button
              key={t.id}
              className={`fortune-tile fortune-tile--totem ${t.revealed ? t.kind : ""} ${t.glow ? "glow" : ""}`}
              disabled={setupOpen || status !== "active" || t.revealed}
              onClick={() => reveal(t.id)}
              aria-label={`totem-${t.id}`}
            >
              <div className="tile-face">
                {!t.revealed && <span className="tile-glyph">🗿</span>}
                {t.revealed && t.kind === "blessed" && <span className="tile-glyph safe">✨</span>}
                {t.revealed && t.kind === "cursed" && <span className="tile-glyph trap">🦂</span>}
              </div>
              <div className="tile-glowline"></div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
