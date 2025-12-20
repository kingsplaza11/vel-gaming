import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../contexts/WalletContext"; // Import wallet context
import { slotsService } from "../services/api";
import "./SlotsGame.css";

/* ===============================
   SYMBOLS (FRONTEND ANIMATION)
================================ */
const SYMBOLS = {
  classic: ["seven", "bar", "bell", "cherry", "orange", "lemon"],
  fruit: ["watermelon", "grapes", "orange", "cherry", "lemon", "plum"],
  diamond: ["diamond", "ruby", "emerald", "sapphire", "gold", "silver"],
  ancient: ["scarab", "pyramid", "sphinx", "ankh", "eye", "pharaoh"],
};

const THEMES = Object.keys(SYMBOLS);

/* ===============================
   SAFE NAIRA FORMATTER
================================ */
const formatNGN = (value) =>
  `₦${Number(value || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
  })}`;

const SlotsGame = ({ user }) => {
  const navigate = useNavigate();
  const { wallet, loading: walletLoading, refreshWallet } = useWallet(); // Get wallet data

  /* ✅ HARD GUARD (NO MORE CRASHES) */
  const safeWallet = wallet || { balance: 0 };

  // Get wallet balance with fallback
  const getWalletBalance = () => {
    return wallet?.balance !== undefined ? wallet.balance : (user?.balance || 0);
  };

  const balance = Number(getWalletBalance() || 0);

  const [showSetup, setShowSetup] = useState(true);
  const [theme, setTheme] = useState("classic");
  const [betAmount, setBetAmount] = useState(1000);

  const [reels, setReels] = useState(Array(12).fill("seven"));
  const [spinning, setSpinning] = useState(false);
  const [lastWin, setLastWin] = useState(0);

  const spinSound = useRef(null);
  const winSound = useRef(null);

  useEffect(() => {
    spinSound.current = new Audio("/sounds/spin.mp3");
    winSound.current = new Audio("/sounds/win.mp3");

    spinSound.current.loop = true;
    spinSound.current.volume = 0.5;
  }, []);

  /* ===============================
     FRONTEND SPIN ANIMATION
  ================================ */
  const randomReels = () => {
    const list = SYMBOLS[theme];
    return Array.from({ length: 12 }, () =>
      list[Math.floor(Math.random() * list.length)]
    );
  };

  const handleSpin = async () => {
    if (spinning) return;
    if (betAmount > balance) return;

    setSpinning(true);
    setLastWin(0);

    spinSound.current.currentTime = 0;
    spinSound.current.play();

    const spinInterval = setInterval(() => {
      setReels(randomReels());
    }, 80);

    setTimeout(async () => {
      clearInterval(spinInterval);
      spinSound.current.pause();

      try {
        const res = await slotsService.spin({
          bet_amount: betAmount,
          theme,
        });

        setReels(res.data.reels);
        setLastWin(res.data.win_amount);

        /* ✅ UPDATE WALLET SAFELY */
        if (refreshWallet) {
          await refreshWallet();
        }
      } catch (err) {
        console.error("Spin failed:", err);
      }

      setSpinning(false);
    }, 2200);
  };

  return (
    <div className="slots-game">
      {/* ================= HEADER ================= */}
      <header className="game-header">
        <button onClick={() => navigate("/")} className="back-button">
          ← Back
        </button>
        <div className="balance-display">
          {walletLoading ? (
            <div className="balance-loading">
              <span className="loading-spinner-small" />
              Loading...
            </div>
          ) : (
            `Balance: ${formatNGN(balance)}`
          )}
        </div>
      </header>

      {/* ================= SETUP MODAL ================= */}
      {showSetup && (
        <div className="modal-overlay">
          <div className="stake-modal">
            <h2>🎰 Slot Setup</h2>

            <label>Stake (₦)</label>
            <input
              type="number"
              min="1000"
              value={betAmount}
              onChange={(e) => setBetAmount(Number(e.target.value))}
              disabled={walletLoading}
            />

            <label>Theme</label>
            <div className="theme-grid">
              {THEMES.map((t) => (
                <button
                  key={t}
                  className={theme === t ? "active" : ""}
                  onClick={() => !walletLoading && setTheme(t)}
                  disabled={walletLoading}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="risk-note">
              ⚠️ Max profit is <b>30%</b> of stake. You can lose everything.
            </div>

            <button
              className="primary"
              disabled={walletLoading || betAmount > balance}
              onClick={() => setShowSetup(false)}
            >
              {walletLoading ? "LOADING..." : "START GAME"}
            </button>
          </div>
        </div>
      )}

      {/* ================= SLOT MACHINE ================= */}
      <div className="slot-machine">
        <div className="reels-grid">
          {reels.map((symbol, i) => (
            <div key={i} className={`reel ${spinning ? "spin" : ""}`}>
              <img
                src={`/images/slots/${symbol}.png`}
                alt={symbol}
                draggable={false}
              />
            </div>
          ))}
        </div>

        <button
          className="spin-btn"
          onClick={handleSpin}
          disabled={walletLoading || spinning || betAmount > balance}
        >
          {spinning ? "SPINNING..." : "SPIN"}
        </button>

        {lastWin > 0 && (
          <div className="win-display">
            🎉 WIN: {formatNGN(lastWin)}
          </div>
        )}
      </div>
    </div>
  );
};

export default SlotsGame;