from decimal import Decimal
import random

MAX_WIN_PROB = Decimal("0.29")  # hard cap

def should_fail(step: int, risk_scale=1.0):
    """
    Probability increases with progress.
    Guaranteed house edge.
    """
    base = Decimal("0.08")
    step_risk = Decimal(step) * Decimal("0.015")
    prob = min(base + step_risk, MAX_WIN_PROB) * Decimal(risk_scale)

    return random.random() < float(prob)
