// src/components/Payment/OTPayVirtualPayment.jsx
import React, { useState, useEffect } from "react";
import { useWallet } from '../../contexts/WalletContext';
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
  Paper,
  Divider,
  Stepper,
  Step,
  StepLabel,
  IconButton,
  Tooltip,
  Snackbar,
  Chip,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PaymentIcon from '@mui/icons-material/Payment';
import ErrorIcon from '@mui/icons-material/Error';
import SuccessIcon from '@mui/icons-material/CheckCircle';
import PendingIcon from '@mui/icons-material/Pending';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import InfoIcon from '@mui/icons-material/Info';

const MIN_AMOUNT = 100;
const MAX_AMOUNT = 10000000;

const OTPayVirtualPayment = ({ user, onSuccess }) => {
  const { refreshWallet } = useWallet();
  const [amount, setAmount] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState("");
  const [virtualAccount, setVirtualAccount] = useState(null);
  const [reference, setReference] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState("idle"); // idle, created, completed, expired
  const [copiedField, setCopiedField] = useState(null);
  const [timeLeft, setTimeLeft] = useState(1800); // 30 minutes in seconds
  const [checkInterval, setCheckInterval] = useState(null);
  const [showCopiedSnackbar, setShowCopiedSnackbar] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [transactionDetails, setTransactionDetails] = useState(null);
  const [supportAttempts, setSupportAttempts] = useState(0);

  const steps = ['Enter Amount', 'Make Transfer', 'Confirmation'];
  const [activeStep, setActiveStep] = useState(0);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (checkInterval) {
        clearInterval(checkInterval);
      }
    };
  }, [checkInterval]);

  // Timer countdown
  useEffect(() => {
    if (paymentStatus === 'created' && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setPaymentStatus('expired');
            setPaymentError('Payment window expired. Please start over.');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [paymentStatus, timeLeft]);

  // Auto-polling for payment status
  const startPolling = (ref) => {
    if (checkInterval) clearInterval(checkInterval);
    
    setPollCount(0);
    const maxPolls = 180; // Poll for 15 minutes (180 * 5 seconds)
    
    const interval = setInterval(async () => {
      setPollCount(prev => {
        const newCount = prev + 1;
        if (newCount > maxPolls) {
          console.log("Max polling attempts reached, stopping");
          clearInterval(interval);
          setCheckInterval(null);
          return prev;
        }
        return newCount;
      });
      
      try {
        console.log(`Polling attempt ${pollCount + 1} for reference:`, ref);
        const response = await walletService.checkPaymentStatus(ref);
        
        // Check if transaction is completed (using meta.status as in your backend)
        const isCompleted = 
          response.data?.meta?.status === 'completed' ||
          response.data?.status === 'completed' ||
          response.data?.transaction_status === 'COMPLETED';
        
        if (isCompleted) {
          console.log("Payment completed, stopping poll");
          clearInterval(interval);
          setPaymentStatus('completed');
          setActiveStep(2);
          setPaymentSuccess(`Payment of ₦${Number(amount).toLocaleString()} confirmed!`);
          setTransactionDetails(response.data);
          
          // Refresh wallet balance
          await refreshWallet();
          
          if (onSuccess) onSuccess(response.data);
        }
      } catch (error) {
        console.error('Error checking payment status:', error);
        // Don't stop polling on error
      }
    }, 5000); // Check every 5 seconds
    
    setCheckInterval(interval);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const validate = () => {
    const amountNum = Number(amount);

    if (!amount || Number.isNaN(amountNum)) {
      return "Please enter a valid amount";
    }

    if (amountNum < MIN_AMOUNT) {
      return `Minimum amount is ₦${MIN_AMOUNT.toLocaleString()}`;
    }

    if (amountNum > MAX_AMOUNT) {
      return `Maximum amount is ₦${MAX_AMOUNT.toLocaleString()}`;
    }

    if (!email || !email.includes('@')) {
      return "Please enter a valid email address";
    }

    return "";
  };

  const handleCreateVirtualAccount = async () => {
    const errorMsg = validate();
    if (errorMsg) {
      setPaymentError(errorMsg);
      return;
    }

    setLoading(true);
    setPaymentError("");
    setPaymentSuccess("");

    try {
      console.log("Creating virtual account with:", {
        amount: Number(amount),
        email: email,
      });

      const res = await walletService.initializeDeposit(Number(amount), email);
      
      console.log("API Response:", res.data);

      if (res.data?.status === true) {
        setVirtualAccount(res.data.virtual_account);
        setReference(res.data.reference);
        setPaymentStatus('created');
        setActiveStep(1);
        setTimeLeft(1800); // Reset timer
        startPolling(res.data.reference);
        
        setPaymentSuccess("Virtual account created successfully! Transfer the exact amount to complete your deposit.");
      } else {
        throw new Error(res.data?.message || "Failed to create virtual account");
      }
    } catch (err) {
      console.error("Error creating virtual account:", err);
      console.error("Error response:", err.response?.data);
      
      const msg = err?.response?.data?.message || 
                  err?.response?.data?.error ||
                  err?.message || 
                  "Payment initialization failed. Please try again.";
      setPaymentError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setShowCopiedSnackbar(true);
    setTimeout(() => {
      setCopiedField(null);
      setShowCopiedSnackbar(false);
    }, 2000);
  };

  const handleRefreshStatus = async () => {
    if (!reference) return;
    
    setRefreshing(true);
    setPaymentError("");

    try {
      console.log("Refreshing status for reference:", reference);
      const response = await walletService.checkPaymentStatus(reference);
      console.log("Refresh response:", response.data);

      // Check if completed using meta.status
      const isCompleted = 
        response.data?.meta?.status === 'completed' ||
        response.data?.status === 'completed' ||
        response.data?.transaction_status === 'COMPLETED';

      if (isCompleted) {
        setPaymentStatus('completed');
        setActiveStep(2);
        setPaymentSuccess(`Payment of ₦${Number(amount).toLocaleString()} confirmed!`);
        setTransactionDetails(response.data);
        
        await refreshWallet();
        if (onSuccess) onSuccess(response.data);
      } else {
        // Don't show error, just inform user it's still pending
        setPaymentSuccess("Payment is still being processed. Please wait a few more minutes.");
        setTimeout(() => setPaymentSuccess(""), 5000);
      }
    } catch (err) {
      console.error("Refresh error:", err);
      setPaymentError("Unable to check payment status. Please try again.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleContactSupport = () => {
    setSupportAttempts(prev => prev + 1);
    
    const subject = encodeURIComponent(`Payment Issue - Reference: ${reference}`);
    const body = encodeURIComponent(
      `Hello Support,\n\nI've made a transfer but my wallet hasn't been credited after waiting.\n\n` +
      `Transaction Details:\n` +
      `- Reference: ${reference}\n` +
      `- Amount: ₦${amount}\n` +
      `- Date: ${new Date().toLocaleString()}\n` +
      `- Bank: ${virtualAccount?.bank_name}\n` +
      `- Account Number: ${virtualAccount?.account_number}\n` +
      `- Account Name: ${virtualAccount?.account_name}\n\n` +
      `I've waited for ${Math.floor((1800 - timeLeft) / 60)} minutes. Please help verify this transaction.`
    );
    window.location.href = `mailto:support@veltoragames.com?subject=${subject}&body=${body}`;
  };

  const handleStartOver = () => {
    setAmount("");
    setVirtualAccount(null);
    setReference(null);
    setPaymentStatus("idle");
    setPaymentError("");
    setPaymentSuccess("");
    setActiveStep(0);
    setTimeLeft(1800);
    setPollCount(0);
    setSupportAttempts(0);
    setTransactionDetails(null);
    
    if (checkInterval) {
      clearInterval(checkInterval);
      setCheckInterval(null);
    }
  };

  const getStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Box>
            <TextField
              fullWidth
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              margin="normal"
              required
              disabled={loading}
              helperText="We'll send payment confirmation to this email"
              error={paymentError && paymentError.includes('email')}
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
              error={paymentError && paymentError.includes('amount')}
            />

            <Button
              fullWidth
              variant="contained"
              color="primary"
              onClick={handleCreateVirtualAccount}
              disabled={loading || !amount || !email}
              sx={{ 
                mt: 3, 
                mb: 2,
                py: 1.5,
                background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #FFA500 0%, #FFD700 100%)',
                }
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : "Generate Virtual Account"}
            </Button>

            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>Note:</strong> You'll receive a virtual account number to transfer funds into. 
                Your wallet will be credited automatically once payment is confirmed.
              </Typography>
            </Alert>
          </Box>
        );
      
      case 1:
        return virtualAccount && (
          <Box>
            <Alert severity="warning" sx={{ mb: 3 }}>
              <Typography variant="body2">
                <strong>⚠️ Important:</strong> Transfer the exact amount of <strong>₦{Number(amount).toLocaleString()}</strong> to the account below. 
                If you transfer a different amount, your wallet won't be credited automatically.
              </Typography>
            </Alert>

            <Paper elevation={0} sx={{ p: 3, bgcolor: 'background.default', borderRadius: 2, mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AccessTimeIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">
                    Time remaining: <strong>{formatTime(timeLeft)}</strong>
                  </Typography>
                </Box>
                <Chip 
                  label={`Ref: ${reference}`} 
                  size="small" 
                  variant="outlined"
                  sx={{ fontFamily: 'monospace' }}
                />
              </Box>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Bank Name
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="h6">{virtualAccount.bank_name}</Typography>
                  <Tooltip title={copiedField === 'bank' ? 'Copied!' : 'Copy'}>
                    <IconButton 
                      size="small" 
                      onClick={() => handleCopy(virtualAccount.bank_name, 'bank')}
                    >
                      {copiedField === 'bank' ? <CheckCircleIcon color="success" /> : <ContentCopyIcon />}
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Account Number
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="h4" sx={{ fontFamily: 'monospace', letterSpacing: 2, fontWeight: 'bold' }}>
                    {virtualAccount.account_number}
                  </Typography>
                  <Tooltip title={copiedField === 'number' ? 'Copied!' : 'Copy'}>
                    <IconButton 
                      onClick={() => handleCopy(virtualAccount.account_number, 'number')}
                    >
                      {copiedField === 'number' ? <CheckCircleIcon color="success" /> : <ContentCopyIcon />}
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Account Name
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="h6">{virtualAccount.account_name}</Typography>
                  <Tooltip title={copiedField === 'name' ? 'Copied!' : 'Copy'}>
                    <IconButton 
                      onClick={() => handleCopy(virtualAccount.account_name, 'name')}
                    >
                      {copiedField === 'name' ? <CheckCircleIcon color="success" /> : <ContentCopyIcon />}
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Exact Amount to Transfer
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="h4" sx={{ color: 'success.main', fontWeight: 'bold' }}>
                    ₦{Number(amount).toLocaleString()}
                  </Typography>
                  <Tooltip title={copiedField === 'amount' ? 'Copied!' : 'Copy'}>
                    <IconButton 
                      onClick={() => handleCopy(amount, 'amount')}
                    >
                      {copiedField === 'amount' ? <CheckCircleIcon color="success" /> : <ContentCopyIcon />}
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Auto-verification status */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary', mb: 2 }}>
                <AccountBalanceIcon fontSize="small" />
                <Typography variant="body2">
                  {pollCount < 180 
                    ? `Auto-verifying... (Polling: ${pollCount}/180)` 
                    : "Monitoring complete. Use refresh button to check status."}
                </Typography>
              </Box>

              {pollCount < 180 && (
                <LinearProgress 
                  sx={{ 
                    mb: 3, 
                    backgroundColor: 'rgba(255,215,0,0.2)',
                    '& .MuiLinearProgress-bar': { 
                      backgroundColor: '#FFD700' 
                    }
                  }} 
                />
              )}

              {/* Single Action Button - Refresh Only */}
              <Button
                fullWidth
                variant="contained"
                onClick={handleRefreshStatus}
                disabled={refreshing}
                sx={{ 
                  py: 1.5,
                  background: 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #1976D2 0%, #2196F3 100%)',
                  }
                }}
                startIcon={refreshing ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
              >
                {refreshing ? "Checking..." : "Check Payment Status"}
              </Button>

              {/* Support Contact - Shows after multiple refresh attempts or long wait */}
              {(pollCount > 60 || supportAttempts > 0) && (
                <Box sx={{ mt: 3 }}>
                  <Alert 
                    severity="info"
                    action={
                      <Button 
                        color="inherit" 
                        size="small" 
                        onClick={handleContactSupport}
                        startIcon={<SupportAgentIcon />}
                      >
                        Contact Support
                      </Button>
                    }
                  >
                    <Typography variant="body2">
                      Still waiting? Our support team can help.
                    </Typography>
                  </Alert>
                </Box>
              )}

              {/* Debug Info Toggle */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Button 
                  size="small" 
                  onClick={() => setShowDebugInfo(!showDebugInfo)}
                  sx={{ textTransform: 'none' }}
                >
                  {showDebugInfo ? 'Hide' : 'Show'} Technical Details
                </Button>
              </Box>

              {/* Debug Info */}
              {showDebugInfo && (
                <Accordion sx={{ mt: 2 }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="body2" color="text.secondary">
                      Transaction Details
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <pre style={{ fontSize: '11px', overflowX: 'auto' }}>
                      {JSON.stringify({
                        reference,
                        amount,
                        virtualAccount,
                        pollCount,
                        paymentStatus,
                        timeLeft
                      }, null, 2)}
                    </pre>
                  </AccordionDetails>
                </Accordion>
              )}
            </Paper>

            <Button
              fullWidth
              variant="text"
              onClick={handleStartOver}
              sx={{ mt: 1 }}
            >
              Start Over
            </Button>
          </Box>
        );
      
      case 2:
        return (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
              Payment Successful!
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              Your wallet has been credited with <strong>₦{Number(amount).toLocaleString()}</strong>
            </Typography>
            
            <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2, mb: 3 }}>
              <Typography variant="body2" color="text.secondary">
                Transaction Reference: <strong>{reference}</strong>
              </Typography>
              {transactionDetails?.meta?.completed_at && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Completed: {new Date(transactionDetails.meta.completed_at).toLocaleString()}
                </Typography>
              )}
            </Paper>
            
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button
                variant="contained"
                onClick={handleStartOver}
                sx={{ 
                  background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                }}
              >
                Make Another Deposit
              </Button>
              
              <Button
                variant="outlined"
                onClick={() => window.location.href = '/dashboard'}
              >
                Go to Dashboard
              </Button>
            </Box>
          </Box>
        );
      
      default:
        return null;
    }
  };

  return (
    <>
      <Card sx={{ maxWidth: 600, mx: "auto", mt: 4 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom align="center" sx={{ fontWeight: 'bold' }}>
            Fund Your Wallet
          </Typography>

          <Stepper activeStep={activeStep} sx={{ my: 3 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {paymentError && (
            <Alert 
              severity="error" 
              sx={{ mb: 2 }}
              onClose={() => setPaymentError("")}
            >
              {paymentError}
            </Alert>
          )}

          {paymentSuccess && (
            <Alert 
              severity="success" 
              sx={{ mb: 2 }}
              onClose={() => setPaymentSuccess("")}
            >
              {paymentSuccess}
            </Alert>
          )}

          {paymentStatus === 'expired' && (
            <Alert 
              severity="warning" 
              sx={{ mb: 2 }}
              action={
                <Button color="inherit" size="small" onClick={handleStartOver}>
                  Start Over
                </Button>
              }
            >
              Payment window expired. Please start a new deposit.
            </Alert>
          )}

          {getStepContent(activeStep)}

          {/* Info Alert */}
          {activeStep === 1 && paymentStatus !== 'completed' && (
            <Alert severity="info" sx={{ mt: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <InfoIcon sx={{ fontSize: 20 }} />
                <Box>
                  <Typography variant="body2" fontWeight="bold">
                    ⚡ Automatic Verification
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Your payment will be verified automatically. Just wait a few moments after transferring - 
                    no need to click any additional buttons.
                  </Typography>
                </Box>
              </Box>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Copied Snackbar */}
      <Snackbar
        open={showCopiedSnackbar}
        autoHideDuration={2000}
        onClose={() => setShowCopiedSnackbar(false)}
        message="Copied to clipboard!"
      />
    </>
  );
};

export default OTPayVirtualPayment;