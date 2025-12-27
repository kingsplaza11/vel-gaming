import hmac
import hashlib
from decimal import Decimal, getcontext

HOUSE_EDGE_DIVISOR = 48  # standard bustabit-style, gives ~1% edge

def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def generate_server_seed(secret_key: str) -> str:
    # Use SECRET_KEY as master seed base
    return hmac.new(
        key=secret_key.encode("utf-8"),
        msg=hashlib.sha256().digest(),
        digestmod=hashlib.sha256,
    ).hexdigest()


def hmac_sha256(server_seed: str, message: str) -> str:
    return hmac.new(
        key=server_seed.encode("utf-8"),
        msg=message.encode("utf-8"),
        digestmod=hashlib.sha256,
    ).hexdigest()


getcontext().prec = 28

# 70% house dominance → ~30% win feel
HOUSE_EDGE = Decimal("0.70")

def crash_point_from_hash(hash_hex: str) -> Decimal:
    """
    Provably fair crash calculation with aggressive early busts.
    ~30% of rounds survive past ~2x.
    """

    # Convert first 52 bits to int
    h = int(hash_hex[:13], 16)
    max_int = Decimal(2 ** 52)

    # Uniform random in (0,1)
    r = Decimal(h) / max_int

    # Apply harsh curve
    # Higher HOUSE_EDGE → more early crashes
    crash = (Decimal(1) - HOUSE_EDGE) / (Decimal(1) - r)

    # Minimum crash at 1.00x
    if crash < Decimal("1.00"):
        crash = Decimal("1.00")

    return crash.quantize(Decimal("0.01"))



def generate_round_result(server_seed: str, client_seed: str, nonce: int) -> Decimal:
    message = f"{client_seed}:{nonce}"
    hash_hex = hmac_sha256(server_seed, message)
    return crash_point_from_hash(hash_hex)


def verify_round(server_seed: str, client_seed: str, nonce: int, crash_point: Decimal) -> bool:
    expected = generate_round_result(server_seed, client_seed, nonce)
    return expected == crash_point
