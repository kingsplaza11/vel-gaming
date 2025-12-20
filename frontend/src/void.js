// src/App.js
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

// Your existing pages
import Dashboard from "./components/Dashboard";

// Existing games (examples - keep yours)
import SlotsGame from "./games/SlotsGame";
import CrashGame from "./games/crash/CrashGame";
import FishingGame from "./games/FishingGame";
import TreasureHuntGame from "./games/TreasureHuntGame";
import DragonArenaGame from "./games/DragonArenaGame";
import CryptoMinerGame from "./games/CryptoMinerGame";
import SpaceExplorerGame from "./games/SpaceExplorerGame";
import PotionBrewingGame from "./games/PotionBrewingGame";
import PyramidAdventureGame from "./games/PyramidAdventureGame";
import CyberHeistGame from "./games/CyberHeistGame";
import MinesweeperGame from "./games/MinesweeperGame";
import TowerGame from "./games/TowerGame";
import CardMatcherGame from "./games/CardMatchingGame";
import NumberGuessingGame from "./games/NumberGuessingGame";
import ClickerGame from "./games/ClickerGame";
import ColorSwitchGame from "./games/ColorSwitchGame";
import Login from './components/Login';
import Register from './components/Register';
import { authService } from './services/api';
// ✅ Fortune games (NEW)
import FortuneStart from "./games/fortune/FortuneStart";
import FortuneMouse from "./games/fortune/FortuneMouse";
import FortuneTiger from "./games/fortune/FortuneTiger";
import FortuneRabbit from "./games/fortune/FortuneRabbit";

// Example ProtectedRoute (use your existing one if you already have it)
const ProtectedRoute = ({ user, children }) => {
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

export default function App({ user, onLogout, onBalanceUpdate }) {
  return (
    <Router>
      <Routes>
        {/* Dashboard */}
        <Route
          path="/"
          element={
            <ProtectedRoute user={user}>
              <Dashboard user={user} onLogout={onLogout} />
            </ProtectedRoute>
          }
        />

        {/* Existing games */}
        <Route path="/slots" element={<ProtectedRoute user={user}><SlotsGame user={user} onBalanceUpdate={onBalanceUpdate} /></ProtectedRoute>} />
        <Route path="/crash" element={<ProtectedRoute user={user}><CrashGame user={user} onBalanceUpdate={onBalanceUpdate} /></ProtectedRoute>} />
        <Route path="/fishing" element={<ProtectedRoute user={user}><FishingGame user={user} onBalanceUpdate={onBalanceUpdate} /></ProtectedRoute>} />
        <Route path="/treasure" element={<ProtectedRoute user={user}><TreasureHuntGame user={user} onBalanceUpdate={onBalanceUpdate} /></ProtectedRoute>} />
        <Route path="/dragon" element={<ProtectedRoute user={user}><DragonArenaGame user={user} onBalanceUpdate={onBalanceUpdate} /></ProtectedRoute>} />
        <Route path="/miner" element={<ProtectedRoute user={user}><CryptoMinerGame user={user} onBalanceUpdate={onBalanceUpdate} /></ProtectedRoute>} />
        <Route path="/space" element={<ProtectedRoute user={user}><SpaceExplorerGame user={user} onBalanceUpdate={onBalanceUpdate} /></ProtectedRoute>} />
        <Route path="/potion" element={<ProtectedRoute user={user}><PotionBrewingGame user={user} onBalanceUpdate={onBalanceUpdate} /></ProtectedRoute>} />
        <Route path="/pyramid" element={<ProtectedRoute user={user}><PyramidAdventureGame user={user} onBalanceUpdate={onBalanceUpdate} /></ProtectedRoute>} />
        <Route path="/heist" element={<ProtectedRoute user={user}><CyberHeistGame user={user} onBalanceUpdate={onBalanceUpdate} /></ProtectedRoute>} />
        <Route path="/minesweeper" element={<ProtectedRoute user={user}><MinesweeperGame user={user} onBalanceUpdate={onBalanceUpdate} /></ProtectedRoute>} />
        <Route path="/tower" element={<ProtectedRoute user={user}><TowerGame user={user} onBalanceUpdate={onBalanceUpdate} /></ProtectedRoute>} />
        <Route path="/cards" element={<ProtectedRoute user={user}><CardMatcherGame user={user} onBalanceUpdate={onBalanceUpdate} /></ProtectedRoute>} />
        <Route path="/guessing" element={<ProtectedRoute user={user}><NumberGuessingGame user={user} onBalanceUpdate={onBalanceUpdate} /></ProtectedRoute>} />
        <Route path="/clicker" element={<ProtectedRoute user={user}><ClickerGame user={user} onBalanceUpdate={onBalanceUpdate} /></ProtectedRoute>} />
        <Route path="/colorswitch" element={<ProtectedRoute user={user}><ColorSwitchGame user={user} onBalanceUpdate={onBalanceUpdate} /></ProtectedRoute>} />

        {/* ✅ Fortune Launcher + Fortune Games */}
        <Route
          path="/fortune"
          element={
            <ProtectedRoute user={user}>
              <FortuneStart user={user} onBalanceUpdate={onBalanceUpdate} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/fortune/mouse"
          element={
            <ProtectedRoute user={user}>
              <FortuneMouse />
            </ProtectedRoute>
          }
        />

        <Route
          path="/fortune/tiger"
          element={
            <ProtectedRoute user={user}>
              <FortuneTiger />
            </ProtectedRoute>
          }
        />

        <Route
          path="/fortune/rabbit"
          element={
            <ProtectedRoute user={user}>
              <FortuneRabbit />
            </ProtectedRoute>
          }
        />

        {/* fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
