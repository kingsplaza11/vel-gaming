// src/services/api.js
import axios from "axios";

/* ======================================================
   API BASE URL (HARD FAIL SAFE)
   - NEVER silently falls back to localhost in production
====================================================== */
const API_BASE =
  process.env.REACT_APP_API_URL?.replace(/\/+$/, "") ||
  "https://veltoragames.com/api"; // ⚠️ CHANGE THIS FOR VPS

/* ======================================================
   AXIOS INSTANCE
====================================================== */
const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000, // prevents infinite hanging on VPS
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

/* ======================================================
   COOKIE HELPER (SAFE)
====================================================== */
function getCookie(name) {
  if (!document.cookie) return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(name + "="));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

/* ======================================================
   REQUEST INTERCEPTOR (CSRF SAFE — NO RECURSION)
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
   RESPONSE INTERCEPTOR (AUTH SAFE — NO LOOPS)
====================================================== */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const path = window.location.pathname;

    // Explicit opt-out
    if (error.config?.skipAuthRedirect) {
      return Promise.reject(error);
    }

    // Never redirect during active games
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
   AUTH SERVICE
====================================================== */
export const authService = {
  login: (credentials) =>
    api.post("/accounts/login/", credentials),

  register: (userData) =>
    api.post("/accounts/register/", userData),

  logout: () =>
    api.post("/accounts/logout/"),

  getProfile: () =>
    api.get("/accounts/profile/", {
      skipAuthRedirect: true,
    }),
};

/* ======================================================
   🎰 FORTUNE (MATCHES BACKEND SERIALIZER EXACTLY)
====================================================== */
export const fortuneService = {
  startSession: (data) =>
    api.post("/fortune/start/", {
      game: data.game,
      bet_amount: data.bet_amount,
      client_seed: data.client_seed,
    }),

  getSession: (sessionId) =>
    api.get(`/fortune/session/${sessionId}/`, {
      skipAuthRedirect: true,
    }),

  cashOut: (sessionId) =>
    api.post(`/fortune/session/${sessionId}/cashout/`),
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
  getThemes: () => api.get("/slots/themes/"),
};

/* ======================================================
   CRASH
====================================================== */
export const crashService = {
  placeBet: (data) =>
    api.post("/crash/place-bet/", data),

  cashOut: (data) =>
    api.post("/crash/cash-out/", data),

  gameCrashed: (data) =>
    api.post("/crash/game-crashed/", data),

  getStats: () => api.get("/crash/stats/"),
  getHistory: () => api.get("/crash/history/"),
};

/* ======================================================
   FISHING
====================================================== */
export const fishingService = {
  castLine: (data) =>
    api.post("/fishing/cast-line/", data),

  getStats: () => api.get("/fishing/stats/"),
  getHistory: () => api.get("/fishing/history/"),
};

/* ======================================================
   TREASURE
====================================================== */
export const treasureService = {
  startHunt: (data) =>
    api.post("/treasure/start-hunt/", data),

  getStats: () => api.get("/treasure/stats/"),
  getHistory: () => api.get("/treasure/history/"),
};

/* ======================================================
   DRAGON
====================================================== */
export const dragonService = {
  startBattle: (data) =>
    api.post("/dragon/start-battle/", data),

  getStats: () => api.get("/dragon/stats/"),
  getHistory: () => api.get("/dragon/history/"),
};

/* ======================================================
   POTION
====================================================== */
export const potionService = {
  brewPotion: (data) =>
    api.post("/potion/brew-potion/", data),

  getStats: () => api.get("/potion/stats/"),
  getHistory: () => api.get("/potion/history/"),
};

/* ======================================================
   PYRAMID
====================================================== */
export const pyramidService = {
  explorePyramid: (data) =>
    api.post("/pyramid/explore-pyramid/", data),

  getStats: () => api.get("/pyramid/stats/"),
  getHistory: () => api.get("/pyramid/history/"),
};

/* ======================================================
   HEIST
====================================================== */
export const heistService = {
  startHeist: (data) =>
    api.post("/heist/start-heist/", data),

  getStats: () => api.get("/heist/stats/"),
  getHistory: () => api.get("/heist/history/"),
};

/* ======================================================
   MINESWEEPER
====================================================== */
export const minesweeperService = {
  startGame: (data) =>
    api.post("/minesweeper/start/", data),

  revealCell: (data) =>
    api.post("/minesweeper/reveal/", data),

  cashOut: (data) =>
    api.post("/minesweeper/cashout/", data),

  getStats: () => api.get("/minesweeper/stats/"),
  getHistory: () => api.get("/minesweeper/history/"),
};

/* ======================================================
   TOWER
====================================================== */
export const towerService = {
  startGame: (data) =>
    api.post("/tower/start/", data),

  buildLevel: (data) =>
    api.post("/tower/build/", data),

  cashOut: (data) =>
    api.post("/tower/cashout/", data),

  getStats: () => api.get("/tower/stats/"),
  getHistory: () => api.get("/tower/history/"),
};

/* ======================================================
   CARDS
====================================================== */
export const cardService = {
  startGame: (data) =>
    api.post("/cards/start-game/", data),

  revealCard: (data) =>
    api.post("/cards/reveal-card/", data),

  getStats: () => api.get("/cards/stats/"),
  getHistory: () => api.get("/cards/history/"),
};

/* ======================================================
   NUMBER GUESSING
====================================================== */
export const guessingService = {
  startGame: (data) =>
    api.post("/guessing/start/", data),

  makeGuess: (data) =>
    api.post("/guessing/guess/", data),

  getStats: () => api.get("/guessing/stats/"),
  getHistory: () => api.get("/guessing/history/"),
};

/* ======================================================
   COLOR SWITCH
====================================================== */
export const colorSwitchService = {
  startGame: (data) =>
    api.post("/colorswitch/start/", data),

  submitSequence: (data) =>
    api.post("/colorswitch/submit/", data),

  cashOut: (data) =>
    api.post("/colorswitch/cashout/", data),

  getStats: () => api.get("/colorswitch/stats/"),
  getHistory: () => api.get("/colorswitch/history/"),
};

/* ======================================================
   EXPORT AXIOS INSTANCE
====================================================== */
export default api;
