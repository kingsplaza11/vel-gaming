import React, { useState } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import PaystackPayment from '../Payment/PaystackPayment';
import WithdrawalForm from '../Withdrawal/WithdrawalForm';
import { Icon } from '@iconify/react';
import './WalletDashboard.css';

const WalletDashboard = () => {
  const {
    wallet,
    transactions,
    loading,
    error,
    refreshWallet,
  } = useWallet();

  const [activeTab, setActiveTab] = useState('overview');
  const [refreshing, setRefreshing] = useState(false);

  /* =========================
     HARD FAIL SAFES
  ========================= */
  const safeWallet = wallet || {};
  const safeTransactions = Array.isArray(transactions) ? transactions : [];

  const formatDate = (dateString) => {
    if (!dateString) return '--';
    const date = new Date(dateString);
    return isNaN(date)
      ? '--'
      : date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
  };

  const formatAmount = (amount) => {
    const num = Number(amount);
    return isNaN(num) ? '0.00' : num.toLocaleString('en-NG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshWallet();
    setTimeout(() => setRefreshing(false), 1000);
  };

  /* =========================
     LOADING STATE
  ========================= */
  if (loading && !safeWallet.balance) {
    return (
      <div className="wallet-loading">
        <div className="loading-orb">
          <div className="orb-glow"></div>
          <Icon icon="mdi:wallet" className="loading-icon" />
        </div>
        <p>Loading your wallet...</p>
      </div>
    );
  }

  return (
    <div className="wallet-dashboard">
      {/* ANIMATED BACKGROUND */}
      <div className="wallet-bg-effects">
        <div className="bg-coin coin-1"></div>
        <div className="bg-coin coin-2"></div>
        <div className="bg-coin coin-3"></div>
        <div className="bg-wave"></div>
      </div>

      {/* =========================
         ERROR BANNER
      ========================= */}
      {error && (
        <div className="wallet-error-alert">
          <div className="error-content">
            <Icon icon="mdi:alert-circle" className="error-icon" />
            <span>{error}</span>
          </div>
          <button className="error-close">
            <Icon icon="mdi:close" />
          </button>
        </div>
      )}

      {/* =========================
         HEADER
      ========================= */}
      <div className="wallet-header">
        <div className="header-content">
          <div className="header-title">
            <div className="title-orb">
              <Icon icon="mdi:wallet" className="title-icon" />
              <div className="title-glow"></div>
              <div className="title-sparkle"></div>
              <div className="title-sparkle"></div>
            </div>
            <h1>
              <span className="title-gradient">MY WALLET</span>
              <div className="title-underline"></div>
            </h1>
          </div>
          <p className="header-subtitle">Manage your funds, deposits, and withdrawals</p>
        </div>
      </div>

      {/* =========================
         TABS
      ========================= */}
      <div className="wallet-tabs">
        {['overview', 'deposit', 'withdraw', 'transactions'].map(tab => (
          <button
            key={tab}
            className={`tab-button ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            <div className="tab-glow"></div>
            <Icon
              icon={
                tab === 'overview'
                  ? 'mdi:view-dashboard'
                  : tab === 'deposit'
                  ? 'mdi:credit-card-plus'
                  : tab === 'withdraw'
                  ? 'mdi:credit-card-minus'
                  : 'mdi:history'
              }
              className="tab-icon"
            />
            <span className="tab-label">
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </span>
            <div className="tab-indicator"></div>
          </button>
        ))}
      </div>

      {/* =========================
         OVERVIEW TAB
      ========================= */}
      {activeTab === 'overview' && (
        <div className="overview-content">
          {/* BALANCE CARDS */}
          <div className="balance-cards">
            <div className="balance-card available">
              <div className="card-glow"></div>
              <div className="card-content">
                <div className="card-header">
                  <div className="card-icon">
                    <Icon icon="mdi:cash" />
                  </div>
                  <h3>Available Balance</h3>
                </div>
                <div className="card-balance">
                  <span className="currency">₦</span>
                  <span className="amount">{formatAmount(safeWallet.balance)}</span>
                </div>
                <p className="card-description">Ready to use</p>
              </div>
              <div className="card-decoration"></div>
            </div>

            <div className="balance-card demo">
              <div className="card-glow"></div>
              <div className="card-content">
                <div className="card-header">
                  <div className="card-icon">
                    <Icon icon="mdi:gamepad" />
                  </div>
                  <h3>Bet Out Balance</h3>
                </div>
                <div className="card-balance">
                  <span className="currency">₦</span>
                  <span className="amount">{formatAmount(safeWallet.spot_balance)}</span>
                </div>
                <p className="card-description">Withdrawable Funds</p>
              </div>
              <div className="card-decoration"></div>
            </div>
          </div>

          {/* QUICK ACTIONS */}
          <div className="quick-actions">
            <div className="section-header">
              <Icon icon="mdi:lightning-bolt" className="section-icon" />
              <h2>Quick Actions</h2>
            </div>
            <div className="action-buttons">
              <button 
                className="action-btn deposit-action"
                onClick={() => setActiveTab('deposit')}
              >
                <div className="action-glow"></div>
                <Icon icon="mdi:credit-card-plus" className="action-icon" />
                <div className="action-text">
                  <span className="action-title">Deposit Funds</span>
                  <span className="action-subtitle">Add money to wallet</span>
                </div>
                <Icon icon="mdi:arrow-right" className="action-arrow" />
              </button>

              <button 
                className="action-btn withdraw-action"
                onClick={() => setActiveTab('withdraw')}
              >
                <div className="action-glow"></div>
                <Icon icon="mdi:credit-card-minus" className="action-icon" />
                <div className="action-text">
                  <span className="action-title">Withdraw Funds</span>
                  <span className="action-subtitle">Cash out winnings</span>
                </div>
                <Icon icon="mdi:arrow-right" className="action-arrow" />
              </button>

              <button 
                className="action-btn refresh-action"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <div className="action-glow"></div>
                <div className="action-icon">
                  {refreshing ? (
                    <div className="refresh-spinner"></div>
                  ) : (
                    <Icon icon="mdi:refresh" />
                  )}
                </div>
                <div className="action-text">
                  <span className="action-title">Refresh Balance</span>
                  <span className="action-subtitle">Update wallet status</span>
                </div>
                <Icon icon="mdi:arrow-right" className="action-arrow" />
              </button>
            </div>
          </div>

          {/* RECENT TRANSACTIONS */}
          <div className="recent-transactions">
            <div className="section-header">
              <div className="header-left">
                <Icon icon="mdi:history" className="section-icon" />
                <h2>Recent Transactions</h2>
              </div>
              <button 
                className="view-all-btn"
                onClick={() => setActiveTab('transactions')}
              >
                View All
                <Icon icon="mdi:chevron-right" />
              </button>
            </div>

            {safeTransactions.length > 0 ? (
              <div className="transactions-table">
                <div className="table-header">
                  <div className="table-cell">Date</div>
                  <div className="table-cell">Type</div>
                  <div className="table-cell">Amount</div>
                  <div className="table-cell">Status</div>
                </div>
                <div className="table-body">
                  {safeTransactions.slice(0, 5).map((tx, index) => (
                    <div className="table-row" key={tx.id || tx.reference || index}>
                      <div className="table-cell date-cell">
                        {formatDate(tx.created_at)}
                      </div>
                      <div className="table-cell">
                        <span className={`type-badge ${tx.tx_type === 'CREDIT' ? 'credit' : 'debit'}`}>
                          {tx.tx_type}
                        </span>
                      </div>
                      <div className="table-cell amount-cell">
                        <span className={`amount ${tx.tx_type === 'CREDIT' ? 'credit' : 'debit'}`}>
                          ₦{formatAmount(tx.amount)}
                        </span>
                      </div>
                      <div className="table-cell">
                        <span className={`status-badge ${tx.meta?.status || 'pending'}`}>
                          {tx.meta?.status || 'pending'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="no-transactions">
                <div className="empty-state">
                  <Icon icon="mdi:receipt" className="empty-icon" />
                  <p>No transactions yet</p>
                  <button 
                    className="make-first-transaction"
                    onClick={() => setActiveTab('deposit')}
                  >
                    Make your first deposit
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================
         DEPOSIT TAB
      ========================= */}
      {activeTab === 'deposit' && (
        <div className="deposit-content">
          <div className="deposit-header">
            <div className="header-content">
              <div className="header-icon">
                <Icon icon="mdi:credit-card-plus" />
                <div className="icon-glow"></div>
              </div>
              <h2>Deposit Funds</h2>
              <p>Add money to your wallet instantly</p>
            </div>
          </div>
          <PaystackPayment />
        </div>
      )}

      {/* =========================
         WITHDRAW TAB
      ========================= */}
      {activeTab === 'withdraw' && (
        <div className="withdraw-content">
          <div className="withdraw-header">
            <div className="header-content">
              <div className="header-icon">
                <Icon icon="mdi:credit-card-minus" />
                <div className="icon-glow"></div>
              </div>
              <h2>Withdraw Funds</h2>
              <p>Cash out your winnings</p>
            </div>
          </div>
          <WithdrawalForm />
        </div>
      )}

      {/* =========================
         TRANSACTIONS TAB
      ========================= */}
      {activeTab === 'transactions' && (
        <div className="transactions-content">
          <div className="transactions-header">
            <div className="header-content">
              <div className="header-left">
                <div className="header-icon">
                  <Icon icon="mdi:history" />
                  <div className="icon-glow"></div>
                </div>
                <div>
                  <h2>Transaction History</h2>
                  <p>All your wallet activities</p>
                </div>
              </div>
              <button 
                className="refresh-btn"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                {refreshing ? (
                  <div className="refresh-spinner-small"></div>
                ) : (
                  <Icon icon="mdi:refresh" />
                )}
                Refresh
              </button>
            </div>
          </div>

          {safeTransactions.length > 0 ? (
            <div className="full-transactions-table">
              <div className="table-header full-header">
                <div className="table-cell">Date</div>
                <div className="table-cell">Type</div>
                <div className="table-cell">Amount</div>
                <div className="table-cell">Reference</div>
                <div className="table-cell">Status</div>
              </div>
              <div className="table-body">
                {safeTransactions.map((tx, index) => (
                  <div className="table-row" key={tx.id || tx.reference || index}>
                    <div className="table-cell date-cell">
                      {formatDate(tx.created_at)}
                    </div>
                    <div className="table-cell">
                      <span className={`type-badge ${tx.tx_type === 'CREDIT' ? 'credit' : 'debit'}`}>
                        {tx.tx_type}
                      </span>
                    </div>
                    <div className="table-cell amount-cell">
                      <span className={`amount ${tx.tx_type === 'CREDIT' ? 'credit' : 'debit'}`}>
                        ₦{formatAmount(tx.amount)}
                      </span>
                    </div>
                    <div className="table-cell reference-cell">
                      <span className="reference">{tx.reference || '--'}</span>
                    </div>
                    <div className="table-cell">
                      <span className={`status-badge ${tx.meta?.status || 'pending'}`}>
                        {tx.meta?.status || 'pending'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="no-transactions">
              <div className="empty-state">
                <Icon icon="mdi:receipt" className="empty-icon" />
                <p>No transactions found</p>
                <button 
                  className="make-first-transaction"
                  onClick={() => setActiveTab('deposit')}
                >
                  Make your first transaction
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================
         FOOTER
      ========================= */}
      <div className="wallet-footer">
        <div className="footer-content">
          <Icon icon="mdi:shield-check" className="footer-icon" />
          <div className="footer-text">
            <p>Need help? Contact support at{' '}
              <span className="support-email">support@veltoragames.com</span>
            </p>
            <p className="footer-note">Your funds are protected with bank-level security</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletDashboard;