import React, { useState, useEffect } from "react";
import { walletService } from "../../services/walletService";
import { Icon } from "@iconify/react";
import "./WalletModals.css";

const BANKS = [
  { code: "058", name: "GTBank" },
  { code: "044", name: "Access Bank" },
  { code: "011", name: "First Bank" },
  { code: "070", name: "Fidelity Bank" },
  { code: "057", name: "Zenith Bank" },
  { code: "033", name: "UBA" },
  { code: "032", name: "Union Bank" },
  { code: "035", name: "Wema Bank" },
  { code: "050", name: "Ecobank Nigeria" },
  { code: "214", name: "First City Monument Bank" },
  { code: "301", name: "Jaiz Bank" },
  { code: "076", name: "Polaris Bank" },
  { code: "101", name: "Providus Bank" },
  { code: "221", name: "Stanbic IBTC Bank" },
  { code: "068", name: "Standard Chartered Bank" },
  { code: "232", name: "Sterling Bank" },
  { code: "100", name: "SunTrust Bank Nigeria" },
  { code: "215", name: "Unity Bank" },
];

const WithdrawModal = ({ balance, onClose, onSuccess }) => {
  const [amount, setAmount] = useState("");
  const [bank, setBank] = useState("");
  const [account, setAccount] = useState("");
  const [accountName, setAccountName] = useState("");
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState("");

  const handleAmountChange = (e) => {
    const value = e.target.value;
    const numValue = parseInt(value);
    
    if (value === "" || (numValue > 0 && numValue <= parseInt(balance || 0))) {
      setAmount(value);
      setError("");
    } else if (numValue > parseInt(balance || 0)) {
      setError("Amount exceeds available balance");
    }
  };

  const resolveName = async () => {
    if (account.length === 10 && bank) {
      setResolving(true);
      setError("");
      try {
        const res = await walletService.resolveAccount(bank, account);
        if (res.data?.account_name) {
          setAccountName(res.data.account_name);
        } else {
          setError("Unable to resolve account name");
        }
      } catch (err) {
        setError("Invalid account number or bank");
        setAccountName("");
      } finally {
        setResolving(false);
      }
    }
  };

  const submitWithdraw = async () => {
    if (!amount || parseInt(amount) < 100) {
      setError("Minimum withdrawal amount is ₦100");
      return;
    }

    if (!bank) {
      setError("Please select a bank");
      return;
    }

    if (!account || account.length !== 10) {
      setError("Please enter a valid 10-digit account number");
      return;
    }

    if (!accountName) {
      setError("Please verify account details");
      return;
    }

    if (parseInt(amount) > parseInt(balance || 0)) {
      setError("Amount exceeds available balance");
      return;
    }

    setLoading(true);
    setError("");
    
    try {
      await walletService.autoWithdraw({
        amount,
        bank_code: bank,
        account_number: account,
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Withdrawal failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const quickAmounts = [
    { amount: 1000, label: "₦1,000" },
    { amount: 5000, label: "₦5,000" },
    { amount: 10000, label: "₦10,000" },
    { amount: 50000, label: "₦50,000" },
  ];

  useEffect(() => {
    if (account.length === 10 && bank) {
      const timeoutId = setTimeout(() => {
        resolveName();
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [account, bank]);

  return (
    <div className="wallet-modal-overlay">
      <div className="wallet-modal-container">
        <div className="wallet-modal-header">
          <div className="modal-title">
            <div className="modal-icon-wrapper">
              <Icon icon="mdi:credit-card-minus" className="modal-icon" />
              <div className="modal-glow"></div>
            </div>
            <h3>Withdraw Funds</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <Icon icon="mdi:close" />
          </button>
        </div>

        <div className="wallet-modal-content">
          {error && (
            <div className="modal-error">
              <Icon icon="mdi:alert-circle" />
              <span>{error}</span>
            </div>
          )}

          <div className="balance-display">
            <div className="balance-info">
              <Icon icon="mdi:wallet" className="balance-icon" />
              <div className="balance-text">
                <span className="balance-label">Available Balance</span>
                <span className="balance-amount">₦{parseInt(balance || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="form-section">
            <div className="amount-section">
              <label className="input-label">
                <Icon icon="mdi:cash" className="label-icon" />
                Withdrawal Amount
              </label>
              
              <div className="amount-input-wrapper">
                <span className="amount-prefix">₦</span>
                <input
                  type="number"
                  className="amount-input"
                  placeholder="0.00"
                  value={amount}
                  onChange={handleAmountChange}
                  min="100"
                  max={balance || 0}
                  step="100"
                />
              </div>

              <div className="quick-amounts">
                <p className="quick-amounts-label">Quick select:</p>
                <div className="quick-amounts-grid">
                  {quickAmounts.map((item) => (
                    <button
                      key={item.amount}
                      className={`quick-amount-btn ${amount === item.amount.toString() ? 'active' : ''}`}
                      onClick={() => {
                        setAmount(item.amount.toString());
                        setError("");
                      }}
                      disabled={item.amount > parseInt(balance || 0)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="bank-details-section">
              <div className="input-group">
                <label className="input-label">
                  <Icon icon="mdi:bank" className="label-icon" />
                  Select Bank
                </label>
                <div className="select-wrapper">
                  <select
                    className="bank-select"
                    value={bank}
                    onChange={(e) => {
                      setBank(e.target.value);
                      setAccountName("");
                      setError("");
                    }}
                  >
                    <option value="">Choose your bank</option>
                    {BANKS.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <Icon icon="mdi:chevron-down" className="select-arrow" />
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">
                  <Icon icon="mdi:numeric" className="label-icon" />
                  Account Number
                </label>
                <div className="input-wrapper">
                  <input
                    type="text"
                    className="account-input"
                    placeholder="Enter 10-digit account number"
                    value={account}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "").slice(0, 10);
                      setAccount(value);
                      if (value.length !== 10) {
                        setAccountName("");
                      }
                    }}
                    maxLength="10"
                  />
                  {account.length === 10 && bank && (
                    <button 
                      className="verify-btn"
                      onClick={resolveName}
                      disabled={resolving}
                    >
                      {resolving ? (
                        <div className="loading-spinner-tiny"></div>
                      ) : (
                        <Icon icon="mdi:check" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {accountName && (
                <div className="account-verified">
                  <div className="verified-content">
                    <Icon icon="mdi:check-circle" className="verified-icon" />
                    <div className="verified-text">
                      <span className="verified-label">Account Verified</span>
                      <span className="verified-name">{accountName}</span>
                    </div>
                  </div>
                  <div className="verified-glow"></div>
                </div>
              )}
            </div>

            <div className="withdrawal-info">
              <div className="info-item">
                <Icon icon="mdi:clock-fast" className="info-icon" />
                <div className="info-text">
                  <span className="info-title">Instant Processing</span>
                  <span className="info-subtitle">Within 24 hours</span>
                </div>
              </div>
              
              <div className="info-item">
                <Icon icon="mdi:currency-ngn" className="info-icon" />
                <div className="info-text">
                  <span className="info-title">₦100 Minimum</span>
                  <span className="info-subtitle">Per transaction</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="wallet-modal-footer">
          <button 
            className="modal-secondary-btn"
            onClick={onClose}
            disabled={loading}
          >
            <Icon icon="mdi:close" />
            Cancel
          </button>
          
          <button 
            className="modal-primary-btn withdraw-btn"
            onClick={submitWithdraw}
            disabled={loading || !amount || !bank || !account || !accountName}
          >
            {loading ? (
              <>
                <div className="loading-spinner-small"></div>
                Processing...
              </>
            ) : (
              <>
                <Icon icon="mdi:bank-transfer" />
                Withdraw Now
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WithdrawModal;