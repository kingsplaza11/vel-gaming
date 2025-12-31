import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useRef,
  useCallback,
} from "react";
import api from "../services/api";

const WalletContext = createContext();

/* ======================================================
   NORMALIZER (CRITICAL)
   Prevents spot_balance from being wiped
====================================================== */
const normalizeWallet = (data, prev = {}) => {
  if (!data) return prev || null;

  const balance = Number(
    data.balance ?? prev?.balance ?? 0
  );

  const spot_balance = Number(
    data.spot_balance ?? prev?.spot_balance ?? 0
  );

  const locked_balance = Number(
    data.locked_balance ?? prev?.locked_balance ?? 0
  );

  return {
    balance,
    spot_balance,
    locked_balance,
    total_balance: balance + spot_balance,
  };
};

export const WalletProvider = ({ children, user }) => {
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const intervalRef = useRef(null);

  /* ======================================================
     HELPERS
  ====================================================== */
  const normalizeTransactions = (data) => {
    if (Array.isArray(data)) return data;
    if (data?.results && Array.isArray(data.results))
      return data.results;
    if (data?.data && Array.isArray(data.data))
      return data.data;
    return [];
  };

  const resetState = () => {
    setWallet(null);
    setTransactions([]);
    setError(null);
    setLoading(false);
  };

  /* ======================================================
     SILENT WALLET FETCH (NO UI LOADING)
  ====================================================== */
  const fetchWalletBalanceSilent = useCallback(async () => {
    if (!user) return;

    try {
      const res = await api.get("/wallet/balance/");
      setWallet((prev) => normalizeWallet(res.data, prev));
    } catch (err) {
      console.warn("Silent wallet refresh failed");
    }
  }, [user]);

  /* ======================================================
     NORMAL WALLET FETCH (MANUAL)
  ====================================================== */
  const fetchWalletBalance = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const res = await api.get("/wallet/balance/");
      setWallet((prev) => normalizeWallet(res.data, prev));
      setError(null);
    } catch (err) {
      console.error("Wallet fetch failed:", err);
      setError("Failed to load wallet");
    } finally {
      setLoading(false);
    }
  };

  /* ======================================================
     FETCH TRANSACTIONS
  ====================================================== */
  const fetchTransactions = async () => {
    if (!user) return;

    try {
      const res = await api.get("/wallet/transactions/");
      setTransactions(normalizeTransactions(res.data));
    } catch (err) {
      console.error("Transactions fetch failed:", err);
      setTransactions([]);
    }
  };

  /* ======================================================
     VERIFY FUNDING
  ====================================================== */
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

  /* ======================================================
     WITHDRAW FUNDS
  ====================================================== */
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

  /* ======================================================
     MANUAL REFRESH (FOR GAMES)
  ====================================================== */
  const refreshWallet = async () => {
    await fetchWalletBalance();
    await fetchTransactions();
  };

  /* ======================================================
     INITIAL LOAD + BACKGROUND POLLING
  ====================================================== */
  useEffect(() => {
    if (!user) {
      resetState();
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    fetchWalletBalance();
    fetchTransactions();

    intervalRef.current = setInterval(() => {
      fetchWalletBalanceSilent();
    }, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user, fetchWalletBalanceSilent]);

  /* ======================================================
     PROVIDER
  ====================================================== */
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

/* ======================================================
   HOOK
====================================================== */
export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within WalletProvider");
  }
  return context;
};
