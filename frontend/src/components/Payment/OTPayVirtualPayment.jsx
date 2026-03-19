// src/components/Payment/BankDepositPayment.jsx
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
} from "@mui/material";
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import InfoIcon from '@mui/icons-material/Info';
import HistoryIcon from '@mui/icons-material/History';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import HomeIcon from '@mui/icons-material/Home';

const BankDepositPayment = ({ user, onSuccess, onBack }) => {
  const { refreshWallet } = useWallet();
  const [amount, setAmount] = useState("");
  const [sourceBankName, setSourceBankName] = useState("");
  const [sourceAccountNumber, setSourceAccountNumber] = useState("");
  const [sourceAccountName, setSourceAccountName] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState("");
  const [depositRequest, setDepositRequest] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState("idle"); // idle, created, processing, completed, expired
  const [copiedField, setCopiedField] = useState(null);
  const [timeLeft, setTimeLeft] = useState(86400); // 24 hours in seconds
  const [showCopiedSnackbar, setShowCopiedSnackbar] = useState(false);
  const [userDepositRequests, setUserDepositRequests] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const steps = ['Enter Amount', 'Make Transfer', 'Confirmation'];
  const [activeStep, setActiveStep] = useState(0);

  // Fetch user's deposit history on component mount
  useEffect(() => {
    fetchUserDepositRequests();
  }, []);

  // Timer countdown for created deposits
  useEffect(() => {
    if (paymentStatus === 'created' && timeLeft > 0 && depositRequest?.expires_at) {
      const expiresAt = new Date(depositRequest.expires_at).getTime();
      const now = new Date().getTime();
      const remaining = Math.floor((expiresAt - now) / 1000);
      
      if (remaining <= 0) {
        setPaymentStatus('expired');
        setPaymentError('Deposit request expired. Please create a new one.');
      } else {
        setTimeLeft(remaining);
      }

      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setPaymentStatus('expired');
            setPaymentError('Deposit request expired. Please create a new one.');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [paymentStatus, depositRequest]);

  const fetchUserDepositRequests = async () => {
    try {
      const response = await walletService.getDepositRequests();
      if (response.status && response.deposit_requests) {
        setUserDepositRequests(response.deposit_requests);
      }
    } catch (error) {
      console.error("Error fetching deposit requests:", error);
    }
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins}m ${secs}s`;
    } else if (mins > 0) {
      return `${mins}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const validate = () => {
    const amountNum = Number(amount);

    if (!amount || Number.isNaN(amountNum)) {
      return "Please enter a valid amount";
    }

    if (amountNum < 3000) {
      return "Minimum deposit is ₦3000";
    }

    if (amountNum > 10000000) {
      return "Maximum deposit is ₦10,000,000";
    }

    return "";
  };

  const handleCreateDepositRequest = async () => {
    const errorMsg = validate();
    if (errorMsg) {
      setPaymentError(errorMsg);
      return;
    }

    setLoading(true);
    setPaymentError("");
    setPaymentSuccess("");

    try {
      console.log("Creating deposit request with amount:", Number(amount));

      const response = await walletService.createDepositRequest({
        amount: Number(amount),
        source_bank_name: sourceBankName,
        source_account_number: sourceAccountNumber,
        source_account_name: sourceAccountName,
      });

      if (response && response.data) {
        if (response.data.status === true) {
          setDepositRequest(response.data.deposit_request);
          setPaymentStatus('created');
          setActiveStep(1);
          setTimeLeft(86400);
          
          setPaymentSuccess("Deposit request created successfully! Please complete your bank transfer.");
          fetchUserDepositRequests();
        } else {
          throw new Error(response.data.message || "Failed to create deposit request");
        }
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (err) {
      console.error("Error creating deposit request:", err);
      
      let errorMessage = "Deposit request failed. Please try again.";
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setPaymentError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaid = async () => {
    if (!depositRequest) return;
    
    setLoading(true);
    
    try {
      const res = await walletService.markAsPaid({
        deposit_request_id: depositRequest.id
      });
      
      if (res?.status === true) {
        // Update status to processing
        setPaymentStatus('processing');
        setActiveStep(2); // Go directly to confirmation step
        
        // Update deposit request status
        setDepositRequest({
          ...depositRequest,
          status: 'processing'
        });
        
        // Refresh deposit requests
        fetchUserDepositRequests();
      } else {
        throw new Error(res?.message || "Failed to mark as paid");
      }
    } catch (err) {
      console.error("Error marking as paid:", err);
      setPaymentError(err?.message || "Failed to mark as paid. Please try again.");
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

  const handleContactSupport = () => {
    const subject = encodeURIComponent(`Deposit Issue - Reference: ${depositRequest?.reference}`);
    const body = encodeURIComponent(
      `Hello Support,\n\nI've made a transfer but my deposit hasn't been confirmed after waiting.\n\n` +
      `Transaction Details:\n` +
      `- Reference: ${depositRequest?.reference}\n` +
      `- Amount: ₦${amount}\n` +
      `- Date: ${new Date().toLocaleString()}\n` +
      `- Bank: ${depositRequest?.bank_details?.bank_name}\n` +
      `- Account Number: ${depositRequest?.bank_details?.account_number}\n\n` +
      `Please help verify this transaction.`
    );
    window.location.href = `mailto:support@veltrogames.com?subject=${subject}&body=${body}`;
  };

  const handleStartOver = () => {
    setAmount("");
    setSourceBankName("");
    setSourceAccountNumber("");
    setSourceAccountName("");
    setDepositRequest(null);
    setPaymentStatus("idle");
    setPaymentError("");
    setPaymentSuccess("");
    setActiveStep(0);
    setTimeLeft(86400);
  };

  const getStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Box>
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
              inputProps={{ min: 3000, max: 10000000, step: 100 }}
              helperText="Minimum: ₦3000 | Maximum: ₦10,000,000"
              error={paymentError && paymentError.includes('amount')}
            />

            <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
              Your Bank Details (Optional - helps us verify faster)
            </Typography>
            
            <TextField
              fullWidth
              label="Your Bank Name"
              value={sourceBankName}
              onChange={(e) => setSourceBankName(e.target.value)}
              margin="normal"
              disabled={loading}
              size="small"
            />
            
            <TextField
              fullWidth
              label="Your Account Number"
              value={sourceAccountNumber}
              onChange={(e) => setSourceAccountNumber(e.target.value)}
              margin="normal"
              disabled={loading}
              size="small"
              inputProps={{ maxLength: 10 }}
            />
            
            <TextField
              fullWidth
              label="Your Account Name"
              value={sourceAccountName}
              onChange={(e) => setSourceAccountName(e.target.value)}
              margin="normal"
              disabled={loading}
              size="small"
            />

            <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
              {onBack && (
                <Button
                  variant="outlined"
                  onClick={onBack}
                  startIcon={<ArrowBackIcon />}
                  sx={{ flex: 1 }}
                >
                  Back
                </Button>
              )}
              <Button
                fullWidth={!onBack}
                variant="contained"
                color="primary"
                onClick={handleCreateDepositRequest}
                disabled={loading || !amount}
                sx={{ 
                  flex: onBack ? 1 : 'none',
                  py: 1.5,
                  background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #FFA500 0%, #FFD700 100%)',
                  }
                }}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : "Proceed to Deposit"}
              </Button>
            </Box>

            {/* Show pending deposit requests */}
            {userDepositRequests.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => setShowHistory(!showHistory)}
                  startIcon={<HistoryIcon />}
                >
                  {showHistory ? 'Hide' : 'Show'} Recent Deposit Requests
                </Button>
                
                {showHistory && (
                  <Box sx={{ mt: 2 }}>
                    {userDepositRequests.slice(0, 3).map((req) => (
                      <Paper key={req.id} sx={{ p: 2, mb: 1, bgcolor: 'background.default' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box>
                            <Typography variant="body2" fontWeight="bold">
                              ₦{req.amount.toLocaleString()}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Ref: {req.reference}
                            </Typography>
                          </Box>
                          <Chip 
                            label={req.status} 
                            size="small"
                            color={
                              req.status === 'completed' ? 'success' :
                              req.status === 'pending' ? 'warning' :
                              req.status === 'processing' ? 'info' :
                              req.status === 'expired' ? 'default' : 'error'
                            }
                          />
                        </Box>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {new Date(req.created_at).toLocaleString()}
                        </Typography>
                      </Paper>
                    ))}
                  </Box>
                )}
              </Box>
            )}

            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>Note:</strong> After creating a deposit request, you'll receive bank details to transfer funds into. 
                Your deposit will be verified by admin after payment.
              </Typography>
            </Alert>
          </Box>
        );
      
      case 1:
        return depositRequest && (
          <Box>
            <Alert severity="warning" sx={{ mb: 3 }}>
              <Typography variant="body2">
                <strong>⚠️ Important:</strong> Transfer the exact amount of <strong>₦{Number(amount).toLocaleString()}</strong> to the account below. 
                After transferring, click "I Have Made Payment" to notify us.
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
                  label={`Ref: ${depositRequest.reference}`} 
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
                  <Typography variant="h6">{depositRequest.bank_details.bank_name}</Typography>
                  <Tooltip title={copiedField === 'bank' ? 'Copied!' : 'Copy'}>
                    <IconButton 
                      size="small" 
                      onClick={() => handleCopy(depositRequest.bank_details.bank_name, 'bank')}
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
                    {depositRequest.bank_details.account_number}
                  </Typography>
                  <Tooltip title={copiedField === 'number' ? 'Copied!' : 'Copy'}>
                    <IconButton 
                      onClick={() => handleCopy(depositRequest.bank_details.account_number, 'number')}
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
                  <Typography variant="h6">{depositRequest.bank_details.account_name}</Typography>
                  <Tooltip title={copiedField === 'name' ? 'Copied!' : 'Copy'}>
                    <IconButton 
                      onClick={() => handleCopy(depositRequest.bank_details.account_name, 'name')}
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

              {/* I Have Made Payment Button */}
              <Button
                fullWidth
                variant="contained"
                color="success"
                onClick={handleMarkAsPaid}
                disabled={loading}
                sx={{ 
                  py: 1.5,
                  mb: 2,
                  background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
                }}
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <CheckCircleIcon />}
              >
                {loading ? "Processing..." : "I Have Made Payment"}
              </Button>

              {/* Support Contact */}
              <Box sx={{ mt: 2 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={handleContactSupport}
                  startIcon={<SupportAgentIcon />}
                  color="info"
                >
                  Need Help? Contact Support
                </Button>
              </Box>
            </Paper>
          </Box>
        );
      
      case 2:
        return (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: 'success.main' }}>
              Thank You!
            </Typography>
            <Typography variant="h6" gutterBottom>
              Your deposit request has been received
            </Typography>
            
            <Paper elevation={0} sx={{ p: 3, bgcolor: 'background.default', borderRadius: 2, mb: 3 }}>
              <Typography variant="body1" paragraph>
                We are now processing your deposit of <strong>₦{Number(amount).toLocaleString()}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Reference: <strong>{depositRequest?.reference}</strong>
              </Typography>
              <Box sx={{ my: 2 }}>
                <Divider>
                  <Chip label="What happens next?" size="small" />
                </Divider>
              </Box>
              <Typography variant="body1" sx={{ mt: 2 }}>
                Sit back and relax while we verify your deposit. This might take a while as our team reviews the transaction.
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                You will receive an email confirmation once your wallet has been credited.
              </Typography>
            </Paper>
            
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 3 }}>
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
                startIcon={<HomeIcon />}
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

          {paymentSuccess && paymentStatus !== 'processing' && (
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
              Deposit request expired. Please create a new deposit.
            </Alert>
          )}

          {getStepContent(activeStep)}

          {/* Info Alert for Make Transfer step */}
          {activeStep === 1 && paymentStatus === 'created' && (
            <Alert severity="info" sx={{ mt: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <InfoIcon sx={{ fontSize: 20 }} />
                <Box>
                  <Typography variant="body2" fontWeight="bold">
                    📝 How it works
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    1. Transfer the exact amount to the bank details above<br/>
                    2. Click "I Have Made Payment" after transferring<br/>
                    3. We'll verify and credit your wallet
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

export default BankDepositPayment;