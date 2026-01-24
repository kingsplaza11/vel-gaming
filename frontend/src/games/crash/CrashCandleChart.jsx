import { useEffect, useRef } from "react";

const MAX_CANDLES = 120;
const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 420;

export default function CrashCandleChart({ multiplier, phase }) {
  const canvasRef = useRef(null);
  const candlesRef = useRef([]);
  const lastPriceRef = useRef(1.0);

  useEffect(() => {
    if (phase === "betting") {
      candlesRef.current = [];
      lastPriceRef.current = 1.0;
      draw();
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== "running" && phase !== "crashed") return;

    const last = lastPriceRef.current;

    // 🎢 Volatility logic
    let volatility = phase === "crashed" ? 1.5 : 0.15;
    let directionBias = multiplier > last ? 0.65 : 0.35;

    const up =
      Math.random() < directionBias
        ? Math.random() * volatility
        : -Math.random() * volatility;

    let next = Math.max(1, last + up);

    // 💥 Hard crash downward
    if (phase === "crashed") {
      next = Math.max(1, last - Math.random() * 2.5);
    }

    candlesRef.current.push({
      open: last,
      close: next,
    });

    if (candlesRef.current.length > MAX_CANDLES) {
      candlesRef.current.shift();
    }

    lastPriceRef.current = next;
    draw();
  }, [multiplier, phase]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const candleWidth = CANVAS_WIDTH / MAX_CANDLES;

    candlesRef.current.forEach((candle, i) => {
      const x = i * candleWidth + candleWidth / 2;
      const openY = CANVAS_HEIGHT - candle.open * 60;
      const closeY = CANVAS_HEIGHT - candle.close * 60;

      const isUp = candle.close >= candle.open;
      ctx.strokeStyle = isUp ? "#00ff99" : "#ff3b3b";
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.moveTo(x, openY);
      ctx.lineTo(x, closeY);
      ctx.stroke();
    });
  };

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      className="crash-canvas"
    />
  );
}
