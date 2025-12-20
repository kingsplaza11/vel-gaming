import React from "react";
import "./AlertModal.css";

export default function AlertModal({ open, type = "error", title, message, onClose }) {
  if (!open) return null;

  return (
    <div className="alert-backdrop" onClick={onClose}>
      <div className={`alert-modal ${type}`} onClick={(e) => e.stopPropagation()}>
        <div className="alert-icon">
          {type === "error" && "⚠️"}
          {type === "success" && "✅"}
          {type === "info" && "ℹ️"}
        </div>

        <div className="alert-content">
          <h3>{title}</h3>
          <p>{message}</p>
        </div>

        <button className="alert-btn" onClick={onClose}>
          OK
        </button>
      </div>
    </div>
  );
}
