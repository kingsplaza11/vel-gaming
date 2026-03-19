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
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import InfoIcon from '@mui/icons-material/Info';
import HistoryIcon from '@mui/icons-material/History';

const BankDepositPayment = ({ user, onSuccess }) => {
  const { refreshWallet } = useWallet();
  const [amount, setAmount] = useState("");
  const [sourceBankName, setSourceBankName] = useState("");
  const [sourceAccountNumber, setSourceAccountNumber] = useState("");
  const [sourceAccountName, setSourceAccountName] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState("");
  const [depositRequest, setDepositRequest] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState("idle"); // idle, created, completed, expired
  const [copiedField, setCopiedField] = useState(null);
  const [timeLeft, setTimeLeft] = useState(86400); // 24 hours in seconds
  const [showCopiedSnackbar, setShowCopiedSnackbar] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [transactionDetails, setTransactionDetails] = useState(null);
  const [supportAttempts, setSupportAttempts] = useState(0);
  const [checkInterval, setCheckInterval] = useState(null);
  const [userDepositRequests, setUserDepositRequests] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [bankInfo, setBankInfo] = useState(null);

  const steps = ['Enter Amount', 'Make Transfer', 'Confirmation'];
  const [activeStep, setActiveStep] = useState(0);

  // Fetch user's deposit history on component mount
  useEffect(() => {
    fetchUserDepositRequests();
  }, []);

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

  // Auto-polling for payment status
  const startPolling = (ref) => {
    if (checkInterval) clearInterval(checkInterval);
    
    setPollCount(0);
    const maxPolls = 720; // Poll for 1 hour (720 * 5 seconds)
    
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
        const response = await walletService.checkDepositStatus(ref);
        
        if (response.data?.deposit_request?.status === 'completed') {
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

      const res = await walletService.createDepositRequest({
        amount: Number(amount),
        source_bank_name: sourceBankName,
        source_account_number: sourceAccountNumber,
        source_account_name: sourceAccountName,
      });

      console.log("API Response:", res);

      if (res?.status === true) {
        setDepositRequest(res.deposit_request);
        setBankInfo(res.deposit_request.bank_details);
        setPaymentStatus('created');
        setActiveStep(1);
        setTimeLeft(86400); // Reset timer to 24 hours
        startPolling(res.deposit_request.reference);
        
        setPaymentSuccess("Deposit request created successfully! Please complete your bank transfer.");
        
        // Refresh deposit requests list
        fetchUserDepositRequests();
      } else {
        throw new Error(res?.message || "Failed to create deposit request");
      }
    } catch (err) {
      console.error("Error creating deposit request:", err);
      console.error("Error response:", err.response?.data);
      
      const msg = err?.response?.data?.message || 
                  err?.response?.data?.error ||
                  err?.message || 
                  "Deposit request failed. Please try again.";
      setPaymentError(msg);
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
        setPaymentSuccess(res.message);
        setDepositRequest({
          ...depositRequest,
          status: res.deposit_request.status
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

  const handleRefreshStatus = async () => {
    if (!depositRequest?.reference) return;
    
    setRefreshing(true);
    setPaymentError("");

    try {
      console.log("Refreshing status for reference:", depositRequest.reference);
      const response = await walletService.checkDepositStatus(depositRequest.reference);
      console.log("Refresh response:", response);

      if (response.status && response.deposit_request) {
        const status = response.deposit_request.status;
        
        if (status === 'completed') {
          setPaymentStatus('completed');
          setActiveStep(2);
          setPaymentSuccess(`Payment of ₦${Number(amount).toLocaleString()} confirmed!`);
          setTransactionDetails(response);
          
          await refreshWallet();
          if (onSuccess) onSuccess(response);
        } else {
          setDepositRequest({
            ...depositRequest,
            status: status
          });
          
          if (status === 'processing') {
            setPaymentSuccess("Your payment has been received and is being verified by admin.");
          } else {
            setPaymentSuccess(`Current status: ${status}. Please wait for admin verification.`);
          }
          setTimeout(() => setPaymentSuccess(""), 5000);
        }
      }
    } catch (err) {
      console.error("Refresh error:", err);
      setPaymentError("Unable to check deposit status. Please try again.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleContactSupport = () => {
    setSupportAttempts(prev => prev + 1);
    
    const subject = encodeURIComponent(`Deposit Issue - Reference: ${depositRequest?.reference}`);
    const body = encodeURIComponent(
      `Hello Support,\n\nI've made a transfer but my deposit hasn't been confirmed after waiting.\n\n` +
      `Transaction Details:\n` +
      `- Reference: ${depositRequest?.reference}\n` +
      `- Amount: ₦${amount}\n` +
      `- Date: ${new Date().toLocaleString()}\n` +
      `- Bank: ${depositRequest?.bank_details?.bank_name}\n` +
      `- Account Number: ${depositRequest?.bank_details?.account_number}\n\n` +
      `I've waited for ${Math.floor((86400 - timeLeft) / 3600)} hours. Please help verify this transaction.`
    );
    window.location.href = `mailto:support@veltrogames.com?subject=${subject}&body=${body}`;
  };

  const handleStartOver = () => {
    setAmount("");
    setSourceBankName("");
    setSourceAccountNumber("");
    setSourceAccountName("");
    setDepositRequest(null);
    setBankInfo(null);
    setPaymentStatus("idle");
    setPaymentError("");
    setPaymentSuccess("");
    setActiveStep(0);
    setTimeLeft(86400);
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

            <Button
              fullWidth
              variant="contained"
              color="primary"
              onClick={handleCreateDepositRequest}
              disabled={loading || !amount}
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
              {loading ? <CircularProgress size={24} color="inherit" /> : "Proceed to Deposit"}
            </Button>

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

              {/* Current Status */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Current Status
                </Typography>
                <Chip 
                  label={depositRequest.status.toUpperCase()} 
                  color={
                    depositRequest.status === 'completed' ? 'success' :
                    depositRequest.status === 'pending' ? 'warning' :
                    depositRequest.status === 'processing' ? 'info' :
                    depositRequest.status === 'expired' ? 'default' : 'error'
                  }
                  sx={{ fontWeight: 'bold' }}
                />
              </Box>

              {/* I Have Made Payment Button */}
              {depositRequest.status === 'pending' && (
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
              )}

              {/* Refresh Button */}
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
                {refreshing ? "Checking..." : "Check Status"}
              </Button>

              {/* Support Contact - Shows after multiple refresh attempts or long wait */}
              {(pollCount > 120 || supportAttempts > 0) && (
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
                        reference: depositRequest.reference,
                        amount,
                        status: depositRequest.status,
                        pollCount,
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
              Deposit Request Received!
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              Your deposit request of <strong>₦{Number(amount).toLocaleString()}</strong> is currently pending review.
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              You will be notified once the payment has been completed by our admin team.
            </Typography>
            
            <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2, mb: 3 }}>
              <Typography variant="body2" color="text.secondary">
                Reference: <strong>{depositRequest?.reference}</strong>
              </Typography>
              {transactionDetails?.deposit_request?.completed_at && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Completed: {new Date(transactionDetails.deposit_request.completed_at).toLocaleString()}
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
              Deposit request expired. Please create a new deposit.
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
                    📝 How it works
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    1. Transfer the exact amount to the bank details above<br/>
                    2. Click "I Have Made Payment" after transferring<br/>
                    3. Admin will verify and credit your wallet within 24 hours
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