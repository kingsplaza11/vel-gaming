import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../contexts/WalletContext"; // Import wallet context
import { minesweeperService } from "../services/api";
import "./MinesweeperGame.css";

const MAX_PROFIT_RATIO = 0.45;

const MinesweeperGame = ({ user, onBalanceUpdate }) => {
  const navigate = useNavigate();
  const { wallet, loading: walletLoading, refreshWallet } = useWallet(); // Get wallet data

  /* -------------------- HELPER FUNCTIONS -------------------- */
  // Get wallet balance with fallback to user.balance
  const getWalletBalance = () => {
    return wallet?.balance !== undefined ? wallet.balance : (user?.balance || 0);
  };

  const balance = Number(getWalletBalance() || 0);

  const formatNGN = (v) =>
    `₦${Number(v || 0).toLocaleString("en-NG", {
      minimumFractionDigits: 2,
    })}`;

  /* -------------------- STATE -------------------- */
  const [showStakeModal, setShowStakeModal] = useState(true);
  const [betAmount, setBetAmount] = useState(1000);

  const [gridSize, setGridSize] = useState(5);
  const [minesCount, setMinesCount] = useState(5);

  const [gameId, setGameId] = useState(null);
  const [grid, setGrid] = useState([]);
  const [gameState, setGameState] = useState("idle"); // idle | playing | lost | cashed_out
  const [multiplier, setMultiplier] = useState(1.0);

  const initializeGrid = (size) =>
    Array.from({ length: size }, () =>
      Array.from({ length: size }, () => ({
        revealed: false,
        mine: false,
      }))
    );

  /* -------------------- START GAME -------------------- */
  const startGame = async () => {
    if (betAmount < 200) {
      alert("Minimum stake is ₦200");
      return;
    }

    if (betAmount > balance) {
      alert("Insufficient balance");
      return;
    }

    // Check if wallet is still loading
    if (walletLoading) {
      alert("Please wait while your balance loads...");
      return;
    }

    try {
      const res = await minesweeperService.start({
        bet_amount: betAmount,
        grid_size: gridSize,
        mines_count: minesCount,
      });

      setGameId(res.data.game_id);
      setGrid(initializeGrid(gridSize));
      setMultiplier(1.0);
      setGameState("playing");
      setShowStakeModal(false);

      // Update wallet balance
      if (refreshWallet) {
        await refreshWallet();
      }

      onBalanceUpdate({ ...user, balance: res.data.new_balance || (balance - betAmount) });
    } catch (err) {
      alert(err.response?.data?.error || "Failed to start game");
    }
  };

  /* -------------------- REVEAL CELL -------------------- */
  const revealCell = async (row, col) => {
    if (gameState !== "playing") return;

    try {
      const res = await minesweeperService.reveal({
        game_id: gameId,
        row,
        col,
      });

      if (res.data.hit_mine) {
        setGameState("lost");
        revealMines(res.data.mines_positions || []);
        return;
      }

      setMultiplier(res.data.multiplier);

      const newGrid = [...grid];
      res.data.revealed_cells.forEach(([r, c]) => {
        newGrid[r][c].revealed = true;
      });
      setGrid(newGrid);
    } catch (err) {
      alert(err.response?.data?.error || "Reveal failed");
    }
  };

  /* -------------------- CASH OUT -------------------- */
  const cashOut = async () => {
    if (gameState !== "playing") return;

    try {
      const res = await minesweeperService.cashout({
        game_id: gameId,
      });

      setGameState("cashed_out");

      // Update wallet balance
      if (refreshWallet) {
        await refreshWallet();
      }

      onBalanceUpdate({ ...user, balance: res.data.new_balance || (balance - betAmount + (betAmount * Math.min(multiplier, 1 + MAX_PROFIT_RATIO))) });

      alert(`Cashed out ${formatNGN(res.data.win_amount)}`);
    } catch (err) {
      alert(err.response?.data?.error || "Cash out failed");
    }
  };

  /* -------------------- REVEAL ALL MINES -------------------- */
  const revealMines = (positions) => {
    const newGrid = [...grid];
    positions.forEach(([r, c]) => {
      if (newGrid[r] && newGrid[r][c]) {
        newGrid[r][c].mine = true;
        newGrid[r][c].revealed = true;
      }
    });
    setGrid(newGrid);
  };

  /* -------------------- RENDER -------------------- */
  return (
    <div className="minesweeper-game">

      {/* HEADER */}
      <header className="game-header">
        <button onClick={() => navigate("/")}>← Back</button>
        <div className="balance">
          {walletLoading ? (
            <div className="balance-loading">
              <span className="loading-spinner-small" />
              Loading...
            </div>
          ) : (
            formatNGN(balance)
          )}
        </div>
      </header>

      {/* STAKE MODAL */}
      {showStakeModal && (
        <div className="stake-modal-overlay">
          <div className="stake-modal">
            <h3>💣 Minesweeper</h3>

            <div className="balance-summary">
              <span className="balance-label">Available Balance:</span>
              <span className="balance-amount">
                {walletLoading ? (
                  <div className="balance-loading-inline">
                    <span className="loading-spinner-small" />
                    Loading...
                  </div>
                ) : (
                  formatNGN(balance)
                )}
              </span>
            </div>

            <label>Stake (₦)</label>
            <input
              type="number"
              value={betAmount}
              min={1000}
              onChange={(e) => setBetAmount(Number(e.target.value))}
              disabled={walletLoading}
            />

            <div className="quick-stakes">
              {[1000, 2500, 5000, 10000].map((v) => (
                <button 
                  key={v} 
                  onClick={() => !walletLoading && setBetAmount(v)}
                  disabled={walletLoading}
                >
                  ₦{v.toLocaleString()}
                </button>
              ))}
            </div>
            <button
              className="start-btn"
              disabled={betAmount > balance || walletLoading}
              onClick={startGame}
            >
              {walletLoading ? "LOADING..." : "START GAME"}
            </button>
          </div>
        </div>
      )}

      {/* GAME BOARD */}
      {!showStakeModal && (
        <div className="board-section">
          <div className="top-info">
            <span>Multiplier</span>
            <strong>{multiplier.toFixed(2)}x</strong>
          </div>

          <div className="grid">
            {grid.map((row, r) => (
              <div key={r} className="row">
                {row.map((cell, c) => (
                  <div
                    key={`${r}-${c}`}
                    className={`cell ${
                      cell.revealed ? (cell.mine ? "mine" : "safe") : "hidden"
                    }`}
                    onClick={() => revealCell(r, c)}
                  >
                    {cell.revealed && cell.mine && "💣"}
                    {cell.revealed && !cell.mine && "✔"}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {gameState === "playing" && (
            <button className="cashout-btn" onClick={cashOut}>
              CASH OUT ({formatNGN(betAmount * Math.min(multiplier, 1 + MAX_PROFIT_RATIO))})
            </button>
          )}

          {gameState !== "playing" && (
            <div className="result-section">
              {gameState === "cashed_out" && (
                <div className="new-balance">
                  <span>New Balance:</span>
                  <span className="balance-amount">
                    {walletLoading ? (
                      <div className="balance-loading-inline">
                        <span className="loading-spinner-small" />
                        Updating...
                      </div>
                    ) : (
                      formatNGN(getWalletBalance())
                    )}
                  </span>
                </div>
              )}
              <button
                className="restart-btn"
                onClick={() => {
                  setShowStakeModal(true);
                  setGameState("idle");
                  setGrid([]);
                  setGameId(null);
                }}
              >
                PLAY AGAIN
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MinesweeperGame;