import React, { useState, useEffect } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import PaystackPayment from '../Payment/PaystackPayment';
import WithdrawalForm from '../Withdrawal/WithdrawalForm';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router-dom';
import './WalletDashboard.css';

const WalletDashboard = ({ user }) => {
    const navigate = useNavigate();
    const { 
        wallet, 
        transactions, 
        loading, 
        error,
        refreshWallet 
    } = useWallet();

    const [activeTab, setActiveTab] = useState('overview');

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleRefresh = async () => {
        await refreshWallet();
    };

    if (loading && !wallet) {
        return (
            <div className="wallet-loading">
                <div className="loading-spinner">
                    <div className="spinner-glow"></div>
                    <Icon icon="mdi:wallet" className="loading-icon" />
                </div>
                <p>Loading wallet...</p>
            </div>
        );
    }

    return (
        <div className="wallet-dashboard">
            {/* Error Alert */}
            {error && (
                <div className="wallet-error-alert">
                    <Icon icon="mdi:alert-circle" className="error-icon" />
                    <span>{error}</span>
                    <button className="error-close" onClick={() => {}}>
                        <Icon icon="mdi:close" />
                    </button>
                </div>
            )}

            {/* Header */}
            <div className="wallet-header">
                
                <div className="header-content">
                    <div className="header-title">
                        <div className="title-icon-wrapper">
                            <Icon icon="mdi:wallet" className="title-icon" />
                            <div className="title-glow"></div>
                        </div>
                        <h1>My Wallet</h1>
                        <div className="title-decoration"></div>
                    </div>
                    <p className="header-subtitle">Manage your funds, deposit money, and withdraw winnings</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="wallet-tabs">
                <button 
                    className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
                    onClick={() => setActiveTab('overview')}
                >
                    <Icon icon="mdi:view-dashboard" />
                    <span>Overview</span>
                </button>
                <button 
                    className={`tab-button ${activeTab === 'deposit' ? 'active' : ''}`}
                    onClick={() => setActiveTab('deposit')}
                >
                    <Icon icon="mdi:credit-card-plus" />
                    <span>Deposit</span>
                </button>
                <button 
                    className={`tab-button ${activeTab === 'withdraw' ? 'active' : ''}`}
                    onClick={() => setActiveTab('withdraw')}
                >
                    <Icon icon="mdi:credit-card-minus" />
                    <span>Withdraw</span>
                </button>
                <button 
                    className={`tab-button ${activeTab === 'transactions' ? 'active' : ''}`}
                    onClick={() => setActiveTab('transactions')}
                >
                    <Icon icon="mdi:history" />
                    <span>Transactions</span>
                </button>
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
                <div className="overview-content">
                    {/* Wallet Summary Cards */}
                    <div className="balance-cards">
                        <div className="balance-card available">
                            <div className="card-glow"></div>
                            <div className="card-content">
                                <div className="card-header">
                                    <Icon icon="mdi:cash" className="card-icon" />
                                    <h3>Available Balance</h3>
                                </div>
                                <div className="card-balance">
                                    <span className="currency">₦</span>
                                    <span className="amount">{wallet?.balance?.toLocaleString() || '0.00'}</span>
                                </div>
                                <p className="card-description">Ready to use</p>
                            </div>
                            <div className="card-decoration"></div>
                        </div>

                        <div className="balance-card locked">
                            <div className="card-glow"></div>
                            <div className="card-content">
                                <div className="card-header">
                                    <Icon icon="mdi:lock" className="card-icon" />
                                    <h3>Locked Balance</h3>
                                </div>
                                <div className="card-balance">
                                    <span className="currency">₦</span>
                                    <span className="amount">{wallet?.locked_balance?.toLocaleString() || '0.00'}</span>
                                </div>
                                <p className="card-description">In pending transactions</p>
                            </div>
                            <div className="card-decoration"></div>
                        </div>

                        <div className="balance-card demo">
                            <div className="card-glow"></div>
                            <div className="card-content">
                                <div className="card-header">
                                    <Icon icon="mdi:gamepad" className="card-icon" />
                                    <h3>Demo Balance</h3>
                                </div>
                                <div className="card-balance">
                                    <span className="currency">₦</span>
                                    <span className="amount">{wallet?.demo_balance?.toLocaleString() || '0.00'}</span>
                                </div>
                                <p className="card-description">Practice funds</p>
                            </div>
                            <div className="card-decoration"></div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="quick-actions">
                        <div className="section-header">
                            <Icon icon="mdi:lightning-bolt" className="section-icon" />
                            <h2>Quick Actions</h2>
                        </div>
                        <div className="action-buttons">
                            <button 
                                className="action-button deposit-action"
                                onClick={() => setActiveTab('deposit')}
                            >
                                <div className="action-glow"></div>
                                <Icon icon="mdi:credit-card-plus" className="action-icon" />
                                <div className="action-text">
                                    <span className="action-title">Deposit Funds</span>
                                    <span className="action-subtitle">Add money to wallet</span>
                                </div>
                            </button>

                            <button 
                                className="action-button withdraw-action"
                                onClick={() => setActiveTab('withdraw')}
                            >
                                <div className="action-glow"></div>
                                <Icon icon="mdi:credit-card-minus" className="action-icon" />
                                <div className="action-text">
                                    <span className="action-title">Withdraw Funds</span>
                                    <span className="action-subtitle">Cash out winnings</span>
                                </div>
                            </button>

                            <button 
                                className="action-button refresh-action"
                                onClick={handleRefresh}
                            >
                                <div className="action-glow"></div>
                                <Icon icon="mdi:refresh" className="action-icon" />
                                <div className="action-text">
                                    <span className="action-title">Refresh Balance</span>
                                    <span className="action-subtitle">Update wallet status</span>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Recent Transactions Preview */}
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

                        {transactions && transactions.length > 0 ? (
                            <div className="transactions-table">
                                <div className="table-header">
                                    <div className="table-cell">Date</div>
                                    <div className="table-cell">Type</div>
                                    <div className="table-cell">Amount</div>
                                    <div className="table-cell">Status</div>
                                </div>
                                <div className="table-body">
                                    {transactions.slice(0, 5).map((tx) => (
                                        <div className="table-row" key={tx.id}>
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
                                                    ₦{parseFloat(tx.amount).toLocaleString()}
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
                                <Icon icon="mdi:receipt" className="empty-icon" />
                                <p>No transactions yet</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Deposit Tab */}
            {activeTab === 'deposit' && (
                <div className="deposit-content">
                    <div className="deposit-main">
                        <PaystackPayment />
                    </div>
                    <div className="deposit-tips">
                        <div className="tips-header">
                            <Icon icon="mdi:lightbulb-on" />
                            <h3>Deposit Tips</h3>
                        </div>
                        <div className="tips-list">
                            <div className="tip-item">
                                <Icon icon="mdi:check-circle" className="tip-icon" />
                                <span>Minimum deposit: ₦100.00</span>
                            </div>
                            <div className="tip-item">
                                <Icon icon="mdi:check-circle" className="tip-icon" />
                                <span>Instant credit upon successful payment</span>
                            </div>
                            <div className="tip-item">
                                <Icon icon="mdi:check-circle" className="tip-icon" />
                                <span>Secure payment via Paystack</span>
                            </div>
                            <div className="tip-item">
                                <Icon icon="mdi:check-circle" className="tip-icon" />
                                <span>Contact support for deposit issues</span>
                            </div>
                        </div>
                        <div className="tips-footer">
                            <Icon icon="mdi:shield-check" />
                            <span>Your funds are safe with us</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Withdraw Tab */}
            {activeTab === 'withdraw' && (
                <div className="withdraw-content">
                    <WithdrawalForm />
                </div>
            )}

            {/* Transactions Tab */}
            {activeTab === 'transactions' && (
                <div className="transactions-content">
                    <div className="section-header">
                        <div className="header-left">
                            <Icon icon="mdi:history" className="section-icon" />
                            <h2>Transaction History</h2>
                        </div>
                        <button className="refresh-btn" onClick={refreshWallet}>
                            <Icon icon="mdi:refresh" />
                            Refresh
                        </button>
                    </div>

                    {transactions && transactions.length > 0 ? (
                        <div className="full-transactions-table">
                            <div className="table-header full-header">
                                <div className="table-cell">Date</div>
                                <div className="table-cell">Type</div>
                                <div className="table-cell">Amount</div>
                                <div className="table-cell">Reference</div>
                                <div className="table-cell">Status</div>
                                <div className="table-cell">Details</div>
                            </div>
                            <div className="table-body">
                                {transactions.map((tx) => (
                                    <div className="table-row" key={tx.id}>
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
                                                ₦{parseFloat(tx.amount).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="table-cell reference-cell">
                                            <span className="reference">{tx.reference}</span>
                                        </div>
                                        <div className="table-cell">
                                            <span className={`status-badge ${tx.meta?.status || 'pending'}`}>
                                                {tx.meta?.status || 'pending'}
                                            </span>
                                        </div>
                                        <div className="table-cell details-cell">
                                            {tx.meta?.purpose && (
                                                <span className="purpose">{tx.meta.purpose}</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="no-transactions">
                            <Icon icon="mdi:receipt" className="empty-icon" />
                            <p>No transactions found</p>
                        </div>
                    )}
                </div>
            )}

            {/* Footer Info */}
            <div className="wallet-footer">
                <div className="footer-content">
                    <Icon icon="mdi:information" className="footer-icon" />
                    <p>Need help? Contact support at <span className="support-email">support@veltoragames.com</span> or visit our Help Center.</p>
                </div>
            </div>
        </div>
    );
};

export default WalletDashboard;