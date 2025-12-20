import React, { useState } from "react";
import { walletService } from "../../services/walletService";

const BANKS = [
  { code: "058", name: "GTBank" },
  { code: "044", name: "Access Bank" },
  { code: "011", name: "First Bank" },
  { code: "070", name: "Fidelity" },
  { code: "057", name: "Zenith Bank" },
  { code: "033", name: "UBA" },
  { code: "032", name: "Union Bank" },
  { code: "035", name: "Wema Bank" },
];

const WithdrawModal = ({ balance, onClose, onSuccess }) => {
  const [amount, setAmount] = useState("");
  const [bank, setBank] = useState("");
  const [account, setAccount] = useState("");
  const [accountName, setAccountName] = useState("");

  const resolveName = async () => {
    if (account.length === 10 && bank) {
      const res = await walletService.resolveAccount(bank, account);
      setAccountName(res.data.account_name);
    }
  };

  const submitWithdraw = async () => {
    await walletService.autoWithdraw({
      amount,
      bank_code: bank,
      account_number: account,
    });
    onSuccess();
    onClose();
  };

  return (
    <div className="wallet-modal">
      <h3>Withdraw Funds</h3>

      <input
        type="number"
        placeholder="Amount ₦"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      <select onChange={(e) => setBank(e.target.value)}>
        <option value="">Select Bank</option>
        {BANKS.map((b) => (
          <option key={b.code} value={b.code}>{b.name}</option>
        ))}
      </select>

      <input
        type="text"
        placeholder="Account Number"
        value={account}
        onChange={(e) => {
          setAccount(e.target.value);
          setAccountName("");
        }}
        onBlur={resolveName}
      />

      {accountName && <p className="account-name">{accountName}</p>}

      <button onClick={submitWithdraw}>Withdraw Instantly</button>
      <button className="ghost" onClick={onClose}>Cancel</button>
    </div>
  );
};

export default WithdrawModal;
