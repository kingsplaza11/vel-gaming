# wallets/otpay_service.py
import requests
import hmac
import hashlib
import logging
import re
import json
from decimal import Decimal
from django.conf import settings
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class OTPayService:
    """
    OT-PAY API Integration
    Based on documentation: https://otpay.ng/api/v1/
    """
    
    def __init__(self):
        self.base_url = "https://otpay.ng/api/v1"
        self.api_key = getattr(settings, 'OTPAY_API_KEY', None)
        self.secret_key = getattr(settings, 'OTPAY_SECRET_KEY', None)
        self.business_code = getattr(settings, 'OTPAY_BUSINESS_CODE', None)
        
        # Increase timeout values
        self.connect_timeout = getattr(settings, 'OTPAY_CONNECT_TIMEOUT', 15)
        self.read_timeout = getattr(settings, 'OTPAY_READ_TIMEOUT', 45)
        self.max_retries = getattr(settings, 'OTPAY_MAX_RETRIES', 2)
        
        # Create session with retry strategy
        self.session = self._create_session()
        
        logger.info(f"OTPay Service initialized with base_url: {self.base_url}")
        logger.info(f"Timeouts - Connect: {self.connect_timeout}s, Read: {self.read_timeout}s, Max Retries: {self.max_retries}")
        
        # Only check for required credentials
        missing = []
        if not self.api_key:
            missing.append("OTPAY_API_KEY")
        if not self.secret_key:
            missing.append("OTPAY_SECRET_KEY")
        if not self.business_code:
            missing.append("OTPAY_BUSINESS_CODE")
            
        if missing:
            error_msg = f"OTPay missing credentials: {', '.join(missing)}"
            logger.error(error_msg)
            raise RuntimeError(error_msg)
    
    def _create_session(self):
        """Create a requests session with retry strategy"""
        session = requests.Session()
        
        # Define retry strategy
        retry_strategy = Retry(
            total=self.max_retries,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["HEAD", "GET", "POST", "PUT", "DELETE", "OPTIONS", "TRACE"],
            backoff_factor=1,
            raise_on_status=False
        )
        
        # Create adapter with retry strategy and timeouts
        adapter = HTTPAdapter(
            max_retries=retry_strategy,
            pool_connections=10,
            pool_maxsize=20
        )
        
        session.mount("http://", adapter)
        session.mount("https://", adapter)
        
        return session
    
    def _headers(self):
        """Generate headers for OTPay API requests"""
        return {
            "api-key": self.api_key,
            "secret-key": self.secret_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "Veltro-Games/1.0",
            "Connection": "keep-alive"
        }
    
    def _make_request(self, method, endpoint, **kwargs):
        """
        Make HTTP request with proper timeout handling
        This is the missing method that was causing the error
        """
        url = f"{self.base_url}{endpoint}" if endpoint.startswith('/') else f"{self.base_url}/{endpoint}"
        
        # Set default timeout if not provided
        if 'timeout' not in kwargs:
            kwargs['timeout'] = (self.connect_timeout, self.read_timeout)
        
        logger.info(f"Making {method} request to {url}")
        logger.debug(f"Request kwargs: {kwargs}")
        
        try:
            response = self.session.request(method, url, **kwargs)
            logger.info(f"Response received with status: {response.status_code}")
            return response
        except requests.exceptions.ConnectTimeout:
            logger.error(f"Connection timeout to {url}")
            raise
        except requests.exceptions.ReadTimeout:
            logger.error(f"Read timeout from {url}")
            raise
        except requests.exceptions.ConnectionError as e:
            logger.error(f"Connection error to {url}: {str(e)}")
            raise
        except requests.exceptions.RequestException as e:
            logger.error(f"Request error to {url}: {str(e)}")
            raise
    
    def _extract_json(self, text):
        """
        Extract JSON from response text that might have a number prefix
        Example: "22169497305{...}" -> {...}
        """
        # Try to find where JSON starts (first '{' or '[')
        json_start = re.search(r'[{\[]', text)
        if json_start:
            json_str = text[json_start.start():]
            logger.debug(f"Extracted JSON string: {json_str[:100]}...")
            return json_str
        return text
    
    def _handle_response(self, response):
        """Handle API response consistently with better error handling"""
        try:
            raw_text = response.text
            logger.debug(f"Raw response: {raw_text[:200]}")
            
            # Extract JSON part if there's a number prefix
            json_str = self._extract_json(raw_text)
            
            # Parse JSON
            data = json.loads(json_str)
            logger.debug(f"Parsed JSON data: {data}")
            
            # Check if response is successful (status code 200-299)
            if 200 <= response.status_code < 300:
                return {
                    "status": data.get("status", False),
                    "data": data,
                    "message": data.get("desc", "Success"),
                    "status_code": response.status_code,
                }
            else:
                return {
                    "status": False,
                    "message": data.get("desc", f"Request failed with status {response.status_code}"),
                    "data": data,
                    "status_code": response.status_code,
                }
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {str(e)}")
            logger.error(f"Raw text that failed: {response.text[:500]}")
            
            # Try one more time with more aggressive cleaning
            try:
                # Remove all non-JSON characters before the first '{' or '['
                cleaned = re.sub(r'^[^{[]*', '', response.text)
                data = json.loads(cleaned)
                logger.info(f"Successfully parsed after cleaning: {data}")
                
                return {
                    "status": data.get("status", False),
                    "data": data,
                    "message": data.get("desc", "Success"),
                    "status_code": response.status_code,
                }
            except:
                return {
                    "status": False,
                    "message": "Invalid response from OTPay",
                    "raw": response.text[:500],
                    "status_code": response.status_code
                }
        except Exception as e:
            logger.error(f"Unexpected error in response handling: {str(e)}")
            return {
                "status": False,
                "message": f"Error processing response: {str(e)}",
                "raw": response.text[:500],
                "status_code": response.status_code
            }
    
    def get_all_banks(self):
        """
        Get list of all banks
        GET https://otpay.ng/api/v1/get_banks
        """
        try:
            response = self._make_request(
                'GET',
                '/get_banks',
                headers=self._headers()
            )
            return self._handle_response(response)
        except requests.exceptions.Timeout:
            logger.error("OTPay get_banks timeout")
            return {"status": False, "message": "Request timeout - please try again"}
        except requests.exceptions.RequestException as e:
            logger.error(f"OTPay get_banks error: {str(e)}")
            return {"status": False, "message": f"Connection error: {str(e)}"}
    
    def create_virtual_account(self, phone, email, name, bank_codes=None):
        """
        Create a virtual account for a user
        POST https://otpay.ng/api/v1/create_virtual_account
        
        Args:
            phone: User's phone number
            email: User's email
            name: User's name
            bank_codes: List of bank codes (defaults to [100033] for Palmpay)
        """
        if bank_codes is None:
            bank_codes = [100033]  # Default to Palmpay
        
        payload = {
            "business_code": self.business_code,
            "phone": phone,
            "email": email,
            "bank_code": bank_codes,
            "name": name
        }
        
        logger.info(f"Creating virtual account for {email}")
        logger.debug(f"Payload: {payload}")
        
        try:
            response = self._make_request(
                'POST',
                '/create_virtual_account',
                json=payload,
                headers=self._headers()
            )
            return self._handle_response(response)
            
        except requests.exceptions.Timeout as e:
            logger.error(f"OTPay create_virtual_account timeout: {str(e)}")
            return {
                "status": False,
                "message": "The request timed out. Please try again in a few moments.",
                "timeout": True
            }
        except requests.exceptions.ConnectionError as e:
            logger.error(f"OTPay connection error: {str(e)}")
            return {
                "status": False,
                "message": "Unable to connect to payment service. Please check your internet connection.",
                "error": str(e)
            }
        except Exception as e:
            logger.error(f"OTPay create_virtual_account error: {str(e)}")
            return {
                "status": False,
                "message": "An unexpected error occurred. Please try again.",
                "error": str(e)
            }
    
    # wallets/otpay_service.py - Update the query_transaction method

    def query_transaction(self, reference=None, account_number=None, amount=None, order_number=None):
        """
        Query transaction status from OTPay
        POST https://otpay.ng/api/v1/query_transaction
        
        Args:
            reference: Transaction reference (our internal reference)
            account_number: Virtual account number
            amount: Amount paid (in Naira)
            order_number: OTPay order number (if available)
        """
        payload = {
            "business_code": self.business_code,
        }
        
        # Try different parameter combinations based on what OTPay expects
        if order_number:
            payload["order_number"] = order_number
        elif reference:
            # If we have our reference, maybe it's stored in OTPay's system
            payload["reference"] = reference
        elif account_number and amount:
            # Query by account and amount
            payload["account_number"] = account_number
            payload["amount"] = int(amount)
        elif account_number:
            # Query by account only
            payload["account_number"] = account_number
        
        logger.info(f"Querying transaction with payload: {payload}")
        
        try:
            response = self._make_request(
                'POST',
                '/query_transaction',
                json=payload,
                headers=self._headers()
            )
            return self._handle_response(response)
        except requests.exceptions.Timeout:
            logger.error("OTPay query_transaction timeout")
            return {"status": False, "message": "Request timeout - please try again"}
        except requests.exceptions.RequestException as e:
            logger.error(f"OTPay query_transaction error: {str(e)}")
            return {"status": False, "message": f"Connection error: {str(e)}"}

    # Add this to OTPayService

    def get_transaction_by_order(self, order_number):
        """
        Get transaction details by order number
        This might be the correct endpoint based on the error message
        """
        payload = {
            "business_code": self.business_code,
            "order_number": order_number
        }
        
        logger.info(f"Getting transaction by order: {order_number}")
        
        try:
            response = self._make_request(
                'POST',
                '/get_transaction',  # Try different endpoint
                json=payload,
                headers=self._headers()
            )
            return self._handle_response(response)
        except Exception as e:
            logger.error(f"Error getting transaction by order: {str(e)}")
            return {"status": False, "message": str(e)}
    
    def query_bank_account(self, bank_account_no, bank_code):
        """
        Query bank account details
        POST https://otpay.ng/api/v1/query_bank_account
        
        Args:
            bank_account_no: Account number to query
            bank_code: Bank code
        """
        payload = {
            "business_code": self.business_code,
            "bank_account_no": bank_account_no,
            "bank_code": bank_code
        }
        
        logger.info(f"Querying bank account: {bank_account_no}")
        
        try:
            response = self._make_request(
                'POST',
                '/query_bank_account',
                json=payload,
                headers=self._headers()
            )
            return self._handle_response(response)
        except requests.exceptions.Timeout:
            logger.error("OTPay query_bank_account timeout")
            return {"status": False, "message": "Request timeout - please try again"}
        except requests.exceptions.RequestException as e:
            logger.error(f"OTPay query_bank_account error: {str(e)}")
            return {"status": False, "message": f"Connection error: {str(e)}"}
    
    def initiate_payout(self, bank_account_no, bank_code, amount):
        """
        Initiate a payout transaction
        POST https://otpay.ng/api/v1/payout
        
        Args:
            bank_account_no: Recipient's account number
            bank_code: Recipient's bank code
            amount: Amount to payout (in Naira, not kobo)
        """
        payload = {
            "business_code": self.business_code,
            "bank_account_no": bank_account_no,
            "bank_code": bank_code,
            "amount": int(amount)  # Amount in Naira
        }
        
        logger.info(f"Initiating payout of ₦{amount} to {bank_account_no}")
        
        try:
            response = self._make_request(
                'POST',
                '/payout',
                json=payload,
                headers=self._headers()
            )
            return self._handle_response(response)
        except requests.exceptions.Timeout:
            logger.error("OTPay payout timeout")
            return {"status": False, "message": "Payout request timeout - please try again"}
        except requests.exceptions.RequestException as e:
            logger.error(f"OTPay payout error: {str(e)}")
            return {"status": False, "message": f"Connection error: {str(e)}"}