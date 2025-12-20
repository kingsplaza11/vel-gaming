import api from "./api";

export const walletService = {
  getDashboard: () => api.get("/wallet/"),

  initializeDeposit: (amount) =>
    api.post("/wallet/deposit/initialize/", { amount }),

  verifyDeposit: (reference) =>
    api.get(`/wallet/deposit/verify/?reference=${reference}`),

  resolveAccount: (bank_code, account_number) =>
    api.get("/wallet/resolve-account/", {
      params: { bank_code, account_number },
    }),

  autoWithdraw: (payload) =>
    api.post("/wallet/withdraw/auto/", payload),
};
