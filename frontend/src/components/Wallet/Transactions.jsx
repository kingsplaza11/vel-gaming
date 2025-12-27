import React, { useEffect, useState } from "react";
import { walletService } from "../../services/api";
import { Icon } from "@iconify/react";
import "./Transactions.css";

const Transactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    let mounted = true;

    const fetchTransactions = async () => {
      try {
        const res = await walletService.getTransactions();
        if (mounted) setTransactions(res.data || []);
      } catch (err) {
        if (mounted) setError("Failed to load transactions");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchTransactions();
    return () => (mounted = false);
  }, []);

  const filteredTransactions = transactions.filter((tx) => {
    if (filter === "all") return true;
    if (filter === "credits") return tx.tx_type === "CREDIT";
    if (filter === "debits") return tx.tx_type === "DEBIT";
    return true;
  });

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatAmount = (amount) => {
    const num = parseFloat(amount);
    return num.toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const getStatusColor = (status) => {
    const statusMap = {
      completed: "#00c853",
      pending: "#ff9800",
      failed: "#ff4444",
      processing: "#2196f3",
      refunded: "#9c27b0"
    };
    return statusMap[status?.toLowerCase()] || "#ff9800";
  };

  const getTransactionIcon = (txType) => {
    const icons = {
      CREDIT: "mdi:arrow-down-circle",
      DEBIT: "mdi:arrow-up-circle",
      DEPOSIT: "mdi:credit-card-plus",
      WITHDRAWAL: "mdi:credit-card-minus",
      WINNING: "mdi:trophy",
      BONUS: "mdi:gift",
      REFUND: "mdi:refresh"
    };
    return icons[txType] || "mdi:swap-horizontal";
  };

  if (loading) {
    return (
      <div className="transactions-loading">
        <div className="loading-orb">
          <div className="orb-glow"></div>
          <Icon icon="mdi:history" className="loading-icon" />
        </div>
        <p>Loading your transactions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="transactions-error">
        <div className="error-orb">
          <Icon icon="mdi:alert-circle" />
        </div>
        <h3>Oops! Something went wrong</h3>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="transactions-page">
      {/* ANIMATED BACKGROUND */}
      <div className="transactions-bg-effects">
        <div className="bg-coin coin-1"></div>
        <div className="bg-coin coin-2"></div>
        <div className="bg-coin coin-3"></div>
        <div className="bg-wave"></div>
      </div>

      {/* HEADER */}
      <div className="transactions-header">
        <div className="header-content">
          <div className="header-title">
            <div className="title-orb">
              <Icon icon="mdi:history" className="title-icon" />
              <div className="title-glow"></div>
              <div className="title-sparkle"></div>
              <div className="title-sparkle"></div>
            </div>
            <h1>
              <span className="title-gradient">TRANSACTION HISTORY</span>
              <div className="title-underline"></div>
            </h1>
          </div>
          <p className="header-subtitle">All your financial activities in one place</p>
        </div>
      </div>

      {/* STATS CARDS */}
      <div className="transactions-stats">
        <div className="stat-card">
          <div className="stat-icon">
            <Icon icon="mdi:swap-horizontal" />
          </div>
          <div className="stat-content">
            <span className="stat-value">{transactions.length}</span>
            <span className="stat-label">Total Transactions</span>
          </div>
          <div className="stat-glow"></div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Icon icon="mdi:arrow-down-circle" />
          </div>
          <div className="stat-content">
            <span className="stat-value">
              {transactions.filter(tx => tx.tx_type === "CREDIT").length}
            </span>
            <span className="stat-label">Credits</span>
          </div>
          <div className="stat-glow"></div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Icon icon="mdi:arrow-up-circle" />
          </div>
          <div className="stat-content">
            <span className="stat-value">
              {transactions.filter(tx => tx.tx_type === "DEBIT").length}
            </span>
            <span className="stat-label">Debits</span>
          </div>
          <div className="stat-glow"></div>
        </div>
      </div>

      {/* FILTERS */}
      <div className="transactions-filters">
        <button 
          className={`filter-btn ${filter === "all" ? "active" : ""}`}
          onClick={() => setFilter("all")}
        >
          <Icon icon="mdi:filter-variant" />
          <span>All Transactions</span>
        </button>
        <button 
          className={`filter-btn ${filter === "credits" ? "active" : ""}`}
          onClick={() => setFilter("credits")}
        >
          <Icon icon="mdi:arrow-down-circle" />
          <span>Credits Only</span>
        </button>
        <button 
          className={`filter-btn ${filter === "debits" ? "active" : ""}`}
          onClick={() => setFilter("debits")}
        >
          <Icon icon="mdi:arrow-up-circle" />
          <span>Debits Only</span>
        </button>
        <button className="export-btn">
          <Icon icon="mdi:download" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* TRANSACTIONS LIST */}
      <div className="transactions-container">
        {filteredTransactions.length === 0 ? (
          <div className="no-transactions">
            <div className="empty-state">
              <Icon icon="mdi:receipt" className="empty-icon" />
              <h3>No transactions found</h3>
              <p>When you make transactions, they will appear here.</p>
              <button className="explore-btn">
                <Icon icon="mdi:gamepad" />
                <span>Explore Games</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="transactions-list">
            {filteredTransactions.map((tx, index) => (
              <div 
                className={`transaction-card ${tx.tx_type === "CREDIT" ? "credit" : "debit"}`}
                key={tx.id || index}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="transaction-shine"></div>
                <div className="transaction-glow"></div>
                
                <div className="card-left">
                  <div className="transaction-icon">
                    <Icon icon={getTransactionIcon(tx.tx_type)} />
                    <div className="icon-glow"></div>
                  </div>
                  <div className="transaction-details">
                    <div className="detail-row">
                      <span className="tx-type">{tx.tx_type}</span>
                      <span 
                        className="tx-status"
                        style={{ color: getStatusColor(tx.meta?.status) }}
                      >
                        <span 
                          className="status-dot"
                          style={{ backgroundColor: getStatusColor(tx.meta?.status) }}
                        ></span>
                        {tx.meta?.status || "pending"}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="tx-reference">{tx.reference}</span>
                      <span className="tx-date">{formatDate(tx.created_at)}</span>
                    </div>
                    {tx.meta?.purpose && (
                      <div className="tx-purpose">
                        <Icon icon="mdi:information" />
                        <span>{tx.meta.purpose}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="card-right">
                  <div className={`amount-display ${tx.tx_type === "CREDIT" ? "credit" : "debit"}`}>
                    <span className="amount-sign">
                      {tx.tx_type === "CREDIT" ? "+" : "-"}
                    </span>
                    <span className="amount-currency">₦</span>
                    <span className="amount-value">{formatAmount(tx.amount)}</span>
                  </div>
                  <div className="action-buttons">
                    <button className="action-btn details-btn">
                      <Icon icon="mdi:eye" />
                      <span>Details</span>
                    </button>
                    <button className="action-btn copy-btn">
                      <Icon icon="mdi:content-copy" />
                      <span>Copy ID</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PAGINATION */}
        {filteredTransactions.length > 0 && (
          <div className="transactions-pagination">
            <button className="pagination-btn prev-btn" disabled>
              <Icon icon="mdi:chevron-left" />
              <span>Previous</span>
            </button>
            <div className="page-numbers">
              <span className="page-number active">1</span>
              <span className="page-number">2</span>
              <span className="page-number">3</span>
              <span className="page-dots">...</span>
              <span className="page-number">10</span>
            </div>
            <button className="pagination-btn next-btn">
              <span>Next</span>
              <Icon icon="mdi:chevron-right" />
            </button>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div className="transactions-footer">
        <div className="footer-content">
          <Icon icon="mdi:shield-check" className="footer-icon" />
          <div className="footer-text">
            <p>All transactions are secured with bank-level encryption</p>
            <p className="footer-note">
              Need help? Contact support at{" "}
              <span className="support-email">support@veltora.com</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Transactions;