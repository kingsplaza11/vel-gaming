import api from "../services/api";
import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';

const WalletContext = createContext();

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

export const WalletProvider = ({ children, user }) => {
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  /* ======================================================
     NORMALIZE WALLET DATA
  ====================================================== */
  const normalizeWallet = (apiData, prevWallet = {}) => {
    return {
      ...prevWallet,
      balance: parseFloat(apiData.balance) || 0,
      spot_balance: parseFloat(apiData.spot_balance) || 0,
      locked_balance: parseFloat(apiData.locked_balance) || 0,
      total_balance: parseFloat(apiData.total_balance) || 0,
      updated_at: apiData.updated_at || new Date().toISOString(),
      transactions: apiData.transactions || [],
    };
  };

  /* ======================================================
     SILENT WALLET FETCH (BACKGROUND REFRESH)
  ====================================================== */
  const fetchWalletBalanceSilent = useCallback(async () => {
    if (!user) return;

    try {
      const res = await api.get("/wallet/balance/");
      setWallet((prev) => normalizeWallet(res.data, prev));
      setLastUpdated(new Date().toISOString());
    } catch (err) {
      console.warn("Silent wallet refresh failed:", err);
      // Don't set error for silent refreshes
    }
  }, [user]);

  /* ======================================================
     NORMAL WALLET FETCH (MANUAL)
  ====================================================== */
  const fetchWalletBalance = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/wallet/balance/");
      setWallet((prev) => normalizeWallet(res.data, prev));
      setLastUpdated(new Date().toISOString());
    } catch (err) {
      console.error("Wallet fetch failed:", err);
      setError("Failed to load wallet. Please try again.");
      // Keep existing wallet data if available
    } finally {
      setLoading(false);
    }
  };

  /* ======================================================
     INITIAL FETCH ON MOUNT & USER CHANGE
  ====================================================== */
  useEffect(() => {
    if (user) {
      fetchWalletBalance();
    } else {
      // Reset wallet if user logs out
      setWallet(null);
      setError(null);
      setLastUpdated(null);
    }
  }, [user]);

  /* ======================================================
     SETUP PERIODIC REFRESH
  ====================================================== */
  useEffect(() => {
    if (!user) return;

    // Initial silent refresh after 30 seconds
    const initialTimer = setTimeout(() => {
      fetchWalletBalanceSilent();
    }, 30000);

    // Then refresh every 60 seconds
    const interval = setInterval(() => {
      fetchWalletBalanceSilent();
    }, 60000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [user, fetchWalletBalanceSilent]);

  /* ======================================================
     GETTERS FOR COMMON BALANCE VALUES
  ====================================================== */
  const getAvailableBalance = () => {
    if (!wallet) return 0;
    return wallet.total_balance; // This is the sum of balance + spot_balance
  };

  const getSpotBalance = () => {
    if (!wallet) return 0;
    return wallet.spot_balance;
  };

  const getWalletBalance = () => {
    if (!wallet) return 0;
    return wallet.balance;
  };

  const getLockedBalance = () => {
    if (!wallet) return 0;
    return wallet.locked_balance;
  };

  /* ======================================================
     REFRESH FUNCTION FOR EXTERNAL USE
  ====================================================== */
  const refreshWallet = async (silent = false) => {
    if (silent) {
      await fetchWalletBalanceSilent();
    } else {
      await fetchWalletBalance();
    }
  };

  /* ======================================================
     CONTEXT VALUE
  ====================================================== */
  const value = {
    wallet,
    loading,
    error,
    lastUpdated,
    
    // Fetch functions
    fetchWalletBalance,
    refreshWallet,
    
    // Balance getters
    getAvailableBalance, // total available (balance + spot_balance)
    getSpotBalance,
    getWalletBalance,
    getLockedBalance,
    
    // Helper properties for convenience
    availableBalance: wallet ? wallet.total_balance : 0,
    spotBalance: wallet ? wallet.spot_balance : 0,
    walletBalance: wallet ? wallet.balance : 0,
    lockedBalance: wallet ? wallet.locked_balance : 0,
    
    // State setters if needed
    setWallet,
    setLoading,
    setError,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};

// Optional: Export a hook for easy wallet balance access
export const useWalletBalance = () => {
  const { getAvailableBalance, getSpotBalance, getWalletBalance } = useWallet();
  
  return {
    totalAvailable: getAvailableBalance(),
    spotBalance: getSpotBalance(),
    walletBalance: getWalletBalance(),
  };
};