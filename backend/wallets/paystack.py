import requests
import hmac
import hashlib
from django.conf import settings

class PaystackService:
    base_url = "https://api.paystack.co"

    def _headers(self):
        if not settings.PAYSTACK_SECRET_KEY:
            raise RuntimeError("PAYSTACK_SECRET_KEY is not set")

        return {
            "Authorization": f"Bearer {settings.PAYSTACK_SECRET_KEY}",
            "Content-Type": "application/json",
        }

    def initialize_transaction(self, email, amount, reference, metadata=None):
        payload = {
            "email": email,
            "amount": int(amount * 100),
            "reference": reference,
            "currency": "NGN",
            "metadata": metadata or {},
        }

        if getattr(settings, "PAYSTACK_CALLBACK_URL", None):
            payload["callback_url"] = settings.PAYSTACK_CALLBACK_URL

        res = requests.post(
            f"{self.base_url}/transaction/initialize",
            json=payload,
            headers=self._headers(),
            timeout=30,
        )

        return res.json()

    def verify_transaction(self, reference):
        res = requests.get(
            f"{self.base_url}/transaction/verify/{reference}",
            headers=self._headers(),
            timeout=30,
        )
        return res.json()

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
        return res.json()

    def initiate_transfer(self, amount, recipient_code, reason):
        payload = {
            "source": "balance",
            "amount": int(amount * 100),
            "recipient": recipient_code,
            "reason": reason,
        }

        res = requests.post(
            f"{self.base_url}/transfer",
            json=payload,
            headers=self._headers(),
            timeout=30,
        )
        return res.json()

    def verify_webhook_signature(self, payload, signature):
        computed = hmac.new(
            settings.PAYSTACK_SECRET_KEY.encode(),
            payload,
            hashlib.sha512,
        ).hexdigest()

        return hmac.compare_digest(computed, signature)
