import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./fortune.css";

import { fortuneService } from "../../services/api";

export default function FortuneStart({ user, onBalanceUpdate }) {
  const navigate = useNavigate();
  const [bet, setBet] = useState("100");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const games = useMemo(() => ([
    {
      id: "fortune_mouse",
      title: "Fortune Mouse",
      emoji: "🐭",
      route: "/fortune/mouse",
      img: "/images/games/fortune-mouse.png",
      desc: "Golden vault tiles • push your luck • cash out anytime",
    },
    {
      id: "fortune_tiger",
      title: "Fortune Tiger",
      emoji: "🐯",
      route: "/fortune/tiger",
      img: "/images/games/fortune-tiger.png",
      desc: "Jade temple strikes • round-based tension • cash out between rounds",
    },
    {
      id: "fortune_rabbit",
      title: "Fortune Rabbit",
      emoji: "🐰",
      route: "/fortune/rabbit",
      img: "/images/games/fortune-rabbit.png",
      desc: "Moonlit hops • auto/manual • stop to secure winnings",
    },
  ]), []);

  const startGame = async (game) => {
    setErr(null);
    setLoading(true);

    const betAmount = Number(bet);
    if (!Number.isFinite(betAmount) || betAmount <= 0) {
      setErr("Enter a valid bet amount");
      setLoading(false);
      return;
    }

    const clientSeed = `${user?.id || user?.username || "user"}:${navigator.userAgent}:${Date.now()}`;

    try {
      const response = await fortuneService.startSession({
        game: game.id,
        bet_amount: betAmount.toFixed(2),
        currency: "NGN",
        client_seed: clientSeed,
      });

      const data = response.data;

      // Update wallet balance (if backend debits immediately)
      if (onBalanceUpdate) onBalanceUpdate();

      // Navigate directly to the selected game
      navigate(game.route, {
        state: {
          startPayload: data,
        },
      });
    } catch (error) {
      console.error("Fortune start error:", error);
      setErr(
        error.response?.data?.detail ||
        "Unable to start game. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fortune-wrap">
      <div className="fortune-topbar">
        <div className="fortune-title">
          <div className="badge">🎴</div>
          <div>
            <div className="h1">Fortune Games</div>
            <div className="sub">
              Premium Asian-themed live games • Server-decided • Max win ≤ 30%
            </div>
          </div>
        </div>

        <div className="fortune-metrics">
          <div className="metric">
            <div className="k">Bet Amount (₦)</div>
            <input
              value={bet}
              onChange={(e) => setBet(e.target.value)}
              className="fortune-bet-input"
              inputMode="decimal"
              placeholder="100"
              disabled={loading}
            />
          </div>

          <button
            className="btn btn-ghost"
            onClick={() => navigate("/")}
            disabled={loading}
          >
            Back to Dashboard
          </button>
        </div>
      </div>

      {err && <div className="fortune-error">{err}</div>}

      <div className="fortune-lobby-grid">
        {games.map((game) => (
          <button
            key={game.id}
            className="fortune-lobby-card"
            onClick={() => startGame(game)}
            disabled={loading}
          >
            <div className="fortune-lobby-img">
              <img src={game.img} alt={game.title} />
              <div className="fortune-lobby-emoji">{game.emoji}</div>
            </div>

            <div className="fortune-lobby-info">
              <div className="fortune-lobby-title">{game.title}</div>
              <div className="fortune-lobby-desc">{game.desc}</div>
            </div>

            <div className="fortune-lobby-cta">
              {loading ? "Starting…" : "PLAY"}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
