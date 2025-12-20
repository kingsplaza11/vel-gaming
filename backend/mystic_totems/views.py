from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from decimal import Decimal

from .models import MysticTotemSession
from .services import reveal_totem
from engine.wallet import debit_wallet, credit_wallet

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def start_game(request):
    stake = Decimal(request.data["stake"])
    debit_wallet(request.user, stake)
    session = MysticTotemSession.objects.create(user=request.user, stake=stake)
    return Response({"session_id": session.id})

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def reveal(request, session_id):
    session = MysticTotemSession.objects.get(id=session_id, user=request.user)
    if not session.active:
        return Response({"error": "Game over"}, status=400)
    return Response(reveal_totem(session))

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def cash_out(request, session_id):
    session = MysticTotemSession.objects.get(id=session_id, user=request.user)
    if not session.active:
        return Response({"error": "Ended"}, status=400)
    payout = session.stake * session.multiplier
    session.active = False
    session.save()
    credit_wallet(request.user, payout)
    return Response({"payout": float(payout)})
