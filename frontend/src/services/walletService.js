// src/services/walletService.js

import api from "./api";

export const walletService = {
  // Get wallet dashboard data
  getDashboard: () => api.get("/wallet/"),

  // Get wallet balance
  getBalance: () => api.get("/wallet/balance/"),

  // Get transaction history
  getTransactions: () => api.get("/wallet/transactions/"),

  // ============= DEPOSIT METHODS =============
  
  // Get admin banks for deposit (kept for admin panel but not used in user flow)
  getAdminBanks: () => {
    console.log("Fetching admin banks");
    return api.get("/wallet/get_admin_banks/");
  },

  // Create deposit request (bank is randomly selected on backend)
  createDepositRequest: async (data) => {
    console.log("Creating deposit request with data:", data);
    try {
      const response = await api.post("/wallet/create_deposit_request/", {
        amount: data.amount,
        source_bank_name: data.source_bank_name || '',
        source_account_number: data.source_account_number || '',
        source_account_name: data.source_account_name || '',
      });
      
      console.log("Raw API response:", response);
      console.log("Response data:", response.data);
      console.log("Response status:", response.status);
      
      return response;
    } catch (error) {
      console.error("API call error in createDepositRequest:", error);
      console.error("Error response:", error.response);
      console.error("Error data:", error.response?.data);
      throw error;
    }
  },

  // Check deposit status
  checkDepositStatus: (reference) => {
    console.log("Checking deposit status for:", reference);
    return api.get(`/wallet/check_deposit_status/?reference=${reference}`);
  },

  // Mark deposit as paid (user has made transfer)
  markAsPaid: async (data) => {
    console.log("Marking deposit as paid with data:", data);
    try {
      const response = await api.post("/wallet/mark_as_paid/", {
        deposit_request_id: data.deposit_request_id,
        reference: data.reference
      });
      
      console.log("Raw markAsPaid response:", response);
      console.log("markAsPaid response data:", response.data);
      console.log("markAsPaid response status:", response.status);
      
      return response;
    } catch (error) {
      console.error("API call error in markAsPaid:", error);
      console.error("Error config:", error.config);
      console.error("Error response:", error.response);
      console.error("Error data:", error.response?.data);
      console.error("Error status:", error.response?.status);
      console.error("Error headers:", error.response?.headers);
      
      // Re-throw with more context
      throw error;
    }
  },

  // Get user's deposit requests history
  getDepositRequests: () => {
    console.log("Fetching user deposit requests");
    return api.get("/wallet/deposit_requests/");
  },

  // ============= LEGACY DEPOSIT METHODS =============
  
  // Initialize deposit - creates virtual account (legacy)
  initializeDeposit: (amount, email = null) => {
    const payload = { amount: amount };
    if (email) payload.email = email;
    console.log("Sending to backend:", payload);
    return api.post("/wallet/fund/", payload);
  },

  // Check payment status (used for polling) - legacy
  checkPaymentStatus: (reference) => {
    console.log("Checking payment status for:", reference);
    return api.get(`/wallet/check-payment-status/?reference=${reference}`);
  },

  // ============= WITHDRAWAL METHODS =============

  // Resolve bank account details (for withdrawal)
  resolveAccount: (bank_code, account_number) => {
    console.log("Resolving account:", bank_code, account_number);
    return api.get("/wallet/resolve-account/", {
      params: { bank_code, account_number },
    });
  },

  // Process withdrawal request
  withdraw: (payload) => {
    console.log("Processing withdrawal:", payload);
    return api.post("/wallet/withdraw/", {
      amount: payload.amount,
      account_number: payload.account_number,
      bank_code: payload.bank_code,
      bank_name: payload.bank_name,
      account_name: payload.account_name
    });
  },

  // Alias for backward compatibility
  autoWithdraw: (payload) => {
    return walletService.withdraw(payload);
  },

  // ============= WITHDRAWAL REQUEST METHODS =============

  // Get user's withdrawal requests
  getWithdrawalRequests: () => {
    console.log("Fetching user withdrawal requests");
    return api.get("/wallet/withdrawal_requests/");
  },

  // Cancel a withdrawal request (if still pending)
  cancelWithdrawalRequest: (reference) => {
    console.log("Cancelling withdrawal request:", reference);
    return api.post("/wallet/cancel_withdrawal/", { reference });
  },

  // ============= UTILITY METHODS =============

  // Check if user has pending deposit
  checkPendingDeposit: () => {
    console.log("Checking for pending deposits");
    return api.get("/wallet/check_pending/");
  },

  // Expire a pending transaction
  expirePendingTransaction: (reference) => {
    console.log("Expiring pending transaction:", reference);
    return api.post("/wallet/expire_pending/", { reference });
  },

  // Get wallet transaction details by reference
  getTransactionByReference: (reference) => {
    console.log("Getting transaction by reference:", reference);
    return api.get(`/wallet/transactions/?reference=${reference}`);
  }
};

// Export simplified version
export const createDepositRequest = (data) => walletService.createDepositRequest(data);
export const checkDepositStatus = (reference) => walletService.checkDepositStatus(reference);
export const markAsPaid = (data) => walletService.markAsPaid(data);
export const getDepositRequests = () => walletService.getDepositRequests();
export const withdraw = (payload) => walletService.withdraw(payload);
export const resolveAccount = (bank_code, account_number) => walletService.resolveAccount(bank_code, account_number);
export const getBalance = () => walletService.getBalance();
export const getTransactions = () => walletService.getTransactions();

export default walletService;