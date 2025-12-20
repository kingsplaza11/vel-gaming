# fortune/engine.py
from __future__ import annotations

import hmac
import hashlib
from dataclasses import dataclass
from decimal import Decimal, getcontext, ROUND_DOWN
from typing import Tuple
from django.utils import timezone

getcontext().prec = 36

D0 = Decimal("0")
D1 = Decimal("1")


def q8(x: Decimal) -> Decimal:
    return x.quantize(Decimal("0.00000001"), rounding=ROUND_DOWN)


def q12(x: Decimal) -> Decimal:
    return x.quantize(Decimal("0.000000000001"), rounding=ROUND_DOWN)


def clamp(x: Decimal, lo: Decimal, hi: Decimal) -> Decimal:
    return max(lo, min(hi, x))


@dataclass(frozen=True)
class StepConfig:
    target_rtp: Decimal
    win_prob_cap: Decimal
    max_steps: int
    max_multiplier: Decimal
    base_safe_prob: Decimal
    safe_prob_decay: Decimal
    min_safe_prob: Decimal


def seed_hash(seed: str) -> str:
    return hashlib.sha256(seed.encode("utf-8")).hexdigest()


def rng_u(server_seed: str, client_seed: str, nonce: str, step: int) -> Decimal:
    """
    Deterministic, audit-friendly RNG in [0,1).
    u = HMAC_SHA256(server_seed, f"{client_seed}:{nonce}:{step}") / 2^256
    """
    msg = f"{client_seed}:{nonce}:{step}".encode("utf-8")
    digest = hmac.new(server_seed.encode("utf-8"), msg, hashlib.sha256).digest()
    n = int.from_bytes(digest, "big")
    u = Decimal(n) / (Decimal(2) ** 256)
    return q12(u)


def safe_probability(step: int, cfg: StepConfig) -> Decimal:
    """
    Trap increases (safe decreases) as step grows.
    Step 1 is forced ≤ win_prob_cap to cap overall win-anything probability.
    """
    if step <= 1:
        p = min(cfg.base_safe_prob, cfg.win_prob_cap)
    else:
        p = cfg.base_safe_prob - (Decimal(step - 1) * cfg.safe_prob_decay)
        p = clamp(p, cfg.min_safe_prob, Decimal("0.99"))
        # Also ensure p never exceeds win_prob_cap? Not required for cumulative,
        # but keeps behavior consistent with "max win prob" interpretation.
        p = min(p, cfg.win_prob_cap)
    return q12(p)


def multiplier_for_survival(survival_prob: Decimal, cfg: StepConfig) -> Decimal:
    """
    Enforce RTP: E[payout] <= bet * target_rtp.
    If player cashes out at this survival_prob, expected multiplier is cfg.target_rtp / survival_prob.
    """
    if survival_prob <= D0:
        return Decimal("1.0")
    raw = cfg.target_rtp / survival_prob
    raw = clamp(raw, Decimal("1.0"), cfg.max_multiplier)
    return q8(raw)


def step_result(
    server_seed: str, client_seed: str, nonce: str, step: int, cfg: StepConfig
) -> Tuple[Decimal, Decimal, bool]:
    """
    Returns (u, p_safe, is_safe)
    """
    u = rng_u(server_seed, client_seed, nonce, step)
    p = safe_probability(step, cfg)
    is_safe = u < p
    return u, p, is_safe
