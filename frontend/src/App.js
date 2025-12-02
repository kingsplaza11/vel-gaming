import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import SlotsGame from './games/SlotsGame';
import CrashGame from './games/CrashGame';
import FishingGame from './games/FishingGame';
import TreasureHuntGame from './games/TreasureHuntGame';
import DragonArenaGame from './games/DragonArenaGame';
import CryptoMinerGame from './games/CryptoMinerGame';
import SpaceExplorerGame from './games/SpaceExplorerGame';
import PotionBrewingGame from './games/PotionBrewingGame';
import PyramidAdventureGame from './games/PyramidAdventureGame';
import CyberHeistGame from './games/CyberHeistGame';
import Login from './components/Login';
import Register from './components/Register';
import { authService } from './services/api';
import NumberGuessingGame from './games/NumberGuessingGame';
import TowerGame from './games/TowerGame';
import CardMatchingGame from './games/CardMatchingGame';
import MinesweeperGame from './games/MinesweeperGame';
import ColorSwitchGame from './games/ColorSwitchGame';
import ClickerGame from './games/ClickerGame';
import SeoHead from './components/SeoHead';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check authentication status
    const checkAuth = async () => {
      try {
        const response = await authService.getProfile();
        setUser(response.data);
      } catch (error) {
        // 401, 403, network error → not logged in → totally fine
        setUser(null);
      } finally {
        // THIS LINE IS CRITICAL — ALWAYS runs, even if request fails or redirects
        setLoading(false);
      }
    };

    checkAuth();

    // Set SEO & meta tags (only once)
    const setInitialMetaTags = () => {
      // Description
      if (!document.querySelector('meta[name="description"]')) {
        const desc = document.createElement('meta');
        desc.name = 'description';
        desc.content = 'Experience premium crypto gaming at Veltora. Play exciting casino games and win real money in Naira.';
        document.head.appendChild(desc);
      }

      // Viewport
      if (!document.querySelector('meta[name="viewport"]')) {
        const vp = document.createElement('meta');
        vp.name = 'viewport';
        vp.content = 'width=device-width, initial-scale=1, maximum-scale=5';
        document.head.appendChild(vp);
      }

      // Theme color
      if (!document.querySelector('meta[name="theme-color"]')) {
        const tc = document.createElement('meta');
        tc.name = 'theme-color';
        tc.content = '#0a0a0f';
        document.head.appendChild(tc);
      }
    };

    setInitialMetaTags();
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setUser(null);
    }
  };

  // SHOW SPINNER ONLY WHILE CHECKING AUTH
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>VELTORA...</p>
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        <Routes>
          {/* Public Routes */}
          <Route
            path="/login"
            element={
              <>
                <SeoHead page="login" />
                {!user ? <Login onLogin={handleLogin} /> : <Navigate to="/" replace />}
              </>
            }
          />
          <Route
            path="/register"
            element={
              <>
                <SeoHead page="register" />
                {!user ? <Register onLogin={handleLogin} /> : <Navigate to="/" replace />}
              </>
            }
          />

          {/* Protected Routes */}
          <Route
            path="/"
            element={
              <>
                <SeoHead page="dashboard" user={user} />
                {user ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />}
              </>
            }
          />

          {/* All Game Routes — Protected */}
          <Route path="/slots" element={user ? <> <SeoHead page="games" subpage="slots" user={user} /> <SlotsGame user={user} onBalanceUpdate={setUser} /> </> : <Navigate to="/login" replace />} />
          <Route path="/crash" element={user ? <> <SeoHead page="games" subpage="crash" user={user} /> <CrashGame user={user} onBalanceUpdate={setUser} /> </> : <Navigate to="/login" replace />} />
          <Route path="/fishing" element={user ? <> <SeoHead page="games" subpage="fishing" user={user} /> <FishingGame user={user} onBalanceUpdate={setUser} /> </> : <Navigate to="/login" replace />} />
          <Route path="/treasure" element={user ? <> <SeoHead page="games" subpage="treasure" user={user} /> <TreasureHuntGame user={user} onBalanceUpdate={setUser} /> </> : <Navigate to="/login" replace />} />
          <Route path="/dragon" element={user ? <> <SeoHead page="games" subpage="dragon" user={user} /> <DragonArenaGame user={user} onBalanceUpdate={setUser} /> </> : <Navigate to="/login" replace />} />
          <Route path="/miner" element={user ? <> <SeoHead page="games" subpage="miner" user={user} /> <CryptoMinerGame user={user} onBalanceUpdate={setUser} /> </> : <Navigate to="/login" replace />} />
          <Route path="/space" element={user ? <> <SeoHead page="games" subpage="space" user={user} /> <SpaceExplorerGame user={user} onBalanceUpdate={setUser} /> </> : <Navigate to="/login" replace />} />
          <Route path="/potion" element={user ? <> <SeoHead page="games" subpage="potion" user={user} /> <PotionBrewingGame user={user} onBalanceUpdate={setUser} /> </> : <Navigate to="/login" replace />} />
          <Route path="/pyramid" element={user ? <> <SeoHead page="games" subpage="pyramid" user={user} /> <PyramidAdventureGame user={user} onBalanceUpdate={setUser} /> </> : <Navigate to="/login" replace />} />
          <Route path="/heist" element={user ? <> <SeoHead page="games" subpage="heist" user={user} /> <CyberHeistGame user={user} onBalanceUpdate={setUser} /> </> : <Navigate to="/login" replace />} />
          <Route path="/tower" element={user ? <> <SeoHead page="games" subpage="tower" user={user} /> <TowerGame user={user} onBalanceUpdate={setUser} /> </> : <Navigate to="/login" replace />} />
          <Route path="/cards" element={user ? <> <SeoHead page="games" subpage="cards" user={user} /> <CardMatchingGame user={user} onBalanceUpdate={setUser} /> </> : <Navigate to="/login" replace />} />
          <Route path="/clicker" element={user ? <> <SeoHead page="games" subpage="clicker" user={user} /> <ClickerGame user={user} onBalanceUpdate={setUser} /> </> : <Navigate to="/login" replace />} />
          <Route path="/colorswitch" element={user ? <> <SeoHead page="games" subpage="colorswitch" user={user} /> <ColorSwitchGame user={user} onBalanceUpdate={setUser} /> </> : <Navigate to="/login" replace />} />
          <Route path="/guessing" element={user ? <> <SeoHead page="games" subpage="guessing" user={user} /> <NumberGuessingGame user={user} onBalanceUpdate={setUser} /> </> : <Navigate to="/login" replace />} />
          <Route path="/minesweeper" element={user ? <> <SeoHead page="games" subpage="minesweeper" user={user} /> <MinesweeperGame user={user} onBalanceUpdate={setUser} /> </> : <Navigate to="/login" replace />} />

          {/* 404 → Redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;