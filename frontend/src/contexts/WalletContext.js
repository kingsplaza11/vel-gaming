// File: src/contexts/WalletContext.js

import React, {
  createContext,
  useState,
  useContext,
  useEffect,
} from "react";

import api from "../services/api"; // ✅ SINGLE axios instance (CSRF + session)

// ======================================================
// CONTEXT
// ======================================================
const WalletContext = createContext();

// ======================================================
// PROVIDER
// ======================================================
export const WalletProvider = ({ children, user }) => {
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]); // ALWAYS ARRAY
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ======================================================
  // HELPERS
  // ======================================================
  const normalizeTransactions = (data) => {
    if (Array.isArray(data)) return data;
    if (data?.results && Array.isArray(data.results)) return data.results;
    if (data?.data && Array.isArray(data.data)) return data.data;
    return [];
  };

  const resetState = () => {
    setWallet(null);
    setTransactions([]);
    setError(null);
    setLoading(false);
  };

  // ======================================================
  // FETCH WALLET BALANCE
  // ======================================================
  const fetchWalletBalance = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const res = await api.get("/wallet/balance/");
      setWallet(res.data || null);
      setError(null);
    } catch (err) {
      console.error("Wallet fetch failed:", err);
      setError("Failed to load wallet");
    } finally {
      setLoading(false);
    }
  };

  // ======================================================
  // FETCH TRANSACTIONS
  // ======================================================
  const fetchTransactions = async () => {
    if (!user) return;

    try {
      const res = await api.get("/wallet/transactions/");
      setTransactions(normalizeTransactions(res.data));
    } catch (err) {
      console.error("Transactions fetch failed:", err);
      setTransactions([]); // HARD FAIL SAFE
    }
  };

  // ======================================================
  // VERIFY FUNDING (PAYSTACK)
  // ======================================================
  const verifyTransaction = async (reference) => {
    if (!reference) {
      return { success: false, message: "Invalid reference" };
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.post("/wallet/verify/", { reference });

      if (res.data?.status) {
        await fetchWalletBalance();
        await fetchTransactions();
        return { success: true };
      }

      return {
        success: false,
        message: res.data?.message || "Verification failed",
      };
    } catch (err) {
      console.error("Verification error:", err);
      setError("Verification failed");
      return { success: false, message: "Verification failed" };
    } finally {
      setLoading(false);
    }
  };

  // ======================================================
  // WITHDRAW FUNDS (PAYSTACK TRANSFER)
  // ======================================================
  const withdrawFunds = async (payload) => {
    setLoading(true);
    setError(null);

    try {
      const res = await api.post("/wallet/withdraw/", payload);

      if (res.data?.status) {
        await fetchWalletBalance();
        await fetchTransactions();
        return { success: true };
      }

      return {
        success: false,
        message: res.data?.message || "Withdrawal failed",
      };
    } catch (err) {
      console.error("Withdrawal error:", err);

      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Withdrawal failed";

      setError(msg);
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  // ======================================================
  // MANUAL REFRESH
  // ======================================================
  const refreshWallet = async () => {
    await fetchWalletBalance();
    await fetchTransactions();
  };

  // ======================================================
  // AUTO LOAD ON LOGIN / LOGOUT
  // ======================================================
  useEffect(() => {
    if (user) {
      fetchWalletBalance();
      fetchTransactions();
    } else {
      resetState();
    }
  }, [user]);

  // ======================================================
  // PROVIDER EXPORT
  // ======================================================
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

// ======================================================
// HOOK
// ======================================================
export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within WalletProvider");
  }
  return context;
};
