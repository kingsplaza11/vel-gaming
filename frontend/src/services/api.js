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

// Example API service structure - make sure it looks like this
export const minesweeperService = {
  start: async (data) => {
    console.log("API Request to /minesweeper/start/:", data);
    try {
      const response = await api.post('/minesweeper/start/', data);
      console.log("API Response:", response.data);
      return response;
    } catch (error) {
      console.error("API Error:", error);
      throw error;
    }
  },
  reveal: async (data) => {
    console.log("API Request to /minesweeper/reveal/:", data);
    return api.post('/minesweeper/reveal/', data);
  },
  cashout: async (data) => {
    console.log("API Request to /minesweeper/cashout/:", data);
    return api.post('/minesweeper/cashout/', data);
  }
};

// Tower Builder Service - FIXED NAMES
export const towerService = {
  startTower: (data) => api.post('/tower/start/', data),
  buildLevel: (data) => api.post('/tower/build/', data),
  cashOut: (data) => api.post('/tower/cashout/', data),
  // Add these for stats if needed
  getStats: () => api.get('/tower/stats/'),
  getHistory: () => api.get('/tower/history/'),
};

export const cardService = {
  // Start a new card game
  startGame: async (data) => {
    console.log("API Request to /cards/start-game/:", data);
    try {
      const response = await api.post('/cards/start-game/', data);
      console.log("API Response:", response.data);
      return response;
    } catch (error) {
      console.error("Start Game API Error:", error);
      throw error;
    }
  },

  // Reveal a card - Make sure this matches what you're calling
  revealCard: async (data) => {  // This is the function name you're calling
    console.log("API Request to /cards/reveal-card/:", data);
    try {
      const response = await api.post('/cards/reveal-card/', data);
      console.log("API Response:", response.data);
      return response;
    } catch (error) {
      console.error("Reveal Card API Error:", error);
      throw error;
    }
  },

  // Cash out early - Make sure this matches what you're calling
  cashOut: async (data) => {  // This is the function name you're calling
    console.log("API Request to /cards/cash-out/:", data);
    try {
      const response = await api.post('/cards/cash-out/', data);
      console.log("API Response:", response.data);
      return response;
    } catch (error) {
      console.error("Cash Out API Error:", error);
      throw error;
    }
  },

  // Get stats
  getStats: async () => {
    console.log("API Request to /cards/stats/");
    try {
      const response = await api.get('/cards/stats/');
      console.log("API Response:", response.data);
      return response;
    } catch (error) {
      console.error("Stats API Error:", error);
      throw error;
    }
  },

  // Get game history
  getHistory: async () => {
    console.log("API Request to /cards/history/");
    try {
      const response = await api.get('/cards/history/');
      console.log("API Response:", response.data);
      return response;
    } catch (error) {
      console.error("History API Error:", error);
      throw error;
    }
  },
};

// services/api.js
export const guessingService = {
  startGame: (data) => api.post("/guessing/start/", data),
  makeGuess: (data) => api.post("/guessing/guess/", data),
  getHint: (data) => api.post("/guessing/hint/", data),
  getStats: () => api.get("/guessing/stats/"),
  getHistory: () => api.get("/guessing/history/"),
};

export const colorSwitchService = {
  startGame: async (data) => {
    console.log("API Request to /colorswitch/start/:", data);
    try {
      const response = await api.post('/colorswitch/start/', data);
      console.log("API Response:", response.data);
      return response;
    } catch (error) {
      console.error("API Error:", error);
      throw error;
    }
  },
  
  submitSequence: async (data) => {
    console.log("API Request to /colorswitch/submit/:", data);
    try {
      const response = await api.post('/colorswitch/submit/', data);
      console.log("API Response:", response.data);
      return response;
    } catch (error) {
      console.error("API Error:", error);
      throw error;
    }
  },
  
  cashOut: async (data) => {
    console.log("API Request to /colorswitch/cashout/:", data);
    try {
      const response = await api.post('/colorswitch/cashout/', data);
      console.log("API Response:", response.data);
      return response;
    } catch (error) {
      console.error("API Error:", error);
      throw error;
    }
  },
  
  getStats: async () => {
    console.log("API Request to /colorswitch/stats/");
    try {
      const response = await api.get('/colorswitch/stats/');
      console.log("API Response:", response.data);
      return response;
    } catch (error) {
      console.error("API Error:", error);
      throw error;
    }
  },
  
  getHistory: async () => {
    console.log("API Request to /colorswitch/history/");
    try {
      const response = await api.get('/colorswitch/history/');
      console.log("API Response:", response.data);
      return response;
    } catch (error) {
      console.error("API Error:", error);
      throw error;
    }
  }
};

export default api;
