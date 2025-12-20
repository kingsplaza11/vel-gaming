import React, { useState } from 'react';
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
    MenuItem,
    Grid
} from '@mui/material';

// Nigerian banks (you can expand this list)
const NIGERIAN_BANKS = [
    { code: '044', name: 'Access Bank' },
    { code: '023', name: 'Citibank' },
    { code: '063', name: 'Diamond Bank' },
    { code: '050', name: 'Ecobank Nigeria' },
    { code: '070', name: 'Fidelity Bank' },
    { code: '011', name: 'First Bank of Nigeria' },
    { code: '214', name: 'First City Monument Bank' },
    { code: '058', name: 'Guaranty Trust Bank' },
    { code: '030', name: 'Heritage Bank' },
    { code: '301', name: 'Jaiz Bank' },
    { code: '082', name: 'Keystone Bank' },
    { code: '014', name: 'MainStreet Bank' },
    { code: '076', name: 'Polaris Bank' },
    { code: '221', name: 'Stanbic IBTC Bank' },
    { code: '232', name: 'Sterling Bank' },
    { code: '032', name: 'Union Bank of Nigeria' },
    { code: '033', name: 'United Bank for Africa' },
    { code: '215', name: 'Unity Bank' },
    { code: '035', name: 'Wema Bank' },
    { code: '057', name: 'Zenith Bank' }
];

const WithdrawalForm = () => {
    const [formData, setFormData] = useState({
        amount: '',
        account_number: '',
        bank_code: '',
        bank_name: '',
        account_name: ''
    });
    const [errors, setErrors] = useState({});
    
    const { withdrawFunds, wallet, loading, error } = useWallet();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));

        // Clear error for this field
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }

        // Auto-fill bank name when bank code is selected
        if (name === 'bank_code') {
            const selectedBank = NIGERIAN_BANKS.find(bank => bank.code === value);
            if (selectedBank) {
                setFormData(prev => ({
                    ...prev,
                    bank_name: selectedBank.name
                }));
            }
        }
    };

    const validateForm = () => {
        const newErrors = {};
        
        if (!formData.amount || parseFloat(formData.amount) < 100) {
            newErrors.amount = 'Minimum withdrawal amount is ₦100.00';
        }
        
        if (wallet && parseFloat(formData.amount) > wallet.balance) {
            newErrors.amount = 'Insufficient balance';
        }
        
        if (!formData.account_number || formData.account_number.length < 10) {
            newErrors.account_number = 'Valid account number is required (10 digits)';
        }
        
        if (!formData.bank_code) {
            newErrors.bank_code = 'Please select a bank';
        }
        
        if (!formData.account_name || formData.account_name.trim().length < 3) {
            newErrors.account_name = 'Valid account name is required';
        }
        
        return newErrors;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const formErrors = validateForm();
        if (Object.keys(formErrors).length > 0) {
            setErrors(formErrors);
            return;
        }
        
        const result = await withdrawFunds(formData);
        
        if (result.success) {
            alert('Withdrawal request submitted successfully!');
            setFormData({
                amount: '',
                account_number: '',
                bank_code: '',
                bank_name: '',
                account_name: ''
            });
        } else {
            alert('Withdrawal failed: ' + result.message);
        }
    };

    return (
        <Card sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
            <CardContent>
                <Typography variant="h5" gutterBottom>
                    Withdraw Funds
                </Typography>

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                {wallet && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                        Available Balance: ₦{wallet.balance.toLocaleString()}
                    </Alert>
                )}

                <Box component="form" onSubmit={handleSubmit}>
                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Amount (NGN)"
                                name="amount"
                                type="number"
                                value={formData.amount}
                                onChange={handleChange}
                                error={!!errors.amount}
                                helperText={errors.amount || 'Minimum: ₦100.00'}
                                required
                                inputProps={{ min: 100, step: 0.01 }}
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Account Number"
                                name="account_number"
                                value={formData.account_number}
                                onChange={handleChange}
                                error={!!errors.account_number}
                                helperText={errors.account_number}
                                required
                                inputProps={{ maxLength: 10 }}
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                select
                                label="Bank"
                                name="bank_code"
                                value={formData.bank_code}
                                onChange={handleChange}
                                error={!!errors.bank_code}
                                helperText={errors.bank_code}
                                required
                            >
                                <MenuItem value="">
                                    <em>Select a bank</em>
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
                                name="account_name"
                                value={formData.account_name}
                                onChange={handleChange}
                                error={!!errors.account_name}
                                helperText={errors.account_name}
                                required
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <Button
                                fullWidth
                                type="submit"
                                variant="contained"
                                color="primary"
                                disabled={loading}
                                sx={{ mt: 2 }}
                            >
                                {loading ? (
                                    <CircularProgress size={24} color="inherit" />
                                ) : (
                                    'Withdraw Funds'
                                )}
                            </Button>
                        </Grid>
                    </Grid>
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
                    Note: Withdrawals are processed within 24 hours. Please ensure your account details are correct.
                </Typography>
            </CardContent>
        </Card>
    );
};

export default WithdrawalForm;