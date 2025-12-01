// SlotsGame.jsx
import React, { useState, useEffect, useRef } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { slotsService } from "../services/api";
import "./SlotsGame.css";

const SYMBOLS = {
  classic: ["seven", "bar", "bell", "cherry", "orange", "lemon"],
  fruit: ["watermelon", "grapes", "orange", "cherry", "lemon", "plum"],
  diamond: ["diamond", "ruby", "emerald", "sapphire", "gold", "silver"],
  ancient: ["scarab", "pyramid", "pharaoh", "ankh", "eye", "sphinx"]
};

const THEME_INFO = {
  classic: { name: "Classic", color: "#d4af37", bg: "#111" },
  fruit: { name: "Fruit", color: "#ff6b6b", bg: "#2a1a1a" },
  diamond: { name: "Diamond", color: "#74b9ff", bg: "#111a2d" },
  ancient: { name: "Ancient", color: "#fdcb6e", bg: "#2d1a0d" }
};

const WinModal = ({ winAmount, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => onClose(), 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="win-modal-overlay">
      <div className="win-modal">
        <h1>🎰 JACKPOT 🎰</h1>
        <h2 className="win-text">${winAmount.toFixed(2)}</h2>
      </div>
    </div>
  );
};

const SlotImage = ({ symbol, isSpinning }) => (
  <img
    className={`slot-symbol ${isSpinning ? "spinning" : ""}`}
    src={`/images/slots/${symbol}.png`}
    alt={symbol}
  />
);

const MobileSidebar = ({ isOpen, onClose, navigate, location }) => {
  return (
    <div className={`mobile-sidebar-overlay ${isOpen ? "open" : ""}`} onClick={onClose}>
      <div className="mobile-sidebar" onClick={(e) => e.stopPropagation()}>
        <h2 className="sidebar-title">MENU</h2>
        <button className="close-sidebar" onClick={onClose}>×</button>

        <div className="mobile-sidebar-nav">
          <button
            className={`mobile-nav-button ${location.pathname === "/slots" ? "active" : ""}`}
            onClick={() => { navigate("/slots"); onClose(); }}
          >
            🎰 Play Game
          </button>
          <button
            className={`mobile-nav-button ${location.pathname === "/slots/stats" ? "active" : ""}`}
            onClick={() => { navigate("/slots/stats"); onClose(); }}
          >
            📊 Statistics
          </button>
          <button
            className={`mobile-nav-button ${location.pathname === "/slots/history" ? "active" : ""}`}
            onClick={() => { navigate("/slots/history"); onClose(); }}
          >
            📜 Game History
          </button>
        </div>
      </div>
    </div>
  );
};

const SlotsGame = ({ user, onBalanceUpdate }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="slots-game">
      <header className="game-header">
        <div className="header-left">
          <h1 className="game-title">SLOT</h1>
        </div>
        
        <div className="header-center">
          <button onClick={() => navigate("/")} className="back-button">Back</button>
        </div>
        
        <div className="header-right">
          <button className="mobile-menu-button" onClick={() => setMobileSidebarOpen(true)}>
            ☰
          </button>
        </div>
      </header>

      <div className="slots-layout">
        <nav className="slots-sidebar">
          <button
            className={`nav-button ${location.pathname === "/slots" ? "active" : ""}`}
            onClick={() => navigate("/slots")}
          >
            🎰 Play Game
          </button>
          <button
            className={`nav-button ${location.pathname === "/slots/stats" ? "active" : ""}`}
            onClick={() => navigate("/slots/stats")}
          >
            📊 Statistics
          </button>
          <button
            className={`nav-button ${location.pathname === "/slots/history" ? "active" : ""}`}
            onClick={() => navigate("/slots/history")}
          >
            📜 Game History
          </button>
        </nav>

        <main className="slots-main">
          <Routes>
            <Route path="/" element={<SlotMachine user={user} onBalanceUpdate={onBalanceUpdate} />} />
            <Route path="/stats" element={<SlotStats />} />
            <Route path="/history" element={<SlotHistory />} />
          </Routes>
        </main>
      </div>

      <MobileSidebar
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
        navigate={navigate}
        location={location}
      />
    </div>
  );
};

