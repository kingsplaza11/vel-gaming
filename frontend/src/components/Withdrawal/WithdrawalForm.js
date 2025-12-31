import React, { useState, useEffect } from "react";
import { useWallet } from "../../contexts/WalletContext";
import { useNavigate } from "react-router-dom"; // Import navigate
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
  Container,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import { 
  AccountBalanceWallet, 
  AttachMoney, 
  Security, 
  AccessTime,
  CheckCircle,
  ArrowBack
} from "@mui/icons-material";

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
  const navigate = useNavigate(); // Initialize navigate
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
     WITHDRAWAL GUIDE
  ====================================================== */
  const withdrawalSteps = [
    {
      icon: <AccountBalanceWallet />,
      title: "Game Winnings",
      description: "All winnings from Treasure Hunt, Minesweeper, and Color Switch are instantly credited to your spot balance."
    },
    {
      icon: <AttachMoney />,
      title: "Transfer to Wallet",
      description: "To withdraw, winnings must be in your main wallet balance. Play games to earn, then withdraw."
    },
    {
      icon: <Security />,
      title: "Secure Withdrawals",
      description: "Enter your bank details below. We'll auto-verify your account name for security."
    },
    {
      icon: <AccessTime />,
      title: "Processing Time",
      description: "Withdrawals are processed within 24 hours on business days. Minimum withdrawal is ₦2,000."
    }
  ];

  /* ======================================================
     RENDER
  ====================================================== */
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Back Button */}
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate("/")}
        sx={{ mb: 3 }}
      >
        Back to Games
      </Button>

      {/* Header Section */}
      <Paper 
        elevation={3} 
        sx={{ 
          p: 4, 
          mb: 4, 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          borderRadius: 2
        }}
      >
        <Typography variant="h4" gutterBottom fontWeight="bold">
          💰 Withdraw Your Winnings
        </Typography>
        <Typography variant="h6" sx={{ mb: 2, opacity: 0.9 }}>
          Your game earnings are ready to cash out! Follow these simple steps:
        </Typography>
        
        <Grid container spacing={3} sx={{ mt: 2 }}>
          {withdrawalSteps.map((step, index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Box sx={{ 
                  mr: 2, 
                  background: 'rgba(255,255,255,0.2)',
                  borderRadius: '50%',
                  p: 1
                }}>
                  {step.icon}
                </Box>
                <Typography variant="subtitle1" fontWeight="bold">
                  {step.title}
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ opacity: 0.9, pl: 6 }}>
                {step.description}
              </Typography>
            </Grid>
          ))}
        </Grid>
      </Paper>

      {/* Balance Summary */}
      {wallet && (
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom color="primary">
              Your Balances
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <Box sx={{ 
                  p: 2, 
                  background: '#f5f5f5', 
                  borderRadius: 1,
                  textAlign: 'center'
                }}>
                  <Typography variant="body2" color="text.secondary">
                    Spot Balance (Game Winnings)
                  </Typography>
                  <Typography variant="h4" color="success.main" fontWeight="bold">
                    ₦{wallet.spot_balance?.toLocaleString() || '0'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Available to use in games
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box sx={{ 
                  p: 2, 
                  background: '#e8f5e9', 
                  borderRadius: 1,
                  textAlign: 'center',
                  border: '2px solid #4caf50'
                }}>
                  <Typography variant="body2" color="text.secondary">
                    Main Balance (Withdrawable)
                  </Typography>
                  <Typography variant="h4" color="primary" fontWeight="bold">
                    ₦{wallet.balance?.toLocaleString() || '0'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Ready to withdraw
                  </Typography>
                </Box>
              </Grid>
            </Grid>
            
            {wallet.spot_balance > 0 && (
              <Alert severity="info" sx={{ mt: 2 }}>
                💡 You have ₦{wallet.spot_balance?.toLocaleString()} in your spot balance. 
                Play more games to convert these winnings to your main balance for withdrawal!
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Info Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <CheckCircle color="success" sx={{ mr: 1 }} />
                <Typography variant="h6">Instant Verification</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                We automatically verify your account name when you enter bank details. 
                No manual verification needed!
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Security color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">100% Secure</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Your banking information is encrypted and secure. 
                We use bank-level security for all transactions.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <AccessTime color="warning" sx={{ mr: 1 }} />
                <Typography variant="h6">Fast Processing</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Most withdrawals are processed within a few hours during business days. 
                Weekends may take up to 24 hours.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Withdrawal Form */}
      <Card sx={{ maxWidth: 600, mx: "auto", mt: 4 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom color="primary">
            Withdraw Funds
          </Typography>

          {error && <Alert severity="error" sx={{ my: 2 }}>{error}</Alert>}

          <Alert severity="info" sx={{ my: 2 }}>
            💰 <strong>Available for Withdrawal:</strong> ₦{wallet?.balance?.toLocaleString() || '0'}
            <br />
            <small>Minimum withdrawal: ₦{MIN_WITHDRAWAL_AMOUNT.toLocaleString()}</small>
          </Alert>

          <Box component="form" onSubmit={handleSubmit} mt={2}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Amount to Withdraw (NGN)"
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
                    `Minimum: ₦${MIN_WITHDRAWAL_AMOUNT.toLocaleString()}`
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
                  helperText={errors.account_number || "Enter your 10-digit account number"}
                  required
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  select
                  fullWidth
                  label="Select Your Bank"
                  name="bank_code"
                  value={formData.bank_code}
                  onChange={handleChange}
                  required
                >
                  <MenuItem value="">
                    <em>Choose your bank</em>
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
                  label="Account Holder Name"
                  value={formData.account_name}
                  InputProps={{ readOnly: true }}
                  helperText={
                    resolving
                      ? "⏳ Resolving account name..."
                      : "✓ Will auto-fill when you enter bank details"
                  }
                />
              </Grid>

              <Grid item xs={12}>
                <Button
                  fullWidth
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={loading || resolving}
                  sx={{ 
                    py: 1.5,
                    background: 'linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #45a049 0%, #1b5e20 100%)',
                    }
                  }}
                >
                  {loading ? (
                    <CircularProgress size={24} color="inherit" />
                  ) : (
                    "💰 Withdraw Now"
                  )}
                </Button>
              </Grid>
            </Grid>
          </Box>

          {/* Important Notes */}
          <Box sx={{ mt: 4, pt: 2, borderTop: '1px solid #eee' }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              <strong>Important Notes:</strong>
            </Typography>
            <List dense>
              <ListItem sx={{ py: 0.5 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <span>✅</span>
                </ListItemIcon>
                <ListItemText 
                  primary="Ensure account name matches your ID" 
                  secondary="For security, withdrawals can only be sent to verified accounts"
                />
              </ListItem>
              <ListItem sx={{ py: 0.5 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <span>✅</span>
                </ListItemIcon>
                <ListItemText 
                  primary="Processing fee of ₦50 applies" 
                  secondary="Deducted from withdrawal amount"
                />
              </ListItem>
              <ListItem sx={{ py: 0.5 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <span>✅</span>
                </ListItemIcon>
                <ListItemText 
                  primary="Contact support for issues" 
                  secondary="Email: support@veltrogames.com | WhatsApp: +1 (825) 572-0351"
                />
              </ListItem>
            </List>
          </Box>
        </CardContent>
      </Card>

    </Container>
  );
};

export default WithdrawalForm;