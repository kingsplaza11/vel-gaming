import axios from "axios";

/* ======================================================
   API BASE URL (HARD FAIL SAFE)
====================================================== */
const API_BASE =
  process.env.REACT_APP_API_URL?.replace(/\/+$/, "") ||
  "https://veltoragames.com/api";

/* ======================================================
   AXIOS INSTANCE
====================================================== */
const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

/* ======================================================
   COOKIE HELPER
====================================================== */
function getCookie(name) {
  if (!document.cookie) return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(name + "="));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

/* ======================================================
   REQUEST INTERCEPTOR (CSRF)
====================================================== */
api.interceptors.request.use(
  (config) => {
    const csrfToken = getCookie("csrftoken");
    if (csrfToken) {
      config.headers["X-CSRFToken"] = csrfToken;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/* ======================================================
   🤝 REFERRALS
====================================================== */
export const referralService = {
  getDashboard: () =>
    api.get("/accounts/referral_dashboard/"),

  getLink: () =>
    api.get("/accounts/referral_dashboard/", {
      skipAuthRedirect: true,
    }),
};


/* ======================================================
   RESPONSE INTERCEPTOR (AUTH SAFE)
====================================================== */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const path = window.location.pathname;

    if (error.config?.skipAuthRedirect) {
      return Promise.reject(error);
    }

    const isGameRoute =
      path.startsWith("/fortune") ||
      path.startsWith("/slots") ||
      path.startsWith("/crash") ||
      path.startsWith("/games");

    if (status === 401 && !isGameRoute && !path.includes("/login")) {
      window.location.replace("/login");
    }

    return Promise.reject(error);
  }
);

/* ======================================================
   CSRF BOOTSTRAP
====================================================== */
let csrfReady = false;

async function ensureCSRF() {
  if (csrfReady) return;

  await api.get("/accounts/csrf/", {
    skipAuthRedirect: true,
  });

  csrfReady = true;
}

/* ======================================================
   AUTH SERVICE
====================================================== */
export const authService = {
  login: async (credentials) => {
    await ensureCSRF();
    return api.post("/accounts/login/", credentials);
  },

  register: async (data) => {
    await ensureCSRF();
    return api.post("/accounts/register/", data);
  },

  logout: async () => {
    await ensureCSRF();
    return api.post("/accounts/logout/");
  },

  getProfile: () =>
    api.get("/accounts/profile/", {
      skipAuthRedirect: true,
    }),
};

/* ======================================================
   WALLET / TRANSACTIONS
====================================================== */
export const walletService = {
  getTransactions: () =>
    api.get("/wallet/transactions/"),

  getBalance: () =>
    api.get("/wallet/balance/", {
      skipAuthRedirect: true,
    }),
};

/* ======================================================
   SETTINGS
====================================================== */
export const settingsService = {
  updateProfile: (data) =>
    api.post("/accounts/update-profile/", {
      username: data.username,
      email: data.email,
    }),

  changePassword: (data) =>
    api.post("/accounts/change-password/", {
      old_password: data.old_password,
      new_password: data.new_password,
    }),
};

/* ======================================================
   SUPPORT
====================================================== */
export const supportService = {
  submitTicket: (data) =>
    api.post("/accounts/ticket/", {
      message: data.message,
    }),
};

/* ======================================================
   FORTUNE
====================================================== */
export const fortuneService = {
  startSession: (data) =>
    api.post("/fortune/start/", data),

  getSession: (id) =>
    api.get(`/fortune/session/${id}/`, {
      skipAuthRedirect: true,
    }),

  cashOut: (id) =>
    api.post(`/fortune/session/${id}/cashout/`),
};

/* ======================================================
   SLOTS
====================================================== */
export const slotsService = {
  spin: (data) =>
    api.post("/slots/spin/", {
      ...data,
      grid_size: "3x4",
    }),

  getStats: () => api.get("/slots/stats/"),
  getHistory: () => api.get("/slots/history/"),
};

/* ======================================================
   CRASH
====================================================== */
export const crashService = {
  placeBet: (data) =>
    api.post("/crash/place-bet/", data),

  cashOut: (data) =>
    api.post("/crash/cash-out/", data),

  getStats: () => api.get("/crash/stats/"),
};

/* ======================================================
   GENERIC GAME SERVICES
====================================================== */
export const fishingService = {
  castLine: (data) => api.post("/fishing/cast-line/", data),
};

export const treasureService = {
  startHunt: (data) => api.post("/treasure/start-hunt/", data),
};

export const dragonService = {
  startBattle: (data) => api.post("/dragon/start-battle/", data),
};

export const potionService = {
  brewPotion: (data) => api.post("/potion/brew-potion/", data),
};

export const pyramidService = {
  explorePyramid: (data) => api.post("/pyramid/explore-pyramid/", data),
};

export const heistService = {
  startHeist: (data) => api.post("/heist/start-heist/", data),
};

export const minesweeperService = {
  startGame: (data) => api.post("/minesweeper/start/", data),
};

export const towerService = {
  startGame: (data) => api.post("/tower/start/", data),
};

export const cardService = {
  startGame: (data) => api.post("/cards/start-game/", data),
};

export const guessingService = {
  startGame: (data) => api.post("/guessing/start/", data),
};

export const colorSwitchService = {
  startGame: (data) => api.post("/colorswitch/start/", data),
};

export default api;
