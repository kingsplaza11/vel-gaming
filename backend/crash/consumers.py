import json
from decimal import Decimal
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from django.db import transaction, DatabaseError, models
from django.conf import settings
from django.core.cache import cache
import logging

from .models import GameRound, CrashBet, RiskSettings
from wallets.services import place_bet_atomic, cashout_atomic, process_auto_cashout
from wallets.models import Wallet

logger = logging.getLogger(__name__)

class CrashConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        if self.scope["user"].is_anonymous:
            await self.close()
            return

        self.user = self.scope["user"]
        self.mode = self.scope["url_route"]["kwargs"]["mode"]
        self.is_demo = self.mode == "demo"
        self.group_name = f"crash_{self.mode}"
        self.user_group_name = f"crash_user_{self.user.id}_{self.mode}"

        # Join both main group and user-specific group
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.channel_layer.group_add(self.user_group_name, self.channel_name)
        await self.accept()

        # Send current round info
        current_round = await self._get_current_round()
        if current_round:
            # Note: Your GameRound model doesn't have current_multiplier field
            # You might need to track this separately or calculate it
            await self.send_json({
                "event": "connected",
                "mode": self.mode,
                "data": {
                    "round_id": current_round.id,
                    "status": current_round.status,
                    "multiplier": 1.0,  # Starting multiplier
                    "phase": "running" if current_round.status == "RUNNING" else "betting"
                }
            })
        else:
            await self.send_json({
                "event": "connected",
                "mode": self.mode,
            })

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)
        await self.channel_layer.group_discard(self.user_group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        event = content.get("event")
        data = content.get("data") or {}

        if event == "place_bet":
            await self.handle_place_bet(data)
        elif event == "cashout":
            await self.handle_cashout(data)
        elif event == "cancel_auto_cashout":
            await self.handle_cancel_auto_cashout(data)

    @database_sync_to_async
    def _get_current_round(self):
        return GameRound.objects.filter(
            is_demo=self.is_demo, 
            status__in=["PENDING", "RUNNING"]
        ).order_by("-id").first()

    @database_sync_to_async
    def _get_active_bet(self, round_obj=None):
        """Get user's active bet for current round"""
        if not round_obj:
            round_obj = GameRound.objects.filter(is_demo=self.is_demo).order_by("-id").first()
        
        if not round_obj:
            return None
            
        return CrashBet.objects.filter(
            user=self.user,
            round=round_obj,
            status="ACTIVE",
            is_demo=self.is_demo
        ).first()

    @database_sync_to_async
    def _place_bet(self, user, amount, auto_cashout, ip, device_fp):
        with transaction.atomic():
            round_obj = GameRound.objects.filter(
                is_demo=self.is_demo, 
                status="PENDING"
            ).select_for_update().order_by("-id").first()
            
            if not round_obj:
                raise ValueError("No active betting round available")
            
            risk = RiskSettings.get()
            
            # Validate bet amount against risk settings
            if amount > risk.max_bet_per_player:
                raise ValueError(f"Maximum bet is ₦{risk.max_bet_per_player:,.2f}")
            
            if amount < risk.min_bet_per_player:
                raise ValueError(f"Minimum bet is ₦{risk.min_bet_per_player:,.2f}")
            
            # Check user's existing active bet (using unique_together constraint)
            existing_bet = CrashBet.objects.filter(
                user=user,
                round=round_obj,
                status="ACTIVE",
                is_demo=self.is_demo
            ).first()
            
            if existing_bet:
                raise ValueError("You already have an active bet in this round")
            
            # Check max bet per player per round
            total_player_bet = CrashBet.objects.filter(
                user=user,
                round=round_obj,
                is_demo=self.is_demo
            ).aggregate(total=models.Sum('bet_amount'))['total'] or Decimal('0')
            
            if total_player_bet + amount > risk.max_bet_per_player_per_round:
                raise ValueError(f"Maximum bet per round is ₦{risk.max_bet_per_player_per_round:,.2f}")
            
            # Calculate total exposure for the round
            total_exposure = CrashBet.objects.filter(
                round=round_obj, 
                status__in=["ACTIVE", "CASHED_OUT", "PENDING"]
            ).aggregate(total=models.Sum('bet_amount'))['total'] or Decimal('0')
            
            if total_exposure + amount > risk.max_exposure_per_round:
                raise ValueError("Round exposure limit reached")
            
            # Validate auto cashout if provided
            if auto_cashout:
                if auto_cashout < risk.min_auto_cashout:
                    raise ValueError(f"Minimum auto cashout is {risk.min_auto_cashout}x")
                if auto_cashout > risk.max_auto_cashout:
                    raise ValueError(f"Maximum auto cashout is {risk.max_auto_cashout}x")
            
            # Check user's wallet balance
            wallet = Wallet.objects.select_for_update().get(user=user, is_demo=self.is_demo)
            if wallet.balance < amount:
                raise ValueError("Insufficient balance")
            
            # Place bet atomically
            ref = f"CRASHBET-{round_obj.id}-{user.id}-{int(timezone.now().timestamp())}"
            new_balance = place_bet_atomic(user, amount, ref, is_demo=self.is_demo)
            
            # Create bet record
            bet = CrashBet.objects.create(
                user=user,
                round=round_obj,
                bet_amount=amount,
                auto_cashout=auto_cashout,
                status="ACTIVE",
                is_demo=self.is_demo,
                ip_address=ip,
                device_fingerprint=device_fp,
            )
            
            # Note: Your GameRound model doesn't have total_bets/total_amount fields
            # You might want to track these separately if needed
            
            return round_obj, bet, new_balance

    @database_sync_to_async
    def _cashout(self, user, bet_id, current_multiplier):
        """Process manual cashout by user"""
        with transaction.atomic():
            bet = CrashBet.objects.select_for_update().select_related('round').get(
                id=bet_id, 
                user=user, 
                is_demo=self.is_demo
            )
            
            if bet.status != "ACTIVE":
                raise ValueError("Bet is not active")
            
            round_obj = bet.round
            
            if round_obj.status != "RUNNING":
                raise ValueError("Cannot cashout - round is not running")
            
            # Ensure current multiplier is valid (not after crash)
            if round_obj.crash_point and current_multiplier > round_obj.crash_point:
                raise ValueError("Round has already crashed")
            
            # Calculate payout and validate max win
            payout = (bet.bet_amount * Decimal(str(current_multiplier))).quantize(Decimal("0.01"))
            
            risk = RiskSettings.get()
            if payout > risk.max_win_per_bet:
                raise ValueError(f"Maximum win per bet is ₦{risk.max_win_per_bet:,.2f}")
            
            # Process cashout
            ref = f"CRASHCASHOUT-{bet.id}-{int(timezone.now().timestamp())}"
            
            try:
                # Use atomic cashout service
                wallet_balance = cashout_atomic(user, bet, payout, ref, is_demo=self.is_demo)
                
                # Update bet status
                bet.status = "CASHED_OUT"
                bet.cashout_multiplier = Decimal(str(current_multiplier))
                bet.win_amount = payout
                bet.cashed_out_at = timezone.now()
                bet.save()
                
                # Note: Your GameRound model doesn't have total_cashed_out/total_payouts fields
                # You might want to track these separately if needed
                
                return bet, payout, round_obj, wallet_balance
                
            except Exception as e:
                logger.error(f"Cashout failed for bet {bet_id}: {str(e)}")
                raise ValueError("Cashout failed. Please try again.")

    @database_sync_to_async
    def _process_auto_cashout(self, round_obj, current_multiplier):
        """Process auto cashouts for all qualifying bets"""
        try:
            active_bets = CrashBet.objects.filter(
                round=round_obj,
                status="ACTIVE",
                auto_cashout__isnull=False,
                auto_cashout__lte=Decimal(str(current_multiplier)),
                is_demo=self.is_demo
            ).select_for_update().select_related('user')
            
            results = []
            for bet in active_bets:
                try:
                    payout = (bet.bet_amount * Decimal(str(current_multiplier))).quantize(Decimal("0.01"))
                    
                    # Validate max win
                    risk = RiskSettings.get()
                    if payout > risk.max_win_per_bet:
                        logger.warning(f"Auto cashout payout {payout} exceeds max win for bet {bet.id}")
                        continue
                    
                    ref = f"AUTOCASHOUT-{bet.id}-{int(timezone.now().timestamp())}"
                    
                    # Process auto cashout
                    wallet_balance = process_auto_cashout(bet.user, bet, payout, ref, is_demo=self.is_demo)
                    
                    # Update bet
                    bet.status = "CASHED_OUT"
                    bet.cashout_multiplier = Decimal(str(current_multiplier))
                    bet.win_amount = payout
                    bet.cashed_out_at = timezone.now()
                    bet.save()
                    
                    results.append({
                        'bet_id': bet.id,
                        'user_id': bet.user.id,
                        'username': bet.user.username,
                        'payout': payout,
                        'multiplier': current_multiplier,
                        'wallet_balance': wallet_balance
                    })
                    
                except Exception as e:
                    logger.error(f"Auto cashout failed for bet {bet.id}: {str(e)}")
                    continue
            
            return results
            
        except Exception as e:
            logger.error(f"Auto cashout processing failed: {str(e)}")
            return []

    @database_sync_to_async
    def _process_end_of_game_cashouts(self, round_obj, crash_multiplier):
        """Process all remaining active bets at the end of the game"""
        try:
            active_bets = CrashBet.objects.filter(
                round=round_obj,
                status="ACTIVE",
                is_demo=self.is_demo
            ).select_for_update().select_related('user')
            
            results = []
            for bet in active_bets:
                try:
                    # At crash, bets lose (status becomes LOST)
                    bet.status = "LOST"
                    # Note: Your model doesn't have crash_multiplier field on CrashBet
                    # You might want to store the crash point where bet lost
                    bet.save()
                    
                    results.append({
                        'bet_id': bet.id,
                        'user_id': bet.user.id,
                        'username': bet.user.username,
                        'status': 'LOST',
                        'crash_multiplier': crash_multiplier,
                        'lost_amount': bet.bet_amount
                    })
                    
                except Exception as e:
                    logger.error(f"End game processing failed for bet {bet.id}: {str(e)}")
                    continue
            
            return results
            
        except Exception as e:
            logger.error(f"End of game processing failed: {str(e)}")
            return []

    @database_sync_to_async
    def _cancel_auto_cashout(self, user, bet_id):
        """Cancel auto cashout setting for a bet"""
        with transaction.atomic():
            bet = CrashBet.objects.select_for_update().get(
                id=bet_id, 
                user=user, 
                status="ACTIVE",
                is_demo=self.is_demo
            )
            
            round_obj = bet.round
            if round_obj.status != "PENDING" and round_obj.status != "RUNNING":
                raise ValueError("Cannot modify auto cashout - round is not active")
            
            bet.auto_cashout = None
            bet.save()
            
            return bet

    async def handle_place_bet(self, data):
        user = self.scope["user"]
        amount = Decimal(str(data.get("amount", "0")))
        auto_cashout = data.get("auto_cashout")
        auto_cashout = Decimal(str(auto_cashout)) if auto_cashout else None

        ip = self.scope.get("client")[0] if self.scope.get("client") else "0.0.0.0"
        device_fp = data.get("device_fp", "")

        try:
            round_obj, bet, new_balance = await self._place_bet(user, amount, auto_cashout, ip, device_fp)
        except Exception as e:
            await self.send_json({
                "event": "bet_failed", 
                "error": str(e),
                "data": {"bet_amount": str(amount)}
            })
            return

        # Broadcast to all users
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "player.bet",
                "data": {
                    "user": user.username,
                    "bet_id": bet.id,
                    "amount": str(amount),
                    "auto_cashout": str(auto_cashout) if auto_cashout else None,
                    "timestamp": timezone.now().isoformat()
                },
            },
        )

        # Send confirmation to user
        await self.send_json({
            "event": "bet_accepted",
            "data": {
                "round_id": round_obj.id,
                "bet_id": bet.id,
                "amount": str(amount),
                "auto_cashout": str(auto_cashout) if auto_cashout else None,
                "balance": str(new_balance),
                "placed_at": bet.created_at.isoformat()
            }
        })

    async def handle_cashout(self, data):
        user = self.scope["user"]
        bet_id = data.get("bet_id")
        current_multiplier = Decimal(str(data.get("multiplier", "1.0")))
        
        try:
            bet, payout, round_obj, new_balance = await self._cashout(user, bet_id, current_multiplier)
        except Exception as e:
            await self.send_json({
                "event": "cashout_failed", 
                "error": str(e),
                "data": {"bet_id": bet_id, "multiplier": str(current_multiplier)}
            })
            return

        # Broadcast to all users
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "player.cashout",
                "data": {
                    "user": user.username,
                    "bet_id": bet.id,
                    "payout": str(payout),
                    "multiplier": str(bet.cashout_multiplier),
                    "cashout_type": "MANUAL",
                    "timestamp": timezone.now().isoformat()
                },
            },
        )

        # Send confirmation to user
        await self.send_json({
            "event": "cashout_success",
            "data": {
                "bet_id": bet.id,
                "payout": str(payout),
                "multiplier": str(bet.cashout_multiplier),
                "balance": str(new_balance),
                "cashout_type": "MANUAL",
                "cashed_out_at": bet.cashed_out_at.isoformat() if bet.cashed_out_at else timezone.now().isoformat()
            }
        })

    async def handle_cancel_auto_cashout(self, data):
        user = self.scope["user"]
        bet_id = data.get("bet_id")
        
        try:
            bet = await self._cancel_auto_cashout(user, bet_id)
        except Exception as e:
            await self.send_json({
                "event": "cancel_auto_cashout_failed", 
                "error": str(e),
                "data": {"bet_id": bet_id}
            })
            return

        await self.send_json({
            "event": "auto_cashout_cancelled",
            "data": {
                "bet_id": bet.id,
                "message": "Auto cashout disabled"
            }
        })

    # Group handlers from game engine
    async def round_start(self, event):
        await self.send_json({"event": "round_start", "data": event["data"]})

    async def round_countdown(self, event):
        await self.send_json({"event": "round_countdown", "data": event["data"]})

    async def round_lock_bets(self, event):
        await self.send_json({"event": "round_lock_bets", "data": event["data"]})

    async def round_multiplier(self, event):
        data = event["data"]
        current_multiplier = Decimal(str(data["multiplier"]))
        
        # Process auto cashouts when multiplier updates
        round_id = data.get("round_id")
        if round_id:
            # Get round object
            round_obj = await self._get_round_by_id(round_id)
            if round_obj:
                # Process auto cashouts
                auto_cashout_results = await self._process_auto_cashout(round_obj, current_multiplier)
                
                # If any auto cashouts happened, broadcast them
                if auto_cashout_results:
                    for result in auto_cashout_results:
                        await self.channel_layer.group_send(
                            self.group_name,
                            {
                                "type": "player.cashout",
                                "data": {
                                    "user": result['username'],
                                    "bet_id": result['bet_id'],
                                    "payout": str(result['payout']),
                                    "multiplier": str(result['multiplier']),
                                    "cashout_type": "AUTO",
                                    "timestamp": timezone.now().isoformat()
                                },
                            },
                        )
                        
                        # Send individual notification to user
                        await self.channel_layer.group_send(
                            f"crash_user_{result['user_id']}_{self.mode}",
                            {
                                "type": "bet.auto.cashout",
                                "data": {
                                    "bet_id": result['bet_id'],
                                    "multiplier": str(result['multiplier']),
                                    "payout": str(result['payout']),
                                    "balance": str(result['wallet_balance'])
                                }
                            }
                        )
        
        await self.send_json({"event": "multiplier_update", "data": data})

    @database_sync_to_async
    def _get_round_by_id(self, round_id):
        try:
            return GameRound.objects.get(id=round_id, is_demo=self.is_demo)
        except GameRound.DoesNotExist:
            return None

    async def round_crash(self, event):
        data = event["data"]
        crash_multiplier = Decimal(str(data["crash_point"]))
        round_id = data.get("round_id")
        
        if round_id:
            round_obj = await self._get_round_by_id(round_id)
            if round_obj:
                # Process all remaining bets as LOST
                crash_results = await self._process_end_of_game_cashouts(round_obj, crash_multiplier)
                
                # Send crash notifications to affected users
                if crash_results:
                    for result in crash_results:
                        await self.channel_layer.group_send(
                            f"crash_user_{result['user_id']}_{self.mode}",
                            {
                                "type": "bet.crashed",
                                "data": {
                                    "bet_id": result['bet_id'],
                                    "crash_multiplier": str(result['crash_multiplier']),
                                    "lost_amount": str(result['lost_amount'])
                                }
                            }
                        )
        
        await self.send_json({"event": "round_crash", "data": data})

    async def player_bet(self, event):
        await self.send_json({"event": "player_bet", "data": event["data"]})

    async def player_cashout(self, event):
        await self.send_json({"event": "player_cashout", "data": event["data"]})

    # User-specific handlers
    async def bet_auto_cashout(self, event):
        """Handle auto cashout notification for specific user"""
        await self.send_json({"event": "auto_cashout_triggered", "data": event["data"]})

    async def bet_crashed(self, event):
        """Handle crash notification for specific user"""
        await self.send_json({"event": "bet_crashed", "data": event["data"]})