// src/pages/PaymentCallback.jsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { walletService } from "../../services/walletService";
import { CircularProgress, Box, Typography } from "@mui/material";

const PaymentCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference");

    if (!reference) {
      navigate("/wallet", { replace: true });
      return;
    }
    

    const verify = async () => {
      try {
        await walletService.verifyDeposit(reference);
      } catch (e) {
        // silent fail — webhook will still reconcile
      } finally {
            window.location.replace("/wallet");
        }
    };

    verify();
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
        Verifying your payment, please wait…
      </Typography>
    </Box>
  );
};

export default PaymentCallback;
