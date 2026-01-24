import React from "react";
import "./CrashGame.css";

export default function HistoryBar({ history }) {
  return (
    <div className="history-bar">
      {history.map((h, i) => (
        <div
          key={i}
          className={`crash-chip ${
            h < 1.5 ? "red" : h < 2.5 ? "yellow" : "green"
          }`}
        >
          {h.toFixed(2)}x
        </div>
      ))}
    </div>
  );
}
