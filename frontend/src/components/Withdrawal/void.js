// WithdrawalForm.jsx
import React, { useState, useEffect } from "react";
import { useWallet } from "../../contexts/WalletContext";
import { useNavigate } from "react-router-dom";
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
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton
} from "@mui/material";
import { 
  AccountBalanceWallet, 
  AttachMoney, 
  Security, 
  AccessTime,
  ArrowBack,
  Close
} from "@mui/icons-material";

/* ======================================================
   CONSTANTS
====================================================== */
const MIN_WITHDRAWAL_AMOUNT = 2000;
const PROCESSING_FEE = 50;

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
  const navigate = useNavigate();
  const { wallet, loading: walletLoading, fetchWallet } = useWallet();
  
  const [formData, setFormData] = useState({
    amount: "",
    account_number: "",
    bank_code: "",
    bank_name: "",
    account_name: "",
  });

  const [errors, setErrors] = useState({});
  const [resolving, setResolving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successDialog, setSuccessDialog] = useState(false);
  const [withdrawalDetails, setWithdrawalDetails] = useState(null);

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
        setErrors((prev) => ({ ...prev, account_number: "" }));
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
    setErrors({});

    const amount = Number(formData.amount);

    // Validation
    if (!amount || amount < MIN_WITHDRAWAL_AMOUNT) {
      setErrors({
        amount: `Minimum withdrawal amount is ₦${MIN_WITHDRAWAL_AMOUNT.toLocaleString()}`,
      });
      return;
    }

    if (!wallet || amount > wallet.spot_balance) {
      setErrors({
        amount: `Insufficient spot balance. Available: ₦${wallet?.spot_balance?.toLocaleString() || '0'}`,
      });
      return;
    }

    if (!formData.account_number || formData.account_number.length !== 10) {
      setErrors({
        account_number: "Please enter a valid 10-digit account number",
      });
      return;
    }

    if (!formData.bank_code) {
      setErrors({
        bank_code: "Please select a bank",
      });
      return;
    }

    setSubmitting(true);

    try {
      const response = await api.post("/wallet/withdraw/", {
        amount: amount.toString(),
        account_number: formData.account_number,
        bank_code: formData.bank_code,
        bank_name: formData.bank_name,
        account_name: formData.account_name,
      });

      if (response.data.status) {
        // Store withdrawal details for success dialog
        setWithdrawalDetails({
          reference: response.data.withdrawal_reference,
          amount: amount,
          processingFee: PROCESSING_FEE,
          netAmount: amount - PROCESSING_FEE,
          estimatedTime: response.data.estimated_time,
        });
        
        // Reset form
        setFormData({
          amount: "",
          account_number: "",
          bank_code: "",
          bank_name: "",
          account_name: "",
        });
        
        // Show success dialog
        setSuccessDialog(true);
        
        // Refresh wallet balance
        fetchWallet();
      } else {
        setErrors({ submit: response.data.message || "Withdrawal failed" });
      }
    } catch (error) {
      console.error("Withdrawal error:", error);
      setErrors({
        submit: error.response?.data?.message || "An error occurred. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  /* ======================================================
     CALCULATE NET AMOUNT
  ====================================================== */
  const calculateNetAmount = () => {
    const amount = Number(formData.amount) || 0;
    if (amount >= MIN_WITHDRAWAL_AMOUNT) {
      const net = amount - PROCESSING_FEE;
      return {
        netAmount: net,
        fee: PROCESSING_FEE,
        isValid: true
      };
    }
    return { netAmount: 0, fee: 0, isValid: false };
  };

  const netInfo = calculateNetAmount();

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
                  background: '#e8f5e9', 
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
                    Available for withdrawal
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box sx={{ 
                  p: 2, 
                  background: '#f5f5f5', 
                  borderRadius: 1,
                  textAlign: 'center'
                }}>
                  <Typography variant="body2" color="text.secondary">
                    Deposit Balance
                  </Typography>
                  <Typography variant="h4" color="primary" fontWeight="bold">
                    ₦{wallet.balance?.toLocaleString() || '0'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    For playing games
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Withdrawal Form */}
      <Card sx={{ maxWidth: 600, mx: "auto", mt: 4 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom color="primary">
            Withdraw Funds
          </Typography>

          {errors.submit && (
            <Alert severity="error" sx={{ my: 2 }}>
              {errors.submit}
            </Alert>
          )}

          <Alert severity="info" sx={{ my: 2 }}>
            💰 <strong>Available for Withdrawal:</strong> ₦{wallet?.spot_balance?.toLocaleString() || '0'}
            <br />
            <small>Minimum withdrawal: ₦{MIN_WITHDRAWAL_AMOUNT.toLocaleString()} (₦{PROCESSING_FEE} processing fee applies)</small>
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
                    (formData.amount && netInfo.isValid ? 
                      `Net amount after fees: ₦${netInfo.netAmount.toLocaleString()}` : 
                      `Minimum: ₦${MIN_WITHDRAWAL_AMOUNT.toLocaleString()}`)
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
                  error={!!errors.bank_code}
                  helperText={errors.bank_code}
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
                      : formData.account_name 
                        ? "✓ Account verified"
                        : "Will auto-fill when you enter bank details"
                  }
                />
              </Grid>

              <Grid item xs={12}>
                <Button
                  fullWidth
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={submitting || resolving || walletLoading}
                  sx={{ 
                    py: 1.5,
                    background: 'linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #45a049 0%, #1b5e20 100%)',
                    }
                  }}
                >
                  {submitting ? (
                    <CircularProgress size={24} color="inherit" />
                  ) : (
                    "💰 Submit Withdrawal Request"
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
                  primary="Processing fee of ₦50 applies" 
                  secondary="Deducted from withdrawal amount"
                />
              </ListItem>
              <ListItem sx={{ py: 0.5 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <span>✅</span>
                </ListItemIcon>
                <ListItemText 
                  primary="Processing time: 24-48 hours" 
                  secondary="On business days only (Mon-Fri, 9am-5pm)"
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

      {/* Success Dialog */}
      <Dialog 
        open={successDialog} 
        onClose={() => setSuccessDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" color="success.main">
            ✅ Withdrawal Request Submitted!
          </Typography>
          <IconButton onClick={() => setSuccessDialog(false)}>
            <Close />
          </IconButton>
        </DialogTitle>
        
        <DialogContent>
          {withdrawalDetails && (
            <Box>
              <Alert severity="success" sx={{ mb: 2 }}>
                Your withdrawal request has been received and is pending admin approval.
              </Alert>
              
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Transaction Details:
                  </Typography>
                  <Grid container spacing={1}>
                    <Grid item xs={6}>
                      <Typography variant="body2">Reference:</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" fontWeight="bold">
                        {withdrawalDetails.reference}
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={6}>
                      <Typography variant="body2">Amount:</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2">₦{withdrawalDetails.amount.toLocaleString()}</Typography>
                    </Grid>
                    
                    <Grid item xs={6}>
                      <Typography variant="body2">Processing Fee:</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2">-₦{withdrawalDetails.processingFee.toLocaleString()}</Typography>
                    </Grid>
                    
                    <Grid item xs={6}>
                      <Typography variant="body2" fontWeight="bold">Net Amount:</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" fontWeight="bold" color="success.main">
                        ₦{withdrawalDetails.netAmount.toLocaleString()}
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={6}>
                      <Typography variant="body2">Estimated Time:</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2">{withdrawalDetails.estimatedTime}</Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
              
              <Typography variant="body2" color="text.secondary">
                Please keep your reference number for tracking. You will receive a notification once your withdrawal is processed.
              </Typography>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => navigate("/withdrawal/history")} variant="outlined">
            View History
          </Button>
          <Button 
            onClick={() => {
              setSuccessDialog(false);
              navigate("/");
            }} 
            variant="contained"
            color="primary"
          >
            Back to Games
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default WithdrawalForm;