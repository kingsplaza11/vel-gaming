// src/App.js
import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

/* =========================
   LAYOUT
========================= */
import BaseLayout from "./components/BaseLayout";

/* =========================
   CORE PAGES
========================= */
import Dashboard from "./components/Dashboard";
import Login from "./components/Login";
import Register from "./components/Register";
import Profile from "./components/Profile";
import SeoHead from "./components/SeoHead";

/* =========================
   WALLET
========================= */
import WalletDashboard from "./components/Wallet/WalletDashboard";
import { WalletProvider } from "./contexts/WalletContext";

/* =========================
   STANDARD GAMES (NO BASE)
========================= */
import SlotsGame from "./games/SlotsGame";
import { CrashGame } from "./games";
import FishingGame from "./games/FishingGame";
import TreasureHuntGame from "./games/TreasureHuntGame";
import DragonArenaGame from "./games/DragonArenaGame";
import PotionBrewingGame from "./games/PotionBrewingGame";
import PyramidAdventureGame from "./games/PyramidAdventureGame";
import CyberHeistGame from "./games/CyberHeistGame";
import NumberGuessingGame from "./games/NumberGuessingGame";
import TowerGame from "./games/TowerGame";
import CardMatchingGame from "./games/CardMatchingGame";
import MinesweeperGame from "./games/MinesweeperGame";
import ColorSwitchGame from "./games/ColorSwitchGame";

/* =========================
   FORTUNE GAMES (NO BASE)
========================= */
import FortuneStart from "./games/fortune/FortuneStart";
import FortuneMouse from "./games/fortune/FortuneMouse";
import FortuneTiger from "./games/fortune/FortuneTiger";
import FortuneRabbit from "./games/fortune/FortuneRabbit";

/* =========================
   SERVICES
========================= */
import { authService } from "./services/api";

/* =========================
   STYLES
========================= */
import "./App.css";

/* =========================
   PROTECTED ROUTE
========================= */
const ProtectedRoute = ({ user, children }) => {
  if (user === undefined) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  /*
    user === undefined → checking auth
    user === null      → logged out
    user === object    → logged in
  */
  const [user, setUser] = useState(undefined);
  const [loading, setLoading] = useState(true);

  /* =========================
     AUTH HYDRATION (ONCE)
  ========================= */
  useEffect(() => {
    let mounted = true;

    const hydrateAuth = async () => {
      try {
        const res = await authService.getProfile();
        if (mounted) setUser(res?.data || null);
      } catch {
        if (mounted) setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    hydrateAuth();

    return () => {
      mounted = false;
    };
  }, []);

  /* =========================
     AUTH HANDLERS
  ========================= */
  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setUser(null);
    }
  };

  /* =========================
     GLOBAL BOOT LOADER
  ========================= */
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>VELTORA</p>
      </div>
    );
  }

  return (
    <WalletProvider user={user}>
      <Router>
        <Routes>

          {/* =========================
             AUTH ROUTES (NO BASE)
          ========================= */}
          <Route
            path="/login"
            element={
              <>
                <SeoHead page="login" />
                {!user ? (
                  <Login onLogin={handleLogin} />
                ) : (
                  <Navigate to="/" replace />
                )}
              </>
            }
          />

          <Route
            path="/register"
            element={
              <>
                <SeoHead page="register" />
                {!user ? (
                  <Register onLogin={handleLogin} />
                ) : (
                  <Navigate to="/" replace />
                )}
              </>
            }
          />

          {/* =========================
             BASE LAYOUT ROUTES
             (DASHBOARD / WALLET / PROFILE)
          ========================= */}
          <Route
            element={
              <ProtectedRoute user={user}>
                <BaseLayout user={user} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          >
            <Route
              path="/"
              element={
                <>
                  <SeoHead page="dashboard" user={user} />
                  <Dashboard />
                </>
              }
            />

            <Route
              path="/wallet"
              element={
                <>
                  <SeoHead page="wallet" user={user} />
                  <WalletDashboard />
                </>
              }
            />

            <Route
              path="/profile"
              element={
                <>
                  <SeoHead page="profile" user={user} />
                  <Profile />
                </>
              }
            />
          </Route>

          {/* =========================
             STANDARD GAMES (NO BASE)
          ========================= */}
          <Route path="/slots" element={<ProtectedRoute user={user}><SlotsGame /></ProtectedRoute>} />
          <Route path="/crash" element={<ProtectedRoute user={user}><CrashGame /></ProtectedRoute>} />
          <Route path="/fishing" element={<ProtectedRoute user={user}><FishingGame /></ProtectedRoute>} />
          <Route path="/treasure" element={<ProtectedRoute user={user}><TreasureHuntGame /></ProtectedRoute>} />
          <Route path="/dragon" element={<ProtectedRoute user={user}><DragonArenaGame /></ProtectedRoute>} />
          <Route path="/potion" element={<ProtectedRoute user={user}><PotionBrewingGame /></ProtectedRoute>} />
          <Route path="/pyramid" element={<ProtectedRoute user={user}><PyramidAdventureGame /></ProtectedRoute>} />
          <Route path="/heist" element={<ProtectedRoute user={user}><CyberHeistGame /></ProtectedRoute>} />
          <Route path="/tower" element={<ProtectedRoute user={user}><TowerGame /></ProtectedRoute>} />
          <Route path="/cards" element={<ProtectedRoute user={user}><CardMatchingGame /></ProtectedRoute>} />
          <Route path="/colorswitch" element={<ProtectedRoute user={user}><ColorSwitchGame /></ProtectedRoute>} />
          <Route path="/guessing" element={<ProtectedRoute user={user}><NumberGuessingGame /></ProtectedRoute>} />
          <Route path="/minesweeper" element={<ProtectedRoute user={user}><MinesweeperGame /></ProtectedRoute>} />

          {/* =========================
             FORTUNE GAMES (NO BASE)
          ========================= */}
          <Route path="/fortune" element={<ProtectedRoute user={user}><FortuneStart /></ProtectedRoute>} />
          <Route path="/fortune/mouse" element={<ProtectedRoute user={user}><FortuneMouse /></ProtectedRoute>} />
          <Route path="/fortune/tiger" element={<ProtectedRoute user={user}><FortuneTiger /></ProtectedRoute>} />
          <Route path="/fortune/rabbit" element={<ProtectedRoute user={user}><FortuneRabbit /></ProtectedRoute>} />

          {/* =========================
             FALLBACK
          ========================= */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </Router>
    </WalletProvider>
  );
}

export default App;
