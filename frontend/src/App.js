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
    checkAuth();
    
    // Set initial meta tags
    const setInitialMetaTags = () => {
      const metaDesc = document.querySelector('meta[name="description"]');
      if (!metaDesc) {
        const desc = document.createElement('meta');
        desc.name = 'description';
        desc.content = 'Experience premium crypto gaming at Veltora. Play exciting casino games and win real money in Naira.';
        document.head.appendChild(desc);
      }
      
      // Add viewport meta tag if not present
      let viewport = document.querySelector('meta[name="viewport"]');
      if (!viewport) {
        viewport = document.createElement('meta');
        viewport.name = 'viewport';
        viewport.content = 'width=device-width, initial-scale=1, maximum-scale=5';
        document.head.appendChild(viewport);
      }
      
      // Add theme-color meta tag
      let themeColor = document.querySelector('meta[name="theme-color"]');
      if (!themeColor) {
        themeColor = document.createElement('meta');
        themeColor.name = 'theme-color';
        themeColor.content = '#0a0a0f';
        document.head.appendChild(themeColor);
      }
    };
    
    setInitialMetaTags();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await authService.getProfile();
      setUser(response.data);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
    }
  };

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
          {/* Login Route */}
          <Route 
            path="/login" 
            element={
              <>
                <SeoHead page="login" />
                {!user ? <Login onLogin={handleLogin} /> : <Navigate to="/" replace />}
              </>
            } 
          />
          
          {/* Register Route */}
          <Route 
            path="/register" 
            element={
              <>
                <SeoHead page="register" />
                {!user ? <Register onLogin={handleLogin} /> : <Navigate to="/" replace />}
              </>
            } 
          />
          
          {/* Dashboard Route */}
          <Route 
            path="/" 
            element={
              <>
                <SeoHead page="dashboard" user={user} />
                {user ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />}
              </>
            } 
          />
          
          {/* Game Routes with Individual SEO */}
          <Route 
            path="/slots" 
            element={
              <>
                <SeoHead page="games" subpage="slots" user={user} />
                {user ? <SlotsGame user={user} onBalanceUpdate={setUser} /> : <Navigate to="/login" replace />}
              </>
            } 
          />
          
          <Route 
            path="/crash" 
            element={
              <>
                <SeoHead page="games" subpage="crash" user={user} />
                {user ? <CrashGame user={user} onBalanceUpdate={setUser} /> : <Navigate to="/login" replace />}
              </>
            } 
          />
          
          <Route 
            path="/fishing" 
            element={
              <>
                <SeoHead page="games" subpage="fishing" user={user} />
                {user ? <FishingGame user={user} onBalanceUpdate={setUser} /> : <Navigate to="/login" replace />}
              </>
            } 
          />
          
          <Route 
            path="/treasure" 
            element={
              <>
                <SeoHead page="games" subpage="treasure" user={user} />
                {user ? <TreasureHuntGame user={user} onBalanceUpdate={setUser} /> : <Navigate to="/login" replace />}
              </>
            } 
          />
          
          <Route 
            path="/dragon" 
            element={
              <>
                <SeoHead page="games" subpage="dragon" user={user} />
                {user ? <DragonArenaGame user={user} onBalanceUpdate={setUser} /> : <Navigate to="/login" replace />}
              </>
            } 
          />
          
          {/* Additional Game Routes */}
          <Route 
            path="/miner" 
            element={
              <>
                <SeoHead page="games" subpage="miner" user={user} />
                {user ? <CryptoMinerGame user={user} onBalanceUpdate={setUser} /> : <Navigate to="/login" replace />}
              </>
            } 
          />
          
          <Route 
            path="/space" 
            element={
              <>
                <SeoHead page="games" subpage="space" user={user} />
                {user ? <SpaceExplorerGame user={user} onBalanceUpdate={setUser} /> : <Navigate to="/login" replace />}
              </>
            } 
          />
          
          <Route 
            path="/potion" 
            element={
              <>
                <SeoHead page="games" subpage="potion" user={user} />
                {user ? <PotionBrewingGame user={user} onBalanceUpdate={setUser} /> : <Navigate to="/login" replace />}
              </>
            } 
          />
          
          <Route 
            path="/pyramid" 
            element={
              <>
                <SeoHead page="games" subpage="pyramid" user={user} />
                {user ? <PyramidAdventureGame user={user} onBalanceUpdate={setUser} /> : <Navigate to="/login" replace />}
              </>
            } 
          />
          
          <Route 
            path="/heist" 
            element={
              <>
                <SeoHead page="games" subpage="heist" user={user} />
                {user ? <CyberHeistGame user={user} onBalanceUpdate={setUser} /> : <Navigate to="/login" replace />}
              </>
            } 
          />
          
          <Route 
            path="/tower" 
            element={
              <>
                <SeoHead page="games" subpage="tower" user={user} />
                {user ? <TowerGame user={user} onBalanceUpdate={setUser} /> : <Navigate to="/login" replace />}
              </>
            } 
          />
          
          <Route 
            path="/cards" 
            element={
              <>
                <SeoHead page="games" subpage="cards" user={user} />
                {user ? <CardMatchingGame user={user} onBalanceUpdate={setUser} /> : <Navigate to="/login" replace />}
              </>
            } 
          />
          
          <Route 
            path="/clicker" 
            element={
              <>
                <SeoHead page="games" subpage="clicker" user={user} />
                {user ? <ClickerGame user={user} onBalanceUpdate={setUser} /> : <Navigate to="/login" replace />}
              </>
            } 
          />
          
          <Route 
            path="/colorswitch" 
            element={
              <>
                <SeoHead page="games" subpage="colorswitch" user={user} />
                {user ? <ColorSwitchGame user={user} onBalanceUpdate={setUser} /> : <Navigate to="/login" replace />}
              </>
            } 
          />
          
          <Route 
            path="/guessing" 
            element={
              <>
                <SeoHead page="games" subpage="guessing" user={user} />
                {user ? <NumberGuessingGame user={user} onBalanceUpdate={setUser} /> : <Navigate to="/login" replace />}
              </>
            } 
          />
          
          <Route 
            path="/minesweeper" 
            element={
              <>
                <SeoHead page="games" subpage="minesweeper" user={user} />
                {user ? <MinesweeperGame user={user} onBalanceUpdate={setUser} /> : <Navigate to="/login" replace />}
              </>
            } 
          />
          
          {/* Catch-all route for 404 */}
          <Route 
            path="*" 
            element={
              <>
                <SeoHead page="404" />
                <Navigate to="/" replace />
              </>
            } 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;