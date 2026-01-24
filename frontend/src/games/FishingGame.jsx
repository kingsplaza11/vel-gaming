import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../contexts/WalletContext";
import { fishingService } from "../services/api";
import { fishingSound } from "../utils/FishingSoundManager";
import toast from "react-hot-toast";
import "./FishingGame.css";

const MINIMUM_STAKE = 100; // Minimum stake of 100 naira

const FishingGame = ({ user, onBalanceUpdate }) => {
  const navigate = useNavigate();
  const { wallet, loading: walletLoading, refreshWallet, availableBalance } = useWallet();

  /* ---------------- STATE ---------------- */
  const [betAmount, setBetAmount] = useState("1000"); // Start with default stake
  const [isCasting, setIsCasting] = useState(false);
  const [muteState, setMuteState] = useState(fishingSound.getMuteState());
  const [animationStage, setAnimationStage] = useState("idle"); // idle, casting, waiting, reeling, caught

  const [lastCatch, setLastCatch] = useState(null);
  const [roundResult, setRoundResult] = useState(null);

  const [showStakeModal, setShowStakeModal] = useState(true);
  const [showResultModal, setShowResultModal] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  /* ---------------- REFS ---------------- */
  const fishingLineRef = useRef(null);
  const hookRef = useRef(null);
  const catchRef = useRef(null);
  const gameContainerRef = useRef(null);

  /* ---------------- AUDIO CONTROLS ---------------- */
  const toggleMute = () => {
    const { bgMuted, gameMuted } = fishingSound.toggleMute();
    setMuteState({ backgroundMusicMuted: bgMuted, gameSoundsMuted: gameMuted });
    
    const bgText = bgMuted ? "Background music muted" : "Background music unmuted";
    const gameText = gameMuted ? "Game sounds muted" : "Game sounds active";
    
    toast(
      <div>
        <div>{bgText}</div>
        <div>{gameText}</div>
      </div>,
      {
        icon: bgMuted && gameMuted ? "🔇" : bgMuted ? "🎵" : gameMuted ? "🔊" : "🎣"
      }
    );
  };

  /* ---------------- HELPER FUNCTIONS ---------------- */
  const getWalletBalance = () => {
    return availableBalance !== undefined ? availableBalance : availableBalance;
  };

  const safeBalance = Number(getWalletBalance() || 0);

  const formatMoney = (v) => Number(v || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const isStakeValid = () => {
    const amt = Number(betAmount);
    return Number.isFinite(amt) && amt >= MINIMUM_STAKE && amt <= safeBalance;
  };

  /* ---------------- ANIMATION HELPERS ---------------- */
  const resetAnimation = useCallback(() => {
    setAnimationStage("idle");
    setLastCatch(null);
    
    // Reset DOM elements
    if (fishingLineRef.current) {
      fishingLineRef.current.style.height = "0";
      fishingLineRef.current.style.opacity = "1";
    }
    if (hookRef.current) {
      hookRef.current.style.top = "-25px";
      hookRef.current.style.opacity = "1";
      hookRef.current.style.transform = "translateX(-50%)";
    }
    if (catchRef.current) {
      catchRef.current.style.opacity = "0";
      catchRef.current.style.transform = "translate(-50%, -50%) scale(0)";
    }
  }, []);

  const animateCasting = useCallback(() => {
    setAnimationStage("casting");
    
    // Play casting sound
    fishingSound.playCastSound();
    
    // Animate fishing line
    if (fishingLineRef.current) {
      fishingLineRef.current.style.height = "100%";
      fishingLineRef.current.style.transition = "height 0.8s cubic-bezier(0.68, -0.55, 0.27, 1.55)";
    }
    
    // Animate hook
    if (hookRef.current) {
      hookRef.current.style.top = "50%";
      hookRef.current.style.transition = "top 0.8s cubic-bezier(0.68, -0.55, 0.27, 1.55), opacity 0.8s ease";
    }
    
    // After casting animation, switch to waiting
    setTimeout(() => {
      setAnimationStage("waiting");
    }, 800);
  }, []);

  const animateCatch = useCallback((isGoodCatch) => {
    setAnimationStage("reeling");
    
    // Play reeling sound
    setTimeout(() => fishingSound.playReelInSound(), 100);
    
    // Animate line back up
    if (fishingLineRef.current) {
      fishingLineRef.current.style.height = "20%";
      fishingLineRef.current.style.transition = "height 0.5s ease-in-out";
    }
    
    // Animate hook coming back up
    if (hookRef.current) {
      hookRef.current.style.top = "20%";
      hookRef.current.style.transition = "top 0.5s ease-in-out";
    }
    
    // After reeling animation, show catch
    setTimeout(() => {
      setAnimationStage("caught");
      
      if (catchRef.current) {
        catchRef.current.style.opacity = "1";
        catchRef.current.style.transform = "translate(-50%, -50%) scale(1)";
        catchRef.current.style.transition = "all 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
      }
      
      // Play appropriate catch sound
      if (isGoodCatch) {
        fishingSound.playCatchSuccessSound();
      } else {
        fishingSound.playCatchTrapSound();
      }
      
      // Show result modal after catch animation
      setTimeout(() => {
        setShowResultModal(true);
      }, 1000);
    }, 500);
  }, []);

  /* ---------------- START GAME ---------------- */
  const startGame = () => {
    setErrorMessage("");
    const amt = Number(betAmount);

    if (!Number.isFinite(amt) || amt <= 0) {
      setErrorMessage("Enter a valid stake amount");
      return;
    }

    if (amt < MINIMUM_STAKE) {
      setErrorMessage(`Minimum stake is ₦${MINIMUM_STAKE.toLocaleString("en-NG")}`);
      return;
    }

    if (amt > safeBalance) {
      setErrorMessage("Insufficient wallet balance");
      return;
    }

    if (walletLoading) {
      setErrorMessage("Please wait while your balance loads...");
      return;
    }

    // Play stake sound
    fishingSound.playStakeSound();
    
    setShowStakeModal(false);
    resetAnimation();
    
    // Start background music if not muted
    if (!muteState.backgroundMusicMuted) {
      fishingSound.playBackgroundMusic();
    }
  };

  /* ---------------- CAST LINE ---------------- */
  const handleCastLine = async () => {
    if (isCasting || isLoading || animationStage !== "idle") return;

    setIsCasting(true);
    setIsLoading(true);
    setErrorMessage("");
    
    // Reset previous catch
    setLastCatch(null);
    setRoundResult(null);
    setShowResultModal(false);
    
    // Start casting animation
    animateCasting();

    try {
      const response = await fishingService.castLine({
        bet_amount: Number(betAmount),
      });

      const data = response.data;
      
      // Update state with catch result
      setLastCatch(data.catch);
      setRoundResult(data);

      // Determine if it's a good catch
      const isGoodCatch = data.profit > 0;
      
      // Wait for casting animation to complete, then animate catch
      setTimeout(() => {
        animateCatch(isGoodCatch);
      }, 1200);

      // Update wallet balance
      if (refreshWallet) {
        setTimeout(async () => {
          await refreshWallet();
        }, 1500);
      }

      // Update parent component if needed
      if (onBalanceUpdate) {
        const newBalance = data.new_balance || (safeBalance - Number(betAmount) + Number(data.profit || 0));
        onBalanceUpdate({
          ...user,
          balance: newBalance,
        });
      }
      
    } catch (err) {
      console.error("Cast line error:", err);
      setErrorMessage(
        err.response?.data?.error || "Failed to cast line. Please try again."
      );
      
      // Reset animation on error
      setTimeout(() => {
        resetAnimation();
        setIsCasting(false);
        setIsLoading(false);
      }, 500);
      
    } finally {
      // Reset loading states after animation completes
      setTimeout(() => {
        setIsLoading(false);
        setIsCasting(false);
      }, 2000);
    }
  };

  /* ---------------- RESET ---------------- */
  const resetGame = () => {
    resetAnimation();
    setLastCatch(null);
    setRoundResult(null);
    setShowResultModal(false);
    setShowStakeModal(true);
  };

  /* ---------------- RETURN TO GAMES ---------------- */
  const returnToGames = () => {
    fishingSound.cleanup();
    navigate("/");
  };

  /* ---------------- EFFECTS ---------------- */
  useEffect(() => {
    // Try to initialize audio context on first user interaction
    const initAudioOnInteraction = () => {
      fishingSound.init();
      document.removeEventListener('click', initAudioOnInteraction);
      document.removeEventListener('touchstart', initAudioOnInteraction);
    };
    
    // Add event listeners for audio context initialization
    document.addEventListener('click', initAudioOnInteraction);
    document.addEventListener('touchstart', initAudioOnInteraction);
    
    // Cleanup on unmount
    return () => {
      fishingSound.cleanup();
      document.removeEventListener('click', initAudioOnInteraction);
      document.removeEventListener('touchstart', initAudioOnInteraction);
    };
  }, []);

  /* ---------------- RENDER ---------------- */
  const allMuted = muteState.backgroundMusicMuted && muteState.gameSoundsMuted;
  const bgMutedOnly = muteState.backgroundMusicMuted && !muteState.gameSoundsMuted;
  const gameMutedOnly = !muteState.backgroundMusicMuted && muteState.gameSoundsMuted;

  // Determine button text based on animation stage
  const getCastButtonText = () => {
    switch (animationStage) {
      case "casting":
        return "CASTING...";
      case "waiting":
        return "WAITING...";
      case "reeling":
        return "REELING IN...";
      case "caught":
        return "CAUGHT!";
      default:
        return "🎣 CAST LINE";
    }
  };

  // Get instruction text for scene header
  const getSceneInstruction = () => {
    switch (animationStage) {
      case "idle":
        return "Tap CAST to throw your line!";
      case "casting":
        return "Throwing line...";
      case "waiting":
        return "Waiting for a bite...";
      case "reeling":
        return "Reeling in...";
      case "caught":
        return "You caught something!";
      default:
        return "Tap CAST to throw your line!";
    }
  };

  return (
    <div className="fishing-game" ref={gameContainerRef}>
      {/* ================= COMPACT NAVBAR HEADER ================= */}
      <header className="game-header">
        <div className="header-content">
          {/* Left side: Back button and Game title */}
          <div className="header-left">
            <button 
              className="back-button" 
              onClick={returnToGames}
              aria-label="Back to games"
            >
              ←
            </button>
            <h1 className="game-title">
              <span className="game-icon">🎣</span>
              Deep Sea Fishing
            </h1>
          </div>
          
          {/* Center: Game status display */}
          <div className="header-center">
            <div className="game-status-bar">
              <div className="current-stake">
                Current Stake: <strong>₦{formatMoney(betAmount)}</strong>
              </div>
              <div className="balance-display">
                Balance: <strong>₦{formatMoney(safeBalance)}</strong>
              </div>
            </div>
          </div>
          
          {/* Right side: Scene header and audio control */}
          <div className="header-right">
            <div className="scene-header">
              <h2 className="scene-title">Deep Sea Fishing</h2>
              <p className="scene-instruction">
                {getSceneInstruction()}
              </p>
            </div>
            <button 
              className="audio-control-btn"
              onClick={toggleMute}
              aria-label={allMuted ? "Unmute all sounds" : "Mute all sounds"}
            >
              {allMuted ? "🔇" : bgMutedOnly ? "🎵" : gameMutedOnly ? "🔊" : "🎣"}
            </button>
          </div>
        </div>
      </header>

      {/* ================= STAKE MODAL ================= */}
      {showStakeModal && (
        <div className="stake-modal-overlay">
          <div className="stake-modal-container">
            <div className="stake-modal-content">
              <div className="modal-header">
                <h2 className="modal-title">DEEP SEA FISHING</h2>
              </div>

              <div className="balance-card">
                <div className="balance-label">Available Balance</div>
                <div className="balance-value">
                  {walletLoading ? (
                    <div className="balance-loading">
                      <span className="loading-spinner"></span>
                      Loading balance...
                    </div>
                  ) : (
                    `₦${formatMoney(safeBalance)}`
                  )}
                </div>
              </div>

              <div className="stake-input-section">
                <div className="input-label">Enter your stake amount:</div>
                <div className="stake-input-wrapper">
                  <span className="currency-symbol">₦</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={betAmount}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^\d.]/g, '');
                      setBetAmount(value);
                    }}
                    onBlur={() => {
                      if (betAmount && isStakeValid()) {
                        setBetAmount(Number(betAmount).toFixed(2));
                      }
                    }}
                    placeholder={`Minimum ₦${MINIMUM_STAKE.toLocaleString("en-NG")}`}
                    disabled={walletLoading}
                    className="stake-input"
                  />
                </div>
              </div>

              <div className="quick-bet-section">
                <div className="quick-bet-label">Quick Bets:</div>
                <div className="quick-bet-grid">
                  {[100, 500, 1000, 2000, 5000, 10000].map((v) => (
                    <button 
                      key={v} 
                      onClick={() => setBetAmount(v.toString())}
                      disabled={walletLoading || v > safeBalance}
                      className={`quick-bet-btn ${Number(betAmount) === v ? "active" : ""} ${
                        v > safeBalance ? "insufficient" : ""
                      }`}
                    >
                      ₦{v.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {betAmount && !isStakeValid() && (
                <div className="validation-error">
                  {Number(betAmount) < MINIMUM_STAKE 
                    ? `Minimum stake is ₦${MINIMUM_STAKE.toLocaleString("en-NG")}`
                    : "Insufficient balance"}
                </div>
              )}

              {errorMessage && (
                <div className="error-message">
                  {errorMessage}
                </div>
              )}

              <div className="modal-actions">
                <button 
                  className="primary-action-btn" 
                  onClick={startGame}
                  disabled={walletLoading || !isStakeValid()}
                >
                  {walletLoading ? (
                    <>
                      <span className="btn-spinner"></span>
                      LOADING...
                    </>
                  ) : (
                    "START FISHING"
                  )}
                </button>
                
                <button 
                  className="secondary-action-btn" 
                  onClick={returnToGames}
                  disabled={walletLoading}
                >
                  BACK TO GAMES
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= GAME SCREEN ================= */}
      {!showStakeModal && !showResultModal && (
        <main className="game-content">
          <div className="game-scene">
            <div className="ocean-container">
              <div className={`ocean-scene ${animationStage}`}>
                {/* Water surface with waves */}
                <div className="water-surface">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="wave" style={{
                      left: `${i * 20}%`,
                      animationDelay: `${i * 0.3}s`
                    }}></div>
                  ))}
                </div>
                
                {/* Animated bubbles */}
                <div className="bubbles-container">
                  {[...Array(15)].map((_, i) => (
                    <div key={i} className="bubble" style={{
                      left: `${5 + (i * 6)}%`,
                      animationDelay: `${i * 0.5}s`,
                      width: `${5 + Math.random() * 10}px`,
                      height: `${5 + Math.random() * 10}px`
                    }}></div>
                  ))}
                </div>

                {/* Fishing line */}
                <div 
                  ref={fishingLineRef}
                  className="fishing-line" 
                  style={{ height: "0", opacity: "1" }}
                />
                
                {/* Hook */}
                <div 
                  ref={hookRef}
                  className="fishing-hook"
                  style={{ top: "-25px", opacity: "1", transform: "translateX(-50%)" }}
                >
                  🪝
                </div>

                {/* Catch display */}
                <div 
                  ref={catchRef}
                  className="catch-display-area"
                  style={{ opacity: "0", transform: "translate(-50%, -50%) scale(0)" }}
                >
                  {lastCatch && (
                    <div className="catch-item">
                      <div className="catch-emoji">{lastCatch.emoji}</div>
                      {animationStage === "caught" && (
                        <div className="catch-name">{lastCatch.name}</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Underwater fish */}
                <div className="underwater-life">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="fish" style={{
                      left: `${15 + (i * 25)}%`,
                      top: `${30 + (i * 15)}%`,
                      animationDelay: `${i * 0.7}s`
                    }}>🐟</div>
                  ))}
                </div>
              </div>
            </div>

            <div className="game-controls">
              <button
                className={`cast-action-btn ${animationStage} ${isLoading ? "loading" : ""}`}
                onClick={handleCastLine}
                disabled={isCasting || isLoading || animationStage !== "idle"}
              >
                {isLoading || animationStage !== "idle" ? (
                  <>
                    <span className="cast-spinner"></span>
                    {getCastButtonText()}
                  </>
                ) : (
                  "🎣 CAST LINE"
                )}
              </button>
              
              <div className="control-info">
                <p className="info-text">
                  {animationStage === "idle" && "Ready to catch some fish!"}
                  {animationStage === "casting" && "Line is going deep..."}
                  {animationStage === "waiting" && "Waiting patiently..."}
                  {animationStage === "reeling" && "Almost there!"}
                  {animationStage === "caught" && "Great catch!"}
                </p>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ================= RESULT MODAL ================= */}
      {showResultModal && roundResult && (
        <div className="result-modal-overlay">
          <div className="result-modal-container">
            <div className="result-modal-content">
              <div className="result-header">
                <div className={`result-icon ${roundResult.profit > 0 ? "win" : "lose"}`}>
                  {roundResult.profit > 0 ? "🎉" : "💀"}
                </div>
                <h2 className="result-title">
                  {roundResult.profit > 0 
                    ? roundResult.profit >= Number(betAmount) * 5 
                      ? "HUGE CATCH!" 
                      : "GOOD CATCH!"
                    : "TRAP CAUGHT!"}
                </h2>
              </div>

              <div className="catch-result">
                <div className="catch-emoji-large">
                  {roundResult.catch?.emoji || "💀"}
                </div>
                <h3 className="catch-result-name">
                  {roundResult.catch?.name || "Unknown"}
                </h3>
                {roundResult.catch?.description && (
                  <p className="catch-description">
                    {roundResult.catch.description}
                  </p>
                )}
              </div>

              <div className="result-details-card">
                <div className="detail-row">
                  <span className="detail-label">Your Stake:</span>
                  <span className="detail-value stake">₦{formatMoney(roundResult.bet_amount)}</span>
                </div>
                
                <div className="detail-row">
                  <span className="detail-label">Payout:</span>
                  <span className="detail-value payout">₦{formatMoney(roundResult.win_amount)}</span>
                </div>
                
                <div className="detail-row total-row">
                  <span className="detail-label">Result:</span>
                  <span className={`detail-value total ${roundResult.profit > 0 ? "profit" : "loss"}`}>
                    {roundResult.profit > 0 
                      ? `+₦${formatMoney(roundResult.profit)}`
                      : `-₦${formatMoney(roundResult.bet_amount - roundResult.win_amount)}`}
                  </span>
                </div>
              </div>

              <div className="balance-update-card">
                <div className="balance-update-label">New Balance:</div>
                <div className="balance-update-value">
                  {walletLoading ? (
                    <div className="balance-update-loading">
                      <span className="loading-spinner"></span>
                      Updating...
                    </div>
                  ) : (
                    `₦${formatMoney(getWalletBalance())}`
                  )}
                </div>
              </div>

              <div className="result-actions">
                <button 
                  className="play-again-btn" 
                  onClick={resetGame}
                  disabled={walletLoading}
                >
                  PLAY AGAIN
                </button>
                <button 
                  className="exit-game-btn" 
                  onClick={returnToGames}
                  disabled={walletLoading}
                >
                  EXIT GAME
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Floating Audio Control for Mobile */}
      <button 
        className="floating-audio-control" 
        onClick={toggleMute}
        aria-label={allMuted ? "Unmute all sounds" : "Mute all sounds"}
      >
        {allMuted ? "🔇" : bgMutedOnly ? "🎵" : gameMutedOnly ? "🔊" : "🎣"}
      </button>
    </div>
  );
};

export default FishingGame;