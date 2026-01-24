import time
from decimal import Decimal
from django.utils import timezone
from django.conf import settings
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from .models import GameRound, CrashBet, RiskSettings
from .provably_fair import generate_round_result, generate_server_seed, sha256_hex
from wallets.services import settle_lost_bet_atomic

BETTING_DURATION = 7    # seconds
TICK_INTERVAL = 0.05    # 20 FPS
COOLDOWN_DURATION = 3   # seconds


def create_new_round(is_demo: bool = False) -> GameRound:
    risk = RiskSettings.get()

    server_seed = generate_server_seed(settings.SECRET_KEY)
    server_seed_hash = sha256_hex(server_seed)
    client_seed = "global-client"

    last_round = GameRound.objects.filter(is_demo=is_demo).order_by("-id").first()
    nonce = last_round.nonce + 1 if last_round else 1

    crash_point = generate_round_result(server_seed, client_seed, nonce)

    if crash_point > risk.max_multiplier_cap:
        crash_point = Decimal(str(risk.max_multiplier_cap)).quantize(Decimal("0.01"))

    return GameRound.objects.create(
        server_seed=server_seed,
        server_seed_hash=server_seed_hash,
        client_seed=client_seed,
        nonce=nonce,
        crash_point=crash_point,
        is_demo=is_demo,
    )


def run_single_round(round_obj: GameRound, heartbeat=None):
    """
    Blocking loop for ONE round.
    heartbeat (optional): LockHeartbeat instance to keep Redis lock alive.
    """
    channel_layer = get_channel_layer()
    group_name = "crash_demo" if round_obj.is_demo else "crash_real"

    # 🔒 Heartbeat helper - tracks when we last called heartbeat
    last_heartbeat_time = time.time()
    HEARTBEAT_CHECK_INTERVAL = 5  # Check heartbeat every 5 seconds
    
    def check_heartbeat():
        """Call heartbeat if enough time has passed"""
        nonlocal last_heartbeat_time
        if heartbeat:
            current_time = time.time()
            if current_time - last_heartbeat_time >= HEARTBEAT_CHECK_INTERVAL:
                heartbeat.tick()
                last_heartbeat_time = current_time

    # 1️⃣ BETTING PHASE
    check_heartbeat()  # Initial heartbeat check
    
    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            "type": "round.start",
            "data": {
                "round_id": round_obj.id,
                "betting_duration": BETTING_DURATION,
                "crash_point": str(round_obj.crash_point),
                "server_seed_hash": round_obj.server_seed_hash,
            },
        },
    )

    round_obj.status = "PENDING"
    round_obj.save(update_fields=["status"])

    betting_end = time.time() + BETTING_DURATION
    while time.time() < betting_end:
        check_heartbeat()  # 🔒 Regular heartbeat check during betting
        
        remaining = betting_end - time.time()
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                "type": "round.countdown",
                "data": {"remaining": remaining},
            },
        )
        time.sleep(0.5)

    # 2️⃣ LOCK BETS → START FLIGHT
    check_heartbeat()  # 🔒 Before starting flight phase
    
    round_obj.status = "RUNNING"
    round_obj.started_at = timezone.now()
    round_obj.save(update_fields=["status", "started_at"])

    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            "type": "round.lock_bets",
            "data": {"round_id": round_obj.id},
        },
    )

    # 3️⃣ FLIGHT PHASE
    check_heartbeat()  # 🔒 Before flight starts
    
    start_time = time.time()
    crashed = False

    while not crashed:
        check_heartbeat()  # 🔒 Regular heartbeat check during flight
        
        elapsed = time.time() - start_time
        multiplier = Decimal(str(1.0025 ** (elapsed * 100))).quantize(Decimal("0.01"))

        if multiplier >= round_obj.crash_point:
            multiplier = round_obj.crash_point
            crashed = True

        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                "type": "round.multiplier",
                "data": {"multiplier": str(multiplier)},
            },
        )

        if not crashed:
            time.sleep(TICK_INTERVAL)

    # 4️⃣ CRASH
    check_heartbeat()  # 🔒 Before crash announcement
    
    round_obj.status = "CRASHED"
    round_obj.crashed_at = timezone.now()
    round_obj.save(update_fields=["status", "crashed_at"])

    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            "type": "round.crash",
            "data": {
                "round_id": round_obj.id,
                "crash_point": str(round_obj.crash_point),
                "server_seed": round_obj.server_seed,
                "client_seed": round_obj.client_seed,
                "nonce": round_obj.nonce,
            },
        },
    )

    # 5️⃣ SETTLE LOSERS - Process in batches with heartbeat checks
    check_heartbeat()  # 🔒 Before starting settlement
    
    bets = CrashBet.objects.filter(
        round=round_obj, status__in=["PENDING", "ACTIVE"]
    )
    
    # Process in smaller batches to allow heartbeat checks
    batch_size = 5
    bet_list = list(bets)
    
    for i in range(0, len(bet_list), batch_size):
        batch = bet_list[i:i + batch_size]
        for bet in batch:
            settle_lost_bet_atomic(bet, is_demo=bet.is_demo)
        
        check_heartbeat()  # 🔒 Check heartbeat after each batch

    round_obj.status = "SETTLED"
    round_obj.save(update_fields=["status"])

    # 6️⃣ COOLDOWN
    check_heartbeat()  # 🔒 Before starting cooldown
    
    cooldown_end = time.time() + COOLDOWN_DURATION
    while time.time() < cooldown_end:
        check_heartbeat()  # 🔒 Regular heartbeat check during cooldown
        time.sleep(0.5)
    
    # Final heartbeat check
    check_heartbeat()