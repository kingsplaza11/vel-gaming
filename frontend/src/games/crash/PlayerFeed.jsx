import React from "react";

export default function PlayerFeed({ feed }) {
  return (
    <div className="player-feed">
      {feed.map((p, i) => (
        <div key={i} className="feed-row">
          <span>{p.user}</span>
          {p.amount && <span>{p.amount}</span>}
          {p.payout && <span className="win">{p.payout}</span>}
        </div>
      ))}
    </div>
  );
}
