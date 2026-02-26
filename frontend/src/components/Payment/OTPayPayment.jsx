// src/components/Payment/OTPayPayment.jsx
import React, { useMemo, useState } from "react";
import { walletService } from "../../services/walletService";
import {
  Box,
  Button,
  TextField,
  Typography,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";

const MIN_AMOUNT = 2000;
const MAX_AMOUNT = 10000000;

const OTPayPayment = ({ user }) => {
  const initialEmail = useMemo(() => user?.email || "", [user]);

  const [amount, setAmount] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [pendingRedirectUrl, setPendingRedirectUrl] = useState("");

  const validate = () => {
    const amountNum = Number(amount);

    if (!email || !email.includes("@")) {
      return "Please enter a valid email address";
    }

    if (!amount || Number.isNaN(amountNum)) {
      return "Please enter a valid amount";
    }

    if (amountNum < MIN_AMOUNT) {
      return `Minimum amount is ₦${MIN_AMOUNT.toLocaleString()}`;
    }

    if (amountNum > MAX_AMOUNT) {
      return `Maximum amount is ₦${MAX_AMOUNT.toLocaleString()}`;
    }

    return "";
  };

  const handlePayment = async () => {
    const errorMsg = validate();
    if (errorMsg) {
      setPaymentError(errorMsg);
      return;
    }

    if (loading) return;

    setPaymentError("");
    setLoading(true);

    try {
      const res = await walletService.initializeDeposit(Number(amount), email);

      const authorizationUrl = res?.data?.authorization_url;

      if (!authorizationUrl) {
        throw new Error("Unable to process payment. No authorization URL returned.");
      }

      setPendingRedirectUrl(authorizationUrl);
      setShowInfo(true);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Payment initialization failed";
      setPaymentError(msg);
    } finally {
      setLoading(false);
    }
  };

  const goToOTPay = () => {
    if (!pendingRedirectUrl) return;
    window.location.assign(pendingRedirectUrl);
  };

  return (
    <Card sx={{ maxWidth: 520, mx: "auto", mt: 4 }}>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          Fund Your Wallet
        </Typography>

        {paymentError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {paymentError}
          </Alert>
        )}

        <Box component="form" sx={{ mt: 1 }} onSubmit={(e) => e.preventDefault()}>
          <TextField
            fullWidth
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            margin="normal"
            required
            disabled={loading}
          />

          <TextField
            fullWidth
            label="Amount (NGN)"
            type="number"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setPaymentError("");
            }}
            margin="normal"
            required
            disabled={loading}
            inputProps={{ min: MIN_AMOUNT, max: MAX_AMOUNT, step: 100 }}
            helperText={`Minimum: ₦${MIN_AMOUNT.toLocaleString()} | Maximum: ₦${MAX_AMOUNT.toLocaleString()}`}
          />

          <Button
            fullWidth
            variant="contained"
            color="primary"
            onClick={handlePayment}
            disabled={loading || !amount || !email}
            sx={{ mt: 3 }}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : "Proceed to OTPay"}
          </Button>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
          You will be redirected to OTPay to complete your payment securely.
        </Typography>
      </CardContent>

      <Dialog open={showInfo} onClose={() => setShowInfo(false)}>
        <DialogTitle>Redirecting to OTPay</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Your transaction has been created successfully. Click continue to complete payment on OTPay.
          </Alert>
          <Typography variant="body2" color="text.secondary">
            If the OTPay page doesn’t open, disable ad-blockers for this site and try again.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowInfo(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={goToOTPay} variant="contained">
            Continue
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default OTPayPayment;