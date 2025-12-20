from decimal import Decimal
from engine.probabilities import should_fail

TOTEM_BOOST = Decimal("0.22")

def reveal_totem(session):
    if should_fail(session.revealed, risk_scale=1.1):
        session.active = False
        session.save()
        return {"status": "cursed"}

    session.revealed += 1
    session.multiplier += TOTEM_BOOST
    session.save()

    return {
        "status": "ok",
        "multiplier": float(session.multiplier),
        "revealed": session.revealed
    }
