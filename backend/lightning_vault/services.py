from decimal import Decimal
from engine.probabilities import should_fail

TICK_GAIN = Decimal("0.05")

def tick(session):
    if should_fail(session.ticks, risk_scale=1.4):
        session.active = False
        session.save()
        return {"status": "exploded"}

    session.ticks += 1
    session.multiplier += TICK_GAIN
    session.save()

    return {
        "status": "charging",
        "multiplier": float(session.multiplier)
    }
