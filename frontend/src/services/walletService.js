import api from "./api";

export const walletService = {
  getDashboard: () => api.get("/wallet/"),

  initializeDeposit: (amount, email = null) => {
    return api.post("/wallet/fund/", {
      amount,
      email, // optional – backend falls back to request.user.email
      metadata: {
        source: "web_app",
        platform: "Veltro Games",
      },
    });
  },

  verifyDeposit: (reference) =>
    api.get(`/wallet/verify/?reference=${reference}`),

  resolveAccount: (bank_code, account_number) =>
    api.get("/wallet/resolve-account/", {
      params: { bank_code, account_number },
    }),

  autoWithdraw: (payload) =>
    api.post("/wallet/withdraw/", payload),
};
