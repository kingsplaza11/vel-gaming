import React from "react";

export default function LiveBetTable({ rows }) {
  return (
    <div className="livebets-card">
      <div className="livebets-head">
        <span>Live Bets</span>
        <span className="muted">{rows.length} shown</span>
      </div>

      <div className="livebets-scroll">
        <table className="livebets-table">
          <thead>
            <tr>
              <th>User</th>
              <th className="right">Bet</th>
              <th className="right">Cashout</th>
              <th className="right">Payout</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.bet_id}>
                <td className="user">{r.user}</td>
                <td className="right">${r.amount}</td>
                <td className="right">
                  {r.multiplier ? `${r.multiplier}x` : "—"}
                </td>
                <td className="right">
                  {r.payout ? `$${r.payout}` : <span className="muted">—</span>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="empty">
                  No live bets yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
