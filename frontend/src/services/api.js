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
   UNIFORM AUTH SERVICE
====================================================== */
export const authService = {
  // Authentication
  login: async (credentials) => {
    return api.post('/accounts/login/', credentials);
  },

  register: async (data) => {
    return api.post('/accounts/register/', data);
  },

  logout: async () => {
    return api.post('/accounts/logout/');
  },

  // Password Reset
  requestPasswordReset: async (email) => {
    return api.post('/accounts/password/reset/', { email });
  },

  resetPasswordConfirm: async (uid, token, new_password1, new_password2) => {
    return api.post('/accounts/password/reset/confirm/', {
      uid,
      token,
      new_password1,
      new_password2,
    });
  },

  // Profile
  getProfile: async () => {
    return api.get('/accounts/profile/', {
      skipAuthRedirect: true,
    });
  },

  updateProfile: async (data) => {
    return api.patch('/accounts/profile/', data);
  },

  // CSRF Token
  getCSRFToken: async () => {
    return api.get('/accounts/csrf/', { skipCSRF: true });
  },
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
   SLOTS
====================================================== */
export const slotsService = {
  spin: (data) => api.post('/slots/spin/', data),
  getStats: () => api.get('/slots/stats/'),
  getHistory: () => api.get('/slots/history/'),
  getInfo: () => api.get('/slots/info/'),
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
   FORTUNE GAMES (MOUSE, TIGER, RABBIT)
====================================================== */
export const fortuneService = {
  // Get game configuration
  getGameConfig: (gameType) => 
    api.get(`/fortune/config/${gameType}/`),

  // Start a new game session
  startSession: (data) => 
    api.post("/fortune/start/", data),

  // Get active sessions
  getActiveSessions: () =>
    api.get("/fortune/sessions/active/"),

  // Get session state
  getSessionState: (sessionId) =>
    api.get(`/fortune/session/${sessionId}/`),

  // Take a step (reveal a tile)
  takeStep: (sessionId, data) =>
    api.post(`/fortune/session/${sessionId}/step/`, data),

  // Cash out
  cashout: (sessionId) =>
    api.post(`/fortune/session/${sessionId}/cashout/`),

  // Abandon session (forfeit)
  abandonSession: (sessionId) =>
    api.post(`/fortune/session/${sessionId}/abandon/`),

  // Reveal server seed for provable fairness
  revealSeed: (sessionId) =>
    api.post(`/fortune/session/${sessionId}/reveal-seed/`),

  // Helper method for starting specific games
  startMouseGame: (betAmount, clientSeed = null) => {
    return fortuneService.startSession({
      game: "fortune_mouse",
      bet_amount: betAmount,
      client_seed: clientSeed || `mouse_${Date.now()}_${Math.random()}`,
    });
  },

  startTigerGame: (betAmount, clientSeed = null) => {
    return fortuneService.startSession({
      game: "fortune_tiger",
      bet_amount: betAmount,
      client_seed: clientSeed || `tiger_${Date.now()}_${Math.random()}`,
    });
  },

  startRabbitGame: (betAmount, clientSeed = null) => {
    return fortuneService.startSession({
      game: "fortune_rabbit",
      bet_amount: betAmount,
      client_seed: clientSeed || `rabbit_${Date.now()}_${Math.random()}`,
    });
  },
};

/* ======================================================
   OTHER GAME SERVICES
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
  start: async (data) => {
    console.log("API Request to /minesweeper/start/:", data);
    try {
      const response = await api.post("/minesweeper/start/", data);
      console.log("API Response:", response.data);
      return response;
    } catch (error) {
      console.error("API Error:", error);
      throw error;
    }
  },
  
  reveal: async (data) => {
    console.log("API Request to /minesweeper/reveal/:", data);
    return api.post("/minesweeper/reveal/", data);
  },
  
  cashout: async (data) => {
    console.log("API Request to /minesweeper/cashout/:", data);
    return api.post("/minesweeper/cashout/", data);
  },
};

export const towerService = {
  startTower: (data) => api.post("/tower/start/", data),
  buildLevel: (data) => api.post("/tower/build/", data),
  cashOut: (data) => api.post("/tower/cashout/", data),
  getStats: () => api.get("/tower/stats/"),
  getHistory: () => api.get("/tower/history/"),
};

export const cardService = {
  startGame: async (data) => {
    console.log("API Request to /cards/start-game/:", data);
    try {
      const response = await api.post("/cards/start-game/", data);
      console.log("API Response:", response.data);
      return response;
    } catch (error) {
      console.error("Start Game API Error:", error);
      throw error;
    }
  },

  revealCard: async (data) => {
    console.log("API Request to /cards/reveal-card/:", data);
    try {
      const response = await api.post("/cards/reveal-card/", data);
      console.log("API Response:", response.data);
      return response;
    } catch (error) {
      console.error("Reveal Card API Error:", error);
      throw error;
    }
  },

  cashOut: async (data) => {
    console.log("API Request to /cards/cash-out/:", data);
    try {
      const response = await api.post("/cards/cash-out/", data);
      console.log("API Response:", response.data);
      return response;
    } catch (error) {
      console.error("Cash Out API Error:", error);
      throw error;
    }
  },

  getStats: async () => {
    console.log("API Request to /cards/stats/");
    try {
      const response = await api.get("/cards/stats/");
      console.log("API Response:", response.data);
      return response;
    } catch (error) {
      console.error("Stats API Error:", error);
      throw error;
    }
  },

  getHistory: async () => {
    console.log("API Request to /cards/history/");
    try {
      const response = await api.get("/cards/history/");
      console.log("API Response:", response.data);
      return response;
    } catch (error) {
      console.error("History API Error:", error);
      throw error;
    }
  },
};

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
      const response = await api.post("/colorswitch/start/", data);
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
      const response = await api.post("/colorswitch/submit/", data);
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
      const response = await api.post("/colorswitch/cashout/", data);
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
      const response = await api.get("/colorswitch/stats/");
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
      const response = await api.get("/colorswitch/history/");
      console.log("API Response:", response.data);
      return response;
    } catch (error) {
      console.error("API Error:", error);
      throw error;
    }
  },
};

/* ======================================================
   EXPORT DEFAULT
====================================================== */
export default api;