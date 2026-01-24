// src/pages/PaymentCallback.jsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Box, CircularProgress, Typography } from "@mui/material";

const PaymentCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Give Paystack webhook time to process (1.5–2s is enough)
    const timer = setTimeout(() => {
      navigate("/wallet", { replace: true });
    }, 1800);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      height="70vh"
    >
      <CircularProgress />
      <Typography mt={2}>
        Payment received. Updating your wallet…
      </Typography>
    </Box>
  );
};

export default PaymentCallback;
