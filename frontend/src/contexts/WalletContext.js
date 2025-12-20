// File: src/contexts/WalletContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

// Create the context
const WalletContext = createContext();

// API Base URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Provider component
export const WalletProvider = ({ children, user }) => {
    // State variables
    const [wallet, setWallet] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Get authentication headers
    // In WalletContext.js or axios setup
    axios.defaults.withCredentials = true;  // Send cookies with requests

    const getAuthHeaders = () => {
        return {
            headers: {
                'Content-Type': 'application/json'
                // No Authorization header needed for session auth
            },
            withCredentials: true  // Important for CORS with cookies
        };
    };

    // Fetch wallet balance
    const fetchWalletBalance = async () => {
        if (!user) return;
        
        setLoading(true);
        try {
            const response = await axios.get(
                `${API_BASE_URL}wallet/balance/`,
                getAuthHeaders()
            );
            setWallet(response.data);
            setError(null);
        } catch (err) {
            console.error('Failed to fetch wallet balance:', err);
            setError(err.response?.data?.message || 'Failed to load wallet data');
        } finally {
            setLoading(false);
        }
    };

    // Fetch transactions
    const fetchTransactions = async () => {
        if (!user) return;
        
        try {
            const response = await axios.get(
                `${API_BASE_URL}wallet/transactions/`,
                getAuthHeaders()
            );
            setTransactions(response.data);
        } catch (err) {
            console.error('Failed to fetch transactions:', err);
        }
    };

    // Verify transaction
    const verifyTransaction = async (reference) => {
        setLoading(true);
        try {
            const response = await axios.post(
                `${API_BASE_URL}wallet/verify/`,
                { reference },
                getAuthHeaders()
            );

            if (response.data.status) {
                await fetchWalletBalance();
                await fetchTransactions();
                return { success: true, data: response.data.data };
            } else {
                return { success: false, message: response.data.message };
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Verification failed');
            return { success: false, message: err.message };
        } finally {
            setLoading(false);
        }
    };

    // Withdraw funds
    const withdrawFunds = async (withdrawalData) => {
        setLoading(true);
        setError(null);

        try {
            const response = await axios.post(
                `${API_BASE_URL}wallet/withdraw/`,
                withdrawalData,
                getAuthHeaders()
            );

            if (response.data.status) {
                await fetchWalletBalance();
                await fetchTransactions();
                return { success: true, data: response.data.data };
            } else {
                throw new Error(response.data.message || 'Withdrawal failed');
            }
        } catch (err) {
            setError(err.response?.data?.message || err.message);
            return { success: false, message: err.message };
        } finally {
            setLoading(false);
        }
    };

    // Refresh wallet data
    const refreshWallet = async () => {
        await fetchWalletBalance();
        await fetchTransactions();
    };

    // Fetch data on mount and when user changes
    useEffect(() => {
        if (user) {
            fetchWalletBalance();
            fetchTransactions();
        }
    }, [user]);

    // Context value
    const value = {
        wallet,
        transactions,
        loading,
        error,
        fetchWalletBalance,
        fetchTransactions,
        verifyTransaction,
        withdrawFunds,
        refreshWallet
    };

    return (
        <WalletContext.Provider value={value}>
            {children}
        </WalletContext.Provider>
    );
};

// Custom hook for using the wallet context
export const useWallet = () => {
    const context = useContext(WalletContext);
    
    if (!context) {
        throw new Error('useWallet must be used within a WalletProvider');
    }
    
    return context;
};