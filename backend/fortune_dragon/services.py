from decimal import Decimal
from engine.probabilities import should_fail

ORB_MULTIPLIER = Decimal("0.18")

def collect_orb(session):
    if should_fail(session.step):
        session.active = False
        session.save()
        return {"status": "dragon_awake"}

    session.step += 1
    session.multiplier += ORB_MULTIPLIER
    session.save()

    return {
        "status": "ok",
        "multiplier": float(session.multiplier),
        "step": session.step
    }
