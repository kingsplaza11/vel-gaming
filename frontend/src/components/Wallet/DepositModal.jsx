import React, { useState } from "react";
import { walletService } from "../../services/walletService";

const DepositModal = ({ onClose }) => {
  const [amount, setAmount] = useState("");

  const startDeposit = async () => {
    const res = await walletService.initializeDeposit(amount);
    window.location.href = res.data.authorization_url;
  };

  return (
    <div className="wallet-modal">
      <h3>Deposit Funds</h3>

      <input
        type="number"
        placeholder="Amount ₦"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      <button onClick={startDeposit}>Proceed to Paystack</button>
      <button className="ghost" onClick={onClose}>Cancel</button>
    </div>
  );
};

export default DepositModal;
