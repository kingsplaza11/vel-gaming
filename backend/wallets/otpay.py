# wallet/paystack.py (rename this file to payment_service.py or create a new one)
import requests
import hmac
import hashlib
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

class OTPayService:
    """
    OTPay Nigeria Payment Gateway Integration
    Based on documentation from https://otpay.ng
    """
    
    def __init__(self):
        self.base_url = "https://otpay.ng/api/v1"  # Confirm this with OTPay docs
        self.api_key = getattr(settings, 'OTPAY_API_KEY', None)
        self.secret_key = getattr(settings, 'OTPAY_SECRET_KEY', None)
        self.business_code = getattr(settings, 'OTPAY_BUSINESS_CODE', None)
        self.timeout = getattr(settings, 'OTPAY_TIMEOUT', 30)
        
        if not self.secret_key or not self.public_key:
            raise RuntimeError("OTPay API keys are not set in settings")
    
    def _headers(self):
        """Generate headers for OTPay API requests"""
        return {
            "Authorization": f"Bearer {self.secret_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
    
    def initialize_transaction(self, email, amount, reference, metadata=None, callback_url=None):
        """
        Initialize a payment transaction
        amount should be in kobo (multiply NGN by 100)
        """
        payload = {
            "email": email,
            "amount": int(amount),  # already in kobo
            "reference": reference,
            "currency": "NGN",
            "callback_url": callback_url or settings.OTPAY_CALLBACK_URL,
            "metadata": metadata or {},
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/transaction/initialize",
                json=payload,
                headers=self._headers(),
                timeout=30
            )
            return self._handle_response(response)
        except requests.RequestException as e:
            logger.error(f"OTPay initialization error: {str(e)}")
            return {
                "status": False,
                "message": "Unable to connect to payment gateway",
                "error": str(e)
            }
    
    def verify_transaction(self, reference):
        """Verify a transaction by reference"""
        try:
            response = requests.get(
                f"{self.base_url}/transaction/verify/{reference}",
                headers=self._headers(),
                timeout=30
            )
            return self._handle_response(response)
        except requests.RequestException as e:
            logger.error(f"OTPay verification error: {str(e)}")
            return {
                "status": False,
                "message": "Unable to verify transaction",
                "error": str(e)
            }
    
    def get_banks(self):
        """Get list of Nigerian banks"""
        try:
            response = requests.get(
                f"{self.base_url}/banks",
                headers=self._headers(),
                timeout=30
            )
            return self._handle_response(response)
        except requests.RequestException as e:
            logger.error(f"OTPay banks fetch error: {str(e)}")
            return {"status": False, "message": "Unable to fetch banks"}
    
    def resolve_account_number(self, account_number, bank_code):
        """Resolve bank account details"""
        try:
            response = requests.get(
                f"{self.base_url}/bank/resolve",
                params={
                    "account_number": account_number,
                    "bank_code": bank_code
                },
                headers=self._headers(),
                timeout=30
            )
            return self._handle_response(response)
        except requests.RequestException as e:
            logger.error(f"OTPay account resolution error: {str(e)}")
            return {
                "status": False,
                "message": "Unable to resolve account"
            }
    
    def verify_webhook_signature(self, payload, signature):
        """Verify webhook signature from OTPay"""
        computed = hmac.new(
            self.secret_key.encode('utf-8'),
            payload,
            hashlib.sha512
        ).hexdigest()
        
        return hmac.compare_digest(computed, signature)
    
    def _handle_response(self, response):
        """Handle API response consistently"""
        try:
            data = response.json()
            
            # OTPay might have different response structure
            # Adjust this based on their actual API response format
            if response.status_code in [200, 201]:
                return {
                    "status": True,
                    "data": data.get("data", {}),
                    "message": data.get("message", "Success"),
                }
            else:
                return {
                    "status": False,
                    "message": data.get("message", "Request failed"),
                    "data": data.get("data", {}),
                }
        except ValueError:
            return {
                "status": False,
                "message": "Invalid response from OTPay",
                "raw": response.text[:200]  # Truncate long responses
            }