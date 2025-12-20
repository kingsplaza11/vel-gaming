import React, { useState } from 'react';
import { usePaystackPayment } from '../../hooks/usePaystackPayment';
import { usePaystack } from '../../hooks/usePaystack';
import { useWallet } from '../../contexts/WalletContext';
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
    DialogActions
} from '@mui/material';

const PaystackPayment = () => {
    const [amount, setAmount] = useState('');
    const [email, setEmail] = useState('');
    const [showSuccess, setShowSuccess] = useState(false);
    const [transactionRef, setTransactionRef] = useState('');
    const [paymentError, setPaymentError] = useState('');
    
    const { initializePayment } = usePaystackPayment();
    const { initializePayment: initBackendPayment, loading: initLoading, error: initError } = usePaystack();
    const { verifyTransaction, loading: verifyLoading } = useWallet();

    const handlePayment = async () => {
        if (!amount || !email) {
            setPaymentError('Please enter amount and email');
            return;
        }

        const amountNum = parseFloat(amount);
        if (amountNum < 100) {
            setPaymentError('Minimum amount is ₦100.00');
            return;
        }

        setPaymentError('');
        
        try {
            // First, initialize payment with backend to get reference
            const paymentData = await initBackendPayment(email, amountNum);
            
            // Configure Paystack payment
            const config = {
                publicKey: process.env.REACT_APP_PAYSTACK_PUBLIC_KEY,
                email: email,
                amount: amountNum * 100, // Convert to kobo
                reference: paymentData.reference,
                metadata: {
                    user_id: 'current_user', // Will be set properly in real implementation
                    custom_fields: [
                        {
                            display_name: "Purpose",
                            variable_name: "purpose",
                            value: "wallet_funding"
                        }
                    ]
                },
                callback: async (response) => {
                    console.log('Payment successful:', response);
                    
                    // Verify transaction with backend
                    const verification = await verifyTransaction(response.reference);
                    
                    if (verification.success) {
                        setTransactionRef(response.reference);
                        setShowSuccess(true);
                        setAmount('');
                        setEmail('');
                    } else {
                        setPaymentError('Payment verification failed: ' + verification.message);
                    }
                },
                onClose: () => {
                    console.log('Payment window closed');
                    // You can add any cleanup or notification here
                }
            };

            // Initialize Paystack payment
            await initializePayment(config);
            
        } catch (err) {
            console.error('Payment failed:', err);
            setPaymentError(err.message || 'Payment initialization failed');
        }
    };

    return (
        <Card sx={{ maxWidth: 500, mx: 'auto', mt: 4 }}>
            <CardContent>
                <Typography variant="h5" gutterBottom>
                    Fund Your Wallet
                </Typography>

                {(initError || paymentError) && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {paymentError || initError}
                    </Alert>
                )}

                <Box component="form" sx={{ mt: 2 }}>
                    <TextField
                        fullWidth
                        label="Email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        margin="normal"
                        required
                        disabled={initLoading || verifyLoading}
                    />

                    <TextField
                        fullWidth
                        label="Amount (NGN)"
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        margin="normal"
                        required
                        disabled={initLoading || verifyLoading}
                        inputProps={{ min: 100, step: 0.01 }}
                        helperText="Minimum amount: ₦100.00"
                    />

                    <Button
                        fullWidth
                        variant="contained"
                        color="primary"
                        onClick={handlePayment}
                        disabled={initLoading || verifyLoading || !amount || !email}
                        sx={{ mt: 3 }}
                    >
                        {initLoading || verifyLoading ? (
                            <CircularProgress size={24} color="inherit" />
                        ) : (
                            'Proceed to Payment'
                        )}
                    </Button>
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
                    Secure payment powered by Paystack
                </Typography>
            </CardContent>

            {/* Success Dialog */}
            <Dialog open={showSuccess} onClose={() => setShowSuccess(false)}>
                <DialogTitle>Payment Successful!</DialogTitle>
                <DialogContent>
                    <Alert severity="success" sx={{ mb: 2 }}>
                        Your wallet has been funded successfully.
                    </Alert>
                    <Typography variant="body2" color="text.secondary">
                        Transaction Reference: {transactionRef}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Funds will be available in your wallet immediately.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowSuccess(false)} variant="contained">
                        Close
                    </Button>
                </DialogActions>
            </Dialog>
        </Card>
    );
};

export default PaystackPayment;