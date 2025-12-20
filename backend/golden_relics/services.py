from decimal import Decimal
from engine.probabilities import should_fail

DIG_REWARD = Decimal("0.27")

def dig(session):
    if session.digs >= session.max_digs:
        return {"status": "limit_reached"}

    if should_fail(session.digs, risk_scale=1.3):
        session.active = False
        session.save()
        return {"status": "curse"}

    session.digs += 1
    session.multiplier += DIG_REWARD
    session.save()

    return {
        "status": "treasure",
        "multiplier": float(session.multiplier),
        "digs_left": session.max_digs - session.digs
    }
