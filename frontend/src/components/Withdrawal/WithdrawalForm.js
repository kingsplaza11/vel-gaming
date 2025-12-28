import React, { useState, useEffect } from "react";
import { useWallet } from "../../contexts/WalletContext";
import api from "../../services/api";
import {
  Box,
  Button,
  TextField,
  Typography,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  MenuItem,
  Grid,
} from "@mui/material";

/* ======================================================
   CONSTANTS
====================================================== */
const MIN_WITHDRAWAL_AMOUNT = 2000;

/* ======================================================
   BANK LIST
====================================================== */
const NIGERIAN_BANKS = [
  { code: "044", name: "Access Bank" },
  { code: "011", name: "First Bank of Nigeria" },
  { code: "058", name: "Guaranty Trust Bank (GTB)" },
  { code: "033", name: "United Bank for Africa (UBA)" },
  { code: "057", name: "Zenith Bank" },
  { code: "070", name: "Fidelity Bank" },
  { code: "050", name: "Ecobank Nigeria" },
  { code: "232", name: "Sterling Bank" },
  { code: "032", name: "Union Bank of Nigeria" },
  { code: "035", name: "Wema Bank" },
  { code: "221", name: "Stanbic IBTC Bank" },
  { code: "214", name: "FCMB" },
  { code: "076", name: "Polaris Bank" },
  { code: "082", name: "Keystone Bank" },
  { code: "301", name: "Jaiz Bank" },

  // Fintechs
  { code: "999992", name: "OPay" },
  { code: "999991", name: "PalmPay" },
  { code: "50211", name: "Kuda Bank" },
  { code: "999993", name: "Moniepoint MFB" },
  { code: "090267", name: "Carbon" },
  { code: "090110", name: "VFD MFB" },
  { code: "090405", name: "FairMoney" },
  { code: "090188", name: "Paga" },
];

const WithdrawalForm = () => {
  const { withdrawFunds, wallet, loading, error } = useWallet();

  const [formData, setFormData] = useState({
    amount: "",
    account_number: "",
    bank_code: "",
    bank_name: "",
    account_name: "",
  });

  const [errors, setErrors] = useState({});
  const [resolving, setResolving] = useState(false);

  /* ======================================================
     AUTO RESOLVE ACCOUNT NAME
  ====================================================== */
  useEffect(() => {
    const { bank_code, account_number } = formData;

    if (bank_code && account_number.length === 10) {
      resolveAccountName(bank_code, account_number);
    }
  }, [formData.bank_code, formData.account_number]);

  const resolveAccountName = async (bank_code, account_number) => {
    setResolving(true);
    try {
      const res = await api.get(
        `/wallet/resolve_account/?bank_code=${bank_code}&account_number=${account_number}`
      );

      if (res.data?.account_name) {
        setFormData((prev) => ({
          ...prev,
          account_name: res.data.account_name,
        }));
      }
    } catch {
      setErrors((prev) => ({
        ...prev,
        account_number: "Unable to resolve account name",
      }));
    } finally {
      setResolving(false);
    }
  };

  /* ======================================================
     HANDLERS
  ====================================================== */
  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (name === "bank_code") {
      const bank = NIGERIAN_BANKS.find((b) => b.code === value);
      if (bank) {
        setFormData((prev) => ({
          ...prev,
          bank_name: bank.name,
          account_name: "",
        }));
      }
    }

    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const amount = Number(formData.amount);

    if (!amount || amount < MIN_WITHDRAWAL_AMOUNT) {
      setErrors({
        amount: `Minimum withdrawal amount is ₦${MIN_WITHDRAWAL_AMOUNT.toLocaleString()}`,
      });
      return;
    }

    if (wallet && amount > wallet.balance) {
      setErrors({
        amount: "Insufficient wallet balance",
      });
      return;
    }

    const result = await withdrawFunds(formData);

    if (result.success) {
      alert("Withdrawal request submitted successfully");
      setFormData({
        amount: "",
        account_number: "",
        bank_code: "",
        bank_name: "",
        account_name: "",
      });
      setErrors({});
    } else {
      alert(result.message || "Withdrawal failed");
    }
  };

  /* ======================================================
     RENDER
  ====================================================== */
  return (
    <Card sx={{ maxWidth: 600, mx: "auto", mt: 4 }}>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          Withdraw Funds
        </Typography>

        {wallet && (
          <Alert severity="info" sx={{ my: 2 }}>
            Available Balance: ₦{wallet.balance.toLocaleString()}
          </Alert>
        )}

        {error && <Alert severity="error">{error}</Alert>}

        <Box component="form" onSubmit={handleSubmit} mt={2}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Amount (NGN)"
                name="amount"
                type="number"
                value={formData.amount}
                onChange={handleChange}
                required
                inputProps={{
                  min: MIN_WITHDRAWAL_AMOUNT,
                  step: 100,
                }}
                error={!!errors.amount}
                helperText={
                  errors.amount ||
                  `Minimum withdrawal: ₦${MIN_WITHDRAWAL_AMOUNT.toLocaleString()}`
                }
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Account Number"
                name="account_number"
                value={formData.account_number}
                onChange={handleChange}
                inputProps={{ maxLength: 10 }}
                error={!!errors.account_number}
                helperText={errors.account_number}
                required
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                label="Bank"
                name="bank_code"
                value={formData.bank_code}
                onChange={handleChange}
                required
              >
                <MenuItem value="">
                  <em>Select bank</em>
                </MenuItem>
                {NIGERIAN_BANKS.map((bank) => (
                  <MenuItem key={bank.code} value={bank.code}>
                    {bank.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Account Name"
                value={formData.account_name}
                InputProps={{ readOnly: true }}
                helperText={
                  resolving
                    ? "Resolving account name..."
                    : "Auto-filled from bank"
                }
              />
            </Grid>

            <Grid item xs={12}>
              <Button
                fullWidth
                type="submit"
                variant="contained"
                disabled={loading || resolving}
              >
                {loading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  "Withdraw Funds"
                )}
              </Button>
            </Grid>
          </Grid>
        </Box>
      </CardContent>
    </Card>
  );
};

export default WithdrawalForm;
