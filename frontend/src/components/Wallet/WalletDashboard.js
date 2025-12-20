import React, { useState, useEffect } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import PaystackPayment from '../Payment/PaystackPayment';
import WithdrawalForm from '../Withdrawal/WithdrawalForm';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Grid,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    CircularProgress,
    Alert,
    Button,
    IconButton
} from '@mui/material';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router-dom';

const WalletDashboard = ({ user }) => {
    const navigate = useNavigate();
    const { 
        wallet, 
        transactions, 
        loading, 
        error,
        refreshWallet 
    } = useWallet();

    const [activeTab, setActiveTab] = useState('overview');

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleRefresh = async () => {
        await refreshWallet();
    };

    if (loading && !wallet) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3, maxWidth: 1200, margin: '0 auto' }}>
            {/* Back Button */}
            <Button
                startIcon={<Icon icon="mdi:arrow-left" />}
                onClick={() => navigate('/')}
                sx={{ mb: 3 }}
            >
                Back to Dashboard
            </Button>

            {/* Error Alert */}
            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                </Alert>
            )}

            {/* Header */}
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" gutterBottom>
                    <Icon icon="mdi:wallet" style={{ marginRight: '10px' }} />
                    My Wallet
                </Typography>
                <Typography color="textSecondary">
                    Manage your funds, deposit money, and withdraw winnings
                </Typography>
            </Box>

            {/* Tabs */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Button
                    onClick={() => setActiveTab('overview')}
                    sx={{ mr: 2 }}
                    color={activeTab === 'overview' ? 'primary' : 'inherit'}
                >
                    Overview
                </Button>
                <Button
                    onClick={() => setActiveTab('deposit')}
                    sx={{ mr: 2 }}
                    color={activeTab === 'deposit' ? 'primary' : 'inherit'}
                >
                    Deposit
                </Button>
                <Button
                    onClick={() => setActiveTab('withdraw')}
                    sx={{ mr: 2 }}
                    color={activeTab === 'withdraw' ? 'primary' : 'inherit'}
                >
                    Withdraw
                </Button>
                <Button
                    onClick={() => setActiveTab('transactions')}
                    color={activeTab === 'transactions' ? 'primary' : 'inherit'}
                >
                    Transactions
                </Button>
            </Box>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
                <Grid container spacing={3}>
                    {/* Wallet Summary Cards */}
                    <Grid item xs={12} md={4}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Available Balance
                                </Typography>
                                <Typography variant="h4" component="div" sx={{ color: 'success.main' }}>
                                    ₦{wallet?.balance?.toLocaleString() || '0.00'}
                                </Typography>
                                <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                                    Ready to use
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid item xs={12} md={4}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Locked Balance
                                </Typography>
                                <Typography variant="h4" component="div" sx={{ color: 'warning.main' }}>
                                    ₦{wallet?.locked_balance?.toLocaleString() || '0.00'}
                                </Typography>
                                <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                                    In pending transactions
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid item xs={12} md={4}>
                        <Card>
                            <CardContent>
                                <Typography color="textSecondary" gutterBottom>
                                    Demo Balance
                                </Typography>
                                <Typography variant="h4" component="div" sx={{ color: 'info.main' }}>
                                    ₦{wallet?.demo_balance?.toLocaleString() || '0.00'}
                                </Typography>
                                <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                                    Practice funds
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Quick Actions */}
                    <Grid item xs={12}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>
                                    Quick Actions
                                </Typography>
                                <Grid container spacing={2}>
                                    <Grid item xs={12} md={4}>
                                        <Button
                                            fullWidth
                                            variant="contained"
                                            color="primary"
                                            startIcon={<Icon icon="mdi:credit-card-plus" />}
                                            onClick={() => setActiveTab('deposit')}
                                            size="large"
                                        >
                                            Deposit Funds
                                        </Button>
                                    </Grid>
                                    <Grid item xs={12} md={4}>
                                        <Button
                                            fullWidth
                                            variant="outlined"
                                            color="primary"
                                            startIcon={<Icon icon="mdi:credit-card-minus" />}
                                            onClick={() => setActiveTab('withdraw')}
                                            size="large"
                                        >
                                            Withdraw Funds
                                        </Button>
                                    </Grid>
                                    <Grid item xs={12} md={4}>
                                        <Button
                                            fullWidth
                                            variant="outlined"
                                            startIcon={<Icon icon="mdi:refresh" />}
                                            onClick={handleRefresh}
                                            size="large"
                                        >
                                            Refresh Balance
                                        </Button>
                                    </Grid>
                                </Grid>
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Recent Transactions Preview */}
                    <Grid item xs={12}>
                        <Card>
                            <CardContent>
                                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                                    <Typography variant="h6">
                                        Recent Transactions
                                    </Typography>
                                    <Button onClick={() => setActiveTab('transactions')}>
                                        View All
                                    </Button>
                                </Box>
                                {transactions && transactions.length > 0 ? (
                                    <TableContainer component={Paper}>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>Date</TableCell>
                                                    <TableCell>Type</TableCell>
                                                    <TableCell>Amount</TableCell>
                                                    <TableCell>Status</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {transactions.slice(0, 5).map((tx) => (
                                                    <TableRow key={tx.id}>
                                                        <TableCell>{formatDate(tx.created_at)}</TableCell>
                                                        <TableCell>
                                                            <Chip
                                                                label={tx.tx_type}
                                                                color={tx.tx_type === 'CREDIT' ? 'success' : 'error'}
                                                                size="small"
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            ₦{parseFloat(tx.amount).toLocaleString()}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Chip
                                                                label={tx.meta?.status || 'pending'}
                                                                color={
                                                                    tx.meta?.status === 'completed' 
                                                                        ? 'success' 
                                                                        : tx.meta?.status === 'failed' 
                                                                            ? 'error' 
                                                                            : 'warning'
                                                                }
                                                                size="small"
                                                            />
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                ) : (
                                    <Typography color="textSecondary" align="center" sx={{ py: 4 }}>
                                        No transactions yet
                                    </Typography>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            )}

            {/* Deposit Tab */}
            {activeTab === 'deposit' && (
                <Grid container spacing={3}>
                    <Grid item xs={12} md={8}>
                        <PaystackPayment />
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>
                                    Deposit Tips
                                </Typography>
                                <ul style={{ paddingLeft: '20px' }}>
                                    <li style={{ marginBottom: '10px' }}>
                                        <Typography variant="body2">
                                            Minimum deposit: ₦100.00
                                        </Typography>
                                    </li>
                                    <li style={{ marginBottom: '10px' }}>
                                        <Typography variant="body2">
                                            Instant credit upon successful payment
                                        </Typography>
                                    </li>
                                    <li style={{ marginBottom: '10px' }}>
                                        <Typography variant="body2">
                                            Secure payment via Paystack
                                        </Typography>
                                    </li>
                                    <li>
                                        <Typography variant="body2">
                                            Contact support for deposit issues
                                        </Typography>
                                    </li>
                                </ul>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            )}

            {/* Withdraw Tab */}
            {activeTab === 'withdraw' && (
                <Grid container spacing={3}>
                    <Grid item xs={12}>
                        <WithdrawalForm />
                    </Grid>
                </Grid>
            )}

            {/* Transactions Tab */}
            {activeTab === 'transactions' && (
                <Grid container spacing={3}>
                    <Grid item xs={12}>
                        <Card>
                            <CardContent>
                                <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                                    <Typography variant="h6">
                                        Transaction History
                                    </Typography>
                                    <Button startIcon={<Icon icon="mdi:refresh" />} onClick={refreshWallet}>
                                        Refresh
                                    </Button>
                                </Box>
                                
                                {transactions && transactions.length > 0 ? (
                                    <TableContainer component={Paper}>
                                        <Table>
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>Date</TableCell>
                                                    <TableCell>Type</TableCell>
                                                    <TableCell>Amount</TableCell>
                                                    <TableCell>Reference</TableCell>
                                                    <TableCell>Status</TableCell>
                                                    <TableCell>Details</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {transactions.map((tx) => (
                                                    <TableRow key={tx.id}>
                                                        <TableCell>{formatDate(tx.created_at)}</TableCell>
                                                        <TableCell>
                                                            <Chip
                                                                label={tx.tx_type}
                                                                color={tx.tx_type === 'CREDIT' ? 'success' : 'error'}
                                                                size="small"
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            ₦{parseFloat(tx.amount).toLocaleString()}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Typography variant="caption">
                                                                {tx.reference}
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Chip
                                                                label={tx.meta?.status || 'pending'}
                                                                color={
                                                                    tx.meta?.status === 'completed' 
                                                                        ? 'success' 
                                                                        : tx.meta?.status === 'failed' 
                                                                            ? 'error' 
                                                                            : 'warning'
                                                                }
                                                                size="small"
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            {tx.meta?.purpose && (
                                                                <Typography variant="body2">
                                                                    {tx.meta.purpose}
                                                                </Typography>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                ) : (
                                    <Typography color="textSecondary" align="center" sx={{ py: 4 }}>
                                        No transactions found
                                    </Typography>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            )}

            {/* Footer Info */}
            <Box sx={{ mt: 4, pt: 3, borderTop: 1, borderColor: 'divider' }}>
                <Typography variant="body2" color="textSecondary">
                    <Icon icon="mdi:information" style={{ marginRight: '8px' }} />
                    Need help? Contact support at support@veltora.com or visit our Help Center.
                </Typography>
            </Box>
        </Box>
    );
};

export default WalletDashboard;