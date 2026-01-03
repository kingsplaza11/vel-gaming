import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

/* =========================
   LAYOUT
========================= */
import BaseLayout from "./components/BaseLayout";

/* =========================
   CORE PAGES
========================= */
import Dashboard from "./components/Dashboard";
import Login from "./components/Login";
import PasswordReset from './components/PasswordReset';
import PasswordResetConfirm from './components/PasswordResetConfirm';
import Register from "./components/Register";
import Profile from "./components/Profile";
import SeoHead from "./components/SeoHead";
import Referral from "./components/Referral";
import PaymentCallback from "./components/Payment/PaymentCallback";
/* =========================
   EXTRA PAGES
========================= */
import Transactions from "./components/Wallet/Transactions";
import Support from "./components/Support";
import Settings from "./components/Settings";

/* =========================
   WALLET
========================= */
import WalletDashboard from "./components/Wallet/WalletDashboard";
import { WalletProvider } from "./contexts/WalletContext";

/* =========================
   GAMES
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
   FORTUNE GAMES
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
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return children;
};

function App() {
  const [user, setUser] = useState(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const hydrate = async () => {
      try {
        const res = await authService.getProfile();
        if (mounted) setUser(res?.data || null);
      } catch {
        if (mounted) setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    hydrate();
    return () => (mounted = false);
  }, []);

  const handleLogin = (data) => setUser(data);

  const handleLogout = async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
    }
  };
  

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

          {/* AUTH */}
          <Route path="/login" element={!user ? <Login onLogin={handleLogin} /> : <Navigate to="/" />} />
          <Route path="/register" element={!user ? <Register onLogin={handleLogin} /> : <Navigate to="/" />} />
          <Route path="/password-reset" element={<PasswordReset />} />
          <Route path="/password-reset-confirm/:uid/:token" element={<PasswordResetConfirm />} />

          {/* BASE */}
          <Route
            element={
              <ProtectedRoute user={user}>
                <BaseLayout user={user} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/wallet" element={<WalletDashboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/support" element={<Support />} />
            <Route path="/settings" element={<Settings user={user} />} />
            <Route path="/referrals" element={<Referral />} />
            <Route path="/payment/callback" element={<PaymentCallback />} />

          </Route>

          {/* GAMES */}
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

          {/* FORTUNE */}
          <Route path="/fortune" element={<ProtectedRoute user={user}><FortuneStart /></ProtectedRoute>} />
          <Route path="/fortune/mouse" element={<ProtectedRoute user={user}><FortuneMouse /></ProtectedRoute>} />
          <Route path="/fortune/tiger" element={<ProtectedRoute user={user}><FortuneTiger /></ProtectedRoute>} />
          <Route path="/fortune/rabbit" element={<ProtectedRoute user={user}><FortuneRabbit /></ProtectedRoute>} />

        </Routes>
      </Router>
    </WalletProvider>
  );
}

export default App;
