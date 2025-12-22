import React, { useState } from "react";
import { walletService } from "../../services/walletService";
import { Icon } from "@iconify/react";
import "./WalletModals.css";

const DepositModal = ({ onClose }) => {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAmountChange = (e) => {
    const value = e.target.value;
    if (value === "" || (parseInt(value) > 0 && parseInt(value) <= 1000000)) {
      setAmount(value);
      setError("");
    } else if (parseInt(value) > 1000000) {
      setError("Maximum deposit amount is ₦1,000,000");
    }
  };

  const startDeposit = async () => {
    if (!amount || parseInt(amount) < 100) {
      setError("Minimum deposit amount is ₦100");
      return;
    }

    setLoading(true);
    setError("");
    
    try {
      const res = await walletService.initializeDeposit(amount);
      if (res.data?.authorization_url) {
        window.location.href = res.data.authorization_url;
      } else {
        setError("Unable to process payment. Please try again.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Payment initialization failed");
    } finally {
      setLoading(false);
    }
  };

  const quickAmounts = [500, 1000, 5000, 10000, 50000, 100000];

  return (
    <div className="wallet-modal-overlay">
      <div className="wallet-modal-container">
        <div className="wallet-modal-header">
          <div className="modal-title">
            <div className="modal-icon-wrapper">
              <Icon icon="mdi:credit-card-plus" className="modal-icon" />
              <div className="modal-glow"></div>
            </div>
            <h3>Deposit Funds</h3>
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

          <div className="amount-section">
            <label className="input-label">
              <Icon icon="mdi:cash" className="label-icon" />
              Enter Amount
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
                max="1000000"
                step="100"
              />
            </div>

            <div className="quick-amounts">
              <p className="quick-amounts-label">Quick select:</p>
              <div className="quick-amounts-grid">
                {quickAmounts.map((quickAmount) => (
                  <button
                    key={quickAmount}
                    className={`quick-amount-btn ${amount === quickAmount.toString() ? 'active' : ''}`}
                    onClick={() => {
                      setAmount(quickAmount.toString());
                      setError("");
                    }}
                  >
                    ₦{quickAmount.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="payment-info">
            <div className="info-item">
              <Icon icon="mdi:shield-check" className="info-icon" />
              <div className="info-text">
                <span className="info-title">Secure Payment</span>
                <span className="info-subtitle">Powered by Paystack</span>
              </div>
            </div>
            
            <div className="info-item">
              <Icon icon="mdi:lightning-bolt" className="info-icon" />
              <div className="info-text">
                <span className="info-title">Instant Credit</span>
                <span className="info-subtitle">Funds added immediately</span>
              </div>
            </div>
            
            <div className="info-item">
              <Icon icon="mdi:lock" className="info-icon" />
              <div className="info-text">
                <span className="info-title">Safe & Secure</span>
                <span className="info-subtitle">Bank-level encryption</span>
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
            className="modal-primary-btn deposit-btn"
            onClick={startDeposit}
            disabled={loading || !amount}
          >
            {loading ? (
              <>
                <div className="loading-spinner-small"></div>
                Processing...
              </>
            ) : (
              <>
                <Icon icon="mdi:credit-card-scan" />
                Proceed to Payment
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DepositModal;