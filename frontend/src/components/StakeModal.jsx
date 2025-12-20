export default function StakeModal({ balance, onConfirm }) {
  const [amount, setAmount] = useState("");

  return (
    <div className="modal-glass">
      <h2>Place Your Bet</h2>
      <p>Balance: ₦{balance}</p>

      <input
        type="number"
        value={amount}
        onChange={e => setAmount(e.target.value)}
      />

      <button onClick={() => onConfirm(amount)}>
        Start Game
      </button>
    </div>
  );
}
