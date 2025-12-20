import React, { useEffect, useState } from "react";
import { walletService } from "../services/walletService";
import DepositModal from "../components/wallet/DepositModal";
import WithdrawModal from "../components/wallet/WithdrawModal";
import "./WalletDashboard.css";

const WalletDashboard = () => {
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);

  useEffect(() => {
    loadWallet();
  }, []);

  const loadWallet = async () => {
    const res = await walletService.getDashboard();
    setWallet(res.data.wallet);
    setTransactions(res.data.transactions);
  };

  const format = (v) =>
    Number(v || 0).toLocaleString("en-NG", {
      minimumFractionDigits: 2,
    });

  return (
    <div className="wallet-page">
      <h1 className="wallet-title">Veltro Games Wallet</h1>

      <div className="wallet-balance-card">
        <p>Available Balance</p>
        <h2>₦{format(wallet?.balance)}</h2>

        <div className="wallet-actions">
          <button onClick={() => setShowDeposit(true)}>Deposit</button>
          <button onClick={() => setShowWithdraw(true)}>Withdraw</button>
        </div>
      </div>

      <div className="wallet-transactions">
        <h3>Transaction History</h3>

        {transactions.length === 0 && (
          <p className="empty">No transactions yet</p>
        )}

        {transactions.map((tx) => (
          <div key={tx.reference} className={`tx ${tx.tx_type.toLowerCase()}`}>
            <span>{tx.tx_type}</span>
            <span>₦{format(tx.amount)}</span>
            <span>{new Date(tx.created_at).toLocaleString()}</span>
            <span className={`status ${tx.meta.status}`}>
              {tx.meta.status}
            </span>
          </div>
        ))}
      </div>

      {showDeposit && (
        <DepositModal
          onClose={() => setShowDeposit(false)}
          onSuccess={loadWallet}
        />
      )}

      {showWithdraw && (
        <WithdrawModal
          balance={wallet?.balance}
          onClose={() => setShowWithdraw(false)}
          onSuccess={loadWallet}
        />
      )}
    </div>
  );
};

export default WalletDashboard;
