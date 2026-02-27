# wallets/otpay_service.py - Complete updated service with all methods

import requests
import hmac
import hashlib
import logging
import re
import json
import uuid
import random
import string
from decimal import Decimal
from django.conf import settings
from django.utils import timezone
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
    
    def get_available_banks(self):
        """
        Get list of top 30 popular banks that support virtual accounts
        Returns a list of bank codes with their names
        """
        # Top 30 popular banks from OTPay API response with correct codes
        banks = [
            # PSB & Mobile Money (Required ones first)
            {"code": "120001", "name": "9 PSB"},      # 9PSB
            {"code": "100033", "name": "PalmPay"},     # Palmpay
            {"code": "120003", "name": "MoMo PSB"},
            {"code": "120002", "name": "HopePSB"},
            {"code": "120005", "name": "Money Master PSB"},
            {"code": "100004", "name": "OPay"},
            {"code": "090405", "name": "Moniepoint"},
            {"code": "090267", "name": "Kuda MFB"},
            {"code": "090551", "name": "Fairmoney MFB"},
            {"code": "100026", "name": "CARBON"},
            
            # Major Commercial Banks
            {"code": "000014", "name": "Access Bank"},
            {"code": "000013", "name": "GTBank"},
            {"code": "000016", "name": "First Bank Of Nigeria"},
            {"code": "000004", "name": "United Bank For Africa"},
            {"code": "000015", "name": "Zenith Bank"},
            {"code": "000003", "name": "FCMB"},
            {"code": "000007", "name": "Fidelity Bank"},
            {"code": "000008", "name": "Polaris Bank"},
            {"code": "000011", "name": "UNITY BANK PLC"},
            {"code": "000017", "name": "Wema Bank"},
            {"code": "000001", "name": "Sterling Bank"},
            {"code": "000012", "name": "Stanbic IBTC Bank"},
            {"code": "000018", "name": "Union Bank Of Nigeria"},
            {"code": "000010", "name": "Ecobank Nigeria"},
            {"code": "000002", "name": "Keystone Bank"},
            {"code": "000006", "name": "Jaiz Bank"},
            {"code": "000027", "name": "Globus Bank"},
            {"code": "000030", "name": "PARALLEX BANK"},
            {"code": "000023", "name": "Providus Bank"},
            {"code": "000025", "name": "TITAN TRUST BANK"},
        ]
        return banks
    
    def create_virtual_account(self, phone, email, name, transaction_reference=None):
        """
        Create a NEW virtual account for a user - ULTRA AGGRESSIVE VERSION
        Forces new account creation every time by making ALL parameters unique
        
        Args:
            phone: User's phone number
            email: User's email
            name: User's name
            transaction_reference: Unique transaction reference to force new account creation
        """
        
        # Use only Palmpay (9PSB is temporarily unavailable)
        bank_codes = ["100033"]
        
        # Generate multiple layers of uniqueness
        timestamp = timezone.now().strftime('%Y%m%d%H%M%S%f')
        unique_id1 = uuid.uuid4().hex
        unique_id2 = uuid.uuid4().hex
        unique_id3 = uuid.uuid4().hex
        random_str1 = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
        random_str2 = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
        
        # Create transaction reference with high uniqueness
        unique_ref = transaction_reference or f"REF_{timestamp}_{unique_id1[:8]}_{random_str1}"
        
        # ===== MAKE EMAIL HIGHLY UNIQUE =====
        # Use + addressing with timestamp and multiple random components
        if '+' in email:
            # If email already has +, replace the suffix
            local_part, domain = email.split('@')
            base_local = local_part.split('+')[0]  # Get base part before any +
            unique_email = f"{base_local}+{timestamp}_{unique_id1[:6]}_{random_str1}@{domain}"
        else:
            # Add multiple + suffixes
            local_part, domain = email.split('@')
            unique_email = f"{local_part}+{timestamp}_{unique_id1[:6]}_{random_str1}_{unique_id2[:6]}@{domain}"
        
        # ===== MAKE PHONE HIGHLY UNIQUE =====
        # OTPay might use phone for deduplication, so we need to vary it
        # Keep the first 7 digits, randomize last 4
        if len(phone) >= 11:
            base_phone = phone[:7]  # Keep first 7 digits
            unique_phone = f"{base_phone}{random.randint(1000, 9999)}"
        else:
            # If phone is too short, pad and randomize
            base_phone = phone.zfill(11)[:7]
            unique_phone = f"{base_phone}{random.randint(1000, 9999)}"
        
        # ===== MAKE NAME HIGHLY UNIQUE =====
        # Add multiple random suffixes to name
        unique_name = f"{name}_{timestamp[-6:]}_{random_str1}_{unique_id1[:4]}"
        
        # ===== ADD CUSTOM UNIQUE IDENTIFIER =====
        # Some payment providers use external_id or custom fields for deduplication
        custom_id = f"EXT_{timestamp}_{unique_id1[:8]}_{unique_id2[:8]}"
        
        payload = {
            "business_code": self.business_code,
            "phone": unique_phone,           # Completely unique phone
            "email": unique_email,            # Completely unique email
            "bank_code": bank_codes,
            "name": unique_name,              # Completely unique name
            "reference": unique_ref,          # Unique reference
            "external_id": custom_id,         # Extra unique identifier
            "metadata": {
                "original_name": name,
                "original_email": email,
                "original_phone": phone,
                "created_at": str(timezone.now()),
                "timestamp": timestamp,
                "unique_id_1": unique_id1,
                "unique_id_2": unique_id2,
                "unique_id_3": unique_id3,
                "random_1": random_str1,
                "random_2": random_str2,
                "force_new": True,
                "transaction_ref": unique_ref
            },
            # Add additional fields that might be used for deduplication
            "customer_code": custom_id,
            "txn_ref": unique_ref,
            "request_id": unique_id1[:16]
        }
        
        logger.info("="*60)
        logger.info(f"CREATING NEW VIRTUAL ACCOUNT - ATTEMPT WITH ALL UNIQUE PARAMETERS")
        logger.info(f"Transaction Ref: {unique_ref}")
        logger.info(f"Original Email: {email}")
        logger.info(f"Unique Email: {unique_email}")
        logger.info(f"Original Phone: {phone}")
        logger.info(f"Unique Phone: {unique_phone}")
        logger.info(f"Original Name: {name}")
        logger.info(f"Unique Name: {unique_name}")
        logger.info(f"Custom ID: {custom_id}")
        logger.info("="*60)
        
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
                "message": f"An unexpected error occurred: {str(e)}",
                "error": str(e)
            }
    
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
    
    def get_transaction_by_order(self, order_number):
        """
        Get transaction details by order number
        """
        payload = {
            "business_code": self.business_code,
            "order_number": order_number
        }
        
        logger.info(f"Getting transaction by order: {order_number}")
        
        try:
            response = self._make_request(
                'POST',
                '/get_transaction',
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