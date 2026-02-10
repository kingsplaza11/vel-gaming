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
    availableBalance // This is the total balance (balance + spot_balance)
  } = useWallet();

  const [activeTab, setActiveTab] = useState('overview');
  const [refreshing, setRefreshing] = useState(false);

  /* =========================
     HARD FAIL SAFES
  ========================= */
  const safeWallet = wallet || {};
  const safeTransactions = Array.isArray(transactions) ? transactions : [];

  // Calculate total balance manually as fallback
  const betOutBalance = Number(safeWallet.balance) || 0;
  const spotBalance = Number(safeWallet.spot_balance) || 0;
  const totalBalance = availableBalance || (betOutBalance + spotBalance);

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

  const getTransactionTypeLabel = (txType) => {
    switch(txType) {
      case 'CREDIT':
        return 'Deposit';
      case 'DEBIT':
        return 'Withdrawal';
      default:
        return txType || 'Unknown';
    }
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
         TABS - UPDATED WITH TOTAL BALANCE TAB
      ========================= */}
      <div className="wallet-tabs">
        {['overview', 'total', 'deposit', 'withdraw', 'transactions'].map(tab => (
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
                  : tab === 'total'
                  ? 'mdi:calculator'
                  : tab === 'deposit'
                  ? 'mdi:credit-card-plus'
                  : tab === 'withdraw'
                  ? 'mdi:credit-card-minus'
                  : 'mdi:history'
              }
              className="tab-icon"
            />
            <span className="tab-label">
              {tab === 'total' ? 'Total Balance' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </span>
            <div className="tab-indicator"></div>
          </button>
        ))}
      </div>

      {/* =========================
         OVERVIEW TAB - UPDATED WITH 3 BALANCE CARDS
      ========================= */}
      {activeTab === 'overview' && (
        <div className="overview-content">
          {/* BALANCE CARDS - UPDATED WITH 3 CARDS */}
          <div className="balance-cards">
            {/* TOTAL FUNDS CARD */}
            <div className="balance-card total">
              <div className="card-glow"></div>
              <div className="card-content">
                <div className="card-header">
                  <div className="card-icon">
                    <Icon icon="mdi:wallet" />
                  </div>
                  <h3>Total Funds</h3>
                </div>
                <div className="card-balance">
                  <span className="currency">₦</span>
                  <span className="amount">{formatAmount(totalBalance)}</span>
                </div>
                <p className="card-description">All available funds</p>
              </div>
              <div className="card-decoration"></div>
            </div>

            {/* BET OUT BALANCE CARD */}
            <div className="balance-card available">
              <div className="card-glow"></div>
              <div className="card-content">
                <div className="card-header">
                  <div className="card-icon">
                    <Icon icon="mdi:cash" />
                  </div>
                  <h3>Bet Out Balance</h3>
                </div>
                <div className="card-balance">
                  <span className="currency">₦</span>
                  <span className="amount">{formatAmount(betOutBalance)}</span>
                </div>
              </div>
              <div className="card-decoration"></div>
            </div>

            {/* AVAILABLE BALANCE CARD (formerly Spot Balance) */}
            <div className="balance-card demo">
              <div className="card-glow"></div>
              <div className="card-content">
                <div className="card-header">
                  <div className="card-icon">
                    <Icon icon="mdi:bank-transfer" />
                  </div>
                  <h3>Available Balance</h3>
                </div>
                <div className="card-balance">
                  <span className="currency">₦</span>
                  <span className="amount">{formatAmount(spotBalance)}</span>
                </div>
                <p className="card-description">Withdrawable funds</p>
              </div>
              <div className="card-decoration"></div>
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
                  <div className="table-cell">Type</div>
                  <div className="table-cell">Amount</div>
                  <div className="table-cell">Date</div>
                </div>
                <div className="table-body">
                  {safeTransactions.slice(0, 5).map((tx, index) => (
                    <div className="table-row" key={tx.id || tx.reference || index}>
                      <div className="table-cell">
                        <span className={`type-badge ${tx.tx_type === 'CREDIT' ? 'credit' : 'debit'}`}>
                          {getTransactionTypeLabel(tx.tx_type)}
                        </span>
                      </div>
                      <div className="table-cell amount-cell">
                        <span className={`amount ${tx.tx_type === 'CREDIT' ? 'credit' : 'debit'}`}>
                          ₦{formatAmount(tx.amount)}
                        </span>
                      </div>
                      <div className="table-cell date-cell">
                        {formatDate(tx.created_at)}
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
         TOTAL BALANCE TAB (NEW)
      ========================= */}
      {activeTab === 'total' && (
        <div className="total-content">
          <div className="total-header">
            <div className="header-content">
              <div className="header-icon">
                <Icon icon="mdi:calculator" />
                <div className="icon-glow"></div>
              </div>
              <h2>Total Available Balance</h2>
              <p>Complete view of your funds</p>
            </div>
          </div>

          <div className="total-balance-display">
            <div className="total-card">
              <div className="total-card-glow"></div>
              <div className="total-card-content">
                <div className="total-card-header">
                  <Icon icon="mdi:wallet-plus" className="total-card-icon" />
                  <h3>Total Available Funds</h3>
                </div>
                <div className="total-balance-amount">
                  <span className="total-currency">₦</span>
                  <span className="total-amount">{formatAmount(totalBalance)}</span>
                </div>
                <p className="total-description">Sum of Bet Out Balance + Available Balance</p>
                
                <div className="breakdown-section">
                  <div className="breakdown-header">
                    <Icon icon="mdi:chart-pie" />
                    <h4>Balance Breakdown</h4>
                  </div>
                  
                  <div className="breakdown-items">
                    <div className="breakdown-item">
                      <div className="breakdown-icon-container">
                        <Icon icon="mdi:cash" className="breakdown-icon wallet" />
                      </div>
                      <div className="breakdown-details">
                        <span className="breakdown-label">Bet Out Balance</span>
                        <span className="breakdown-amount">
                          ₦{formatAmount(betOutBalance)}
                        </span>
                      </div>
                      <div className="breakdown-percentage">
                        {totalBalance > 0 ? `${((betOutBalance / totalBalance) * 100).toFixed(1)}%` : '0%'}
                      </div>
                    </div>
                    
                    <div className="breakdown-item">
                      <div className="breakdown-icon-container">
                        <Icon icon="mdi:bank-transfer" className="breakdown-icon spot" />
                      </div>
                      <div className="breakdown-details">
                        <span className="breakdown-label">Available Balance</span>
                        <span className="breakdown-amount">
                          ₦{formatAmount(spotBalance)}
                        </span>
                      </div>
                      <div className="breakdown-percentage">
                        {totalBalance > 0 ? `${((spotBalance / totalBalance) * 100).toFixed(1)}%` : '0%'}
                      </div>
                    </div>
                    
                    <div className="breakdown-item total-breakdown">
                      <div className="breakdown-icon-container">
                        <Icon icon="mdi:plus-circle" className="breakdown-icon total" />
                      </div>
                      <div className="breakdown-details">
                        <span className="breakdown-label">Total Available</span>
                        <span className="breakdown-amount highlight">
                          ₦{formatAmount(totalBalance)}
                        </span>
                      </div>
                      <div className="breakdown-percentage highlight">
                        100%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="total-actions">
              <button 
                className="total-action-btn deposit"
                onClick={() => setActiveTab('deposit')}
              >
                <Icon icon="mdi:credit-card-plus" />
                <span>Add Funds</span>
              </button>
              <button 
                className="total-action-btn withdraw"
                onClick={() => setActiveTab('withdraw')}
              >
                <Icon icon="mdi:credit-card-minus" />
                <span>Cash Out</span>
              </button>
              <button 
                className="total-action-btn refresh"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <Icon icon="mdi:refresh" />
                <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
              </button>
            </div>
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
                <div className="table-cell">Type</div>
                <div className="table-cell">Amount</div>
                <div className="table-cell">Date</div>
                <div className="table-cell">Reference</div>
              </div>
              <div className="table-body">
                {safeTransactions.map((tx, index) => (
                  <div className="table-row" key={tx.id || tx.reference || index}>
                    <div className="table-cell">
                      <span className={`type-badge ${tx.tx_type === 'CREDIT' ? 'credit' : 'debit'}`}>
                        {getTransactionTypeLabel(tx.tx_type)}
                      </span>
                    </div>
                    <div className="table-cell amount-cell">
                      <span className={`amount ${tx.tx_type === 'CREDIT' ? 'credit' : 'debit'}`}>
                        ₦{formatAmount(tx.amount)}
                      </span>
                    </div>
                    <div className="table-cell date-cell">
                      {formatDate(tx.created_at)}
                    </div>
                    <div className="table-cell reference-cell">
                      <span className="reference">{tx.reference || '--'}</span>
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