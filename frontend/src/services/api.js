import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/accounts';

// Create axios instance with credentials
const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for CSRF tokens
api.interceptors.request.use(
  async (config) => {
    // Try to get CSRF token from cookie
    const csrfToken = getCookie('csrftoken');
    if (csrfToken) {
      config.headers['X-CSRFToken'] = csrfToken;
    } else {
      // If no CSRF token, try to get one
      try {
        await api.get('/accounts/profile/');
        const newCsrfToken = getCookie('csrftoken');
        if (newCsrfToken) {
          config.headers['X-CSRFToken'] = newCsrfToken;
        }
      } catch (error) {
        console.log('Could not get CSRF token');
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 403 || error.response?.status === 401) {
      console.error('Authentication error - redirecting to login');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Helper function to get cookie value
function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

export const authService = {
  login: (credentials) => api.post('/accounts/login/', credentials),
  register: (userData) => api.post('/accounts/register/', userData),
  logout: () => api.post('/accounts/logout/'),
  getProfile: () => api.get('/accounts/profile/'),
};

// Updated Slots Service with 3x4 grid support
export const slotsService = {
  spin: (data) => api.post('/slots/spin/', {
    ...data,
    grid_size: '3x4' // Explicitly specify grid size
  }),
  getStats: () => api.get('/slots/stats/'),
  getHistory: () => api.get('/slots/history/'),
  getThemes: () => api.get('/slots/themes/'), // Optional: if you want to fetch themes from backend
};

export const crashService = {
  placeBet: (data) => api.post('/crash/place-bet/', data),
  cashOut: (data) => api.post('/crash/cash-out/', data),
  gameCrashed: (data) => api.post('/crash/game-crashed/', data),
  getStats: () => api.get('/crash/stats/'),
  getHistory: () => api.get('/crash/history/'),
};

// New Game Services
export const fishingService = {
  castLine: (data) => api.post('/fishing/cast-line/', data),
  getStats: () => api.get('/fishing/stats/'),
  getHistory: () => api.get('/fishing/history/'),
};

export const treasureService = {
  startHunt: (data) => api.post('/treasure/start-hunt/', data),
  getStats: () => api.get('/treasure/stats/'),
  getHistory: () => api.get('/treasure/history/'),
};

export const dragonService = {
  startBattle: (data) => api.post('/dragon/start-battle/', data),
  getStats: () => api.get('/dragon/stats/'),
  getHistory: () => api.get('/dragon/history/'),
};

export const minerService = {
  startMining: (data) => api.post('/miner/start-mining/', data),
  getStats: () => api.get('/miner/stats/'),
  getHistory: () => api.get('/miner/history/'),
};

export const spaceService = {
  launchMission: (data) => api.post('/space/launch-mission/', data),
  getStats: () => api.get('/space/stats/'),
  getHistory: () => api.get('/space/history/'),
};

export const potionService = {
  brewPotion: (data) => api.post('/potion/brew-potion/', data),
  getStats: () => api.get('/potion/stats/'),
  getHistory: () => api.get('/potion/history/'),
};

export const pyramidService = {
  explorePyramid: (data) => api.post('/pyramid/explore-pyramid/', data),
  getStats: () => api.get('/pyramid/stats/'),
  getHistory: () => api.get('/pyramid/history/'),
};

export const heistService = {
  startHeist: (data) => api.post('/heist/start-heist/', data),
  getStats: () => api.get('/heist/stats/'),
  getHistory: () => api.get('/heist/history/'),
};

export const minesweeperService = {
  startGame: (data) => api.post('/minesweeper/start/', data),
  revealCell: (data) => api.post('/minesweeper/reveal/', data),
  cashOut: (data) => api.post('/minesweeper/cashout/', data),
  getStats: () => api.get('/minesweeper/stats/'),
  getHistory: () => api.get('/minesweeper/history/'),
};

export const towerService = {
  startGame: (data) => api.post('/tower/start/', data),
  buildLevel: (data) => api.post('/tower/build/', data),
  cashOut: (data) => api.post('/tower/cashout/', data),
  getStats: () => api.get('/tower/stats/'),
  getHistory: () => api.get('/tower/history/'),
};

export const cardService = {
  startGame: (data) => api.post('/cards/start/', data),
  revealCard: (data) => api.post('/cards/reveal/', data),
  getStats: () => api.get('/cards/stats/'),
  getHistory: () => api.get('/cards/history/'),
};

export const guessingService = {
  startGame: (data) => api.post('/guessing/start/', data),
  makeGuess: (data) => api.post('/guessing/guess/', data),
  getStats: () => api.get('/guessing/stats/'),
  getHistory: () => api.get('/guessing/history/'),
};

export const clickerService = {
  startGame: (data) => api.post('/clicker/start/', data),
  registerClick: (data) => api.post('/clicker/click/', data),
  getStats: () => api.get('/clicker/stats/'),
  getHistory: () => api.get('/clicker/history/'),
};

export const colorSwitchService = {
  startGame: (data) => api.post('/colorswitch/start/', data),
  submitSequence: (data) => api.post('/colorswitch/submit/', data),
  cashOut: (data) => api.post('/colorswitch/cashout/', data),
  getStats: () => api.get('/colorswitch/stats/'),
  getHistory: () => api.get('/colorswitch/history/'),
};

export default api;