import requests
import hmac
import hashlib
from django.conf import settings


class PaystackService:
    base_url = "https://api.paystack.co"

    # ---------------------------------------------------
    # INTERNAL HEADERS
    # ---------------------------------------------------
    def _headers(self):
        if not settings.PAYSTACK_SECRET_KEY:
            raise RuntimeError("PAYSTACK_SECRET_KEY is not set")

        return {
            "Authorization": f"Bearer {settings.PAYSTACK_SECRET_KEY}",
            "Content-Type": "application/json",
        }

    # ---------------------------------------------------
    # INITIALIZE PAYMENT
    # amount MUST be in KOBO
    # ---------------------------------------------------
    def initialize_transaction(self, email, amount, reference, metadata=None):
        payload = {
            "email": email,
            "amount": int(amount),  # already kobo
            "reference": reference,
            "currency": "NGN",
            "callback_url": settings.PAYSTACK_CALLBACK_URL,
            "metadata": metadata or {},
        }

        res = requests.post(
            f"{self.base_url}/transaction/initialize",
            json=payload,
            headers=self._headers(),
            timeout=15,
        )

        return self._safe_json(res)

    # ---------------------------------------------------
    # VERIFY PAYMENT
    # ---------------------------------------------------
    def verify_transaction(self, reference):
        res = requests.get(
            f"{self.base_url}/transaction/verify/{reference}",
            headers=self._headers(),
            timeout=30,
        )
        return self._safe_json(res)

    # ---------------------------------------------------
    # RESOLVE BANK ACCOUNT (AUTO NAME)
    # ---------------------------------------------------
    def resolve_account_number(self, account_number, bank_code):
        res = requests.get(
            f"{self.base_url}/bank/resolve",
            params={
                "account_number": account_number,
                "bank_code": bank_code,
            },
            headers=self._headers(),
            timeout=15,
        )
        return self._safe_json(res)

    # ---------------------------------------------------
    # CREATE TRANSFER RECIPIENT
    # ---------------------------------------------------
    def create_transfer_recipient(self, name, account_number, bank_code):
        payload = {
            "type": "nuban",
            "name": name,
            "account_number": account_number,
            "bank_code": bank_code,
            "currency": "NGN",
        }

        res = requests.post(
            f"{self.base_url}/transferrecipient",
            json=payload,
            headers=self._headers(),
            timeout=30,
        )
        return self._safe_json(res)

    # ---------------------------------------------------
    # INITIATE TRANSFER
    # amount MUST be in KOBO
    # ---------------------------------------------------
    def initiate_transfer(self, amount, recipient_code, reason):
        payload = {
            "source": "balance",
            "amount": int(amount),  # already kobo (NO *100 HERE)
            "recipient": recipient_code,
            "reason": reason,
        }

        res = requests.post(
            f"{self.base_url}/transfer",
            json=payload,
            headers=self._headers(),
            timeout=30,
        )
        return self._safe_json(res)

    # ---------------------------------------------------
    # WEBHOOK SIGNATURE VERIFICATION
    # ---------------------------------------------------
    def verify_webhook_signature(self, payload, signature):
        computed = hmac.new(
            settings.PAYSTACK_SECRET_KEY.encode(),
            payload,
            hashlib.sha512,
        ).hexdigest()

        return hmac.compare_digest(computed, signature)

    # ---------------------------------------------------
    # SAFE JSON PARSER (IMPORTANT)
    # ---------------------------------------------------
    def _safe_json(self, response):
        try:
            return response.json()
        except ValueError:
            return {
                "status": False,
                "message": "Invalid response from Paystack",
                "raw": response.text,
            }
