// src/components/Payment/PaystackPayment.jsx
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

const MIN_AMOUNT = 100;
const MAX_AMOUNT = 1000000;

const PaystackPayment = ({ user }) => {
  const initialEmail = useMemo(() => user?.email || "", [user]);

  const [amount, setAmount] = useState("");
  const [email, setEmail] = useState(initialEmail);

  const [loading, setLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  // Optional: small "ready" dialog before redirect (some people like feedback)
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

    // Prevent double init
    if (loading) return;

    setPaymentError("");
    setLoading(true);

    try {
      // IMPORTANT:
      // This MUST call your backend fund endpoint and return { authorization_url }
      // Your logs show backend is already returning it correctly.
      const res = await walletService.initializeDeposit(Number(amount), email);

      // Expect either:
      // res.data.data.authorization_url (your backend)
      // OR res.data.authorization_url (some services return direct)
      const authorizationUrl =
        res?.data?.data?.authorization_url || res?.data?.authorization_url;

      if (!authorizationUrl) {
        throw new Error("Unable to process payment. No authorization URL returned.");
      }

      // Option 1: redirect immediately
      // window.location.assign(authorizationUrl);

      // Option 2 (clean UX): show a short dialog before redirect
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

  const goToPaystack = () => {
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
            {loading ? <CircularProgress size={24} color="inherit" /> : "Proceed to Paystack"}
          </Button>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
          You will be redirected to Paystack to complete your payment securely.
        </Typography>
      </CardContent>

      {/* Optional info dialog before redirect */}
      <Dialog open={showInfo} onClose={() => setShowInfo(false)}>
        <DialogTitle>Redirecting to Paystack</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Your transaction has been created successfully. Click continue to complete payment on Paystack.
          </Alert>
          <Typography variant="body2" color="text.secondary">
            If the Paystack page doesn’t open, disable ad-blockers for this site and try again.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowInfo(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={goToPaystack} variant="contained">
            Continue
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default PaystackPayment;
