// src/services/walletService.js

import api from "./api";

export const walletService = {
  // Get wallet dashboard data
  getDashboard: () => api.get("/wallet/"),

  // Get wallet balance
  getBalance: () => api.get("/wallet/balance/"),

  // Get transaction history
  getTransactions: () => api.get("/wallet/transactions/"),

  // Initialize deposit - creates virtual account
  initializeDeposit: (amount, email = null) => {
    const payload = {
      amount: amount,
    };
    
    // Only add email if provided (backend will use user's email as fallback)
    if (email) {
      payload.email = email;
    }
    
    console.log("Sending to backend:", payload);
    return api.post("/wallet/fund/", payload);
  },

  // Check payment status (used for polling)
  checkPaymentStatus: (reference) => {
    console.log("Checking payment status for:", reference);
    return api.get(`/wallet/check-payment-status/?reference=${reference}`);
  },
    
  // Basic manual verification
  manualVerify: (reference) => {
    console.log("Manual verify for:", reference);
    return api.post("/wallet/manual-verify/", { reference });
  },
  
  // Temporary manual verification (credits wallet)
  manualVerifyTemp: (reference) => {
    console.log("Temporary manual verify for:", reference);
    return api.post("/wallet/manual-verify-temp/", { reference });
  },
  
  // Advanced manual verification with OTPay checking
  manualVerifyAdvanced: (reference) => {
    console.log("Advanced manual verify for:", reference);
    return api.post("/wallet/manual-verify-advanced/", { reference });
  },

  // Resolve bank account details
  resolveAccount: (bank_code, account_number) => {
    console.log("Resolving account:", bank_code, account_number);
    return api.get("/wallet/resolve-account/", {
      params: { bank_code, account_number },
    });
  },

  // Process withdrawal
  autoWithdraw: (payload) => {
    console.log("Processing withdrawal:", payload);
    return api.post("/wallet/withdraw/", payload);
  },
};