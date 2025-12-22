// File: src/contexts/WalletContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

// Create the context
const WalletContext = createContext();

// API Base URL
const API_BASE_URL =
  process.env.REACT_APP_API_URL?.replace(/\/+$/, '') ||
  'http://localhost:8001/api';

// Provider component
export const WalletProvider = ({ children, user }) => {
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]); // ALWAYS ARRAY
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  axios.defaults.withCredentials = true;

  const getAuthHeaders = () => ({
    headers: {
      'Content-Type': 'application/json',
    },
    withCredentials: true,
  });

  /* =========================
     NORMALIZE TRANSACTIONS
  ========================= */
  const normalizeTransactions = (data) => {
    if (Array.isArray(data)) return data;
    if (data?.results && Array.isArray(data.results)) return data.results;
    if (data?.data && Array.isArray(data.data)) return data.data;
    return [];
  };

  /* =========================
     FETCH WALLET
  ========================= */
  const fetchWalletBalance = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const res = await axios.get(
        `${API_BASE_URL}/wallet/balance/`,
        getAuthHeaders()
      );
      setWallet(res.data || null);
      setError(null);
    } catch (err) {
      console.error('Wallet fetch failed:', err);
      setError('Failed to load wallet');
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     FETCH TRANSACTIONS
  ========================= */
  const fetchTransactions = async () => {
    if (!user) return;

    try {
      const res = await axios.get(
        `${API_BASE_URL}/wallet/transactions/`,
        getAuthHeaders()
      );

      const safeTxs = normalizeTransactions(res.data);
      setTransactions(safeTxs);
    } catch (err) {
      console.error('Transactions fetch failed:', err);
      setTransactions([]); // HARD FAIL SAFE
    }
  };

  /* =========================
     VERIFY TRANSACTION
  ========================= */
  const verifyTransaction = async (reference) => {
    setLoading(true);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/wallet/verify/`,
        { reference },
        getAuthHeaders()
      );

      if (res.data?.status) {
        await fetchWalletBalance();
        await fetchTransactions();
        return { success: true };
      }
      return { success: false, message: res.data?.message };
    } catch (err) {
      setError('Verification failed');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     WITHDRAW
  ========================= */
  const withdrawFunds = async (payload) => {
    setLoading(true);
    setError(null);

    try {
      const res = await axios.post(
        `${API_BASE_URL}/wallet/withdraw/`,
        payload,
        getAuthHeaders()
      );

      if (res.data?.status) {
        await fetchWalletBalance();
        await fetchTransactions();
        return { success: true };
      }
      return { success: false, message: res.data?.message };
    } catch (err) {
      setError(err.response?.data?.message || 'Withdrawal failed');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const refreshWallet = async () => {
    await fetchWalletBalance();
    await fetchTransactions();
  };

  useEffect(() => {
    if (user) {
      fetchWalletBalance();
      fetchTransactions();
    } else {
      setWallet(null);
      setTransactions([]);
    }
  }, [user]);

  return (
    <WalletContext.Provider
      value={{
        wallet,
        transactions,
        loading,
        error,
        refreshWallet,
        verifyTransaction,
        withdrawFunds,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return ctx;
};
