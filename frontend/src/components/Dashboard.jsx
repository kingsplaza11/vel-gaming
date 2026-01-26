// src/pages/Dashboard.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useLoading } from "../contexts/LoadingContext"; // Use useLoading hook
import "./Dashboard.css";

const Dashboard = () => {
  const navigate = useNavigate();
  const { startGameLoading } = useLoading(); // Use the hook
  const [clickedGame, setClickedGame] = useState(null);

  const games = [
    // ===== FORTUNE SERIES (POPULAR) =====
    {
      id: "fortune_mouse",
      name: "Fortune Mouse",
      path: "/fortune/mouse",
      img: "/images/games/fortune-mouse.png",
      popular: true,
      category: "Fortune Series",
      players: "5.2k",
      multiplier: "1000x",
      loadingAnimation: "fortune"
    },
    {
      id: "fortune_tiger",
      name: "Fortune Tiger",
      path: "/fortune/tiger",
      img: "/images/games/fortune-tiger.png",
      popular: true,
      category: "Fortune Series",
      players: "8.7k",
      multiplier: "5000x",
      loadingAnimation: "fortune"
    },
    {
      id: "fortune_rabbit",
      name: "Fortune Rabbit",
      path: "/fortune/rabbit",
      img: "/images/games/fortune-rabbit.png",
      popular: true,
      category: "Fortune Series",
      players: "4.3k",
      multiplier: "2500x",
      loadingAnimation: "fortune"
    },

    // ===== CORE GAMES =====
    {
      id: "crash",
      name: "Crash",
      path: "/crash",
      img: "/images/games/crash.png",
      popular: false,
      category: "Crash Game",
      players: "9.8k",
      multiplier: "10000x",
      loadingAnimation: "rocket"
    },
    {
      id: "fishing",
      name: "Deep Sea Fishing",
      path: "/fishing",
      img: "/images/games/fishing.jpg",
      popular: false,
      category: "Arcade",
      players: "3.2k",
      multiplier: "200x",
      loadingAnimation: "ocean"
    },
    {
      id: "treasure",
      name: "Treasure Hunt",
      path: "/treasure",
      img: "/images/games/treasure.jpg",
      popular: false,
      category: "Adventure",
      players: "2.7k",
      multiplier: "1000x",
      loadingAnimation: "treasure"
    },
    {
      id: "potion",
      name: "Potion Brewing",
      path: "/potion",
      img: "/images/games/potion.png",
      popular: false,
      category: "Puzzle",
      players: "1.9k",
      multiplier: "500x",
      loadingAnimation: "magic"
    },
    {
      id: "pyramid",
      name: "Pyramid Adventure",
      path: "/pyramid",
      img: "/images/games/pyramid.png",
      popular: false,
      category: "Adventure",
      players: "3.5k",
      multiplier: "750x",
      loadingAnimation: "egypt"
    },
    {
      id: "heist",
      name: "Cyber Heist",
      path: "/heist",
      img: "/images/games/heist.png",
      popular: false,
      category: "Strategy",
      players: "4.1k",
      multiplier: "1500x",
      loadingAnimation: "cyber"
    },
    {
      id: "minesweeper",
      name: "Minesweeper Treasure",
      path: "/minesweeper",
      img: "/images/games/minesweeper.png",
      popular: false,
      category: "Strategy",
      players: "2.8k",
      multiplier: "3000x",
      loadingAnimation: "mine"
    },
    {
      id: "tower",
      name: "Tower Builder",
      path: "/tower",
      img: "/images/games/tower.png",
      popular: false,
      category: "Arcade",
      players: "2.1k",
      multiplier: "400x",
      loadingAnimation: "block"
    },
    {
      id: "cards",
      name: "Card Matcher",
      path: "/cards",
      img: "/images/games/cards.png",
      popular: false,
      category: "Card Game",
      players: "1.6k",
      multiplier: "200x",
      loadingAnimation: "card"
    },
    {
      id: "guessing",
      name: "Number Guesser",
      path: "/guessing",
      img: "/images/games/guessing.png",
      popular: false,
      category: "Prediction",
      players: "3.9k",
      multiplier: "50x",
      loadingAnimation: "number"
    },
    // {
    //   id: "colorswitch",
    //   name: "Color Switch",
    //   path: "/colorswitch",
    //   img: "/images/games/colorswitch.png",
    //   popular: false,
    //   category: "Arcade",
    //   players: "2.4k",
    //   multiplier: "100x",
    //   loadingAnimation: "color"
    // },
  ];

  const popularGames = games.filter((g) => g.popular);
  const allGames = games.filter((g) => !g.popular);

  const handleGameClick = (game) => {
    // Set the clicked game for visual feedback
    setClickedGame(game.id);
    
    // Start the loading animation
    startGameLoading(game);
    
    // Navigate after delay
    setTimeout(() => {
      navigate(game.path);
      // Reset clicked state after navigation
      setTimeout(() => setClickedGame(null), 500);
    }, 5000); // 5 seconds delay
  };

  const GameCard = ({ game, highlight = false }) => (
    <div
      className={`game-card ${highlight ? "popular" : ""} ${clickedGame === game.id ? "clicked" : ""}`}
      onClick={() => handleGameClick(game)}
    >
      <div className="game-card-inner">
        <div className="game-image-container">
          <img src={game.img} alt={game.name} className="game-image" />
          
          {highlight && (
            <div className="popular-badge">
              <div className="badge-glow"></div>
              <Icon icon="mdi:fire" className="badge-icon" />
              <span>TRENDING</span>
            </div>
          )}
          
          <div className="game-play-overlay">
            <div className="play-button">
              <Icon icon="mdi:play" />
            </div>
            <span className="play-text">PLAY NOW</span>
          </div>
          
          <div className="game-stats">
            <div className="stat-item">
              <Icon icon="mdi:account-group" />
              <span>{game.players}</span>
            </div>
            <div className="stat-item">
              <Icon icon="mdi:chart-line" />
              <span>{game.multiplier}</span>
            </div>
          </div>
        </div>

        <div className="game-content">
          <h3 className="game-name">{game.name}</h3>
        </div>
        
        <div className="game-glow"></div>
        <div className="card-shine"></div>
      </div>
    </div>
  );

  return (
    <div className="dashboard-content">
      {/* ================= SLOTS FLOATING BUTTON ================= */}
      <button 
        className="slots-floating-btn"
        onClick={() => handleGameClick({
          id: "slots",
          name: "Golden Slots",
          path: "/slots",
          loadingAnimation: "slot"
        })}
        aria-label="Play Golden Slots"
      >
        <div className="slots-btn-glow"></div>
        <div className="slots-btn-inner">
          <Icon icon="mdi:slot-machine" className="slots-icon" />
          <div className="slots-text">
            <span className="slots-title">Golden Slots</span>
            <span className="slots-subtitle">Spin & Win</span>
          </div>
        </div>
      </button>

      {/* ================= POPULAR GAMES ================= */}
      <div className="games-section">
        <div className="section-header">
          <div className="section-title">
            <Icon icon="mdi:fire" className="title-icon" />
            <h2>Trending Games</h2>
            <div className="title-glow"></div>
          </div>
          <p className="section-subtitle">Most played games right now</p>
        </div>

        <div className="games-grid popular-grid">
          {popularGames.map((game) => (
            <GameCard key={game.id} game={game} highlight />
          ))}
        </div>
      </div>

      {/* ================= ALL GAMES ================= */}
      <div className="games-section">
        <div className="section-header">
          <div className="section-title">
            <Icon icon="mdi:gamepad-variant" className="title-icon" />
            <h2>All Games</h2>
            <div className="title-glow"></div>
          </div>
          <p className="section-subtitle">Explore the full gaming experience</p>
        </div>

        <div className="games-grid">
          {allGames.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;