const SlotMachine = ({ user, onBalanceUpdate }) => {
  const [theme, setTheme] = useState("classic");
  const [betAmount, setBetAmount] = useState(100);
  const [reels, setReels] = useState(Array(12).fill("seven"));
  const [spinning, setSpinning] = useState(false);
  const [forceStop, setForceStop] = useState(false);
  const [winAmount, setWinAmount] = useState(0);
  const [lastWin, setLastWin] = useState(0);
  const [winningLines, setWinningLines] = useState([]);
  const [showWinModal, setShowWinModal] = useState(false);

  const spinSound = useRef(new Audio("/sounds/spin.mp3"));
  const winSound = useRef(new Audio("/sounds/win.mp3"));

  useEffect(() => {
    spinSound.current.loop = true;
    spinSound.current.volume = 0.5;
    winSound.current.loop = false;
  }, []);

  const randomReels = () => {
    const list = SYMBOLS[theme];
    return Array(12)
      .fill(0)
      .map(() => list[Math.floor(Math.random() * list.length)]);
  };

  const handleSpin = () => {
    if (spinning || betAmount > user.balance) return;

    setSpinning(true);
    setForceStop(false);
    setShowWinModal(false);

    spinSound.current.currentTime = 0;
    spinSound.current.play();

    const startTime = Date.now();
    const spinDuration = 2000;
    
    const animateSpin = () => {
      const elapsed = Date.now() - startTime;
      
      if (!forceStop && elapsed < spinDuration) {
        setReels(randomReels());
        requestAnimationFrame(animateSpin);
      } else {
        beginSlowDown();
      }
    };
    
    animateSpin();
  };

  const stopSpinEarly = () => {
    if (spinning) {
      setForceStop(true);
    }
  };

  const beginSlowDown = () => {
    let stepsCompleted = 0;
    const totalSlowSteps = 8;
    
    const slowStep = () => {
      if (stepsCompleted < totalSlowSteps) {
        setReels(randomReels());
        stepsCompleted++;
        
        const delay = 100 + (stepsCompleted * 40);
        setTimeout(slowStep, delay);
      } else {
        finalizeSpin();
      }
    };
    
    slowStep();
  };

  const finalizeSpin = async () => {
    spinSound.current.pause();
    spinSound.current.currentTime = 0;
    
    try {
      const response = await slotsService.spin({ theme, bet_amount: betAmount });
      const { reels, win_amount, new_balance, winning_lines } = response.data;

      setReels(reels);
      setWinAmount(win_amount);
      setLastWin(win_amount);
      setWinningLines(winning_lines || []);
      onBalanceUpdate({ ...user, balance: new_balance });

      if (win_amount > 0) {
        winSound.current.currentTime = 0;
        winSound.current.play();
        setShowWinModal(true);
      }
    } catch (error) {
      console.error("Spin error:", error);
      const fallbackReels = randomReels();
      setReels(fallbackReels);
      setLastWin(0);
    }

    setSpinning(false);
    setForceStop(false);
  };

  return (
    <div className="slot-machine">
      <div className="machine-container">
        <div className="machine-header">
          <h2>{THEME_INFO[theme].name}</h2>
          {lastWin > 0 && (
            <div className="last-win">LAST WIN: ${lastWin.toFixed(2)}</div>
          )}
        </div>

        <div className="reels-display">
          <div className="reels-container">
            {[0, 1, 2, 3].map(col => (
              <div key={col} className="reel-column">
                {[0, 1, 2].map(row => {
                  const index = col * 3 + row;
                  return (
                    <div key={index} className="reel-slot">
                      <SlotImage symbol={reels[index]} isSpinning={spinning} />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="control-panel">
          <div className="stake-box">
            <label>Stake</label>
            <input
              type="number"
              value={betAmount}
              min="1"
              max={user.balance}
              onChange={(e) => setBetAmount(Number(e.target.value))}
            />
          </div>

          <select value={theme} onChange={(e) => setTheme(e.target.value)}>
            <option value="classic">Classic</option>
            <option value="fruit">Fruit</option>
            <option value="diamond">Diamond</option>
            <option value="ancient">Ancient</option>
          </select>

          {!spinning ? (
            <button className="spin-button mechanical-button" onClick={handleSpin}>
              SPIN
            </button>
          ) : (
            <button className="stop-button mechanical-button" onClick={stopSpinEarly}>
              STOP
            </button>
          )}
        </div>
      </div>

      {showWinModal && <WinModal winAmount={winAmount} onClose={() => setShowWinModal(false)} />}
    </div>
  );
};

const SlotStats = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await slotsService.getStats();
        setStats(response.data.stats || response.data || {});
      } catch (error) {
        console.error("Error loading stats:", error);
        setStats({
          total_spins: 0,
          total_bet: 0,
          total_won: 0
        });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) return <div className="loading">Loading Stats...</div>;

  return (
    <div className="stats-page">
      <h1>Player Statistics</h1>
      <div className="stats-grid">
        <div className="stat-box">Total Spins: {stats.total_spins || 0}</div>
        <div className="stat-box">Total Wagered: ${(stats.total_bet || 0).toFixed(2)}</div>
        <div className="stat-box">Total Won: ${(stats.total_won || 0).toFixed(2)}</div>
        <div className="stat-box">
          Return Rate: {stats.total_bet > 0 ? (((stats.total_won || 0) / (stats.total_bet || 1)) * 100).toFixed(1) : 0}%
        </div>
      </div>
    </div>
  );
};

const SlotHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await slotsService.getHistory();
        setHistory(response.data.history || response.data.games || response.data || []);
      } catch (error) {
        console.error("Error loading history:", error);
        setHistory([]);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) return <div className="loading">Loading History...</div>;

  return (
    <div className="history-page">
      <h1>Game History</h1>

      {history.length === 0 ? (
        <div className="no-history">No games played yet.</div>
      ) : (
        <div className="history-table">
          {history.map((game, i) => (
            <div key={i} className="history-row">
              <span>{new Date(game.created_at).toLocaleString()}</span>
              <span>{game.theme}</span>
              <span>${(game.bet_amount || 0).toFixed(2)}</span>
              <span className={game.win_amount > 0 ? "win" : "loss"}>
                ${(game.win_amount || 0).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SlotsGame;