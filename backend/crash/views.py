from decimal import Decimal
from rest_framework import generics, permissions, views, response, status
from .models import GameRound
from .serializers import GameRoundSerializer
from .provably_fair import verify_round

class RecentRoundsView(generics.ListAPIView):
    serializer_class = GameRoundSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        is_demo = self.request.query_params.get("is_demo") == "true"
        return GameRound.objects.filter(is_demo=is_demo).order_by("-id")[:50]


class VerifyRoundView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        server_seed = request.data.get("server_seed")
        client_seed = request.data.get("client_seed")
        nonce = int(request.data.get("nonce"))
        crash_point = Decimal(str(request.data.get("crash_point")))

        ok = verify_round(server_seed, client_seed, nonce, crash_point)
        return response.Response({"valid": ok})
